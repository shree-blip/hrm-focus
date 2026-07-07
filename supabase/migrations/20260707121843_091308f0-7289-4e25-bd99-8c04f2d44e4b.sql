-- Weekly sprints table for the Performance module
CREATE TABLE public.weekly_sprints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  org_id uuid,
  week_start date NOT NULL,
  week_end date NOT NULL,
  current_tasks text,
  weekly_targets text,
  last_week_completed text,
  upcoming_plan text,
  notes_blockers text,
  status text NOT NULL DEFAULT 'pending_review',
  score smallint,
  reviewer_id uuid,
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_sprints_status_check CHECK (status IN ('pending_review','reviewed','needs_improvement')),
  CONSTRAINT weekly_sprints_score_check CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  CONSTRAINT weekly_sprints_unique_week UNIQUE (employee_id, week_start)
);

-- Grants (Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_sprints TO authenticated;
GRANT ALL ON public.weekly_sprints TO service_role;

-- Enable RLS
ALTER TABLE public.weekly_sprints ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a manager (in the reporting line) of the given employee, or admin/vp
CREATE OR REPLACE FUNCTION public.can_review_sprint(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'vp'::app_role)
    OR (
      public.get_employee_id_for_user(_user_id) IS NOT NULL
      AND _employee_id IN (
        SELECT public.get_all_subordinate_employee_ids(public.get_employee_id_for_user(_user_id))
      )
    )
$$;

-- SELECT: own sprints, or subordinate/team sprints, or admin/vp all
CREATE POLICY "View own or team sprints"
ON public.weekly_sprints FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_review_sprint(auth.uid(), employee_id)
);

-- INSERT: employees create their own sprints
CREATE POLICY "Create own sprint"
ON public.weekly_sprints FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: owner can edit their own sprint content; managers/admins can review
CREATE POLICY "Update own or reviewable sprint"
ON public.weekly_sprints FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_review_sprint(auth.uid(), employee_id)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.can_review_sprint(auth.uid(), employee_id)
);

-- DELETE: owner or admin/vp
CREATE POLICY "Delete own sprint or admin"
ON public.weekly_sprints FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'vp'::app_role)
);

-- updated_at trigger
CREATE TRIGGER update_weekly_sprints_updated_at
BEFORE UPDATE ON public.weekly_sprints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();