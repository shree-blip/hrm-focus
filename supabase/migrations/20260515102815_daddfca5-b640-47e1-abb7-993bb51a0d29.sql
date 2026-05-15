
-- Hiring posts table
CREATE TABLE public.hiring_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hiring_posts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Authenticated users can view hiring posts"
  ON public.hiring_posts FOR SELECT
  TO authenticated
  USING (true);

-- Only admin or vp can insert
CREATE POLICY "Admin and VP can create hiring posts"
  ON public.hiring_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'vp'::public.app_role)
  );

CREATE POLICY "Admin and VP can update hiring posts"
  ON public.hiring_posts FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'vp'::public.app_role)
  );

CREATE POLICY "Admin and VP can delete hiring posts"
  ON public.hiring_posts FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'vp'::public.app_role)
  );

CREATE TRIGGER hiring_posts_updated_at
  BEFORE UPDATE ON public.hiring_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for JD attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('hiring-attachments', 'hiring-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can read hiring attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hiring-attachments');

CREATE POLICY "Admin/VP can upload hiring attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hiring-attachments'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'vp'::public.app_role)
    )
  );

CREATE POLICY "Admin/VP can delete hiring attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hiring-attachments'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'vp'::public.app_role)
    )
  );
