-- Fix leave balance fiscal-year handling.
-- The app treats the leave year as July -> June, stored under the ENDING calendar
-- year (e.g. Jul 2026 - Jun 2027 => year 2027). The `year` column previously
-- defaulted to the raw calendar year, so users added mid-year got a row under the
-- wrong year and their balance appeared as "No leave data available".

-- 1. Make the default fiscal-year aware (Jul onward counts toward next year).
ALTER TABLE public.leave_balances
  ALTER COLUMN year SET DEFAULT (
    EXTRACT(YEAR FROM CURRENT_DATE)::int
    + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN 1 ELSE 0 END
  );

-- 2. Backfill the current fiscal-year Annual Leave row for any active, linked
--    employee who is missing it (fixes existing affected users). Interns/probation
--    carry forward their existing balance; everyone else gets a fresh 12 days.
INSERT INTO public.leave_balances (user_id, leave_type, total_days, used_days, year, org_id)
SELECT
  p.user_id,
  'Annual Leave',
  CASE WHEN e.employment_type IN ('intern','probation')
       THEN COALESCE(prev.total_days, 12) ELSE 12 END,
  CASE WHEN e.employment_type IN ('intern','probation')
       THEN COALESCE(prev.used_days, 0) ELSE 0 END,
  (EXTRACT(YEAR FROM CURRENT_DATE)::int
    + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN 1 ELSE 0 END),
  e.org_id
FROM public.employees e
JOIN public.profiles p ON lower(p.email) = lower(e.email)
LEFT JOIN LATERAL (
  SELECT total_days, used_days
  FROM public.leave_balances lb
  WHERE lb.user_id = p.user_id AND lb.leave_type = 'Annual Leave'
  ORDER BY lb.year DESC
  LIMIT 1
) prev ON true
WHERE p.user_id IS NOT NULL
  AND COALESCE(e.status, 'active') = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.leave_balances lb2
    WHERE lb2.user_id = p.user_id
      AND lb2.leave_type = 'Annual Leave'
      AND lb2.year = (EXTRACT(YEAR FROM CURRENT_DATE)::int
        + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN 1 ELSE 0 END)
  );