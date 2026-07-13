-- ============================================================
-- FastestHR Chat System — Production Migration
-- Tables: chat_conversations, chat_participants, chat_messages, chat_presence
-- ============================================================

-- ========================
-- ENUMS
-- ========================
CREATE TYPE public.chat_conversation_type AS ENUM ('dm', 'group');
CREATE TYPE public.chat_participant_role AS ENUM ('admin', 'member');
CREATE TYPE public.chat_message_type AS ENUM ('text', 'system');

-- ========================
-- 1. chat_conversations
-- ========================
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type public.chat_conversation_type NOT NULL DEFAULT 'dm',
  name TEXT,  -- NULL for DMs, required for groups
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conversations_company ON public.chat_conversations(company_id);
CREATE INDEX idx_chat_conversations_created_by ON public.chat_conversations(created_by);
CREATE INDEX idx_chat_conversations_updated ON public.chat_conversations(updated_at DESC);

-- ========================
-- 2. chat_participants
-- ========================
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.chat_participant_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conversation ON public.chat_participants(conversation_id);
CREATE INDEX idx_chat_participants_active ON public.chat_participants(user_id) WHERE left_at IS NULL;

-- ========================
-- 3. chat_messages
-- ========================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type public.chat_message_type NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No updated_at or deleted_at — messages are immutable
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- ========================
-- 4. chat_presence
-- ========================
CREATE TABLE public.chat_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_presence_company ON public.chat_presence(company_id);
CREATE INDEX idx_chat_presence_online ON public.chat_presence(company_id) WHERE is_online = true;

-- ========================
-- FUNCTION: Update updated_at on conversation when new message arrives
-- ========================
CREATE OR REPLACE FUNCTION public.chat_update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_message_update_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_update_conversation_timestamp();

-- ========================
-- FUNCTION: Upsert presence on login/activity
-- ========================
CREATE OR REPLACE FUNCTION public.chat_upsert_presence(p_user_id UUID, p_company_id UUID, p_is_online BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.chat_presence (user_id, company_id, is_online, last_seen_at)
  VALUES (p_user_id, p_company_id, p_is_online, now())
  ON CONFLICT (user_id) DO UPDATE
  SET is_online = p_is_online,
      last_seen_at = now();
END;
$$;

-- ========================
-- RLS POLICIES
-- ========================
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

-- ---- chat_conversations ----

-- Users can see conversations they participate in
CREATE POLICY "chat_conversations_select_participant"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.conversation_id = id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Company admins can see all conversations in their company
CREATE POLICY "chat_conversations_select_admin"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.get_user_platform_role() = 'company_admin'
  );

-- Authenticated users can create conversations in their company
CREATE POLICY "chat_conversations_insert"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND created_by = auth.uid()
  );

-- ---- chat_participants ----

-- Users can see participants in their conversations
CREATE POLICY "chat_participants_select"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp2
      WHERE cp2.conversation_id = conversation_id
        AND cp2.user_id = auth.uid()
        AND cp2.left_at IS NULL
    )
  );

-- Company admins can see all participants
CREATE POLICY "chat_participants_select_admin"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations cc
      WHERE cc.id = conversation_id
        AND cc.company_id = public.get_user_company_id()
        AND public.get_user_platform_role() = 'company_admin'
    )
  );

-- Users can insert participants (for creating conversations / adding to groups)
CREATE POLICY "chat_participants_insert"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations cc
      WHERE cc.id = conversation_id
        AND cc.company_id = public.get_user_company_id()
    )
  );

-- Users can update their own participant record (last_read_at, left_at)
CREATE POLICY "chat_participants_update_self"
  ON public.chat_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Group admins can update other participants (role changes, removing)
CREATE POLICY "chat_participants_update_admin"
  ON public.chat_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp_admin
      WHERE cp_admin.conversation_id = conversation_id
        AND cp_admin.user_id = auth.uid()
        AND cp_admin.role = 'admin'
        AND cp_admin.left_at IS NULL
    )
  );

-- ---- chat_messages ----

-- Users can see messages in their conversations
CREATE POLICY "chat_messages_select"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Company admins can see all messages
CREATE POLICY "chat_messages_select_admin"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations cc
      WHERE cc.id = conversation_id
        AND cc.company_id = public.get_user_company_id()
        AND public.get_user_platform_role() = 'company_admin'
    )
  );

-- Participants can send messages to their conversations
CREATE POLICY "chat_messages_insert"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- NO UPDATE or DELETE policies on chat_messages — messages are immutable

-- ---- chat_presence ----

-- Users can see presence of people in their company
CREATE POLICY "chat_presence_select"
  ON public.chat_presence FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Users can insert/update their own presence
CREATE POLICY "chat_presence_insert"
  ON public.chat_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_presence_update"
  ON public.chat_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ========================
-- Enable Realtime for chat tables
-- ========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
