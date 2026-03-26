
CREATE OR REPLACE FUNCTION public.get_all_subordinate_employee_ids(_manager_employee_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_ids uuid[];
  _next_ids uuid[];
  _all_ids uuid[] := ARRAY[]::uuid[];
  _id uuid;
BEGIN
  -- Seed with direct reports
  SELECT array_agg(DISTINCT sub_id) INTO _current_ids
  FROM (
    SELECT e.id AS sub_id FROM employees e WHERE e.line_manager_id = _manager_employee_id
    UNION
    SELECT tm.member_employee_id AS sub_id FROM team_members tm WHERE tm.manager_employee_id = _manager_employee_id
  ) t;

  IF _current_ids IS NULL THEN RETURN; END IF;

  _all_ids := _current_ids;

  -- Iteratively expand
  LOOP
    SELECT array_agg(DISTINCT sub_id) INTO _next_ids
    FROM (
      SELECT e.id AS sub_id FROM employees e WHERE e.line_manager_id = ANY(_current_ids) AND NOT (e.id = ANY(_all_ids))
      UNION
      SELECT tm.member_employee_id AS sub_id FROM team_members tm WHERE tm.manager_employee_id = ANY(_current_ids) AND NOT (tm.member_employee_id = ANY(_all_ids))
    ) t;

    EXIT WHEN _next_ids IS NULL OR array_length(_next_ids, 1) = 0;

    _all_ids := _all_ids || _next_ids;
    _current_ids := _next_ids;
  END LOOP;

  FOREACH _id IN ARRAY _all_ids LOOP
    RETURN NEXT _id;
  END LOOP;
END;
$$;
