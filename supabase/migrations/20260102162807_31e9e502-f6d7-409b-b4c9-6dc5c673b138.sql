-- ============================================================
-- SECURITY FIX: Multi-Tenant Data Isolation + Storage Access
-- ============================================================

-- 1. Update get_visible_employee_ids to filter by org_id
CREATE OR REPLACE FUNCTION public.get_visible_employee_ids(_user_id uuid)
RETURNS SETOF uuid AS $$
DECLARE
  user_org_id uuid;
  user_employee_id uuid;
BEGIN
  -- Get user's org
  SELECT get_user_org_id(_user_id) INTO user_org_id;
  SELECT get_employee_id_for_user(_user_id) INTO user_employee_id;
  
  -- If user has view_employees_all permission, return all employees in their org
  IF has_permission(_user_id, 'view_employees_all') THEN
    RETURN QUERY 
    SELECT id FROM public.employees 
    WHERE status = 'active' 
      AND (org_id = user_org_id OR org_id IS NULL);
    RETURN;
  END IF;
  
  -- If user has view_employees_reports_only, return their direct/indirect reports in same org
  IF has_permission(_user_id, 'view_employees_reports_only') THEN
    RETURN QUERY 
    SELECT id FROM public.employees 
    WHERE status = 'active' 
      AND (org_id = user_org_id OR org_id IS NULL)
      AND (manager_id = user_employee_id OR line_manager_id = user_employee_id);
    RETURN;
  END IF;
  
  -- Default: return only the user's own employee id
  IF user_employee_id IS NOT NULL THEN
    RETURN QUERY SELECT user_employee_id;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix is_direct_manager to include org check
CREATE OR REPLACE FUNCTION public.is_direct_manager(_user_id uuid, _employee_id uuid)
RETURNS boolean AS $$
DECLARE
  user_org_id uuid;
  employee_org_id uuid;
  user_emp_id uuid;
BEGIN
  SELECT get_user_org_id(_user_id) INTO user_org_id;
  SELECT org_id INTO employee_org_id FROM public.employees WHERE id = _employee_id;
  
  -- Must be in same org (or employee has no org)
  IF user_org_id IS DISTINCT FROM employee_org_id AND employee_org_id IS NOT NULL THEN
    RETURN false;
  END IF;
  
  SELECT get_employee_id_for_user(_user_id) INTO user_emp_id;
  
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = _employee_id 
      AND (manager_id = user_emp_id OR line_manager_id = user_emp_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix can_view_salary to include org check
CREATE OR REPLACE FUNCTION public.can_view_salary(_user_id uuid, _employee_id uuid)
RETURNS boolean AS $$
DECLARE
  user_org_id uuid;
  employee_org_id uuid;
BEGIN
  SELECT get_user_org_id(_user_id) INTO user_org_id;
  SELECT org_id INTO employee_org_id FROM public.employees WHERE id = _employee_id;
  
  -- Must be in same org (or employee has no org assigned)
  IF user_org_id IS DISTINCT FROM employee_org_id AND employee_org_id IS NOT NULL THEN
    RETURN false;
  END IF;
  
  -- Admins and VPs can view salaries in their org
  IF has_role(_user_id, 'admin'::app_role) OR has_role(_user_id, 'vp'::app_role) THEN
    RETURN true;
  END IF;
  
  -- Check manage_salaries_all permission
  IF has_permission(_user_id, 'manage_salaries_all') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- FIX PROFILES TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;

CREATE POLICY "Users can view org profiles" ON public.profiles
FOR SELECT USING (
  org_id = get_user_org_id(auth.uid()) OR 
  org_id IS NULL OR 
  user_id = auth.uid()
);

-- ============================================================
-- FIX EMPLOYEES TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Users can view org employees" ON public.employees;
DROP POLICY IF EXISTS "Line managers can view their team" ON public.employees;

-- Main SELECT policy with org filtering
CREATE POLICY "Users can view org employees" ON public.employees
FOR SELECT USING (
  -- Must be in same org (or employee has no org)
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    -- User has permission to view all employees
    has_permission(auth.uid(), 'view_employees_all') OR
    -- User has permission to view reports only
    (has_permission(auth.uid(), 'view_employees_reports_only') AND 
     (manager_id = get_employee_id_for_user(auth.uid()) OR 
      line_manager_id = get_employee_id_for_user(auth.uid()))) OR
    -- User is viewing their own record
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    -- Admin/VP/Manager roles
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

-- ============================================================
-- FIX ATTENDANCE_LOGS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Permission-based attendance view" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users can view org attendance" ON public.attendance_logs;

CREATE POLICY "Users can view org attendance" ON public.attendance_logs
FOR SELECT USING (
  -- Must be in same org (or no org)
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    -- Own attendance
    user_id = auth.uid() OR
    -- Has view all permission
    has_permission(auth.uid(), 'view_attendance_all') OR
    -- Has view reports only permission
    (has_permission(auth.uid(), 'view_attendance_reports_only') AND 
     employee_id IN (SELECT get_visible_employee_ids(auth.uid())))
  )
);

-- ============================================================
-- FIX DOCUMENTS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view org documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert org documents" ON public.documents;

CREATE POLICY "Users can view org documents" ON public.documents
FOR SELECT USING (
  -- Must be in same org (or no org)
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    -- Own documents
    uploaded_by = auth.uid() OR
    -- Document assigned to user
    employee_id = get_employee_id_for_user(auth.uid()) OR
    -- Admin/VP/Manager can view all org documents
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Users can insert org documents" ON public.documents
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid() AND
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
);

-- ============================================================
-- FIX TASKS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view org tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create org tasks" ON public.tasks;

CREATE POLICY "Users can view org tasks" ON public.tasks
FOR SELECT USING (
  org_id = get_user_org_id(auth.uid()) OR org_id IS NULL
);

CREATE POLICY "Users can create org tasks" ON public.tasks
FOR INSERT WITH CHECK (
  created_by = auth.uid() AND
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
);

-- ============================================================
-- FIX ANNOUNCEMENTS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Users can view org announcements" ON public.announcements;

CREATE POLICY "Users can view org announcements" ON public.announcements
FOR SELECT USING (
  is_active = true AND
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
);

-- ============================================================
-- FIX LEAVE_REQUESTS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own or managed leave" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view org leave requests" ON public.leave_requests;

CREATE POLICY "Users can view org leave requests" ON public.leave_requests
FOR SELECT USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'line_manager'::app_role)
  )
);

