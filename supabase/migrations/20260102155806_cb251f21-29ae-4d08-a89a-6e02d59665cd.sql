-- Create a function to auto clock-out users after 8 hours
CREATE OR REPLACE FUNCTION public.auto_clock_out_after_8_hours()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER := 0;
  log_record RECORD;
BEGIN
  -- Find all attendance logs where user is still clocked in and it's been more than 8 hours
  FOR log_record IN 
    SELECT al.id, al.user_id, al.employee_id, al.clock_in, e.first_name, e.last_name
    FROM attendance_logs al
    LEFT JOIN employees e ON e.id = al.employee_id
    WHERE al.clock_out IS NULL 
      AND al.clock_in < (now() - interval '8 hours')
  LOOP
    -- Auto clock out
    UPDATE attendance_logs 
    SET 
      clock_out = clock_in + interval '8 hours',
      notes = COALESCE(notes, '') || ' [Auto clocked out after 8 hours]',
      status = 'auto_clocked_out'
    WHERE id = log_record.id;
    
    -- Create notification for the user
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      log_record.user_id,
      'Auto Clock Out',
      'You were automatically clocked out after 8 hours of work. If you are still working, please clock in again.',
      'warning',
      '/attendance'
    );
    
    affected_count := affected_count + 1;
  END LOOP;
  
  RETURN affected_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_clock_out_after_8_hours() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_clock_out_after_8_hours() TO service_role;