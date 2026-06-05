-- Data fix: a duplicated end_break call double-counted break time on one log.
-- The real break (from attendance_break_sessions) was 6 minutes
-- (06:01:44 -> 06:07:30), but total_break_minutes inflated to 35 and
-- break_end was overwritten to 06:30:49. Realign the log with the true session.
UPDATE public.attendance_logs
SET total_break_minutes = 6,
    break_end = '2026-06-05 06:07:30.792+00'
WHERE id = 'd014e1a3-1c9a-41d8-92ee-a5687d4e4993'
  AND total_break_minutes = 35;
