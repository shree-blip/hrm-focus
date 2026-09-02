CREATE TABLE public.employment_type_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employment_type text NOT NULL,
  previous_type text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_type_history_employee ON public.employment_type_history(employee_id, effective_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employment_type_history TO authenticated;
GRANT ALL ON public.employment_type_history TO service_role;

ALTER TABLE public.employment_type_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view employment history"
ON public.employment_type_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));

CREATE POLICY "Management can insert employment history"
ON public.employment_type_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));

CREATE POLICY "Management can update employment history"
ON public.employment_type_history FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));

CREATE POLICY "Management can delete employment history"
ON public.employment_type_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));

CREATE OR REPLACE FUNCTION public.log_employment_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employment_type IS DISTINCT FROM OLD.employment_type THEN
    INSERT INTO public.employment_type_history (employee_id, employment_type, previous_type, effective_date, changed_by)
    VALUES (
      NEW.id,
      COALESCE(NEW.employment_type, 'full_time'),
      OLD.employment_type,
      COALESCE(CASE WHEN NEW.employment_type = 'probation' THEN NEW.probation_start_date END, CURRENT_DATE),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_employment_type_change
AFTER UPDATE OF employment_type ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.log_employment_type_change();

-- Backfill: starting entry at joining date
INSERT INTO public.employment_type_history (employee_id, employment_type, effective_date, note)
SELECT e.id,
       CASE WHEN e.employment_type = 'probation' AND e.probation_start_date IS NOT NULL AND e.probation_start_date > e.hire_date
            THEN 'intern' ELSE COALESCE(e.employment_type, 'full_time') END,
       COALESCE(e.hire_date, e.created_at::date),
       'Initial record (backfilled)'
FROM public.employees e;

-- Backfill: probation start entry where probation began after joining
INSERT INTO public.employment_type_history (employee_id, employment_type, previous_type, effective_date, note)
SELECT e.id, 'probation', 'intern', e.probation_start_date, 'Probation start (backfilled)'
FROM public.employees e
WHERE e.employment_type = 'probation'
  AND e.probation_start_date IS NOT NULL
  AND e.hire_date IS NOT NULL
  AND e.probation_start_date > e.hire_date;