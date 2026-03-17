
-- Add IANA timezone column to employees table
-- Default to Asia/Kathmandu for Nepal-based company
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kathmandu';

-- Add comment for documentation
COMMENT ON COLUMN public.employees.timezone IS 'IANA timezone for the employee physical work location. Used as single source of truth for attendance timestamps.';
