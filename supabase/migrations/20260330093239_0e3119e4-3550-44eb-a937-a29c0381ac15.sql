
CREATE OR REPLACE FUNCTION public.auto_deduct_leave_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_days numeric;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_days := NEW.days;

  -- Handle INSERT (admin-assigned approved leaves)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
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
  -- CASE 1: Status changed TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
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

  -- CASE 2: Status changed FROM 'approved' to something else (reversal)
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE leave_balances
    SET used_days = GREATEST(used_days - OLD.days, 0), updated_at = now()
    WHERE user_id = NEW.user_id
      AND leave_type = 'Annual Leave'
      AND year = v_year;
  END IF;

  RETURN NEW;
END;
$function$;
