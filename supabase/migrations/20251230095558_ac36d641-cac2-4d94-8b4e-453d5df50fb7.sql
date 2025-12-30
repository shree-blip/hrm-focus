-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  allowed_email_domains TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add org_id to tables if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'org_id') THEN
    ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'org_id') THEN
    ALTER TABLE public.employees ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_logs' AND column_name = 'org_id') THEN
    ALTER TABLE public.attendance_logs ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'org_id') THEN
    ALTER TABLE public.leave_requests ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_balances' AND column_name = 'org_id') THEN
    ALTER TABLE public.leave_balances ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslip_files' AND column_name = 'org_id') THEN
    ALTER TABLE public.payslip_files ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_runs' AND column_name = 'org_id') THEN
    ALTER TABLE public.payroll_runs ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'org_id') THEN
    ALTER TABLE public.payslips ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'org_id') THEN
    ALTER TABLE public.documents ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'org_id') THEN
    ALTER TABLE public.tasks ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'org_id') THEN
    ALTER TABLE public.notifications ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON public.employees(org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_org_id ON public.attendance_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_id ON public.leave_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_payslip_files_org_id ON public.payslip_files(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_id ON public.payroll_runs(org_id);

-- Create organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  is_org_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Enable RLS on organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id UUID, _org_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = _user_id AND org_id = _org_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_vp(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = 'vp'
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_email_domain(_email TEXT, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT;
  allowed_domains TEXT[];
BEGIN
  email_domain := split_part(_email, '@', 2);
  SELECT allowed_email_domains INTO allowed_domains
  FROM public.organizations WHERE id = _org_id;
  RETURN email_domain = ANY(allowed_domains);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_by_slug(_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  allowed_email_domains TEXT[],
  logo_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, o.allowed_email_domains, o.logo_url
  FROM public.organizations o
  WHERE o.slug = _slug
$$;

-- RLS for organizations
CREATE POLICY "Anyone can view orgs" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Auth users can create orgs" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Org admins can update org" ON public.organizations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = id AND om.user_id = auth.uid() AND om.is_org_admin = true)
);

-- RLS for organization_members  
CREATE POLICY "View own org members" ON public.organization_members FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "First user or admin can insert" ON public.organization_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = organization_members.org_id)
    OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = organization_members.org_id AND om.user_id = auth.uid() AND om.is_org_admin = true)
  )
);
CREATE POLICY "Org admins can update members" ON public.organization_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.is_org_admin = true)
);