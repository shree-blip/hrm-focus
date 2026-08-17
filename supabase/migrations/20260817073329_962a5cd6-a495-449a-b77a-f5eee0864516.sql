-- Sync probation employees' used leave to the paid leave taken inside their probation window
WITH prob AS (
  SELECT e.id, p.user_id, e.probation_start_date, e.probation_end_date
  FROM public.employees e
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.employment_type = 'probation' AND p.user_id IS NOT NULL
), usage AS (
  SELECT pr.user_id,
         COALESCE(SUM(lr.days), 0) AS paid_used
  FROM prob pr
  LEFT JOIN public.leave_requests lr
    ON lr.user_id = pr.user_id
   AND lr.status IN ('pending', 'approved')
   AND (pr.probation_start_date IS NULL OR lr.start_date >= pr.probation_start_date)
   AND (pr.probation_end_date IS NULL OR lr.start_date <= pr.probation_end_date)
   AND lr.leave_type NOT IN ('Wedding Leave', 'Bereavement Leave', 'Maternity Leave', 'Paternity Leave')
   AND lr.leave_type NOT LIKE 'Leave in Lieu%'
   AND lr.leave_type NOT LIKE 'Leave on Lieu%'
   AND COALESCE(lr.reason, '') !~* '\[(payroll|unpaid leave)\]'
  GROUP BY pr.user_id
)
UPDATE public.leave_balances lb
SET total_days = 3, used_days = u.paid_used, updated_at = now()
FROM usage u
WHERE lb.user_id = u.user_id
  AND lb.leave_type = 'Annual Leave'
  AND lb.year = public.fiscal_year_of(CURRENT_DATE);