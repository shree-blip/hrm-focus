-- Create function to trigger welcome email on new employee insert
CREATE OR REPLACE FUNCTION public.notify_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  -- Get Supabase URL and anon key from environment
  v_url := current_setting('app.settings.supabase_url', true);
  
  -- Use net extension for async HTTP call if available, otherwise use pg_notify
  -- We'll use pg_notify approach which the edge function can listen to
  -- Actually, use the Supabase edge function invocation via http extension
  
  -- Insert a record into a queue table that gets processed
  -- For simplicity, use pg_net if available, otherwise just log
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) 
           || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1)
    ),
    body := jsonb_build_object(
      'employee_id', NEW.id,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'email', NEW.email,
      'job_title', NEW.job_title,
      'department', NEW.department,
      'start_date', NEW.hire_date
    )
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if email fails
  RAISE WARNING 'Welcome email trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on employees table
DROP TRIGGER IF EXISTS trg_send_welcome_email ON public.employees;
CREATE TRIGGER trg_send_welcome_email
  AFTER INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_welcome_email();