-- Create table to track document shares/sends
CREATE TABLE public.document_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  org_id UUID REFERENCES public.organizations(id)
);

-- Enable RLS
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents shared with them
CREATE POLICY "Users can view received document shares"
ON public.document_shares
FOR SELECT
USING (recipient_id = auth.uid());

-- Policy: Users can view documents they sent
CREATE POLICY "Users can view sent document shares"
ON public.document_shares
FOR SELECT
USING (sender_id = auth.uid());

-- Policy: Managers can view all document shares in org
CREATE POLICY "Managers can view all document shares"
ON public.document_shares
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'vp'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Policy: Authenticated users can send documents
CREATE POLICY "Users can send documents"
ON public.document_shares
FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- Policy: Recipients can mark as read
CREATE POLICY "Recipients can update read status"
ON public.document_shares
FOR UPDATE
USING (recipient_id = auth.uid());

-- Add index for faster lookups
CREATE INDEX idx_document_shares_recipient ON public.document_shares(recipient_id);
CREATE INDEX idx_document_shares_sender ON public.document_shares(sender_id);
CREATE INDEX idx_document_shares_document ON public.document_shares(document_id);