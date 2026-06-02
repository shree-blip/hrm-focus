-- Replace fragile incremental leave-balance triggers with a recalculation approach.
-- used_days is recomputed as the SUM of currently-APPROVED leave days for the
-- matching balance bucket and year. Cancelled/rejected leaves are never counted.

-- Recalculation function (must run AFTER row change so it sees the new status)
CREATE OR REPLACE FUNCTION public.recalc_leave_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  -- Annual Leave bucket (Annual Leave + all "Other Leave" types deduct here)
  UPDATE public.leave_balances lb
  SET used_days = COALESCE((
        SELECT SUM(lr.days)
        FROM public.leave_requests lr
        WHERE lr.user_id = v_user
          AND lr.status = 'approved'
          AND EXTRACT(YEAR FROM lr.start_date) = lb.year
          AND (lr.leave_type = 'Annual Leave' OR lr.leave_type LIKE 'Other Leave%')
      ), 0),
      updated_at = now()
  WHERE lb.user_id = v_user
    AND lb.leave_type = 'Annual Leave';

  -- Leave in Lieu bucket
  UPDATE public.leave_balances lb
  SET used_days = COALESCE((
        SELECT SUM(lr.days)
        FROM public.leave_requests lr
        WHERE lr.user_id = v_user
          AND lr.status = 'approved'
          AND EXTRACT(YEAR FROM lr.start_date) = lb.year
          AND (lr.leave_type = 'Leave in Lieu'
               OR lr.leave_type LIKE 'Leave on Lieu%'
               OR lr.leave_type LIKE 'Leave on Leave%')
      ), 0),
      updated_at = now()
  WHERE lb.user_id = v_user
    AND lb.leave_type = 'Leave in Lieu';

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop old incremental triggers
DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance ON public.leave_requests;
DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance_insert ON public.leave_requests;

-- Single AFTER trigger that keeps used_days correct on any change
CREATE TRIGGER trg_recalc_leave_balances
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.recalc_leave_balances();

-- Backfill: correct all existing balances so drifted/cancelled counts are fixed
UPDATE public.leave_balances lb
SET used_days = COALESCE((
      SELECT SUM(lr.days)
      FROM public.leave_requests lr
      WHERE lr.user_id = lb.user_id
        AND lr.status = 'approved'
        AND EXTRACT(YEAR FROM lr.start_date) = lb.year
        AND (
          (lb.leave_type = 'Annual Leave'
            AND (lr.leave_type = 'Annual Leave' OR lr.leave_type LIKE 'Other Leave%'))
          OR
          (lb.leave_type = 'Leave in Lieu'
            AND (lr.leave_type = 'Leave in Lieu'
                 OR lr.leave_type LIKE 'Leave on Lieu%'
                 OR lr.leave_type LIKE 'Leave on Leave%'))
        )
    ), 0),
    updated_at = now()
WHERE lb.leave_type IN ('Annual Leave', 'Leave in Lieu');