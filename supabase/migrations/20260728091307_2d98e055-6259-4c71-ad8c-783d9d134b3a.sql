ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS probation_start_date date,
  ADD COLUMN IF NOT EXISTS probation_end_date date;

-- Fiscal year helper (Jul -> Jun, keyed to the year the fiscal year ends)
CREATE OR REPLACE FUNCTION public.fiscal_year_of(_d date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXTRACT(year FROM _d)::int + CASE WHEN EXTRACT(month FROM _d)::int >= 7 THEN 1 ELSE 0 END;
$$;

-- Set annual leave allowance for an employee's linked user, preserving used_days
CREATE OR REPLACE FUNCTION public.set_annual_leave_total(_employee_id uuid, _total numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _org uuid;
  _name text;
  _fy int := public.fiscal_year_of(CURRENT_DATE);
BEGIN
  SELECT p.user_id, e.org_id, (e.first_name || ' ' || e.last_name)
    INTO _uid, _org, _name
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.id = _employee_id;

  IF _uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.leave_balances (user_id, leave_type, year, total_days, used_days, org_id, employee_name)
  VALUES (_uid, 'Annual Leave', _fy, _total, 0, _org, _name)
  ON CONFLICT (user_id, leave_type, year)
  DO UPDATE SET total_days = EXCLUDED.total_days, updated_at = now();
END;
$$;

-- Keep leave allowance in sync with probation status changes
CREATE OR REPLACE FUNCTION public.sync_probation_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _months numeric;
BEGIN
  -- Entering / updating probation: prorate to 1 day per probation month
  IF NEW.employment_type = 'probation'
     AND NEW.probation_start_date IS NOT NULL
     AND NEW.probation_end_date IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.employment_type IS DISTINCT FROM NEW.employment_type
          OR OLD.probation_start_date IS DISTINCT FROM NEW.probation_start_date
          OR OLD.probation_end_date IS DISTINCT FROM NEW.probation_end_date)
  THEN
    _months := GREATEST(
      1,
      ROUND(((NEW.probation_end_date - NEW.probation_start_date)::numeric / 30.4375))
    );
    PERFORM public.set_annual_leave_total(NEW.id, LEAST(12, _months));
    RETURN NEW;
  END IF;

  -- Leaving probation for full time: restore the full 12-day allowance
  IF TG_OP = 'UPDATE'
     AND OLD.employment_type = 'probation'
     AND NEW.employment_type = 'full_time'
  THEN
    PERFORM public.set_annual_leave_total(NEW.id, 12);
    NEW.probation_completed := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_probation_leave ON public.employees;
CREATE TRIGGER trg_sync_probation_leave
BEFORE INSERT OR UPDATE OF employment_type, probation_start_date, probation_end_date
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_probation_leave();

-- Daily job: auto-complete probation once the end date has passed
CREATE OR REPLACE FUNCTION public.complete_due_probations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
BEGIN
  UPDATE public.employees
  SET employment_type = 'full_time'
  WHERE employment_type = 'probation'
    AND probation_end_date IS NOT NULL
    AND probation_end_date <= CURRENT_DATE;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('complete-due-probations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule('complete-due-probations', '15 1 * * *', 'SELECT public.complete_due_probations();');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;