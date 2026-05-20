-- Add module column to existing notifications table for sidebar badge routing
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS module text;

-- CHECK constraint: when module is set, it must be one of the 4 allowed values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_module_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_module_check
      CHECK (module IS NULL OR module IN ('approvals','leave','tasks','announcements'));
  END IF;
END $$;

-- Partial index for fastest unread lookup per user+module
CREATE INDEX IF NOT EXISTS idx_notifications_unread_module
  ON public.notifications (user_id, module)
  WHERE read_at IS NULL AND module IS NOT NULL;
