
-- Trigger function: auto-assign line_manager role when an employee is assigned as a line manager
CREATE OR REPLACE FUNCTION public.auto_assign_line_manager_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _manager_user_id uuid;
BEGIN
  -- When line_manager_id is set or changed
  IF NEW.line_manager_id IS NOT NULL AND (OLD.line_manager_id IS DISTINCT FROM NEW.line_manager_id) THEN
    -- Get the user_id of the new line manager via their profile
    SELECT p.user_id INTO _manager_user_id
    FROM employees e
    JOIN profiles p ON p.id = e.profile_id
    WHERE e.id = NEW.line_manager_id;

    IF _manager_user_id IS NOT NULL THEN
      -- Insert line_manager role if not already present
      INSERT INTO user_roles (user_id, role)
      VALUES (_manager_user_id, 'line_manager')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  -- Also handle manager_id assignments
  IF NEW.manager_id IS NOT NULL AND (OLD.manager_id IS DISTINCT FROM NEW.manager_id) THEN
    SELECT p.user_id INTO _manager_user_id
    FROM employees e
    JOIN profiles p ON p.id = e.profile_id
    WHERE e.id = NEW.manager_id;

    IF _manager_user_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role)
      VALUES (_manager_user_id, 'line_manager')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_assign_line_manager_role ON employees;
CREATE TRIGGER trg_auto_assign_line_manager_role
  AFTER INSERT OR UPDATE OF line_manager_id, manager_id
  ON employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_line_manager_role();

-- Also grant manage_employees permission to line_manager role if not exists
INSERT INTO role_permissions (role, permission, enabled)
VALUES 
  ('line_manager', 'view_employees_reports_only', true),
  ('line_manager', 'view_attendance_reports_only', true)
ON CONFLICT DO NOTHING;
