DROP POLICY IF EXISTS "Users can view org announcements" ON public.announcements;

CREATE POLICY "Users can view org announcements"
ON public.announcements
FOR SELECT
USING ((org_id = get_user_org_id(auth.uid())) OR (org_id IS NULL));