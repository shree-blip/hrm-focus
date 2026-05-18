
-- Helper: can the user view a specific asset request?
CREATE OR REPLACE FUNCTION public.can_view_asset_request(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_requests ar
    WHERE ar.id = _request_id
      AND (
        ar.user_id = _user_id
        OR has_role(_user_id, 'admin'::app_role)
        OR has_role(_user_id, 'vp'::app_role)
        OR ar.first_approver_id = get_employee_id_for_user(_user_id)
        OR ar.requester_employee_id IN (
          SELECT get_all_subordinate_employee_ids(get_employee_id_for_user(_user_id))
        )
      )
  );
$$;

-- Helper: can the user view a specific bug report?
CREATE OR REPLACE FUNCTION public.can_view_bug_report(_user_id uuid, _report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bug_reports br
    WHERE br.id = _report_id
      AND (
        br.user_id = _user_id
        OR has_role(_user_id, 'admin'::app_role)
        OR has_role(_user_id, 'vp'::app_role)
        OR has_permission(_user_id, 'view_bug_reports')
        OR has_permission(_user_id, 'manage_support')
        OR br.user_id IN (SELECT get_all_subordinate_user_ids(_user_id))
      )
  );
$$;

-- Asset Request Comments
CREATE TABLE public.asset_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_request_comments_request ON public.asset_request_comments(request_id);
ALTER TABLE public.asset_request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View asset comments if can view request"
ON public.asset_request_comments FOR SELECT TO authenticated
USING (public.can_view_asset_request(auth.uid(), request_id));

CREATE POLICY "Post asset comments after approval"
ON public.asset_request_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_asset_request(auth.uid(), request_id)
  AND EXISTS (
    SELECT 1 FROM public.asset_requests ar
    WHERE ar.id = request_id AND ar.approval_stage = 'approved'
  )
);

CREATE POLICY "Authors edit own asset comments"
ON public.asset_request_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authors or admins delete asset comments"
ON public.asset_request_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

CREATE TRIGGER trg_asset_request_comments_updated_at
BEFORE UPDATE ON public.asset_request_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bug Report Comments
CREATE TABLE public.bug_report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id uuid NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bug_report_comments_bug ON public.bug_report_comments(bug_report_id);
ALTER TABLE public.bug_report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View bug comments if can view report"
ON public.bug_report_comments FOR SELECT TO authenticated
USING (public.can_view_bug_report(auth.uid(), bug_report_id));

CREATE POLICY "Post bug comments if can view report"
ON public.bug_report_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_bug_report(auth.uid(), bug_report_id)
);

CREATE POLICY "Authors edit own bug comments"
ON public.bug_report_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authors or admins delete bug comments"
ON public.bug_report_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role));

CREATE TRIGGER trg_bug_report_comments_updated_at
BEFORE UPDATE ON public.bug_report_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
