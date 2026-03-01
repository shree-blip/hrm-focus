
-- Add routing columns to loan_requests
ALTER TABLE public.loan_requests 
  ADD COLUMN IF NOT EXISTS manager_user_id uuid,
  ADD COLUMN IF NOT EXISTS vp_user_id uuid,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_comment text;

-- Create trigger to update manager_id when employee's team changes
CREATE OR REPLACE FUNCTION public.update_loan_manager_on_team_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_manager_user_id uuid;
BEGIN
  -- Only act when line_manager_id changes
  IF NEW.line_manager_id IS DISTINCT FROM OLD.line_manager_id AND NEW.line_manager_id IS NOT NULL THEN
    -- Get the user_id of the new line manager
    SELECT p.user_id INTO new_manager_user_id
    FROM employees e
    JOIN profiles p ON p.id = e.profile_id
    WHERE e.id = NEW.line_manager_id;

    IF new_manager_user_id IS NOT NULL THEN
      -- Update any PENDING_MANAGER loans for this employee
      UPDATE loan_requests
      SET manager_user_id = new_manager_user_id
      WHERE employee_id = NEW.id
        AND status = 'pending_manager';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_loan_manager_on_team_change ON public.employees;
CREATE TRIGGER trg_update_loan_manager_on_team_change
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_loan_manager_on_team_change();

-- Helper function to get VP user_id for an org
CREATE OR REPLACE FUNCTION public.get_vp_user_id_for_org(_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'vp'
  LIMIT 1
$$;
