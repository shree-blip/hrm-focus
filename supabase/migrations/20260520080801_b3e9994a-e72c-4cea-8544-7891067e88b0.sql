ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_module_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_module_check
  CHECK (module IS NULL OR module IN ('approvals','leave','tasks','announcements','hiring','loans','support'));