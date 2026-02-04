-- Drop and recreate the trigger function with complete task lifecycle handling
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
  v_work_log RECORD;
  v_end_time time;
  v_duration_minutes integer;
  v_has_worklog boolean;
BEGIN
  -- Handle when status changes to 'in-progress'
  IF NEW.status = 'in-progress' AND (OLD.status IS NULL OR OLD.status != 'in-progress') THEN
    v_client_id := NEW.client_id;
    
    -- For each assignee, create a work log entry
    FOR assignee_record IN 
      SELECT ta.user_id 
      FROM public.task_assignees ta 
      WHERE ta.task_id = NEW.id
    LOOP
      SELECT e.id, e.org_id INTO v_employee_id, v_org_id
      FROM public.employees e
      JOIN public.profiles p ON e.profile_id = p.id
      WHERE p.user_id = assignee_record.user_id
      LIMIT 1;
      
      INSERT INTO public.work_logs (
        user_id, employee_id, org_id, client_id, log_date,
        task_description, time_spent_minutes, start_time, status, notes
      ) VALUES (
        assignee_record.user_id, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
        NEW.title, 0, (NOW() AT TIME ZONE 'UTC')::time, 'in_progress',
        'Auto-created from task: ' || NEW.title
      );
    END LOOP;
    
    -- Handle legacy assignee_id
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
          user_id, employee_id, org_id, client_id, log_date,
          task_description, time_spent_minutes, start_time, status, notes
        ) VALUES (
          NEW.assignee_id, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
          NEW.title, 0, (NOW() AT TIME ZONE 'UTC')::time, 'in_progress',
          'Auto-created from task: ' || NEW.title
        );
      END IF;
    END IF;
    
    -- Handle self-assigned case
    IF NOT EXISTS (
      SELECT 1 FROM public.task_assignees 
      WHERE task_id = NEW.id AND user_id = NEW.created_by
    ) AND NEW.assignee_id IS NULL THEN
      SELECT e.id, e.org_id INTO v_employee_id, v_org_id
      FROM public.employees e
      JOIN public.profiles p ON e.profile_id = p.id
      WHERE p.user_id = NEW.created_by
      LIMIT 1;
      
      IF v_employee_id IS NOT NULL THEN
        INSERT INTO public.work_logs (
          user_id, employee_id, org_id, client_id, log_date,
          task_description, time_spent_minutes, start_time, status, notes
        ) VALUES (
          NEW.created_by, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
          NEW.title, 0, (NOW() AT TIME ZONE 'UTC')::time, 'in_progress',
          'Auto-created from task: ' || NEW.title
        );
      END IF;
    END IF;
  END IF;
  
  -- Handle when status changes to 'done' - auto-complete work logs
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    v_client_id := NEW.client_id;
    v_end_time := (NOW() AT TIME ZONE 'UTC')::time;
    v_has_worklog := FALSE;
    
    -- Update all work logs that were auto-created from this task
    FOR v_work_log IN 
      SELECT wl.id, wl.start_time, wl.user_id
      FROM public.work_logs wl
      WHERE wl.notes = 'Auto-created from task: ' || NEW.title
        AND wl.status = 'in_progress'
        AND wl.log_date = CURRENT_DATE
    LOOP
      v_has_worklog := TRUE;
      
      -- Calculate duration in minutes
      IF v_work_log.start_time IS NOT NULL THEN
        v_duration_minutes := EXTRACT(EPOCH FROM (v_end_time - v_work_log.start_time)) / 60;
        IF v_duration_minutes < 0 THEN
          v_duration_minutes := v_duration_minutes + (24 * 60);
        END IF;
      ELSE
        v_duration_minutes := 0;
      END IF;
      
      -- Update the work log with end time and calculated duration
      UPDATE public.work_logs
      SET 
        end_time = v_end_time,
        time_spent_minutes = v_duration_minutes,
        status = 'completed'
      WHERE id = v_work_log.id;
    END LOOP;
    
    -- If no work log exists (direct todo -> done), create a completed one
    IF NOT v_has_worklog THEN
      -- Create for all assignees
      FOR assignee_record IN 
        SELECT ta.user_id 
        FROM public.task_assignees ta 
        WHERE ta.task_id = NEW.id
      LOOP
        SELECT e.id, e.org_id INTO v_employee_id, v_org_id
        FROM public.employees e
        JOIN public.profiles p ON e.profile_id = p.id
        WHERE p.user_id = assignee_record.user_id
        LIMIT 1;
        
        INSERT INTO public.work_logs (
          user_id, employee_id, org_id, client_id, log_date,
          task_description, time_spent_minutes, start_time, end_time, status, notes
        ) VALUES (
          assignee_record.user_id, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
          NEW.title, 0, v_end_time, v_end_time, 'completed',
          'Auto-created from task: ' || NEW.title || ' (completed directly)'
        );
      END LOOP;
      
      -- Handle legacy assignee_id
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
            user_id, employee_id, org_id, client_id, log_date,
            task_description, time_spent_minutes, start_time, end_time, status, notes
          ) VALUES (
            NEW.assignee_id, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
            NEW.title, 0, v_end_time, v_end_time, 'completed',
            'Auto-created from task: ' || NEW.title || ' (completed directly)'
          );
        END IF;
      END IF;
      
      -- Handle self-completed case
      IF NOT EXISTS (
        SELECT 1 FROM public.task_assignees 
        WHERE task_id = NEW.id AND user_id = NEW.created_by
      ) AND NEW.assignee_id IS NULL THEN
        SELECT e.id, e.org_id INTO v_employee_id, v_org_id
        FROM public.employees e
        JOIN public.profiles p ON e.profile_id = p.id
        WHERE p.user_id = NEW.created_by
        LIMIT 1;
        
        IF v_employee_id IS NOT NULL THEN
          INSERT INTO public.work_logs (
            user_id, employee_id, org_id, client_id, log_date,
            task_description, time_spent_minutes, start_time, end_time, status, notes
          ) VALUES (
            NEW.created_by, v_employee_id, v_org_id, v_client_id, CURRENT_DATE,
            NEW.title, 0, v_end_time, v_end_time, 'completed',
            'Auto-created from task: ' || NEW.title || ' (completed directly)'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_create_worklog_on_task_progress ON public.tasks;
CREATE TRIGGER trigger_create_worklog_on_task_progress
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_worklog_on_task_progress();