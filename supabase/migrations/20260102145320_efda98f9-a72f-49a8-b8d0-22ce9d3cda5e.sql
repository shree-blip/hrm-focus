-- Add deduction columns
ALTER TABLE public.employees 
ADD COLUMN income_tax numeric DEFAULT 0,
ADD COLUMN social_security numeric DEFAULT 0,
ADD COLUMN provident_fund numeric DEFAULT 0;