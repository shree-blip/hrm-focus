-- Helper: resolve recursive subordinate user_ids from manager user_id
CREATE OR REPLACE FUNCTION public.get_all_subordinate_user_ids(_manager_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH manager_emp AS (
    SELECT public.get_employee_id_for_user(_manager_user_id) AS employee_id
  ),
  subordinate_emp AS (
    SELECT public.get_all_subordinate_employee_ids(me.employee_id) AS employee_id
    FROM manager_emp me
    WHERE me.employee_id IS NOT NULL
  )
  SELECT DISTINCT COALESCE(p_by_id.user_id, p_by_email.user_id) AS user_id
  FROM subordinate_emp se
  JOIN public.employees e ON e.id = se.employee_id
  LEFT JOIN public.profiles p_by_id ON p_by_id.id = e.profile_id
  LEFT JOIN public.profiles p_by_email
    ON p_by_id.user_id IS NULL
   AND e.email IS NOT NULL
   AND lower(p_by_email.email) = lower(e.email)
  WHERE COALESCE(p_by_id.user_id, p_by_email.user_id) IS NOT NULL;
$$;

-- Ensure line-manager detection works for both team_members and employees.line_manager_id hierarchy
CREATE OR REPLACE FUNCTION public.is_line_manager(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  SELECT public.get_employee_id_for_user(_user_id) INTO v_employee_id;

  RETURN
    public.has_role(_user_id, 'line_manager'::public.app_role)
    OR (v_employee_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.manager_employee_id = v_employee_id
    ))
    OR (v_employee_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.line_manager_id = v_employee_id
    ))
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.profiles p ON p.id = e.profile_id
      WHERE p.user_id = _user_id
        AND lower(COALESCE(e.job_title, '')) = 'line manager'
    );
END;
$$;

-- Recursive visible employee resolver used by attendance/reporting policies
CREATE OR REPLACE FUNCTION public.get_visible_employee_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  user_employee_id uuid;
BEGIN
  SELECT public.get_user_org_id(_user_id) INTO user_org_id;
  SELECT public.get_employee_id_for_user(_user_id) INTO user_employee_id;

  IF public.has_permission(_user_id, 'view_employees_all') THEN
    RETURN QUERY
    SELECT e.id
    FROM public.employees e
    WHERE (e.status = 'active' OR e.status IS NULL)
      AND (e.org_id = user_org_id OR e.org_id IS NULL);
    RETURN;
  END IF;

  IF public.has_permission(_user_id, 'view_employees_reports_only')
     OR public.is_line_manager(_user_id)
     OR public.has_role(_user_id, 'manager'::public.app_role)
     OR public.has_role(_user_id, 'line_manager'::public.app_role)
     OR public.has_role(_user_id, 'supervisor'::public.app_role) THEN

    IF user_employee_id IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT e.id
    FROM public.employees e
    WHERE (e.status = 'active' OR e.status IS NULL)
      AND (e.org_id = user_org_id OR e.org_id IS NULL)
      AND (
        e.id = user_employee_id
        OR e.id IN (
          SELECT public.get_all_subordinate_employee_ids(user_employee_id)
        )
      );
    RETURN;
  END IF;

  IF user_employee_id IS NOT NULL THEN
    RETURN QUERY SELECT user_employee_id;
  END IF;
END;
$$;

-- Grievance visibility should include recursive subordinates
CREATE OR REPLACE FUNCTION public.can_view_grievance(_user_id uuid, _grievance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.grievances g
    WHERE g.id = _grievance_id
      AND (
        g.user_id = _user_id
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'vp'::public.app_role)
        OR (
          (
            public.has_role(_user_id, 'manager'::public.app_role)
            OR public.has_role(_user_id, 'line_manager'::public.app_role)
            OR public.has_role(_user_id, 'supervisor'::public.app_role)
            OR public.is_line_manager(_user_id)
          )
          AND g.employee_id IN (
            SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(_user_id))
          )
        )
      )
  );
$$;

-- Work logs: replace direct-only policy with recursive team visibility
DROP POLICY IF EXISTS "Line managers can view direct reports work logs" ON public.work_logs;
DROP POLICY IF EXISTS "Line managers can view recursive team work logs" ON public.work_logs;
CREATE POLICY "Line managers can view recursive team work logs"
ON public.work_logs
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
  OR (
    employee_id IS NOT NULL
    AND employee_id IN (
      SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(auth.uid()))
    )
  )
);

-- Keep global visibility for VP/Admin only (remove manager-all fallback)
DROP POLICY IF EXISTS "VP and Admin can view all work logs" ON public.work_logs;
CREATE POLICY "VP and Admin can view all work logs"
ON public.work_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
);

-- Attendance adjustments: fix broken requested_by mapping and make it recursive
DROP POLICY IF EXISTS line_managers_read_team_adjustments ON public.attendance_adjustment_requests;
CREATE POLICY line_managers_read_team_adjustments
ON public.attendance_adjustment_requests
FOR SELECT
TO authenticated
USING (
  requested_by IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
);

DROP POLICY IF EXISTS line_managers_review_team_adjustments ON public.attendance_adjustment_requests;
CREATE POLICY line_managers_review_team_adjustments
ON public.attendance_adjustment_requests
FOR UPDATE
TO authenticated
USING (
  requested_by IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
)
WITH CHECK (true);

-- Attendance logs: add explicit recursive subordinate visibility
DROP POLICY IF EXISTS "Managers can view recursive team attendance" ON public.attendance_logs;
CREATE POLICY "Managers can view recursive team attendance"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
  OR (
    employee_id IS NOT NULL
    AND employee_id IN (
      SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(auth.uid()))
    )
  )
);

-- Leave requests: remove direct-role broad access and replace with recursive hierarchy-aware access
DROP POLICY IF EXISTS "Managers can view all requests" ON public.leave_requests;
CREATE POLICY "Managers can view all requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
  OR user_id IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view org leave requests" ON public.leave_requests;
CREATE POLICY "Users can view org leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  ((org_id = public.get_user_org_id(auth.uid())) OR (org_id IS NULL))
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'vp'::public.app_role)
    OR user_id IN (
      SELECT public.get_all_subordinate_user_ids(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Managers can update requests" ON public.leave_requests;
CREATE POLICY "Managers can update requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
  OR (
    status = 'pending'
    AND user_id IN (
      SELECT public.get_all_subordinate_user_ids(auth.uid())
    )
  )
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Supervisors and line managers can update team requests" ON public.leave_requests;
CREATE POLICY "Supervisors and line managers can update team requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND user_id IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
)
WITH CHECK (true);

-- Support visibility: allow managers to see recursive subordinate support items
DROP POLICY IF EXISTS "Managers see recursive subordinate asset requests" ON public.asset_requests;
CREATE POLICY "Managers see recursive subordinate asset requests"
ON public.asset_requests
FOR SELECT
TO authenticated
USING (
  requester_employee_id IN (
    SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Managers can view recursive team grievances" ON public.grievances;
CREATE POLICY "Managers can view recursive team grievances"
ON public.grievances
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Managers can view recursive team bug reports" ON public.bug_reports;
CREATE POLICY "Managers can view recursive team bug reports"
ON public.bug_reports
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT public.get_all_subordinate_user_ids(auth.uid())
  )
);

-- Attendance global role policy should not grant all rows to generic managers
DROP POLICY IF EXISTS "Managers can view all attendance" ON public.attendance_logs;
CREATE POLICY "Managers can view all attendance"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
);