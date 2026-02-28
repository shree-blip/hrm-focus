
-- Create loan_policies table for dynamic eligibility
CREATE TABLE public.loan_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_level TEXT NOT NULL UNIQUE,
  max_loan NUMERIC NOT NULL DEFAULT 0,
  allowed_terms INTEGER[] NOT NULL DEFAULT '{3,6}',
  interest_rate NUMERIC NOT NULL DEFAULT 5,
  min_tenure_months INTEGER NOT NULL DEFAULT 0,
  allow_if_existing_loan BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_policies ENABLE ROW LEVEL SECURITY;

-- Everyone can read policies
CREATE POLICY "Anyone can read loan policies"
ON public.loan_policies FOR SELECT
TO authenticated
USING (true);

-- Only VP/Admin can manage policies
CREATE POLICY "VP/Admin can manage loan policies"
ON public.loan_policies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin'));

-- Seed default policies
INSERT INTO public.loan_policies (position_level, max_loan, allowed_terms, interest_rate, min_tenure_months, allow_if_existing_loan)
VALUES
  ('entry', 500, '{1,2,3}', 5, 6, false),
  ('mid', 1500, '{1,2,3,4,5,6}', 5, 3, false),
  ('senior', 2500, '{1,2,3,4,5,6}', 5, 0, true),
  ('management', 2500, '{1,2,3,4,5,6}', 5, 0, true);

-- Add trigger for updated_at
CREATE TRIGGER update_loan_policies_updated_at
BEFORE UPDATE ON public.loan_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
