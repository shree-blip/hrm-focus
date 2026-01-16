-- Create work_log_history table to track changes
CREATE TABLE public.work_log_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_log_id UUID NOT NULL REFERENCES public.work_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL DEFAULT 'update',
  previous_task_description TEXT,
  new_task_description TEXT,
  previous_time_spent_minutes INTEGER,
  new_time_spent_minutes INTEGER,
  previous_notes TEXT,
  new_notes TEXT,
  previous_log_date DATE,
  new_log_date DATE
);

-- Enable RLS
ALTER TABLE public.work_log_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own edit history
CREATE POLICY "Users can view their own work log history"
  ON public.work_log_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- VP, Admin, and Managers can view all history
CREATE POLICY "Managers can view all work log history"
  ON public.work_log_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Users can insert their own history records
CREATE POLICY "Users can insert their own work log history"
  ON public.work_log_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_work_log_history_work_log_id ON public.work_log_history(work_log_id);
CREATE INDEX idx_work_log_history_user_id ON public.work_log_history(user_id);
CREATE INDEX idx_work_log_history_changed_at ON public.work_log_history(changed_at DESC);