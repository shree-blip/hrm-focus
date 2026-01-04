-- Enable realtime payloads for announcements updates
ALTER TABLE public.announcements REPLICA IDENTITY FULL;

-- Add announcements to realtime publication (safe if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END$$;