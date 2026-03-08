
-- Drop the restrictive SELECT policies on invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "VP and Admin can view all org invoices" ON public.invoices;

-- Recreate as PERMISSIVE policies (default) so either one passing grants access
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "VP and Admin can view all org invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Also fix UPDATE policies to be permissive
DROP POLICY IF EXISTS "Users can update own draft invoices" ON public.invoices;
DROP POLICY IF EXISTS "VP and Admin can update invoices" ON public.invoices;

CREATE POLICY "Users can update own draft invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "VP and Admin can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Also fix INSERT policy
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;

CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
