
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS timezone_status TEXT NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS timezone_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timezone_verified_by UUID,
ADD COLUMN IF NOT EXISTS timezone_effective_from DATE DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.timezone_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  old_timezone TEXT NOT NULL,
  new_timezone TEXT NOT NULL,
  reason TEXT NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  changed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timezone_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and VPs can view timezone change log"
  ON public.timezone_change_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and VPs can insert timezone change log"
  ON public.timezone_change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
