
-- Drop all old RLS policies on bug_reports
DROP POLICY IF EXISTS "IT team can view all bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "IT team can update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can view their own bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can submit bug reports" ON public.bug_reports;

-- Drop all old RLS policies on asset_requests
DROP POLICY IF EXISTS "Management can view all asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Management can update asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can view their own asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can submit asset requests" ON public.asset_requests;

-- Drop all old RLS policies on grievances
DROP POLICY IF EXISTS "Admin VP can view all grievances" ON public.grievances;
DROP POLICY IF EXISTS "Admin VP Manager can update grievances" ON public.grievances;
DROP POLICY IF EXISTS "Managers can view team grievances" ON public.grievances;
DROP POLICY IF EXISTS "Users can view own grievances" ON public.grievances;
DROP POLICY IF EXISTS "Users can create grievances" ON public.grievances;

-- ============ bug_reports ============
-- Anyone authenticated can submit (own records)
CREATE POLICY "Users can submit bug reports"
  ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can always see their own bug reports
CREATE POLICY "Users can view own bug reports"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users with view_bug_reports or manage_support permission can see ALL bug reports
CREATE POLICY "Permitted users can view all bug reports"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (
    has_permission(auth.uid(), 'view_bug_reports')
    OR has_permission(auth.uid(), 'manage_support')
  );

-- Users with view_bug_reports or manage_support can update bug reports
CREATE POLICY "Permitted users can update bug reports"
  ON public.bug_reports FOR UPDATE TO authenticated
  USING (
    has_permission(auth.uid(), 'view_bug_reports')
    OR has_permission(auth.uid(), 'manage_support')
  );

-- ============ asset_requests ============
CREATE POLICY "Users can submit asset requests"
  ON public.asset_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own asset requests"
  ON public.asset_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Permitted users can view all asset requests"
  ON public.asset_requests FOR SELECT TO authenticated
  USING (
    has_permission(auth.uid(), 'view_asset_requests')
    OR has_permission(auth.uid(), 'manage_support')
  );

CREATE POLICY "Permitted users can update asset requests"
  ON public.asset_requests FOR UPDATE TO authenticated
  USING (
    has_permission(auth.uid(), 'view_asset_requests')
    OR has_permission(auth.uid(), 'manage_support')
  );

-- ============ grievances ============
CREATE POLICY "Users can create grievances"
  ON public.grievances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own grievances"
  ON public.grievances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Permitted users can view all grievances"
  ON public.grievances FOR SELECT TO authenticated
  USING (
    has_permission(auth.uid(), 'view_grievances')
    OR has_permission(auth.uid(), 'manage_support')
  );

CREATE POLICY "Permitted users can update grievances"
  ON public.grievances FOR UPDATE TO authenticated
  USING (
    has_permission(auth.uid(), 'view_grievances')
    OR has_permission(auth.uid(), 'manage_support')
  );
