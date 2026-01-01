-- Create announcements table
CREATE TABLE public.announcements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES public.organizations(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- important, info, event
    is_pinned BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view announcements
CREATE POLICY "Authenticated users can view announcements"
ON public.announcements FOR SELECT
USING (is_active = true);

-- Allow managers/VP/admin to manage announcements
CREATE POLICY "Managers can manage announcements"
ON public.announcements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for announcements table
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- Insert sample announcements
INSERT INTO public.announcements (title, content, type, is_pinned, is_active) VALUES
('Year-End Closing Procedures', 'All timesheets must be submitted by December 30th for Q4 processing. This is crucial for our annual financial reporting. Please ensure all your hours are accurately logged, project codes are correct, and any outstanding expenses are submitted.', 'important', true, true),
('Office Holiday Hours', 'The office will be closed December 25-26 for the holidays. During this time, emergency support will be available via email. Normal business hours will resume on December 27th.', 'info', false, true),
('New Tax Software Training', 'Mandatory training session scheduled for January 3rd, 2025. All accounting and tax team members are required to attend. The training will cover the new TaxPro 2025 software features.', 'event', false, true),
('Q1 2026 Planning Meeting', 'All department heads are required to attend the Q1 planning meeting on January 15th, 2026 at 10:00 AM. Please prepare your department goals and resource requirements.', 'important', true, true);