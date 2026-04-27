
CREATE OR REPLACE FUNCTION public.get_milestones_in_days(days_ahead integer)
RETURNS TABLE(user_id uuid, first_name text, last_name text, milestone_type text, years integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_date date := (CURRENT_DATE + (days_ahead || ' days')::interval)::date;
BEGIN
  -- Birthdays on target_date
  RETURN QUERY
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    'birthday'::text,
    EXTRACT(YEAR FROM AGE(target_date, p.date_of_birth))::integer
  FROM public.profiles p
  WHERE p.date_of_birth IS NOT NULL
    AND p.user_id IS NOT NULL
    AND EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM target_date)
    AND EXTRACT(DAY FROM p.date_of_birth) = EXTRACT(DAY FROM target_date)
    AND COALESCE(p.status, 'active') <> 'inactive';

  -- Work anniversaries on target_date (exclude joining year itself)
  RETURN QUERY
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    'work_anniversary'::text,
    EXTRACT(YEAR FROM AGE(target_date, p.joining_date))::integer
  FROM public.profiles p
  WHERE p.joining_date IS NOT NULL
    AND p.user_id IS NOT NULL
    AND EXTRACT(MONTH FROM p.joining_date) = EXTRACT(MONTH FROM target_date)
    AND EXTRACT(DAY FROM p.joining_date) = EXTRACT(DAY FROM target_date)
    AND p.joining_date < target_date
    AND COALESCE(p.status, 'active') <> 'inactive';
END;
$function$;
