-- Add policy to allow users to view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Enable realtime for spam_users table
ALTER PUBLICATION supabase_realtime ADD TABLE public.spam_users;