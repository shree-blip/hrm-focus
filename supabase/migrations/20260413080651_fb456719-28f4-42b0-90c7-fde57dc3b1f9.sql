-- Add unique constraint on employees email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique ON public.employees (lower(email));