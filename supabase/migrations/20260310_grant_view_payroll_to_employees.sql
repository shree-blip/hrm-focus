-- Grant view_payroll permission to employees so they can access the
-- Payroll page and see the "My Payslips" tab.
-- Sensitive payroll data is already hidden in the UI via isVP checks,
-- and salary/employee data is protected by RLS.
UPDATE public.role_permissions
SET enabled = true
WHERE role = 'employee'
  AND permission = 'view_payroll';
