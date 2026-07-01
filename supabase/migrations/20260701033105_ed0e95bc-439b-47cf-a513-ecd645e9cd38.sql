CREATE OR REPLACE FUNCTION public.auto_deduct_leave_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_days numeric;
  v_target_balance text;
  v_old_target_balance text;
  v_new_is_payroll boolean;
  v_old_is_payroll boolean;
BEGIN
  -- Leave year runs Jul 1 - Jun 30 and is stored under the year it ends in.
  -- After July 1 the active balance row is under next calendar year, so
  -- deductions must target that same fiscal year (matches the dashboard/Teams).
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int
            + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN 1 ELSE 0 END;
  v_days := NEW.days;

  v_new_is_payroll := COALESCE(NEW.reason, '') LIKE '[Payroll]%';
  v_old_is_payroll := (TG_OP <> 'INSERT') AND COALESCE(OLD.reason, '') LIKE '[Payroll]%';

  v_target_balance := CASE
    WHEN NEW.leave_type = 'Annual Leave' THEN 'Annual Leave'
    WHEN NEW.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
    WHEN NEW.leave_type = 'Leave in Lieu' OR NEW.leave_type LIKE 'Leave on Lieu%' OR NEW.leave_type LIKE 'Leave on Leave%' THEN 'Leave in Lieu'
    ELSE NULL
  END;

  v_old_target_balance := CASE
    WHEN OLD IS NOT NULL AND OLD.leave_type = 'Annual Leave' THEN 'Annual Leave'
    WHEN OLD IS NOT NULL AND OLD.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
    WHEN OLD IS NOT NULL AND (OLD.leave_type = 'Leave in Lieu' OR OLD.leave_type LIKE 'Leave on Lieu%' OR OLD.leave_type LIKE 'Leave on Leave%') THEN 'Leave in Lieu'
    ELSE NULL
  END;

  IF v_new_is_payroll AND v_target_balance = 'Annual Leave' THEN
    v_target_balance := NULL;
  END IF;
  IF v_old_is_payroll AND v_old_target_balance = 'Annual Leave' THEN
    v_old_target_balance := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' AND v_target_balance IS NOT NULL THEN
      UPDATE leave_balances
      SET used_days = used_days + v_days, updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type = v_target_balance
        AND year = v_year;

      IF NOT FOUND THEN
        INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
        VALUES (NEW.user_id, v_target_balance, CASE WHEN v_target_balance = 'Annual Leave' THEN 20 ELSE 0 END, v_days, v_year);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') AND v_target_balance IS NOT NULL THEN
    UPDATE leave_balances
    SET used_days = used_days + v_days, updated_at = now()
    WHERE user_id = NEW.user_id
      AND leave_type = v_target_balance
      AND year = v_year;

    IF NOT FOUND THEN
      INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
      VALUES (NEW.user_id, v_target_balance, CASE WHEN v_target_balance = 'Annual Leave' THEN 20 ELSE 0 END, v_days, v_year);
    END IF;
  END IF;

  IF OLD.status = 'approved' AND NEW.status != 'approved' AND v_old_target_balance IS NOT NULL THEN
    UPDATE leave_balances
    SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
    WHERE user_id = OLD.user_id
      AND leave_type = v_old_target_balance
      AND year = v_year;
  END IF;

  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF v_old_target_balance IS NOT NULL AND (v_old_target_balance IS DISTINCT FROM v_target_balance OR OLD.days IS DISTINCT FROM NEW.days OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      UPDATE leave_balances
      SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
      WHERE user_id = OLD.user_id
        AND leave_type = v_old_target_balance
        AND year = v_year;
    END IF;

    IF v_target_balance IS NOT NULL AND (v_old_target_balance IS DISTINCT FROM v_target_balance OR OLD.days IS DISTINCT FROM NEW.days OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      UPDATE leave_balances
      SET used_days = used_days + NEW.days, updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type = v_target_balance
        AND year = v_year;

      IF NOT FOUND THEN
        INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
        VALUES (NEW.user_id, v_target_balance, CASE WHEN v_target_balance = 'Annual Leave' THEN 20 ELSE 0 END, NEW.days, v_year);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;