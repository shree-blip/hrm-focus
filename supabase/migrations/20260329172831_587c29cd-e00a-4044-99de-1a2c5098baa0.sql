
-- 1. Add half-day columns to leave_requests
ALTER TABLE public.leave_requests 
  ADD COLUMN IF NOT EXISTS is_half_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS half_day_period text;

-- 2. Create trigger function to auto-deduct/reverse leave balances on approval
CREATE OR REPLACE FUNCTION public.auto_deduct_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year integer;
  v_days numeric;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_days := NEW.days;

  -- CASE 1: Status changed TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Always deduct from Annual Leave (company policy: all leaves count against annual)
    UPDATE leave_balances
    SET used_days = used_days + v_days, updated_at = now()
    WHERE user_id = NEW.user_id
      AND leave_type = 'Annual Leave'
      AND year = v_year;

    -- If no annual leave balance row exists for this year, create one
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
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance ON public.leave_requests;
CREATE TRIGGER trg_auto_deduct_leave_balance
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_leave_balance();
