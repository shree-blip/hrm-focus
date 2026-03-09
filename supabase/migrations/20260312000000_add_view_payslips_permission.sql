-- Add the view_payslips permission for all roles so every employee
-- can access their own payslip PDFs via the "My Payslips" tab.
-- This is a lightweight permission separate from view_payroll (which
-- exposes the full payroll overview / admin screens).

DO $$
DECLARE
  r app_role;
  roles app_role[] := ARRAY['vp'::app_role, 'admin'::app_role, 'manager'::app_role, 'line_manager'::app_role, 'employee'::app_role];
BEGIN
  FOREACH r IN ARRAY roles LOOP
    INSERT INTO public.role_permissions (role, permission, enabled)
    VALUES (r, 'view_payslips', true)
    ON CONFLICT (role, permission) DO UPDATE SET enabled = true;
  END LOOP;
END $$;
