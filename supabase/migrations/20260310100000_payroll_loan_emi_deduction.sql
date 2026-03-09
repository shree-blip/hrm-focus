-- =============================================
-- PAYROLL ↔ LOAN EMI DEDUCTION
-- Adds loan_emi column to payroll_run_details
-- and payroll_run_id to loan_repayments for
-- preventing duplicate deductions
-- =============================================

-- 1. Add loan_emi column to payroll_run_details
ALTER TABLE public.payroll_run_details
  ADD COLUMN IF NOT EXISTS loan_emi numeric DEFAULT 0;

-- 2. Add payroll_run_id to loan_repayments (for dedup tracking)
ALTER TABLE public.loan_repayments
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL;

-- 3. Unique constraint to prevent double-deducting EMI for same loan
--    in the same payroll run
CREATE UNIQUE INDEX IF NOT EXISTS uq_loan_repayment_per_run
  ON public.loan_repayments (loan_request_id, payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

-- 4. RPC to record a payroll EMI deduction (with dedup + auto-close)
CREATE OR REPLACE FUNCTION public.record_payroll_emi_deduction(
  p_loan_request_id uuid,
  p_payroll_run_id uuid,
  p_emi_amount numeric,
  p_recorded_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_remaining numeric;
  v_month_number integer;
  v_interest numeric;
  v_principal numeric;
  v_new_balance numeric;
  v_repayment_id uuid;
  v_existing_id uuid;
  v_original_emi numeric;
BEGIN
  -- Dedup: check if EMI was already deducted for this loan + payroll run
  SELECT id INTO v_existing_id
  FROM loan_repayments
  WHERE loan_request_id = p_loan_request_id
    AND payroll_run_id = p_payroll_run_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EMI already deducted for this payroll run',
      'duplicate', true
    );
  END IF;

  -- Get the loan
  SELECT * INTO v_loan FROM loan_requests WHERE id = p_loan_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_loan.status NOT IN ('disbursed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan is not disbursed');
  END IF;

  v_remaining := COALESCE(v_loan.remaining_balance, v_loan.amount);
  v_original_emi := p_emi_amount;

  -- Cap EMI to remaining balance (don't over-deduct)
  IF p_emi_amount > v_remaining THEN
    p_emi_amount := v_remaining;
  END IF;

  -- Interest / principal split (3% annual, reducing balance)
  v_interest := ROUND(v_remaining * (3.0 / 100.0 / 12.0), 2);
  v_principal := ROUND(p_emi_amount - v_interest, 2);
  IF v_principal < 0 THEN
    v_principal := 0;
    v_interest := p_emi_amount;
  END IF;
  v_new_balance := ROUND(v_remaining - v_principal, 2);
  IF v_new_balance < 0 THEN v_new_balance := 0; END IF;

  -- Next month number
  SELECT COALESCE(MAX(month_number), 0) + 1 INTO v_month_number
  FROM loan_repayments WHERE loan_request_id = p_loan_request_id;

  -- Insert repayment record tied to payroll run
  INSERT INTO loan_repayments (
    loan_request_id, employee_id, user_id,
    month_number, due_date,
    principal_amount, interest_amount, total_amount,
    remaining_balance, status, deducted_at,
    payroll_run_id
  ) VALUES (
    p_loan_request_id, v_loan.employee_id, v_loan.user_id,
    v_month_number, CURRENT_DATE,
    v_principal, v_interest, p_emi_amount,
    v_new_balance, 'paid', now(),
    p_payroll_run_id
  )
  RETURNING id INTO v_repayment_id;

  -- Update remaining balance
  UPDATE loan_requests
  SET remaining_balance = v_new_balance, updated_at = now()
  WHERE id = p_loan_request_id;

  -- Auto-close if balance reaches 0
  IF v_new_balance <= 0 THEN
    UPDATE loan_requests
    SET status = 'closed', closed_at = now(), remaining_balance = 0, updated_at = now()
    WHERE id = p_loan_request_id;
  END IF;

  -- Audit log
  INSERT INTO loan_audit_logs (loan_request_id, user_id, action, details)
  VALUES (
    p_loan_request_id, p_recorded_by, 'payroll_emi_deducted',
    jsonb_build_object(
      'payroll_run_id', p_payroll_run_id,
      'emi_amount', p_emi_amount,
      'principal', v_principal,
      'interest', v_interest,
      'remaining_balance', v_new_balance,
      'month_number', v_month_number,
      'auto_closed', v_new_balance <= 0
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'repayment_id', v_repayment_id,
    'principal', v_principal,
    'interest', v_interest,
    'remaining_balance', v_new_balance,
    'auto_closed', v_new_balance <= 0,
    'capped', p_emi_amount < v_original_emi
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payroll_emi_deduction TO authenticated;
