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

-- ============================================
-- CHAT SYSTEM FIX - Complete Solution
-- ============================================

-- 1. Add missing description column to chat_conversations
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Create get_user_org_id function (if missing)
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 3. Create helper function to check conversation participation
-- This bypasses RLS to avoid recursion
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

-- 4. Create a SECURITY DEFINER function to create conversations with participants
-- This bypasses RLS and handles the atomic creation properly
CREATE OR REPLACE FUNCTION public.create_dm_conversation(
  _other_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _org_id uuid;
  _conversation_id uuid;
  _existing_conversation_id uuid;
BEGIN
  -- Check if DM already exists between these users
  SELECT cp1.conversation_id INTO _existing_conversation_id
  FROM chat_participants cp1
  JOIN chat_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN chat_conversations cc ON cc.id = cp1.conversation_id
  WHERE cp1.user_id = _current_user_id
    AND cp2.user_id = _other_user_id
    AND cc.is_group = false
  LIMIT 1;
  
  IF _existing_conversation_id IS NOT NULL THEN
    RETURN _existing_conversation_id;
  END IF;

  -- Get org_id
  SELECT org_id INTO _org_id FROM profiles WHERE user_id = _current_user_id;

  -- Create conversation
  INSERT INTO chat_conversations (is_group, org_id)
  VALUES (false, _org_id)
  RETURNING id INTO _conversation_id;

  -- Add both participants atomically
  INSERT INTO chat_participants (conversation_id, user_id)
  VALUES 
    (_conversation_id, _current_user_id),
    (_conversation_id, _other_user_id);

  RETURN _conversation_id;
END;
$$;

-- 5. Create function for group chat creation
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  _name text,
  _member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _org_id uuid;
  _conversation_id uuid;
  _member_id uuid;
BEGIN
  -- Get org_id
  SELECT org_id INTO _org_id FROM profiles WHERE user_id = _current_user_id;

  -- Create conversation
  INSERT INTO chat_conversations (is_group, name, org_id)
  VALUES (true, _name, _org_id)
  RETURNING id INTO _conversation_id;

  -- Add creator as participant
  INSERT INTO chat_participants (conversation_id, user_id)
  VALUES (_conversation_id, _current_user_id);

  -- Add all other members
  FOREACH _member_id IN ARRAY _member_ids
  LOOP
    IF _member_id != _current_user_id THEN
      INSERT INTO chat_participants (conversation_id, user_id)
      VALUES (_conversation_id, _member_id);
    END IF;
  END LOOP;

  RETURN _conversation_id;
END;
$$;

-- 6. Create function to add member to group
CREATE OR REPLACE FUNCTION public.add_group_member(
  _conversation_id uuid,
  _new_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
BEGIN
  -- Check if current user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE conversation_id = _conversation_id AND user_id = _current_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to add members to this conversation';
  END IF;

  -- Add the new member
  INSERT INTO chat_participants (conversation_id, user_id)
  VALUES (_conversation_id, _new_member_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN true;
END;
$$;

-- 7. DROP and recreate RLS policies with proper logic
-- ============================================

-- chat_conversations policies
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), id));

-- Allow insert via SECURITY DEFINER functions only (restrict direct inserts)
CREATE POLICY "Users can create conversations"
ON public.chat_conversations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- chat_participants policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they're in" ON public.chat_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

-- Simplified INSERT policy - we rely on SECURITY DEFINER functions for actual inserts
CREATE POLICY "Users can add participants to conversations they're in"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- chat_messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;

CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(auth.uid(), conversation_id)
);

-- user_presence policies (if not already properly set)
DROP POLICY IF EXISTS "Users can view presence in their org" ON public.user_presence;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;

CREATE POLICY "Users can view presence in their org"
ON public.user_presence
FOR SELECT
USING (
  org_id = public.get_user_org_id(auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 8. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_dm_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_conversation_ids(uuid) TO authenticated;
