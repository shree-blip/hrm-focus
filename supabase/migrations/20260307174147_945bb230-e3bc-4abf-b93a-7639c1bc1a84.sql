
-- Create invoices table
CREATE TABLE public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  org_id UUID REFERENCES public.organizations(id),
  sender_name TEXT NOT NULL,
  sender_address TEXT,
  sender_email TEXT,
  bill_to_client_id UUID REFERENCES public.clients(id),
  bill_to_name TEXT NOT NULL,
  bill_to_address TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  month_of_service TEXT,
  service_description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NPR',
  payment_account_name TEXT,
  payment_bank_name TEXT,
  payment_account_number TEXT,
  payment_swift_code TEXT,
  pdf_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoice_comments table
CREATE TABLE public.invoice_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_comments_invoice_id ON public.invoice_comments(invoice_id);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'submitted', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_invoice_status
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_status();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_comments ENABLE ROW LEVEL SECURITY;

-- Invoice RLS policies
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "VP and Admin can view all org invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "VP and Admin can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Invoice comments RLS
CREATE POLICY "Users can view comments on own invoices"
  ON public.invoice_comments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
    OR has_role(auth.uid(), 'vp'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users and VP can insert comments"
  ON public.invoice_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
      OR has_role(auth.uid(), 'vp'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload invoice PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own invoice PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "VP can view all invoice PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
