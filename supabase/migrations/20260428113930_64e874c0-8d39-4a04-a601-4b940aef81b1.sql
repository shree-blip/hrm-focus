DROP POLICY IF EXISTS "VP and Admin can view all org invoices" ON public.invoices;
DROP POLICY IF EXISTS "VP and Admin can update invoices" ON public.invoices;

CREATE POLICY "VP can view all invoices"
ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'vp'::app_role));

CREATE POLICY "VP can update invoices"
ON public.invoices FOR UPDATE
USING (has_role(auth.uid(), 'vp'::app_role));

DROP POLICY IF EXISTS "VP and Admin can view all invoice comments" ON public.invoice_comments;
DROP POLICY IF EXISTS "VP and Admin can insert invoice comments" ON public.invoice_comments;

CREATE POLICY "VP can view all invoice comments"
ON public.invoice_comments FOR SELECT
USING (has_role(auth.uid(), 'vp'::app_role));

CREATE POLICY "VP can insert invoice comments"
ON public.invoice_comments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vp'::app_role) AND user_id = auth.uid());