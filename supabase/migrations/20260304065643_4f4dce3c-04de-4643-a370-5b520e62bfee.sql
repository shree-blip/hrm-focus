
-- Trigger function to auto-set employee_id on work_logs
CREATE OR REPLACE FUNCTION public.set_work_log_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT e.id INTO NEW.employee_id
    FROM employees e
    JOIN profiles p ON e.profile_id = p.id
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_work_log_employee_id ON public.work_logs;
CREATE TRIGGER trg_set_work_log_employee_id
  BEFORE INSERT ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_work_log_employee_id();

-- Backfill existing work_logs with NULL employee_id
UPDATE work_logs wl
SET employee_id = e.id
FROM employees e
JOIN profiles p ON e.profile_id = p.id
WHERE p.user_id = wl.user_id
  AND wl.employee_id IS NULL;
