CREATE OR REPLACE FUNCTION public.reset_annual_leave_for_new_period()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    current_yr INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    next_yr INTEGER := current_yr + 1;
    rows_created INTEGER := 0;
BEGIN
    -- Roll the Annual Leave pool forward into the new fiscal year.
    -- Full-Time employees (and anyone without a matched employment type)
    -- reset to a fresh 12 days. Interns / Probation employees do NOT reset:
    -- they carry forward their existing (manually provisioned) balance until
    -- their employment type becomes Full-Time.
    INSERT INTO leave_balances (
        id, user_id, leave_type, total_days, used_days, year, org_id, created_at, updated_at
    )
    SELECT
        gen_random_uuid(),
        lb.user_id,
        'Annual Leave',
        CASE WHEN et.employment_type IN ('intern','probation') THEN lb.total_days ELSE 12 END,
        CASE WHEN et.employment_type IN ('intern','probation') THEN lb.used_days ELSE 0 END,
        next_yr,
        lb.org_id,
        NOW(),
        NOW()
    FROM leave_balances lb
    LEFT JOIN LATERAL (
        SELECT e.employment_type
        FROM employees e
        JOIN profiles p ON p.id = e.profile_id
        WHERE p.user_id = lb.user_id
        LIMIT 1
    ) et ON true
    WHERE lb.leave_type = 'Annual Leave'
      AND lb.year = current_yr
      AND NOT EXISTS (
          SELECT 1 FROM leave_balances lb2
          WHERE lb2.user_id = lb.user_id
            AND lb2.leave_type = 'Annual Leave'
            AND lb2.year = next_yr
      );
    GET DIAGNOSTICS rows_created = ROW_COUNT;

    UPDATE leave_balances new_lb
    SET employee_name = old_lb.employee_name
    FROM leave_balances old_lb
    WHERE old_lb.user_id = new_lb.user_id
      AND old_lb.leave_type = 'Annual Leave'
      AND old_lb.year = current_yr
      AND new_lb.year = next_yr
      AND new_lb.employee_name IS NULL;

    RAISE NOTICE 'Leave reset complete: % new rows created for year %', rows_created, next_yr;
END;
$function$;