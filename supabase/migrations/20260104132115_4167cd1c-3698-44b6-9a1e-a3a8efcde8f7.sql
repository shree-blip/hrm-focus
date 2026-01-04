-- Drop the foreign key constraint on user_id that references auth.users
-- This allows seeding attendance data for demo purposes where employees may not have auth accounts
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_user_id_fkey;