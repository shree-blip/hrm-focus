
-- =============================================
-- EMPLOYEE LOAN MODULE - DATABASE SCHEMA
-- =============================================

-- 1. Add new columns to employees table
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS probation_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS position_level text DEFAULT 'entry';

-- 2. Loan officer roles
CREATE TABLE public.loan_officer_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_role text NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, loan_role)
);
ALTER TABLE public.loan_officer_roles ENABLE ROW LEVEL SECURITY;

-- 3. Loan requests
CREATE TABLE public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid REFERENCES public.employees(id),
  org_id uuid REFERENCES public.organizations(id),
  amount numeric NOT NULL CHECK (amount > 0),
  term_months integer NOT NULL CHECK (term_months >= 1 AND term_months <= 6),
  interest_rate numeric NOT NULL DEFAULT 5.0,
  reason_type text NOT NULL,
  estimated_monthly_installment numeric,
  auto_deduction_consent boolean NOT NULL DEFAULT false,
  declaration_signed boolean NOT NULL DEFAULT false,
  e_signature text,
  signed_at timestamptz,
  has_prior_outstanding boolean DEFAULT false,
  prior_outstanding_amount numeric DEFAULT 0,
  position_level text,
  max_eligible_amount numeric,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

-- 4. Confidential loan details (field-level security)
CREATE TABLE public.loan_request_confidential (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id) ON DELETE CASCADE,
  reason_details text,
  explanation text,
  supporting_doc_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_request_confidential ENABLE ROW LEVEL SECURITY;

-- 5. Loan approvals
CREATE TABLE public.loan_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id),
  approval_step text NOT NULL,
  reviewer_id uuid NOT NULL,
  decision text DEFAULT 'pending',
  notes text,
  eligibility_verified boolean DEFAULT false,
  position_verified boolean DEFAULT false,
  outstanding_checked boolean DEFAULT false,
  repayment_finalized boolean DEFAULT false,
  prioritization_applied boolean DEFAULT false,
  hr_recommendation text,
  budget_available boolean,
  cashflow_approved boolean,
  finalized_installment numeric,
  finalized_schedule jsonb,
  ceo_decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_approvals ENABLE ROW LEVEL SECURITY;

-- 6. Loan agreements
CREATE TABLE public.loan_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id),
  principal numeric NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 5.0,
  term_months integer NOT NULL,
  monthly_installment numeric NOT NULL,
  repayment_schedule jsonb NOT NULL,
  first_deduction_month text NOT NULL,
  agreement_text text,
  employee_signature text,
  employee_signed_at timestamptz,
  hr_signature text,
  hr_signed_at timestamptz,
  ceo_signature text,
  ceo_signed_at timestamptz,
  agreement_doc_path text,
  status text NOT NULL DEFAULT 'pending',
  disbursement_date date,
  disbursement_amount numeric,
  disbursement_sla_deadline date,
  sla_alert_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_agreements ENABLE ROW LEVEL SECURITY;

-- 7. Repayments
CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id),
  agreement_id uuid REFERENCES public.loan_agreements(id),
  employee_id uuid REFERENCES public.employees(id),
  user_id uuid NOT NULL,
  month_number integer NOT NULL,
  due_date date NOT NULL,
  principal_amount numeric NOT NULL,
  interest_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  deducted_at timestamptz,
  payroll_export_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

-- 8. Monthly budgets
CREATE TABLE public.loan_monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  total_budget numeric NOT NULL,
  allocated_amount numeric NOT NULL DEFAULT 0,
  set_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, year, month)
);
ALTER TABLE public.loan_monthly_budgets ENABLE ROW LEVEL SECURITY;

-- 9. Waiting list
CREATE TABLE public.loan_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id),
  priority_score integer NOT NULL DEFAULT 0,
  reason_type text,
  hire_date date,
  submitted_at timestamptz,
  deferred_month integer,
  deferred_year integer,
  reconfirm_required boolean DEFAULT false,
  reconfirmed boolean,
  reconfirmed_at timestamptz,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_waiting_list ENABLE ROW LEVEL SECURITY;

-- 10. Audit logs
CREATE TABLE public.loan_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid REFERENCES public.loan_requests(id),
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  document_accessed text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_audit_logs ENABLE ROW LEVEL SECURITY;

