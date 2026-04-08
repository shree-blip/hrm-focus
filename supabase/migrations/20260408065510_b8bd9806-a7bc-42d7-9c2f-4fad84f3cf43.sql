CREATE OR REPLACE FUNCTION public.auto_deduct_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_days numeric;
  v_deducts_annual boolean;
  v_old_deducts_annual boolean;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_days := NEW.days;
  v_deducts_annual := NEW.leave_type IN ('Annual Leave', 'Other Leave - Sick Leave');
  v_old_deducts_annual := COALESCE(OLD.leave_type IN ('Annual Leave', 'Other Leave - Sick Leave'), false);

  -- Handle INSERT (admin-assigned approved leaves)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' AND v_deducts_annual THEN
      UPDATE leave_balances
      SET used_days = used_days + v_days, updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type = 'Annual Leave'
        AND year = v_year;

      IF NOT FOUND THEN
        INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
        VALUES (NEW.user_id, 'Annual Leave', 20, v_days, v_year);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  -- CASE 1: Status changed TO approved and this leave type consumes annual balance
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') AND v_deducts_annual THEN
    UPDATE leave_balances
    SET used_days = used_days + v_days, updated_at = now()
    WHERE user_id = NEW.user_id
      AND leave_type = 'Annual Leave'
      AND year = v_year;

    IF NOT FOUND THEN
      INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
      VALUES (NEW.user_id, 'Annual Leave', 20, v_days, v_year);
    END IF;
  END IF;

  -- CASE 2: Status changed FROM approved and the old leave type consumed annual balance
  IF OLD.status = 'approved' AND NEW.status != 'approved' AND v_old_deducts_annual THEN
    UPDATE leave_balances
    SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
    WHERE user_id = OLD.user_id
      AND leave_type = 'Annual Leave'
      AND year = v_year;
  END IF;

  -- CASE 3: approved leave type changed while staying approved
  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF v_old_deducts_annual AND NOT v_deducts_annual THEN
      UPDATE leave_balances
      SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
      WHERE user_id = OLD.user_id
        AND leave_type = 'Annual Leave'
        AND year = v_year;
    ELSIF NOT v_old_deducts_annual AND v_deducts_annual THEN
      UPDATE leave_balances
      SET used_days = used_days + NEW.days, updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type = 'Annual Leave'
        AND year = v_year;

      IF NOT FOUND THEN
        INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
        VALUES (NEW.user_id, 'Annual Leave', 20, NEW.days, v_year);
      END IF;
    ELSIF v_old_deducts_annual AND v_deducts_annual AND (OLD.days IS DISTINCT FROM NEW.days OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      UPDATE leave_balances
      SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
      WHERE user_id = OLD.user_id
        AND leave_type = 'Annual Leave'
        AND year = v_year;

      UPDATE leave_balances
      SET used_days = used_days + NEW.days, updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type = 'Annual Leave'
        AND year = v_year;

      IF NOT FOUND THEN
        INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year)
        VALUES (NEW.user_id, 'Annual Leave', 20, NEW.days, v_year);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;