CREATE OR REPLACE FUNCTION public.recalc_used_days(_user_id uuid, _target text, _year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_used numeric;
BEGIN
  IF _user_id IS NULL OR _target IS NULL OR _year IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(r.days), 0) INTO v_used
  FROM leave_requests r
  WHERE r.user_id = _user_id
    AND r.status = 'approved'
    AND COALESCE(r.reason, '') NOT LIKE '%[Payroll]%'
    AND COALESCE(r.reason, '') NOT LIKE '%[Unpaid Leave]%'
    AND (EXTRACT(YEAR FROM r.start_date)::int
         + CASE WHEN EXTRACT(MONTH FROM r.start_date) >= 7 THEN 1 ELSE 0 END) = _year
    AND CASE
          WHEN r.leave_type = 'Annual Leave' THEN 'Annual Leave'
          WHEN r.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
          WHEN r.leave_type = 'Leave in Lieu' OR r.leave_type LIKE 'Leave on Lieu%' OR r.leave_type LIKE 'Leave on Leave%' THEN 'Leave in Lieu'
          ELSE NULL
        END = _target;

  UPDATE leave_balances
  SET used_days = v_used, updated_at = now()
  WHERE user_id = _user_id AND leave_type = _target AND year = _year;

  IF NOT FOUND AND v_used > 0 THEN
    INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
    VALUES (_user_id, _target, CASE WHEN _target = 'Annual Leave' THEN 12 ELSE 0 END, v_used, _year);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_deduct_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target text;
  v_year integer;
  v_old_target text;
  v_old_year integer;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    v_year := EXTRACT(YEAR FROM NEW.start_date)::int
              + CASE WHEN EXTRACT(MONTH FROM NEW.start_date) >= 7 THEN 1 ELSE 0 END;
    v_target := CASE
      WHEN NEW.leave_type = 'Annual Leave' THEN 'Annual Leave'
      WHEN NEW.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
      WHEN NEW.leave_type = 'Leave in Lieu' OR NEW.leave_type LIKE 'Leave on Lieu%' OR NEW.leave_type LIKE 'Leave on Leave%' THEN 'Leave in Lieu'
      ELSE NULL
    END;
    PERFORM recalc_used_days(NEW.user_id, v_target, v_year);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_year := EXTRACT(YEAR FROM OLD.start_date)::int
                  + CASE WHEN EXTRACT(MONTH FROM OLD.start_date) >= 7 THEN 1 ELSE 0 END;
    v_old_target := CASE
      WHEN OLD.leave_type = 'Annual Leave' THEN 'Annual Leave'
      WHEN OLD.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
      WHEN OLD.leave_type = 'Leave in Lieu' OR OLD.leave_type LIKE 'Leave on Lieu%' OR OLD.leave_type LIKE 'Leave on Leave%' THEN 'Leave in Lieu'
      ELSE NULL
    END;
    IF v_old_target IS DISTINCT FROM v_target OR v_old_year IS DISTINCT FROM v_year OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM recalc_used_days(OLD.user_id, v_old_target, v_old_year);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance ON public.leave_requests;
CREATE TRIGGER trg_auto_deduct_leave_balance
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.auto_deduct_leave_balance();