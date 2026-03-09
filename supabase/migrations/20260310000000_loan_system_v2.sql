-- =============================================
-- LOAN SYSTEM V2 MIGRATION
-- 3% fixed interest, full workflow, repayment tracking
-- =============================================

-- 1. Add new columns to loan_requests for v2
ALTER TABLE public.loan_requests
  ADD COLUMN IF NOT EXISTS remaining_balance numeric,
  ADD COLUMN IF NOT EXISTS disbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS amortization_schedule jsonb;

-- 2. Update loan_policies to 3% fixed interest
UPDATE public.loan_policies SET interest_rate = 3;

-- 3. Add an RPC to record a repayment and auto-close
CREATE OR REPLACE FUNCTION public.record_loan_repayment(
  p_loan_request_id uuid,
  p_amount numeric,
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
  v_result jsonb;
BEGIN
  -- Get the loan
  SELECT * INTO v_loan FROM loan_requests WHERE id = p_loan_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_loan.status NOT IN ('disbursed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan is not in disbursed status');
  END IF;

  -- Get current remaining balance
  v_remaining := COALESCE(v_loan.remaining_balance, v_loan.amount);

  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount exceeds remaining balance');
  END IF;

  -- Calculate interest + principal split (3% annual, reducing balance)
  v_interest := ROUND(v_remaining * (3.0 / 100.0 / 12.0), 2);
  v_principal := ROUND(p_amount - v_interest, 2);
  IF v_principal < 0 THEN
    v_principal := 0;
    v_interest := p_amount;
  END IF;
  v_new_balance := ROUND(v_remaining - v_principal, 2);
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  -- Get next month number
  SELECT COALESCE(MAX(month_number), 0) + 1 INTO v_month_number
  FROM loan_repayments WHERE loan_request_id = p_loan_request_id;

  -- Insert repayment record
  INSERT INTO loan_repayments (
    loan_request_id,
    employee_id,
    user_id,
    month_number,
    due_date,
    principal_amount,
    interest_amount,
    total_amount,
    remaining_balance,
    status,
    deducted_at
  ) VALUES (
    p_loan_request_id,
    v_loan.employee_id,
    v_loan.user_id,
    v_month_number,
    CURRENT_DATE,
    v_principal,
    v_interest,
    p_amount,
    v_new_balance,
    'paid',
    now()
  )
  RETURNING id INTO v_repayment_id;

  -- Update remaining balance on loan_requests
  UPDATE loan_requests
  SET remaining_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_loan_request_id;

  -- Auto-close if balance is 0
  IF v_new_balance <= 0 THEN
    UPDATE loan_requests
    SET status = 'closed',
        closed_at = now(),
        remaining_balance = 0,
        updated_at = now()
    WHERE id = p_loan_request_id;
  END IF;

  -- Audit log
  INSERT INTO loan_audit_logs (loan_request_id, user_id, action, details)
  VALUES (
    p_loan_request_id,
    p_recorded_by,
    'repayment_recorded',
    jsonb_build_object(
      'amount', p_amount,
      'principal', v_principal,
      'interest', v_interest,
      'remaining_balance', v_new_balance,
      'month_number', v_month_number,
      'auto_closed', v_new_balance <= 0
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'repayment_id', v_repayment_id,
    'principal', v_principal,
    'interest', v_interest,
    'remaining_balance', v_new_balance,
    'auto_closed', v_new_balance <= 0
  );

  RETURN v_result;
END;
$$;

-- 4. Allow VP to update disbursed loans (for recording repayments / closing)
DROP POLICY IF EXISTS "VP can update assigned loans" ON public.loan_requests;
CREATE POLICY "VP can update assigned loans" ON public.loan_requests
FOR UPDATE
USING (has_role(auth.uid(), 'vp'::app_role) AND status IN ('pending_vp', 'approved', 'disbursed'));

-- 5. RPC permissions (callable by authenticated users with proper roles)
GRANT EXECUTE ON FUNCTION public.record_loan_repayment(uuid, numeric, uuid) TO authenticated;

-- 6. Add realtime for loan_repayments (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'loan_repayments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_repayments;
  END IF;
END $$;
