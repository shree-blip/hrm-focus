-- Fix RLS policies for tasks to allow assignees to update task status
-- Drop existing update policy and create a more permissive one

DROP POLICY IF EXISTS "Task owners and assignees can update" ON public.tasks;

CREATE POLICY "Task owners, assignees, and managers can update" 
ON public.tasks 
FOR UPDATE 
USING (
  auth.uid() = created_by 
  OR auth.uid() = assignee_id 
  OR public.is_task_assignee(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vp'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- Allow all authenticated users to assign anyone (new policy for task_assignees)
DROP POLICY IF EXISTS "Task owners and managers can assign users" ON public.task_assignees;

CREATE POLICY "Authenticated users can assign task" 
ON public.task_assignees 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND assigned_by = auth.uid()
);

-- Add client_id column to tasks table to link with clients
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);

-- Create a function to auto-create work log when task moves to in-progress
CREATE OR REPLACE FUNCTION public.create_worklog_on_task_progress()
RETURNS TRIGGER AS $$
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
      
      -- Create work log entry
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
        TO_CHAR(NOW() AT TIME ZONE 'UTC', 'HH24:MI'),
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
          TO_CHAR(NOW() AT TIME ZONE 'UTC', 'HH24:MI'),
          'in_progress',
          'Auto-created from task: ' || NEW.title
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS task_to_worklog_trigger ON public.tasks;
CREATE TRIGGER task_to_worklog_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_worklog_on_task_progress();