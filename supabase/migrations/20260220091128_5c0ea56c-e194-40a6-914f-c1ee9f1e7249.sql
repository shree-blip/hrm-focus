CREATE OR REPLACE FUNCTION public.is_it_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IN (
    '744c4e71-96bf-4c43-a225-dcbb3b762080'  -- Bikash (neupanebikash53@gmail.com)
  )
$$;