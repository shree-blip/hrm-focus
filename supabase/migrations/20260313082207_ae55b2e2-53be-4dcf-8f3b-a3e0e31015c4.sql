
-- Junction table for multi-team membership
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  member_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_employee_id, member_employee_id)
);

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read team_members
CREATE POLICY "Authenticated users can read team_members"
  ON public.team_members FOR SELECT TO authenticated USING (true);

-- Managers can insert/delete their own team members
CREATE POLICY "Managers can manage their team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (
    manager_employee_id = public.get_employee_id_for_user(auth.uid())
    OR public.has_role(auth.uid(), 'vp')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    manager_employee_id = public.get_employee_id_for_user(auth.uid())
    OR public.has_role(auth.uid(), 'vp')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Seed existing relationships into team_members
INSERT INTO public.team_members (manager_employee_id, member_employee_id)
SELECT DISTINCT line_manager_id, id
FROM public.employees
WHERE line_manager_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.team_members (manager_employee_id, member_employee_id)
SELECT DISTINCT manager_id, id
FROM public.employees
WHERE manager_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.manager_employee_id = employees.manager_id 
      AND tm.member_employee_id = employees.id
  )
ON CONFLICT DO NOTHING;

-- Update add_team_member to use junction table (no longer overwrites line_manager_id)
CREATE OR REPLACE FUNCTION public.add_team_member(_manager_employee_id uuid, _member_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_member_name text;
  v_manager_name text;
BEGIN
  SELECT first_name || ' ' || last_name INTO v_member_name
  FROM public.employees WHERE id = _member_employee_id;
  
  IF v_member_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'employee_not_found');
  END IF;
  
  SELECT first_name || ' ' || last_name INTO v_manager_name
  FROM public.employees WHERE id = _manager_employee_id;
  
  -- Check if already in this specific team
  IF EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE manager_employee_id = _manager_employee_id 
      AND member_employee_id = _member_employee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_member', 'member_name', v_member_name);
  END IF;
  
  -- Insert into junction table (does NOT remove from other teams)
  INSERT INTO public.team_members (manager_employee_id, member_employee_id)
  VALUES (_manager_employee_id, _member_employee_id);
  
  -- Set line_manager_id only if currently NULL (preserve existing primary manager)
  UPDATE public.employees
  SET line_manager_id = _manager_employee_id, updated_at = now()
  WHERE id = _member_employee_id AND line_manager_id IS NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'member_name', v_member_name,
    'manager_name', v_manager_name
  );
END;
$$;
