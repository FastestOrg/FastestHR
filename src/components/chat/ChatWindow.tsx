import { useState, useMemo } from 'react';
import { useMessages, useSendMessage, useMarkAsRead, useConversationParticipants, useTypingIndicator } from '@/hooks/use-chat';
import type { ConversationWithMeta } from '@/hooks/use-chat';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { GroupInfoSheet } from './GroupInfoSheet';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  conversation: ConversationWithMeta | null;
  isAdminView?: boolean;
}

export function ChatWindow({ conversation, isAdminView }: ChatWindowProps) {
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const isMobile = useIsMobile();
  const { profile } = useAuthStore();
  const { setMobileShowChat, typingUsers } = useChatStore();

  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversation?.id || null);
  const { data: participants = [] } = useConversationParticipants(conversation?.id || null);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { handleTypingStart, handleTypingStop } = useTypingIndicator(conversation?.id || null);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (conversation?.id && !isAdminView) {
      markAsRead.mutate(conversation.id);
    }
  }, [conversation?.id, messages.length]);

  // Get typing users for this conversation
  const currentTypingUsers = useMemo(() => {
    if (!conversation?.id) return [];
    const users = typingUsers.get(conversation.id);
    return users ? Array.from(users) : [];
  }, [conversation?.id, typingUsers]);

  const handleSend = (content: string) => {
    if (!conversation?.id) return;
    sendMessage.mutate({
      conversationId: conversation.id,
      content,
    });
  };

  const handleBack = () => {
    setMobileShowChat(false);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
        <div className="w-20 h-20 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10 text-primary/20" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">FastestHR Chats</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Select a conversation or start a new chat to begin messaging your team
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <ChatHeader
        conversation={conversation}
        participants={participants}
        onInfoClick={() => setShowGroupInfo(true)}
        showBackButton={isMobile}
        onBack={handleBack}
      />

      <MessageList
        messages={messages}
        isLoading={messagesLoading}
        isGroupChat={conversation.type === 'group'}
        participants={participants}
        typingUsers={currentTypingUsers}
      />

      {!isAdminView && (
        <MessageInput
          onSend={handleSend}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          disabled={sendMessage.isPending}
        />
      )}

      {conversation.type === 'group' && (
        <GroupInfoSheet
          open={showGroupInfo}
          onOpenChange={setShowGroupInfo}
          conversation={conversation}
          participants={participants}
        />
      )}
    </div>
  );
}
