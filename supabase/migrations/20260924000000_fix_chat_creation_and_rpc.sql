-- ============================================================
-- Fix Chat Creation RLS & Add Atomic Functions for DMs and Groups
-- ============================================================

-- 1. Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.can_insert_chat_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = p_conversation_id
      AND cc.company_id = public.get_user_company_id()
      AND (
        cc.created_by = auth.uid()
        OR public.is_chat_group_admin(p_conversation_id, auth.uid())
        OR public.get_user_platform_role() = 'company_admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_user_left_chat(p_conversation_id UUID, p_user_id UUID)
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
      AND left_at IS NOT NULL
  );
$$;

-- 2. Update RLS policies on chat_conversations & chat_participants
DROP POLICY IF EXISTS "chat_conversations_select_participant" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_participant"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    public.is_chat_participant(id, auth.uid())
    OR (
      created_by = auth.uid()
      AND NOT public.has_user_left_chat(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
CREATE POLICY "chat_participants_insert"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_insert_chat_participant(conversation_id)
  );

-- 3. Atomic RPC Function: create_or_get_dm
CREATE OR REPLACE FUNCTION public.create_or_get_dm(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_my_user_id UUID := auth.uid();
  v_my_company_id UUID;
  v_other_company_id UUID;
  v_conv_id UUID;
BEGIN
  IF v_my_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_my_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot start a chat with yourself';
  END IF;

  -- Verify companies
  SELECT company_id INTO v_my_company_id FROM public.profiles WHERE id = v_my_user_id;
  SELECT company_id INTO v_other_company_id FROM public.profiles WHERE id = p_other_user_id;

  IF v_my_company_id IS NULL OR v_other_company_id IS NULL OR v_my_company_id <> v_other_company_id THEN
    RAISE EXCEPTION 'Users must belong to the same company';
  END IF;

  -- Check if a DM already exists between these two users in this company
  SELECT cc.id INTO v_conv_id
  FROM public.chat_conversations cc
  JOIN public.chat_participants cp1 ON cp1.conversation_id = cc.id AND cp1.user_id = v_my_user_id
  JOIN public.chat_participants cp2 ON cp2.conversation_id = cc.id AND cp2.user_id = p_other_user_id
  WHERE cc.company_id = v_my_company_id
    AND cc.type = 'dm'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    -- If either participant had left, unmark left_at
    UPDATE public.chat_participants
    SET left_at = NULL
    WHERE conversation_id = v_conv_id
      AND user_id IN (v_my_user_id, p_other_user_id)
      AND left_at IS NOT NULL;

    RETURN v_conv_id;
  END IF;

  -- Create new DM conversation
  INSERT INTO public.chat_conversations (company_id, type, created_by)
  VALUES (v_my_company_id, 'dm', v_my_user_id)
  RETURNING id INTO v_conv_id;

  -- Insert both participants
  INSERT INTO public.chat_participants (conversation_id, user_id, role)
  VALUES
    (v_conv_id, v_my_user_id, 'member'),
    (v_conv_id, p_other_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET left_at = NULL;

  RETURN v_conv_id;
END;
$$;

-- 4. Atomic RPC Function: create_chat_group
CREATE OR REPLACE FUNCTION public.create_chat_group(p_name TEXT, p_member_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_my_user_id UUID := auth.uid();
  v_my_company_id UUID;
  v_conv_id UUID;
  v_creator_name TEXT;
  v_member_id UUID;
BEGIN
  IF v_my_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  SELECT company_id, full_name INTO v_my_company_id, v_creator_name FROM public.profiles WHERE id = v_my_user_id;

  IF v_my_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;

  -- Create group conversation
  INSERT INTO public.chat_conversations (company_id, type, name, created_by)
  VALUES (v_my_company_id, 'group', trim(p_name), v_my_user_id)
  RETURNING id INTO v_conv_id;

  -- Insert creator as admin
  INSERT INTO public.chat_participants (conversation_id, user_id, role)
  VALUES (v_conv_id, v_my_user_id, 'admin');

  -- Insert members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id <> v_my_user_id THEN
      -- Ensure member belongs to same company
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_member_id AND company_id = v_my_company_id) THEN
        INSERT INTO public.chat_participants (conversation_id, user_id, role)
        VALUES (v_conv_id, v_member_id, 'member')
        ON CONFLICT (conversation_id, user_id) DO UPDATE
        SET left_at = NULL, role = 'member';
      END IF;
    END IF;
  END LOOP;

  -- Insert initial system message
  INSERT INTO public.chat_messages (conversation_id, sender_id, content, message_type)
  VALUES (v_conv_id, v_my_user_id, coalesce(v_creator_name, 'Someone') || ' created this group', 'system');

  RETURN v_conv_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.can_insert_chat_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_user_left_chat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_dm(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_group(TEXT, UUID[]) TO authenticated;

-- 5. Fix profiles.is_active for active employees whose profiles were marked inactive
UPDATE public.profiles p
SET is_active = true
FROM public.employees e
WHERE e.user_id = p.id
  AND e.status = 'active'
  AND e.deleted_at IS NULL
  AND p.is_active = false;
