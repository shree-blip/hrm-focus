-- Create table for user encryption public keys
CREATE TABLE IF NOT EXISTS public.user_encryption_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  public_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for encrypted conversation keys (per-user)
CREATE TABLE IF NOT EXISTS public.chat_conversation_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  encrypted_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_encryption_keys
CREATE POLICY "Users can insert their own public key"
ON public.user_encryption_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own public key"
ON public.user_encryption_keys FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all public keys"
ON public.user_encryption_keys FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS policies for chat_conversation_keys
CREATE POLICY "Users can view their own conversation keys"
ON public.chat_conversation_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Participants can insert conversation keys"
ON public.chat_conversation_keys FOR INSERT
WITH CHECK (is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can update their own conversation keys"
ON public.chat_conversation_keys FOR UPDATE
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_user_id ON public.user_encryption_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_keys_conversation_id ON public.chat_conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_keys_user_id ON public.chat_conversation_keys(user_id);