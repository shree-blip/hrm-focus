
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
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_days := NEW.days;

  -- Determine which balance bucket to deduct from
  v_target_balance := CASE
    WHEN NEW.leave_type = 'Annual Leave' THEN 'Annual Leave'
    WHEN NEW.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
    WHEN NEW.leave_type = 'Leave in Lieu' OR NEW.leave_type LIKE 'Leave on Lieu%' OR NEW.leave_type LIKE 'Leave on Leave%' THEN 'Leave in Lieu'
    ELSE NULL  -- Special leaves (Wedding, Bereavement, Maternity, Paternity) don't deduct
  END;

  v_old_target_balance := CASE
    WHEN OLD IS NOT NULL AND OLD.leave_type = 'Annual Leave' THEN 'Annual Leave'
    WHEN OLD IS NOT NULL AND OLD.leave_type LIKE 'Other Leave%' THEN 'Annual Leave'
    WHEN OLD IS NOT NULL AND (OLD.leave_type = 'Leave in Lieu' OR OLD.leave_type LIKE 'Leave on Lieu%' OR OLD.leave_type LIKE 'Leave on Leave%') THEN 'Leave in Lieu'
    ELSE NULL
  END;

  -- Handle INSERT (admin-assigned approved leaves)
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

  -- Handle UPDATE
  -- CASE 1: Status changed TO approved
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

  -- CASE 2: Status changed FROM approved (cancelled/rejected)
  IF OLD.status = 'approved' AND NEW.status != 'approved' AND v_old_target_balance IS NOT NULL THEN
    UPDATE leave_balances
    SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
    WHERE user_id = OLD.user_id
      AND leave_type = v_old_target_balance
      AND year = v_year;
  END IF;

  -- CASE 3: approved leave type changed while staying approved
  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    -- Reverse old deduction
    IF v_old_target_balance IS NOT NULL AND (v_old_target_balance IS DISTINCT FROM v_target_balance OR OLD.days IS DISTINCT FROM NEW.days OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      UPDATE leave_balances
      SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
      WHERE user_id = OLD.user_id
        AND leave_type = v_old_target_balance
        AND year = v_year;
    END IF;

    -- Apply new deduction
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
