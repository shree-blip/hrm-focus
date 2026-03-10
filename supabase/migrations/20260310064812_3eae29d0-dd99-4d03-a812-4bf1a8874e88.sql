
-- Add payroll_run_id column
ALTER TABLE public.payslip_files ADD COLUMN IF NOT EXISTS payroll_run_id UUID;

-- Create unique index for upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_payslip_files_run_employee
  ON public.payslip_files (payroll_run_id, employee_id)
  WHERE payroll_run_id IS NOT NULL AND employee_id IS NOT NULL;

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_payslip_files_user_id ON public.payslip_files (user_id);

-- Index for employee_id lookups (fallback query)
CREATE INDEX IF NOT EXISTS idx_payslip_files_employee_id ON public.payslip_files (employee_id);

-- Allow employees to see payslips linked via employee_id (fallback path)
CREATE POLICY "Users can view payslips by employee_id"
  ON public.payslip_files FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e
      JOIN public.profiles p ON p.id = e.profile_id
      WHERE p.user_id = auth.uid()
    )
  );
