import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

export interface ChatConversation {
  id: string;
  company_id: string;
  type: 'dm' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at: string | null;
  joined_at: string;
  left_at: string | null;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    platform_role: string | null;
  } | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system';
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface ConversationWithMeta extends ChatConversation {
  participants: ChatParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  otherUser?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    platform_role: string | null;
  } | null;
}

// ============================================================
// useConversations — Fetch all conversations for current user
// ============================================================

export function useConversations() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery<ConversationWithMeta[]>({
    queryKey: ['chat-conversations', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Get all conversations this user is part of
      const { data: participantRows, error: pErr } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', profile.id)
        .is('left_at', null);

      if (pErr) throw pErr;
      if (!participantRows?.length) return [];

      const conversationIds = participantRows.map((p: any) => p.conversation_id);

      // Fetch conversations with participants
      const { data: conversations, error: cErr } = await supabase
        .from('chat_conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (cErr) throw cErr;
      if (!conversations?.length) return [];

      // Fetch all participants for these conversations
      const { data: allParticipants, error: apErr } = await supabase
        .from('chat_participants')
        .select('*, profiles:user_id(id, full_name, avatar_url, platform_role)')
        .in('conversation_id', conversationIds)
        .is('left_at', null);

      if (apErr) throw apErr;

      // Fetch last message for each conversation
      const lastMessages: Record<string, ChatMessage> = {};
      for (const convId of conversationIds) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*, sender:sender_id(id, full_name, avatar_url)')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (msgs?.[0]) {
          lastMessages[convId] = msgs[0] as unknown as ChatMessage;
        }
      }

      // Build enriched conversations
      return conversations.map((conv: any) => {
        const participants = (allParticipants || []).filter(
          (p: any) => p.conversation_id === conv.id
        ) as ChatParticipant[];

        const myParticipant = participants.find((p) => p.user_id === profile.id);
        const lastMsg = lastMessages[conv.id] || null;

        // Count unread: messages after my last_read_at
        let unreadCount = 0;
        if (myParticipant?.last_read_at && lastMsg) {
          if (new Date(lastMsg.created_at) > new Date(myParticipant.last_read_at)) {
            unreadCount = 1; // We'll refine this with a count query
          }
        }

        // For DMs, find the other user
        let otherUser = null;
        if (conv.type === 'dm') {
          const other = participants.find((p) => p.user_id !== profile.id);
          otherUser = other?.profiles || null;
        }

        return {
          ...conv,
          participants,
          lastMessage: lastMsg,
          unreadCount,
          otherUser,
        } as ConversationWithMeta;
      });
    },
    enabled: !!profile?.id,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Subscribe to new messages to refresh the list
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('chat-conversations-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  return query;
}

// ============================================================
// useMessages — Fetch messages for a conversation with realtime
// ============================================================

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, sender:sender_id(id, full_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return (data as unknown as ChatMessage[]) || [];
    },
    enabled: !!conversationId,
    staleTime: 5_000,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the full message with sender info
          const { data: newMsg } = await supabase
            .from('chat_messages')
            .select('*, sender:sender_id(id, full_name, avatar_url)')
            .eq('id', (payload.new as any).id)
            .single();

          if (newMsg) {
            queryClient.setQueryData<ChatMessage[]>(
              ['chat-messages', conversationId],
              (old) => {
                if (!old) return [newMsg as unknown as ChatMessage];
                // Avoid duplicates
                if (old.some((m) => m.id === (newMsg as any).id)) return old;
                return [...old, newMsg as unknown as ChatMessage];
              }
            );
          }

          // Also refresh the conversation list for last message / ordering
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

// ============================================================
// useSendMessage
// ============================================================

export function useSendMessage() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      messageType = 'text',
    }: {
      conversationId: string;
      content: string;
      messageType?: 'text' | 'system';
    }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: profile!.id,
          content,
          message_type: messageType,
        })
        .select('*, sender:sender_id(id, full_name, avatar_url)')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

// ============================================================
// useMarkAsRead
// ============================================================

export function useMarkAsRead() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', profile!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

// ============================================================
// useCreateDM — Find or create a DM conversation
// ============================================================

export function useCreateDM() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!profile?.id || !profile?.company_id) throw new Error('Not authenticated');

      // Check if a DM already exists between these two users
      const { data: myConvs } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', profile.id)
        .is('left_at', null);

      if (myConvs?.length) {
        const convIds = myConvs.map((c: any) => c.conversation_id);

        const { data: otherConvs } = await supabase
          .from('chat_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', convIds)
          .is('left_at', null);

        if (otherConvs?.length) {
          // Check if any of these are DMs
          const { data: dmConvs } = await supabase
            .from('chat_conversations')
            .select('id')
            .in('id', otherConvs.map((c: any) => c.conversation_id))
            .eq('type', 'dm');

          if (dmConvs?.[0]) {
            return dmConvs[0].id;
          }
        }
      }

      // Create new DM conversation
      const { data: conv, error: convErr } = await supabase
        .from('chat_conversations')
        .insert({
          company_id: profile.company_id,
          type: 'dm',
          created_by: profile.id,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // Add both participants
      const { error: pErr } = await supabase
        .from('chat_participants')
        .insert([
          { conversation_id: conv.id, user_id: profile.id, role: 'member' },
          { conversation_id: conv.id, user_id: otherUserId, role: 'member' },
        ]);

      if (pErr) throw pErr;

      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      return conv.id;
    },
  });
}

// ============================================================
// useCreateGroup — Create a group conversation
// ============================================================

