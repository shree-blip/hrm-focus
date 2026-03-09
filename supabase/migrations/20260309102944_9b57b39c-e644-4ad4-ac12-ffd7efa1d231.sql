CREATE OR REPLACE FUNCTION public.increment_used_hours(record_id uuid, hours_to_add numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.overtime_bank
  SET used_hours = used_hours + hours_to_add,
      updated_at = now()
  WHERE id = record_id;
$$;