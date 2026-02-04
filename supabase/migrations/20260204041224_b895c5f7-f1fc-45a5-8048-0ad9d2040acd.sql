-- Drop and recreate the trigger function with proper fixes
CREATE OR REPLACE FUNCTION public.create_worklog_on_task_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assignee_record RECORD;
  v_employee_id uuid;
  v_org_id uuid;
  v_client_id uuid;
BEGIN
  -- Only trigger when status changes to 'in-progress'
  IF NEW.status = 'in-progress' AND (OLD.status IS NULL OR OLD.status != 'in-progress') THEN
    -- Get client_id from task
    v_client_id := NEW.client_id;
    
    -- For each assignee, create a work log entry
    FOR assignee_record IN 
      SELECT ta.user_id 
      FROM public.task_assignees ta 
      WHERE ta.task_id = NEW.id
    LOOP
      -- Get employee_id and org_id for the assignee
      SELECT e.id, e.org_id INTO v_employee_id, v_org_id
      FROM public.employees e
      JOIN public.profiles p ON e.profile_id = p.id
      WHERE p.user_id = assignee_record.user_id
      LIMIT 1;
      
      -- Create work log entry with proper time type casting
      INSERT INTO public.work_logs (
        user_id,
        employee_id,
        org_id,
        client_id,
        log_date,
        task_description,
        time_spent_minutes,
        start_time,
        status,
        notes
      ) VALUES (
        assignee_record.user_id,
        v_employee_id,
        v_org_id,
        v_client_id,
        CURRENT_DATE,
        NEW.title,
        0,
        (NOW() AT TIME ZONE 'UTC')::time,
        'in_progress',
        'Auto-created from task: ' || NEW.title
      );
    END LOOP;
    
    -- Also create for the legacy assignee_id if set and not in task_assignees
    IF NEW.assignee_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.task_assignees 
        WHERE task_id = NEW.id AND user_id = NEW.assignee_id
      ) THEN
        SELECT e.id, e.org_id INTO v_employee_id, v_org_id
        FROM public.employees e
        JOIN public.profiles p ON e.profile_id = p.id
        WHERE p.user_id = NEW.assignee_id
        LIMIT 1;
        
        INSERT INTO public.work_logs (
          user_id,
          employee_id,
          org_id,
          client_id,
          log_date,
          task_description,
          time_spent_minutes,
          start_time,
          status,
          notes
        ) VALUES (
          NEW.assignee_id,
          v_employee_id,
          v_org_id,
          v_client_id,
          CURRENT_DATE,
          NEW.title,
          0,
          (NOW() AT TIME ZONE 'UTC')::time,
          'in_progress',
          'Auto-created from task: ' || NEW.title
        );
      END IF;
    END IF;
    
    -- Also handle case where user assigns task to themselves (created_by = updater)
    -- Check if created_by is an assignee, if not and they're moving to in-progress, add them
    IF NOT EXISTS (
      SELECT 1 FROM public.task_assignees 
      WHERE task_id = NEW.id AND user_id = NEW.created_by
    ) AND NEW.assignee_id IS NULL THEN
      -- The creator moved task to in-progress but isn't in assignees
      -- Create work log for the creator
      SELECT e.id, e.org_id INTO v_employee_id, v_org_id
      FROM public.employees e
      JOIN public.profiles p ON e.profile_id = p.id
      WHERE p.user_id = NEW.created_by
      LIMIT 1;
      
      IF v_employee_id IS NOT NULL THEN
        INSERT INTO public.work_logs (
          user_id,
          employee_id,
          org_id,
          client_id,
          log_date,
          task_description,
          time_spent_minutes,
          start_time,
          status,
          notes
        ) VALUES (
          NEW.created_by,
          v_employee_id,
          v_org_id,
          v_client_id,
          CURRENT_DATE,
          NEW.title,
          0,
          (NOW() AT TIME ZONE 'UTC')::time,
          'in_progress',
          'Auto-created from task: ' || NEW.title
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS trigger_create_worklog_on_task_progress ON public.tasks;
CREATE TRIGGER trigger_create_worklog_on_task_progress
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_worklog_on_task_progress();