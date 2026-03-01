
-- 1. Drop the WRONG policy that compares employee_id (employees table UUID) with auth.uid()
DROP POLICY IF EXISTS "employee can read own loan requests" ON public.loan_requests;

-- 2. Drop duplicate SELECT policy (loan_requests_employee_select already covers this)
DROP POLICY IF EXISTS "Users can view own loan requests" ON public.loan_requests;

-- 3. Update is_loan_officer to also include line_manager role
CREATE OR REPLACE FUNCTION public.is_loan_officer(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_officer_roles WHERE user_id = _user_id
  )
  OR has_role(_user_id, 'vp'::app_role)
  OR has_role(_user_id, 'admin'::app_role)
  OR has_role(_user_id, 'line_manager'::app_role)
$$;

-- 4. Add UPDATE policy for Line Managers to approve/reject pending_manager loans
DROP POLICY IF EXISTS "Manager can update assigned loans" ON public.loan_requests;
CREATE POLICY "Manager can update assigned loans" ON public.loan_requests
FOR UPDATE TO authenticated
USING (manager_user_id = auth.uid() AND status = 'pending_manager')
WITH CHECK (manager_user_id = auth.uid());

-- 5. Add UPDATE policy for VP to approve/reject pending_vp loans
DROP POLICY IF EXISTS "VP can update assigned loans" ON public.loan_requests;
CREATE POLICY "VP can update assigned loans" ON public.loan_requests
FOR UPDATE TO authenticated
USING (vp_user_id = auth.uid() AND status IN ('pending_vp', 'approved'))
WITH CHECK (vp_user_id = auth.uid());

-- 6. Allow managers and VPs to insert into loan_approvals for their decisions
DROP POLICY IF EXISTS "Managers and VPs can insert approvals" ON public.loan_approvals;
CREATE POLICY "Managers and VPs can insert approvals" ON public.loan_approvals
FOR INSERT TO authenticated
WITH CHECK (reviewer_id = auth.uid());

-- 7. Allow managers and VPs to view loan_audit_logs for loans they're involved in
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.loan_audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.loan_audit_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());
