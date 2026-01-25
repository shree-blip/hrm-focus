-- Add pause tracking columns to attendance_logs table
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS pause_start timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pause_end timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_pause_minutes integer DEFAULT 0;