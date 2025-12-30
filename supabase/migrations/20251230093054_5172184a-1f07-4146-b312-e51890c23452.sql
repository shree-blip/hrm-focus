-- Create payslip_files table to store payslip PDF metadata
CREATE TABLE public.payslip_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid REFERENCES public.employees(id),
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  year integer NOT NULL DEFAULT 2025,
  month integer CHECK (month >= 1 AND month <= 12),
  quarter integer CHECK (quarter >= 1 AND quarter <= 4),
  period_start date NOT NULL,
  period_end date NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_monthly CHECK (period_type != 'monthly' OR month IS NOT NULL),
  CONSTRAINT valid_quarterly CHECK (period_type != 'quarterly' OR quarter IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.payslip_files ENABLE ROW LEVEL SECURITY;

-- Employees can view their own payslips
CREATE POLICY "Users can view their own payslips"
ON public.payslip_files
FOR SELECT
USING (auth.uid() = user_id);

-- VP and Admin can view all payslips
CREATE POLICY "VP and Admin can view all payslips"
ON public.payslip_files
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
);

-- VP and Admin can insert payslips
CREATE POLICY "VP and Admin can insert payslips"
ON public.payslip_files
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
);

-- VP and Admin can update payslips
CREATE POLICY "VP and Admin can update payslips"
ON public.payslip_files
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
);

-- VP and Admin can delete payslips
CREATE POLICY "VP and Admin can delete payslips"
ON public.payslip_files
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role)
);

-- Create storage bucket for payslips if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payslips', 'payslips', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payslips bucket
CREATE POLICY "Users can view their own payslip files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'payslips' AND 
  (auth.uid()::text = (storage.foldername(name))[1] OR
   has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'vp'::app_role))
);

CREATE POLICY "VP and Admin can upload payslip files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'payslips' AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'vp'::app_role))
);

CREATE POLICY "VP and Admin can update payslip files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'payslips' AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'vp'::app_role))
);

CREATE POLICY "VP and Admin can delete payslip files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'payslips' AND
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'vp'::app_role))
);