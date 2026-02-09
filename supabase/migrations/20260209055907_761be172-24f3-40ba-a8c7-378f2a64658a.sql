
-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
USING (sender_id = auth.uid());

-- Allow participants to update conversations (for renaming groups)
CREATE POLICY "Participants can update their conversations"
ON public.chat_conversations
FOR UPDATE
USING (is_conversation_participant(auth.uid(), id));

-- Allow users to update their own participant record (for marking messages as read)
CREATE POLICY "Users can update their own participation"
ON public.chat_participants
FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for user_presence table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
