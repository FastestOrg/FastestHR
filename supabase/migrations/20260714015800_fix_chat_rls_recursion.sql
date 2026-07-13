-- ============================================================
-- Fix RLS Recursion in Chat Policies
-- ============================================================

-- 1. Helper Functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
      AND left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_group_admin(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
      AND role = 'admin'
      AND left_at IS NULL
  );
$$;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "chat_conversations_select_participant" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_update_admin" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;

-- 3. Re-create policies using non-recursive helper functions

-- ---- chat_conversations ----
CREATE POLICY "chat_conversations_select_participant"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    public.is_chat_participant(id, auth.uid())
  );

-- ---- chat_participants ----
CREATE POLICY "chat_participants_select"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (
    public.is_chat_participant(conversation_id, auth.uid())
  );

CREATE POLICY "chat_participants_update_admin"
  ON public.chat_participants FOR UPDATE
  TO authenticated
  USING (
    public.is_chat_group_admin(conversation_id, auth.uid())
  );

-- ---- chat_messages ----
CREATE POLICY "chat_messages_select"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    public.is_chat_participant(conversation_id, auth.uid())
  );

CREATE POLICY "chat_messages_insert"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_chat_participant(conversation_id, auth.uid())
  );
