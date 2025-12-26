
-- Create allowed_signups table to restrict who can sign up
CREATE TABLE public.allowed_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can check if their email is allowed (for signup validation)
CREATE POLICY "Anyone can check allowed emails"
  ON public.allowed_signups
  FOR SELECT
  USING (true);

-- Only VP and managers can invite new users
CREATE POLICY "VP and managers can invite users"
  ON public.allowed_signups
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Only VP and managers can update invitations
CREATE POLICY "VP and managers can update invitations"
  ON public.allowed_signups
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Only VP and managers can delete invitations
CREATE POLICY "VP and managers can delete invitations"
  ON public.allowed_signups
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'vp'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );
