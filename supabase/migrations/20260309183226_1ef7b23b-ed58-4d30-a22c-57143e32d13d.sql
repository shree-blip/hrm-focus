ALTER TABLE public.payroll_run_details
  ADD COLUMN IF NOT EXISTS paid_leave_days NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC DEFAULT 0;