-- 11. Default events
CREATE TABLE public.loan_default_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id),
  repayment_id uuid REFERENCES public.loan_repayments(id),
  event_type text NOT NULL,
  description text,
  flagged_for_hr boolean DEFAULT true,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_default_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.has_loan_officer_role(_user_id uuid, _loan_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_officer_roles
    WHERE user_id = _user_id AND loan_role = _loan_role
  )
  OR has_role(_user_id, 'vp'::app_role)
  OR has_role(_user_id, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_loan_officer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_officer_roles WHERE user_id = _user_id
  )
  OR has_role(_user_id, 'vp'::app_role)
  OR has_role(_user_id, 'admin'::app_role)
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Loan officer roles
CREATE POLICY "Admins can manage loan officer roles" ON public.loan_officer_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));
CREATE POLICY "Users can view their own loan roles" ON public.loan_officer_roles
  FOR SELECT USING (user_id = auth.uid());

-- Loan requests
CREATE POLICY "Users can view own loan requests" ON public.loan_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Loan officers can view all loan requests" ON public.loan_requests
  FOR SELECT USING (is_loan_officer(auth.uid()));
CREATE POLICY "Users can create own loan requests" ON public.loan_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own draft requests" ON public.loan_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');
CREATE POLICY "Loan officers can update loan requests" ON public.loan_requests
  FOR UPDATE USING (is_loan_officer(auth.uid()));

-- Confidential details (STRICT)
CREATE POLICY "Users can view own confidential details" ON public.loan_request_confidential
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));
CREATE POLICY "Loan officers can view confidential details" ON public.loan_request_confidential
  FOR SELECT USING (is_loan_officer(auth.uid()));
CREATE POLICY "Users can insert own confidential details" ON public.loan_request_confidential
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));
CREATE POLICY "Loan officers can update confidential details" ON public.loan_request_confidential
  FOR UPDATE USING (is_loan_officer(auth.uid()));

-- Loan approvals
CREATE POLICY "Loan officers can manage approvals" ON public.loan_approvals
  FOR ALL USING (is_loan_officer(auth.uid()));
CREATE POLICY "Users can view own loan approvals" ON public.loan_approvals
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));

-- Agreements
CREATE POLICY "Users can view own agreements" ON public.loan_agreements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));
CREATE POLICY "Loan officers can manage agreements" ON public.loan_agreements
  FOR ALL USING (is_loan_officer(auth.uid()));
CREATE POLICY "Users can update own agreement signatures" ON public.loan_agreements
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));

-- Repayments
CREATE POLICY "Users can view own repayments" ON public.loan_repayments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Loan officers can manage repayments" ON public.loan_repayments
  FOR ALL USING (is_loan_officer(auth.uid()));

-- Monthly budgets
CREATE POLICY "Finance can manage budgets" ON public.loan_monthly_budgets
  FOR ALL USING (has_loan_officer_role(auth.uid(), 'finance_reviewer'));
CREATE POLICY "Loan officers can view budgets" ON public.loan_monthly_budgets
  FOR SELECT USING (is_loan_officer(auth.uid()));

-- Waiting list
CREATE POLICY "Loan officers can manage waiting list" ON public.loan_waiting_list
  FOR ALL USING (is_loan_officer(auth.uid()));
CREATE POLICY "Users can view own waiting list entry" ON public.loan_waiting_list
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.loan_requests lr WHERE lr.id = loan_request_id AND lr.user_id = auth.uid()
  ));

-- Audit logs
CREATE POLICY "Loan officers can view audit logs" ON public.loan_audit_logs
  FOR SELECT USING (is_loan_officer(auth.uid()));
CREATE POLICY "Authenticated can insert audit logs" ON public.loan_audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Default events
CREATE POLICY "Loan officers can manage default events" ON public.loan_default_events
  FOR ALL USING (is_loan_officer(auth.uid()));

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('loan-documents', 'loan-documents', false);

CREATE POLICY "Users can upload loan documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own loan documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Loan officers can view all loan documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'loan-documents' AND is_loan_officer(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_loan_requests_updated_at
  BEFORE UPDATE ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_approvals_updated_at
  BEFORE UPDATE ON public.loan_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_agreements_updated_at
  BEFORE UPDATE ON public.loan_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_repayments_updated_at
  BEFORE UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_monthly_budgets_updated_at
  BEFORE UPDATE ON public.loan_monthly_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_waiting_list_updated_at
  BEFORE UPDATE ON public.loan_waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_repayments;
