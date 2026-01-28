-- Add date_of_birth and joining_date columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS joining_date date;

-- Create a function to check for birthdays and work anniversaries
CREATE OR REPLACE FUNCTION public.get_todays_milestones()
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  milestone_type text,
  years integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return birthdays (matching month and day)
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    'birthday'::text as milestone_type,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))::integer as years
  FROM public.profiles p
  WHERE p.date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM p.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE);

  -- Return work anniversaries (matching month and day, but not first year - that's join date)
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    'work_anniversary'::text as milestone_type,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.joining_date))::integer as years
  FROM public.profiles p
  WHERE p.joining_date IS NOT NULL
    AND EXTRACT(MONTH FROM p.joining_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM p.joining_date) = EXTRACT(DAY FROM CURRENT_DATE)
    AND p.joining_date < CURRENT_DATE; -- Exclude if joining today
END;
$$;