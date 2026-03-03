
-- Drop restrictive VP-specific SELECT policy
DROP POLICY IF EXISTS "loan_requests_vp_select" ON public.loan_requests;

-- Create a permissive VP SELECT policy: any VP can see all loan requests
CREATE POLICY "loan_requests_vp_select"
ON public.loan_requests
FOR SELECT
USING (has_role(auth.uid(), 'vp'::app_role));

-- Drop restrictive VP UPDATE policy
DROP POLICY IF EXISTS "VP can update assigned loans" ON public.loan_requests;

-- Create permissive VP UPDATE policy: any VP can update pending_vp or approved loans
CREATE POLICY "VP can update assigned loans"
ON public.loan_requests
FOR UPDATE
USING (has_role(auth.uid(), 'vp'::app_role) AND status IN ('pending_vp', 'approved'));
