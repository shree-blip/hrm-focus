-- Enable realtime for attendance_logs table
ALTER TABLE public.attendance_logs REPLICA IDENTITY FULL;

-- Add to realtime publication if not already
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'attendance_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
  END IF;
END $$;