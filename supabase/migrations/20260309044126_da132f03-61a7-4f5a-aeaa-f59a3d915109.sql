-- Enable realtime replication for leave_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;