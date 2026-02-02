-- Create enum for request status
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'declined');

-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'open',
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset_requests table
CREATE TABLE public.asset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'asset', -- 'asset' or 'it_support'
  status public.request_status DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_requests ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is Bikash or Sagar (IT team)
CREATE OR REPLACE FUNCTION public.is_it_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IN (
    '6bf66314-dc0f-4dda-945d-2b12972dbd84', -- Sagar
    '2e75b9b5-8a15-46eb-8721-16fcbe7db719'  -- Bikash
  )
$$;

-- Bug Reports RLS Policies
-- Anyone can submit bug reports
CREATE POLICY "Users can submit bug reports"
ON public.bug_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own bug reports
CREATE POLICY "Users can view their own bug reports"
ON public.bug_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Only Bikash and Sagar can view all bug reports
CREATE POLICY "IT team can view all bug reports"
ON public.bug_reports
FOR SELECT
USING (is_it_team(auth.uid()));

-- Only Bikash and Sagar can update bug reports
CREATE POLICY "IT team can update bug reports"
ON public.bug_reports
FOR UPDATE
USING (is_it_team(auth.uid()));

-- Asset Requests RLS Policies
-- Anyone can submit asset requests
CREATE POLICY "Users can submit asset requests"
ON public.asset_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own asset requests
CREATE POLICY "Users can view their own asset requests"
ON public.asset_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Managers, line managers, VP, admin can view all asset requests
CREATE POLICY "Management can view all asset requests"
ON public.asset_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR
  is_line_manager(auth.uid())
);

-- Managers, line managers, VP, admin can update asset requests
CREATE POLICY "Management can update asset requests"
ON public.asset_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR
  is_line_manager(auth.uid())
);

-- Create storage bucket for bug report screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('bug-screenshots', 'bug-screenshots', false);

-- Storage policies for bug screenshots
CREATE POLICY "Authenticated users can upload bug screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bug-screenshots' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own bug screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bug-screenshots' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_it_team(auth.uid())));

-- Add triggers for updated_at
CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asset_requests_updated_at
BEFORE UPDATE ON public.asset_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();