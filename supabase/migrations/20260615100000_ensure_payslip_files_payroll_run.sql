-- Ensure payslip_files has payroll_run_id column and unique index.
-- This is a safety-net migration: the column/index may already exist
-- from 20260615_add_payroll_run_to_payslip_files.sql.

-- Add payroll_run_id column if missing
ALTER TABLE public.payslip_files
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE;

-- Index for fast lookup by payroll run
CREATE INDEX IF NOT EXISTS idx_payslip_files_payroll_run
  ON public.payslip_files(payroll_run_id);

-- Unique per (run, employee) for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_payslip_files_run_employee
  ON public.payslip_files(payroll_run_id, employee_id)
  WHERE payroll_run_id IS NOT NULL;

-- Also ensure employee RLS is broad enough:
-- employees should be able to read their own payslips by user_id OR employee_id.
-- The existing policy only checks user_id. Add a fallback policy for employee_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payslip_files'
      AND policyname = 'Users can view own payslips by employee_id'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Users can view own payslips by employee_id"
      ON public.payslip_files FOR SELECT
      USING (
        employee_id IN (
          SELECT e.id FROM public.employees e
          JOIN public.profiles p ON p.id = e.profile_id
          WHERE p.user_id = auth.uid()
        )
      )
    $$;
  END IF;
END $$;
