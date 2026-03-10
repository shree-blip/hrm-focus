
-- 1. Performance Reviews
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  quality_rating SMALLINT,
  communication_rating SMALLINT,
  ownership_rating SMALLINT,
  collaboration_rating SMALLINT,
  final_score SMALLINT,
  strengths TEXT,
  improvements TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_reviews_employee_select"
ON public.performance_reviews FOR SELECT
USING (
  employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "performance_reviews_reviewer_all"
ON public.performance_reviews FOR ALL
USING (reviewer_id = auth.uid())
WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "performance_reviews_admin_select"
ON public.performance_reviews FOR SELECT
USING (
  has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "performance_reviews_admin_update"
ON public.performance_reviews FOR UPDATE
USING (
  has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX idx_perf_reviews_employee ON public.performance_reviews(employee_id);
CREATE INDEX idx_perf_reviews_reviewer ON public.performance_reviews(reviewer_id);
CREATE INDEX idx_perf_reviews_period ON public.performance_reviews(period_start, period_end);
CREATE INDEX idx_perf_reviews_status ON public.performance_reviews(status);

-- 2. 360 Feedback
CREATE TABLE IF NOT EXISTS public.feedback_360 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  rating SMALLINT NOT NULL,
  comment TEXT,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_360 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_360_insert"
ON public.feedback_360 FOR INSERT
WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "feedback_360_own_select"
ON public.feedback_360 FOR SELECT
USING (from_user_id = auth.uid());

CREATE POLICY "feedback_360_recipient_select"
ON public.feedback_360 FOR SELECT
USING (
  to_employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "feedback_360_admin_select"
ON public.feedback_360 FOR SELECT
USING (
  has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "feedback_360_manager_select"
ON public.feedback_360 FOR SELECT
USING (
  to_employee_id IN (
    SELECT e.id FROM public.employees e
    WHERE e.manager_id IN (
      SELECT emp.id FROM public.employees emp
      JOIN public.profiles p ON p.id = emp.profile_id
      WHERE p.user_id = auth.uid()
    )
    OR e.line_manager_id IN (
      SELECT emp.id FROM public.employees emp
      JOIN public.profiles p ON p.id = emp.profile_id
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE INDEX idx_feedback_360_from ON public.feedback_360(from_user_id);
CREATE INDEX idx_feedback_360_to ON public.feedback_360(to_employee_id);
CREATE INDEX idx_feedback_360_category ON public.feedback_360(category);

-- 3. Performance Goals
CREATE TABLE IF NOT EXISTS public.performance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  progress SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_employee_select"
ON public.performance_goals FOR SELECT
USING (
  employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "goals_employee_update"
ON public.performance_goals FOR UPDATE
USING (
  employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "goals_creator_all"
ON public.performance_goals FOR ALL
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "goals_admin_all"
ON public.performance_goals FOR ALL
USING (
  has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'vp'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "goals_manager_select"
ON public.performance_goals FOR SELECT
USING (
  employee_id IN (
    SELECT e.id FROM public.employees e
    WHERE e.manager_id IN (
      SELECT emp.id FROM public.employees emp
      JOIN public.profiles p ON p.id = emp.profile_id
      WHERE p.user_id = auth.uid()
    )
    OR e.line_manager_id IN (
      SELECT emp.id FROM public.employees emp
      JOIN public.profiles p ON p.id = emp.profile_id
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE INDEX idx_goals_employee ON public.performance_goals(employee_id);
CREATE INDEX idx_goals_created_by ON public.performance_goals(created_by);
CREATE INDEX idx_goals_status ON public.performance_goals(status);
CREATE INDEX idx_goals_target_date ON public.performance_goals(target_date);

-- Enable realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_360;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_goals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
