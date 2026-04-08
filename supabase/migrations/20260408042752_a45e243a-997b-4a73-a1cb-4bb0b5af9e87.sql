
-- Drop the old public-role INSERT policy and recreate for authenticated
DROP POLICY IF EXISTS "Users can create their own requests" ON public.leave_requests;
CREATE POLICY "Users can create their own requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also fix the public-role UPDATE policy
DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.leave_requests;
CREATE POLICY "Users can update their own pending requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Also fix the public-role SELECT policy
DROP POLICY IF EXISTS "Users can view their own requests" ON public.leave_requests;
CREATE POLICY "Users can view their own requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
