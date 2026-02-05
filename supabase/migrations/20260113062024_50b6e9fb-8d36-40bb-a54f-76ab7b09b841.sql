-- Create user presence table for tracking online status
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create chat conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation participants table
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- User presence policies - everyone in org can see presence
CREATE POLICY "Users can view presence in their org"
ON public.user_presence FOR SELECT
USING (
  org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Users can update their own presence"
ON public.user_presence FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own presence"
ON public.user_presence FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Chat conversations policies
CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations FOR SELECT
USING (
  id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (true);

-- Chat participants policies
CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants FOR SELECT
USING (
  conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can add participants to conversations they're in"
ON public.chat_participants FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.chat_participants WHERE conversation_id = conversation_id)
  OR NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = conversation_id)
);

-- Chat messages policies
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
  conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- Create indexes for performance
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conversation ON public.chat_participants(conversation_id);
CREATE INDEX idx_user_presence_user ON public.user_presence(user_id);
CREATE INDEX idx_user_presence_status ON public.user_presence(status);

-- Trigger to update updated_at
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add encryption columns to chat_messages if they don't exist
-- Run this AFTER the main chat_system_fix.sql

-- Add encryption columns
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS encrypted_content TEXT;

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS nonce TEXT;

-- Create index for faster queries on encrypted messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_encrypted 
ON public.chat_messages(is_encrypted) 
WHERE is_encrypted = true;