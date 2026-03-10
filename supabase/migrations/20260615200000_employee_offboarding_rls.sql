-- Allow employees to view their own offboarding workflow.
-- The existing RLS only grants access to admin/vp/manager roles.
-- This adds a SELECT policy so the employee can see their own record.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'offboarding_workflows'
      AND policyname = 'Employees can view own offboarding'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Employees can view own offboarding"
      ON public.offboarding_workflows FOR SELECT
      USING (
        employee_id IN (
          SELECT e.id FROM public.employees e
          JOIN public.profiles p ON p.id = e.profile_id
          WHERE p.user_id = auth.uid()
        )
      )
    $$;
  END IF;
END $$;