-- ============================================================
-- FIX LEAVE_BALANCES TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own leave balance" ON public.leave_balances;
DROP POLICY IF EXISTS "Users can view org leave balances" ON public.leave_balances;

CREATE POLICY "Users can view org leave balances" ON public.leave_balances
FOR SELECT USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role)
  )
);

-- ============================================================
-- FIX PAYROLL_RUNS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Managers can view payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "VPs can view org payroll runs" ON public.payroll_runs;

CREATE POLICY "VPs can view org payroll runs" ON public.payroll_runs
FOR SELECT USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role)
  )
);

-- ============================================================
-- FIX PAYSLIPS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can view org payslips" ON public.payslips;

CREATE POLICY "Users can view org payslips" ON public.payslips
FOR SELECT USING (
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
  AND (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role)
  )
);

-- ============================================================
-- FIX NOTIFICATIONS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view org notifications" ON public.notifications;

CREATE POLICY "Users can view org notifications" ON public.notifications
FOR SELECT USING (
  user_id = auth.uid() AND
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
);

-- ============================================================
-- FIX ONBOARDING_WORKFLOWS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Managers can view onboarding" ON public.onboarding_workflows;
DROP POLICY IF EXISTS "Managers can view org onboarding" ON public.onboarding_workflows;

-- Check if table exists before creating policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onboarding_workflows' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Managers can view org onboarding" ON public.onboarding_workflows
    FOR SELECT USING (
      has_role(auth.uid(), ''admin''::app_role) OR
      has_role(auth.uid(), ''vp''::app_role) OR
      has_role(auth.uid(), ''manager''::app_role)
    )';
  END IF;
END $$;

-- ============================================================
-- FIX OFFBOARDING_WORKFLOWS TABLE RLS
-- ============================================================
DROP POLICY IF EXISTS "Managers can view offboarding" ON public.offboarding_workflows;
DROP POLICY IF EXISTS "Managers can view org offboarding" ON public.offboarding_workflows;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offboarding_workflows' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Managers can view org offboarding" ON public.offboarding_workflows
    FOR SELECT USING (
      has_role(auth.uid(), ''admin''::app_role) OR
      has_role(auth.uid(), ''vp''::app_role) OR
      has_role(auth.uid(), ''manager''::app_role)
    )';
  END IF;
END $$;

-- ============================================================
-- FIX ORGANIZATIONS TABLE RLS (restrict public access)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their org" ON public.organizations;

CREATE POLICY "Users can view their org" ON public.organizations
FOR SELECT USING (
  id = get_user_org_id(auth.uid()) OR
  -- Allow lookup by slug for login flow (unauthenticated)
  auth.uid() IS NULL
);

-- ============================================================
-- FIX STORAGE BUCKET POLICIES
-- ============================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- New secure SELECT policy: Users can view files in their own folder
CREATE POLICY "Users view own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND
  (
    -- User's own folder
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Admin/VP can view all documents
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'vp'::app_role)
  )
);

-- New secure INSERT policy: Users can only upload to their own folder
CREATE POLICY "Users upload own documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- New secure UPDATE policy: Users can only update their own files
CREATE POLICY "Users update own documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- New secure DELETE policy: Users can delete own files, admins can delete any
CREATE POLICY "Users delete own documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);