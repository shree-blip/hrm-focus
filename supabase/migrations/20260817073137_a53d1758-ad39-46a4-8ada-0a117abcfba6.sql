CREATE OR REPLACE FUNCTION public.sync_probation_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employment_type = 'probation'
     AND (TG_OP = 'INSERT' OR OLD.employment_type IS DISTINCT FROM NEW.employment_type)
  THEN
    PERFORM public.set_annual_leave_total(NEW.id, 3);
    RETURN NEW;
  END IF;

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

UPDATE public.leave_balances lb
SET total_days = 3, updated_at = now()
FROM public.employees e
JOIN public.profiles p ON p.id = e.profile_id
WHERE lb.user_id = p.user_id
  AND lb.leave_type = 'Annual Leave'
  AND lb.year = public.fiscal_year_of(CURRENT_DATE)
  AND e.employment_type = 'probation'
  AND lb.total_days <> 3;