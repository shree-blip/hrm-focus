-- Link payslip_files to a specific payroll run so payslips are
-- traceable and can be regenerated / replaced per run.

ALTER TABLE public.payslip_files
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE;

-- Index for fast lookup by payroll run
CREATE INDEX IF NOT EXISTS idx_payslip_files_payroll_run
  ON public.payslip_files(payroll_run_id);

-- When payroll is re-run the system deletes old payslips for the same run
-- before inserting fresh ones, so a unique constraint per run+employee is helpful.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payslip_files_run_employee
  ON public.payslip_files(payroll_run_id, employee_id)
  WHERE payroll_run_id IS NOT NULL;
