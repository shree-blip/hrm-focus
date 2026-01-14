-- Fix infinite recursion in chat RLS by moving participant membership checks into SECURITY DEFINER helpers

-- Helper: all conversation IDs a user participates in
CREATE OR REPLACE FUNCTION public.user_conversation_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id
  FROM public.chat_participants
  WHERE user_id = _user_id
$$;

-- Helper: is a user a participant of a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
$$;

-- chat_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;
CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can add participants to conversations they're in" ON public.chat_participants;
CREATE POLICY "Users can add participants to conversations they're in"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR public.is_conversation_participant(auth.uid(), conversation_id)
  )
);

-- chat_conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), id));

-- chat_messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(auth.uid(), conversation_id)
);
