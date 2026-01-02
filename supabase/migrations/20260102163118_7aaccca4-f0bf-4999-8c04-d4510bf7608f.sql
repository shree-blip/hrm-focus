-- ============================================================
-- SECURITY FIX: Notification Insert Policy
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create secure policy: Users can only create notifications for themselves within their org
CREATE POLICY "Users create own notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  (org_id = get_user_org_id(auth.uid()) OR org_id IS NULL)
);