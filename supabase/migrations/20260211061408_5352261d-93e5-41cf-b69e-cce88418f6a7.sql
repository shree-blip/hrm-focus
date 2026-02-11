
-- Add gender column for tax rebate calculation
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL;

-- Add insurance_premium for optional insurance deduction
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS insurance_premium numeric DEFAULT 0;

-- Add dashain_bonus flag (whether to include Dashain bonus in annual calculation)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS include_dashain_bonus boolean DEFAULT false;