export function useCreateGroup() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();

  return useMutation({
    mutationFn: async ({
      name,
      memberIds,
    }: {
      name: string;
      memberIds: string[];
    }) => {
      if (!profile?.id || !profile?.company_id) throw new Error('Not authenticated');

      // Create group conversation
      const { data: conv, error: convErr } = await supabase
        .from('chat_conversations')
        .insert({
          company_id: profile.company_id,
          type: 'group',
          name,
          created_by: profile.id,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // Add creator as admin + all members
      const participants = [
        { conversation_id: conv.id, user_id: profile.id, role: 'admin' as const },
        ...memberIds.map((uid) => ({
          conversation_id: conv.id,
          user_id: uid,
          role: 'member' as const,
        })),
      ];

      const { error: pErr } = await supabase
        .from('chat_participants')
        .insert(participants);

      if (pErr) throw pErr;

      // Send system message
      await supabase.from('chat_messages').insert({
        conversation_id: conv.id,
        sender_id: profile.id,
        content: `${profile.full_name} created this group`,
        message_type: 'system',
      });

      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      return conv.id;
    },
  });
}

// ============================================================
// useConversationParticipants
// ============================================================

export function useConversationParticipants(conversationId: string | null) {
  return useQuery<ChatParticipant[]>({
    queryKey: ['chat-participants', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('chat_participants')
        .select('*, profiles:user_id(id, full_name, avatar_url, platform_role)')
        .eq('conversation_id', conversationId)
        .is('left_at', null);

      if (error) throw error;
      return (data as unknown as ChatParticipant[]) || [];
    },
    enabled: !!conversationId,
  });
}

// ============================================================
// useCompanyMembers — For new chat / new group user selection
// ============================================================

export function useCompanyMembers(searchQuery?: string) {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['company-members', profile?.company_id, searchQuery],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, platform_role')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .neq('id', profile.id)
        .order('full_name');

      if (searchQuery) {
        query = query.ilike('full_name', `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
    staleTime: 30_000,
  });
}

// ============================================================
// usePresence — Online presence tracking
// ============================================================

export function usePresence() {
  const { profile } = useAuthStore();
  const { setOnlineUsers, addOnlineUser, removeOnlineUser } = useChatStore();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!profile?.id || !profile?.company_id) return;

    // Set self as online
    supabase.rpc('chat_upsert_presence', {
      p_user_id: profile.id,
      p_company_id: profile.company_id,
      p_is_online: true,
    });

    // Fetch initial online users
    supabase
      .from('chat_presence')
      .select('user_id')
      .eq('company_id', profile.company_id)
      .eq('is_online', true)
      .then(({ data }) => {
        if (data) {
          setOnlineUsers(new Set(data.map((d: any) => d.user_id)));
        }
      });

    // Subscribe to presence changes
    const channel = supabase
      .channel('chat-presence-track')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_presence',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record?.is_online) {
            addOnlineUser(record.user_id);
          } else if (record?.user_id) {
            removeOnlineUser(record.user_id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Heartbeat every 60s
    const heartbeat = setInterval(() => {
      supabase.rpc('chat_upsert_presence', {
        p_user_id: profile.id,
        p_company_id: profile.company_id,
        p_is_online: true,
      });
    }, 60_000);

    // Set offline on unload
    const handleUnload = () => {
      supabase.rpc('chat_upsert_presence', {
        p_user_id: profile.id,
        p_company_id: profile.company_id,
        p_is_online: false,
      });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [profile?.id, profile?.company_id]);
}

// ============================================================
// useTypingIndicator — Broadcast typing events
// ============================================================

export function useTypingIndicator(conversationId: string | null) {
  const { profile } = useAuthStore();
  const { setTypingUser } = useChatStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId || !profile?.id) return;

    const channel = supabase.channel(`typing-${conversationId}`);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean };
        if (userId !== profile.id) {
          setTypingUser(conversationId, userId, isTyping);
          // Auto-clear after 5s
          if (isTyping) {
            setTimeout(() => {
              setTypingUser(conversationId, userId, false);
            }, 5000);
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, profile?.id]);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !profile?.id) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping },
      });
    },
    [profile?.id]
  );

  const handleTypingStart = useCallback(() => {
    broadcastTyping(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 3000);
  }, [broadcastTyping]);

  const handleTypingStop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    broadcastTyping(false);
  }, [broadcastTyping]);

  return { handleTypingStart, handleTypingStop };
}

// ============================================================
// useAdminConversations — All company conversations for admin
// ============================================================

export function useAdminConversations() {
  const { profile } = useAuthStore();

  return useQuery<ConversationWithMeta[]>({
    queryKey: ['admin-chat-conversations', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!conversations?.length) return [];

      const convIds = conversations.map((c: any) => c.id);

      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('*, profiles:user_id(id, full_name, avatar_url, platform_role)')
        .in('conversation_id', convIds)
        .is('left_at', null);

      const lastMessages: Record<string, ChatMessage> = {};
      for (const convId of convIds) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*, sender:sender_id(id, full_name, avatar_url)')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (msgs?.[0]) {
          lastMessages[convId] = msgs[0] as unknown as ChatMessage;
        }
      }

      return conversations.map((conv: any) => {
        const participants = (allParticipants || []).filter(
          (p: any) => p.conversation_id === conv.id
        ) as ChatParticipant[];

        return {
          ...conv,
          participants,
          lastMessage: lastMessages[conv.id] || null,
          unreadCount: 0,
          otherUser: null,
        } as ConversationWithMeta;
      });
    },
    enabled: !!profile?.company_id && profile?.platform_role === 'company_admin',
    staleTime: 30_000,
  });
}
