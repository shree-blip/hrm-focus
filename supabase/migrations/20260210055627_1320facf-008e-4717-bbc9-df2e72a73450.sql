
-- Add unique constraint for deduplication (task_id + user_id + log_date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_logs_task_user_date 
ON public.work_logs (task_id, user_id, log_date) 
WHERE task_id IS NOT NULL;

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_task_status_change ON public.tasks;

CREATE TRIGGER on_task_status_change
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_worklog_on_task_progress();
