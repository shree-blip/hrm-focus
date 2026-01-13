-- Fix overly permissive RLS policies for chat tables

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

-- Create a more restrictive policy - users can only create conversations for their org
CREATE POLICY "Users can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (org_id IS NULL OR org_id = get_user_org_id(auth.uid()))
);

-- Also fix chat_participants policy to be more specific
DROP POLICY IF EXISTS "Users can add participants to conversations they're in" ON public.chat_participants;

-- Recreate with proper check
CREATE POLICY "Users can add participants to conversations they're in"
ON public.chat_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Allow adding yourself to a new conversation
    user_id = auth.uid()
    OR
    -- Or if you're already a participant of that conversation
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.conversation_id = chat_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  )
);