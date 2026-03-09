-- Fix Loan Visibility: re-add employee SELECT, add manager SELECT, expand VP UPDATE
-- Previous migration (20260301145348) dropped "Users can view own loan requests" but
-- never re-created it, so regular employees can't see their own loans.

-- 1. Re-add employee SELECT policy
CREATE POLICY "Users can view own loan requests"
ON public.loan_requests FOR SELECT
USING (user_id = auth.uid());

-- 2. Add manager SELECT policy for loans assigned to them
CREATE POLICY "Managers can view assigned loan requests"
ON public.loan_requests FOR SELECT
USING (manager_user_id = auth.uid());

-- 3. Expand VP UPDATE to include pending_manager (so VP can directly approve
--    loans that are stuck or have no manager assigned)
DROP POLICY IF EXISTS "VP can update assigned loans" ON public.loan_requests;
CREATE POLICY "VP can update assigned loans"
ON public.loan_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'vp'::app_role)
  AND status IN ('pending_manager', 'pending_vp', 'approved', 'disbursed')
);

-- 4. Add manager UPDATE support for 'manager' role (not just line_manager)
--    Update is_loan_officer to include 'manager' role
CREATE OR REPLACE FUNCTION public.is_loan_officer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_officer_roles WHERE user_id = _user_id
  )
  OR has_role(_user_id, 'vp'::app_role)
  OR has_role(_user_id, 'admin'::app_role)
  OR has_role(_user_id, 'line_manager'::app_role)
  OR has_role(_user_id, 'manager'::app_role)
$$;
