
-- Grievance status enum-like check
-- Using text with validation trigger instead of enum for flexibility

-- Create storage bucket for grievance attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('grievance-attachments', 'grievance-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Grievances table
CREATE TABLE public.grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  employee_id uuid REFERENCES public.employees(id),
  title text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  details text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  anonymous_visibility text NOT NULL DEFAULT 'nobody',
  status text NOT NULL DEFAULT 'submitted',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grievance comments table
CREATE TABLE public.grievance_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grievance attachments table
CREATE TABLE public.grievance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: check if user can view a grievance (handles anonymous visibility)
CREATE OR REPLACE FUNCTION public.can_view_grievance(
  _user_id uuid,
  _grievance_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grievances g
    WHERE g.id = _grievance_id
    AND (
      -- Owner can always see their own
      g.user_id = _user_id
      -- Admin can see all
      OR has_role(_user_id, 'admin')
      -- VP can see all
      OR has_role(_user_id, 'vp')
      -- Manager/line manager can see team grievances (non-anonymous or allowed)
      OR (
        (has_role(_user_id, 'manager') OR is_line_manager(_user_id))
        AND g.employee_id IN (
          SELECT e.id FROM employees e
          WHERE e.line_manager_id = get_employee_id_for_user(_user_id)
             OR e.manager_id = get_employee_id_for_user(_user_id)
        )
      )
    )
  )
$$;

-- Grievances RLS policies
CREATE POLICY "Users can create grievances"
  ON public.grievances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own grievances"
  ON public.grievances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin VP can view all grievances"
  ON public.grievances FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));

CREATE POLICY "Managers can view team grievances"
  ON public.grievances FOR SELECT
  USING (
    (has_role(auth.uid(), 'manager') OR is_line_manager(auth.uid()))
    AND employee_id IN (
      SELECT e.id FROM employees e
      WHERE e.line_manager_id = get_employee_id_for_user(auth.uid())
         OR e.manager_id = get_employee_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Admin VP Manager can update grievances"
  ON public.grievances FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vp')
    OR has_role(auth.uid(), 'manager')
  );

-- Grievance comments RLS
CREATE POLICY "Users can add comments to visible grievances"
  ON public.grievance_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND can_view_grievance(auth.uid(), grievance_id)
  );

CREATE POLICY "Users can view comments on visible grievances"
  ON public.grievance_comments FOR SELECT
  USING (can_view_grievance(auth.uid(), grievance_id));

CREATE POLICY "Internal comments visible to management only"
  ON public.grievance_comments FOR SELECT
  USING (
    is_internal = false
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vp')
    OR has_role(auth.uid(), 'manager')
  );

-- Grievance attachments RLS
CREATE POLICY "Users can upload attachments to own grievances"
  ON public.grievance_attachments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can view attachments on visible grievances"
  ON public.grievance_attachments FOR SELECT
  USING (can_view_grievance(auth.uid(), grievance_id));

-- Storage policies for grievance-attachments bucket
CREATE POLICY "Users can upload grievance attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'grievance-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view grievance attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'grievance-attachments' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_grievances_updated_at
  BEFORE UPDATE ON public.grievances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grievance_comments_updated_at
  BEFORE UPDATE ON public.grievance_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
