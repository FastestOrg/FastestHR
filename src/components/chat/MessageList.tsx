import { useRef, useEffect, useMemo } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { MessageBubble } from './MessageBubble';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatMessage, ChatParticipant } from '@/hooks/use-chat';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isGroupChat: boolean;
  participants: ChatParticipant[];
  typingUsers: string[];
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function MessageList({ messages, isLoading, isGroupChat, participants, typingUsers }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Group messages by date for separators
  const messagesWithSeparators = useMemo(() => {
    const result: { type: 'separator' | 'message'; date?: string; message?: ChatMessage; showSenderName?: boolean }[] = [];
    let lastDate: string | null = null;
    let lastSenderId: string | null = null;

    for (const msg of messages) {
      const msgDate = new Date(msg.created_at);
      const dateKey = format(msgDate, 'yyyy-MM-dd');

      if (dateKey !== lastDate) {
        result.push({ type: 'separator', date: msg.created_at });
        lastDate = dateKey;
        lastSenderId = null;
      }

      const showSenderName = msg.sender_id !== lastSenderId || msg.message_type === 'system';
      result.push({ type: 'message', message: msg, showSenderName });
      lastSenderId = msg.message_type === 'system' ? null : msg.sender_id;
    }

    return result;
  }, [messages]);

  // Participant names lookup for typing indicator
  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((p) => {
      if (p.profiles) {
        map.set(p.user_id, p.profiles.full_name);
      }
    });
    return map;
  }, [participants]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            {i % 2 === 0 && <Skeleton className="h-7 w-7 rounded-full shrink-0" />}
            <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-48 rounded-bl-md' : 'w-40 rounded-br-md'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1">No messages yet</p>
        <p className="text-xs text-muted-foreground/70">Send a message to start the conversation</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0.5 scroll-smooth">
      {messagesWithSeparators.map((item, idx) => {
        if (item.type === 'separator') {
          return (
            <div key={`sep-${idx}`} className="flex items-center justify-center my-4">
              <div className="h-px flex-1 bg-border/50" />
              <span className="px-3 text-[11px] font-medium text-muted-foreground bg-background">
                {formatDateSeparator(item.date!)}
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
          );
        }

        return (
          <MessageBubble
            key={item.message!.id}
            message={item.message!}
            isGroupChat={isGroupChat}
            participants={participants}
            showSenderName={item.showSenderName!}
          />
        );
      })}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 py-2 pl-2">
          <div className="flex gap-0.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground">
            {typingUsers.map((uid) => participantNames.get(uid) || 'Someone').join(', ')}{' '}
            {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
