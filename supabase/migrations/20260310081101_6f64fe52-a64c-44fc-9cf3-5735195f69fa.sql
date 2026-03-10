
-- Backfill null employee_id in attendance_logs using profile -> employee link
UPDATE public.attendance_logs al
SET employee_id = e.id
FROM public.employees e
JOIN public.profiles p ON p.id = e.profile_id
WHERE al.employee_id IS NULL
  AND p.user_id = al.user_id;
