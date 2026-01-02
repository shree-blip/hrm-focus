-- Fix user_roles RLS to allow VP/Admin to manage all roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "VP and Admin can manage roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
);

-- Create spam_users table to track suspicious accounts
CREATE TABLE IF NOT EXISTS public.spam_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  flagged_at timestamp with time zone DEFAULT now(),
  flagged_by uuid,
  reason text DEFAULT 'Unauthorized signup',
  is_blocked boolean DEFAULT true,
  notes text
);

-- Enable RLS on spam_users - only visible to specific security monitors
ALTER TABLE public.spam_users ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is security monitor
CREATE OR REPLACE FUNCTION public.is_security_monitor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id 
    AND p.email IN ('shree@focusyourfinance.com', 'hello@focusyourfinance.com')
  ) OR has_role(_user_id, 'vp'::app_role) OR has_role(_user_id, 'admin'::app_role)
$$;

-- Only security monitors can see spam users
CREATE POLICY "Security monitors can view spam users"
ON public.spam_users
FOR SELECT
USING (is_security_monitor(auth.uid()));

CREATE POLICY "Security monitors can manage spam users"
ON public.spam_users
FOR ALL
USING (is_security_monitor(auth.uid()))
WITH CHECK (is_security_monitor(auth.uid()));

-- Insert the spam user
INSERT INTO public.spam_users (user_id, email, reason, is_blocked)
VALUES (
  'c5965c8f-3f68-4fe0-9eb8-c837937c5a7c',
  'krishhgangs11@gmail.com',
  'Unauthorized signup - not in employee list',
  true
) ON CONFLICT DO NOTHING;

-- Block the spam user from accessing data by revoking their role permissions
-- First, update their role to a blocked state
UPDATE public.user_roles 
SET role = 'employee' 
WHERE user_id = 'c5965c8f-3f68-4fe0-9eb8-c837937c5a7c';