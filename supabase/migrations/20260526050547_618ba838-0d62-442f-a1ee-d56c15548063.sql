
-- Function: when an employee row is inserted or its email changes, link to matching profile
CREATE OR REPLACE FUNCTION public.link_employee_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS NULL THEN
    SELECT id INTO v_profile_id
    FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      NEW.profile_id := v_profile_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_employee_to_profile ON public.employees;
CREATE TRIGGER trg_link_employee_to_profile
BEFORE INSERT OR UPDATE OF email, profile_id ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.link_employee_to_profile();

-- Function: when a profile is inserted or its email changes, link matching employee back
CREATE OR REPLACE FUNCTION public.link_profile_to_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.employees e
  SET profile_id = NEW.id
  WHERE lower(e.email) = lower(NEW.email)
    AND (e.profile_id IS NULL OR e.profile_id <> NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_profile_to_employee ON public.profiles;
CREATE TRIGGER trg_link_profile_to_employee
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_profile_to_employee();

-- One-time backfill for any currently-unlinked rows
UPDATE public.employees e
SET profile_id = p.id
FROM public.profiles p
WHERE e.profile_id IS NULL
  AND lower(e.email) = lower(p.email);
