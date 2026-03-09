-- Add paid/unpaid leave day columns to payroll_run_details
-- These track how many leave days were factored into each employee's payroll calculation.

ALTER TABLE payroll_run_details
  ADD COLUMN IF NOT EXISTS paid_leave_days   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC DEFAULT 0;

COMMENT ON COLUMN payroll_run_details.paid_leave_days   IS 'Number of approved paid-leave days in the pay period';
COMMENT ON COLUMN payroll_run_details.unpaid_leave_days IS 'Number of approved unpaid-leave days (Other Leave) in the pay period';
