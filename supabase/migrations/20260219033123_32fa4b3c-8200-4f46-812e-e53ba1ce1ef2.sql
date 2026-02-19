
-- 1. Create an announcement_publishers table for users who can post announcements
CREATE TABLE IF NOT EXISTS public.announcement_publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.announcement_publishers ENABLE ROW LEVEL SECURITY;

-- Only admins/vp/managers can manage this table
CREATE POLICY "Admins can manage announcement publishers"
ON public.announcement_publishers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Anyone authenticated can read (to check own access)
CREATE POLICY "Users can check own publisher status"
ON public.announcement_publishers
FOR SELECT
USING (user_id = auth.uid());

-- 2. Helper function to check if user can manage announcements
CREATE OR REPLACE FUNCTION public.can_manage_announcements(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_role(_user_id, 'admin'::app_role)
    OR has_role(_user_id, 'vp'::app_role)
    OR has_role(_user_id, 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM announcement_publishers WHERE user_id = _user_id)
  )
$$;

-- 3. Update announcements RLS to use the new function
DROP POLICY IF EXISTS "Managers can manage announcements" ON public.announcements;
CREATE POLICY "Authorized users can manage announcements"
ON public.announcements
FOR ALL
USING (can_manage_announcements(auth.uid()))
WITH CHECK (can_manage_announcements(auth.uid()));

-- 4. Insert Hemant as announcement publisher
INSERT INTO public.announcement_publishers (user_id, granted_by)
VALUES (
  '220869fe-4256-48bf-bdef-b636ee0ae858',
  (SELECT id FROM auth.users WHERE email = 'hemant@focusyourfinance.com' LIMIT 1)
);

-- 5. Create a function to auto-populate employee_id on attendance_logs insert
CREATE OR REPLACE FUNCTION public.set_attendance_employee_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT e.id INTO NEW.employee_id
    FROM employees e
    JOIN profiles p ON p.id = e.profile_id
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_attendance_employee_id
BEFORE INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_attendance_employee_id();

-- 6. Backfill existing attendance_logs with missing employee_id
UPDATE attendance_logs al
SET employee_id = e.id
FROM employees e
JOIN profiles p ON p.id = e.profile_id
WHERE p.user_id = al.user_id
AND al.employee_id IS NULL;
