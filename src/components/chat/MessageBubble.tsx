import { format, isToday, isYesterday } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ChatMessage, ChatParticipant } from '@/hooks/use-chat';
import { useAuthStore } from '@/store/auth-store';

interface MessageBubbleProps {
  message: ChatMessage;
  isGroupChat: boolean;
  participants: ChatParticipant[];
  showSenderName: boolean;
}

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  return format(date, 'h:mm a');
}

function getReadStatus(
  message: ChatMessage,
  currentUserId: string,
  participants: ChatParticipant[]
): 'sent' | 'delivered' | 'read' {
  if (message.sender_id !== currentUserId) return 'sent';

  const otherParticipants = participants.filter(
    (p) => p.user_id !== currentUserId && !p.left_at
  );

  if (otherParticipants.length === 0) return 'sent';

  const allRead = otherParticipants.every((p) => {
    if (!p.last_read_at) return false;
    return new Date(p.last_read_at) >= new Date(message.created_at);
  });

  if (allRead) return 'read';
  return 'delivered';
}

export function MessageBubble({ message, isGroupChat, participants, showSenderName }: MessageBubbleProps) {
  const { profile } = useAuthStore();
  const isOwn = message.sender_id === profile?.id;
  const isSystem = message.message_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 text-[11px] text-muted-foreground bg-muted/50 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const readStatus = getReadStatus(message, profile?.id || '', participants);
  const senderName = message.sender?.full_name || 'Unknown';
  const senderInitials = senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`flex gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar for others in group chats */}
      {!isOwn && isGroupChat && (
        <div className="flex-shrink-0 mt-auto">
          {showSenderName ? (
            <Avatar className="h-7 w-7">
              <AvatarImage src={message.sender?.avatar_url || ''} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                {senderInitials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-7" />
          )}
        </div>
      )}

      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name for group chats */}
        {!isOwn && isGroupChat && showSenderName && (
          <span className="text-[11px] font-medium text-primary/70 ml-1 mb-0.5">
            {senderName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`
            relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
            ${isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted/80 text-foreground rounded-bl-md'
            }
          `}
        >
          <span className="whitespace-pre-wrap">{message.content}</span>

          {/* Timestamp + read receipt */}
          <span
            className={`
              inline-flex items-center gap-0.5 ml-2 float-right mt-1
              text-[10px] leading-none
              ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}
            `}
          >
            {formatMessageTime(message.created_at)}
            {isOwn && (
              <span className="ml-0.5 inline-flex items-center">
                {readStatus === 'sent' && (
                  <Check className="h-3 w-3 opacity-60" />
                )}
                {readStatus === 'delivered' && (
                  <CheckCheck className="h-3 w-3 opacity-60" />
                )}
                {readStatus === 'read' && (
                  <CheckCheck className="h-3 w-3 text-blue-400" />
                )}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
