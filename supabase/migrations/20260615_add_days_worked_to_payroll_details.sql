-- Add days_worked column to payroll_run_details
-- Stores the number of unique calendar days the employee clocked in during the pay period

ALTER TABLE public.payroll_run_details
  ADD COLUMN IF NOT EXISTS days_worked integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.payroll_run_details.days_worked IS 'Actual attendance days (unique calendar dates with completed clock-in/out) in the pay period';
