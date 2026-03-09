ALTER TABLE public.payroll_run_details ADD COLUMN IF NOT EXISTS income_tax numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_run_details ADD COLUMN IF NOT EXISTS social_security numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_run_details ADD COLUMN IF NOT EXISTS provident_fund numeric NOT NULL DEFAULT 0;