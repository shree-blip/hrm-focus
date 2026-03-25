
-- Add approval workflow columns to asset_requests
ALTER TABLE public.asset_requests 
  ADD COLUMN IF NOT EXISTS first_approver_id uuid,
  ADD COLUMN IF NOT EXISTS approval_stage text NOT NULL DEFAULT 'pending_line_manager',
  ADD COLUMN IF NOT EXISTS line_manager_approved_by uuid,
  ADD COLUMN IF NOT EXISTS line_manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_approved_by uuid,
  ADD COLUMN IF NOT EXISTS admin_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS requester_employee_id uuid;

-- Drop old status enum default and alter to text for flexible statuses
ALTER TABLE public.asset_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.asset_requests ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.asset_requests ALTER COLUMN status SET DEFAULT 'pending_line_manager';

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Permitted users can view all asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Permitted users can update asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can submit asset requests" ON public.asset_requests;

-- New RLS policies for hierarchical approval
-- 1. Employees see their own requests
CREATE POLICY "Users can view own asset requests"
ON public.asset_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 2. Line managers see requests assigned to them
CREATE POLICY "Line managers see assigned requests"
ON public.asset_requests FOR SELECT TO authenticated
USING (first_approver_id = get_employee_id_for_user(auth.uid()));

-- 3. Admins/VPs see requests at admin stage or completed
CREATE POLICY "Admins see admin-stage requests"
ON public.asset_requests FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'))
  AND approval_stage IN ('pending_admin', 'approved', 'declined')
);

-- 4. Users can insert their own requests
CREATE POLICY "Users can submit asset requests"
ON public.asset_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. Line managers can update requests assigned to them at LM stage
CREATE POLICY "Line managers can update assigned requests"
ON public.asset_requests FOR UPDATE TO authenticated
USING (
  first_approver_id = get_employee_id_for_user(auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'vp')
);

-- Create trigger function to auto-set first_approver_id and requester_employee_id on insert
CREATE OR REPLACE FUNCTION public.set_asset_request_approver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id uuid;
  v_line_manager_id uuid;
BEGIN
  -- Get employee ID for the requester
  SELECT get_employee_id_for_user(NEW.user_id) INTO v_employee_id;
  NEW.requester_employee_id := v_employee_id;

  -- Get line manager
  IF v_employee_id IS NOT NULL THEN
    SELECT line_manager_id INTO v_line_manager_id
    FROM public.employees WHERE id = v_employee_id;
  END IF;

  IF v_line_manager_id IS NOT NULL THEN
    NEW.first_approver_id := v_line_manager_id;
    NEW.approval_stage := 'pending_line_manager';
    NEW.status := 'pending_line_manager';
  ELSE
    -- Fallback: go directly to admin
    NEW.approval_stage := 'pending_admin';
    NEW.status := 'pending_admin';
    NEW.first_approver_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_asset_request_approver
  BEFORE INSERT ON public.asset_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_asset_request_approver();

-- Update existing records to have proper approval_stage
UPDATE public.asset_requests SET approval_stage = 'approved', status = 'approved' WHERE status = 'approved';
UPDATE public.asset_requests SET approval_stage = 'declined', status = 'declined' WHERE status = 'declined';
UPDATE public.asset_requests SET approval_stage = 'pending_admin', status = 'pending_admin' WHERE status = 'pending';
