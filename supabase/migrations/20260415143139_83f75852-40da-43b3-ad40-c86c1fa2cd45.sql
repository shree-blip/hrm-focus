
-- Trigger: sync employees → profiles
CREATE OR REPLACE FUNCTION public.sync_employee_to_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Only sync if profile_id is set and relevant fields actually changed
  IF NEW.profile_id IS NOT NULL AND (
    OLD.first_name IS DISTINCT FROM NEW.first_name OR
    OLD.last_name IS DISTINCT FROM NEW.last_name OR
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.department IS DISTINCT FROM NEW.department OR
    OLD.job_title IS DISTINCT FROM NEW.job_title OR
    OLD.location IS DISTINCT FROM NEW.location
  ) THEN
    UPDATE public.profiles
    SET
      first_name = NEW.first_name,
      last_name = NEW.last_name,
      phone = NEW.phone,
      department = NEW.department,
      job_title = NEW.job_title,
      location = NEW.location,
      updated_at = now()
    WHERE id = NEW.profile_id
      AND (
        first_name IS DISTINCT FROM NEW.first_name OR
        last_name IS DISTINCT FROM NEW.last_name OR
        phone IS DISTINCT FROM NEW.phone OR
        department IS DISTINCT FROM NEW.department OR
        job_title IS DISTINCT FROM NEW.job_title OR
        location IS DISTINCT FROM NEW.location
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_employee_to_profile ON public.employees;
CREATE TRIGGER trg_sync_employee_to_profile
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_to_profile();

-- Trigger: sync profiles → employees
CREATE OR REPLACE FUNCTION public.sync_profile_to_employee()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Only sync if relevant fields actually changed
  IF (
    OLD.first_name IS DISTINCT FROM NEW.first_name OR
    OLD.last_name IS DISTINCT FROM NEW.last_name OR
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.department IS DISTINCT FROM NEW.department OR
    OLD.job_title IS DISTINCT FROM NEW.job_title OR
    OLD.location IS DISTINCT FROM NEW.location
  ) THEN
    UPDATE public.employees
    SET
      first_name = NEW.first_name,
      last_name = NEW.last_name,
      phone = NEW.phone,
      department = NEW.department,
      job_title = NEW.job_title,
      location = NEW.location,
      updated_at = now()
    WHERE profile_id = NEW.id
      AND (
        first_name IS DISTINCT FROM NEW.first_name OR
        last_name IS DISTINCT FROM NEW.last_name OR
        phone IS DISTINCT FROM NEW.phone OR
        department IS DISTINCT FROM NEW.department OR
        job_title IS DISTINCT FROM NEW.job_title OR
        location IS DISTINCT FROM NEW.location
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_employee ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_employee
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_employee();
