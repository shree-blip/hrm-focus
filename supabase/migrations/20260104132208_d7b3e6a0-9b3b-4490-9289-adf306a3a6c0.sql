-- Update the status check constraint to include 'auto_clocked_out' status
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_status_check;

ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'break'::text, 'completed'::text, 'auto_clocked_out'::text]));