import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, Plus, Users, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import type { ConversationWithMeta } from '@/hooks/use-chat';

interface ConversationListProps {
  conversations: ConversationWithMeta[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeConversationId: string | null;
  onSelect: (conversation: ConversationWithMeta) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  filter: 'all' | 'dms' | 'groups';
  onFilterChange: (filter: 'all' | 'dms' | 'groups') => void;
}

function formatLastMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

export function ConversationList({
  conversations,
  isLoading,
  searchQuery,
  onSearchChange,
  activeConversationId,
  onSelect,
  onNewChat,
  onNewGroup,
  filter,
  onFilterChange,
}: ConversationListProps) {
  const { onlineUsers, unreadCounts } = useChatStore();
  const { profile } = useAuthStore();

  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Filter by type
    if (filter === 'dms') result = result.filter((c) => c.type === 'dm');
    if (filter === 'groups') result = result.filter((c) => c.type === 'group');

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const name = c.type === 'dm'
          ? c.otherUser?.full_name || ''
          : c.name || '';
        return name.toLowerCase().includes(q);
      });
    }

    return result;
  }, [conversations, filter, searchQuery]);

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Header */}
      <div className="p-4 pb-3 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Chats</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90"
                aria-label="New conversation"
                id="chat-new-conversation-btn"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onNewChat} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                New Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup} className="gap-2">
                <Users className="h-4 w-4" />
                New Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 h-9 rounded-xl bg-muted/30 border-border/50 text-sm"
            id="chat-search-input"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'dms', 'groups'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${filter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              {f === 'all' ? 'All' : f === 'dms' ? 'Direct' : 'Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to connect with your team</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isDm = conv.type === 'dm';
              const isActive = conv.id === activeConversationId;
              const displayName = isDm
                ? conv.otherUser?.full_name || 'Unknown'
                : conv.name || 'Group';
              const avatarUrl = isDm
                ? conv.otherUser?.avatar_url || ''
                : conv.avatar_url || '';
              const initials = displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const isOnline = isDm && conv.otherUser ? onlineUsers.has(conv.otherUser.id) : false;
              const unread = unreadCounts.get(conv.id) || conv.unreadCount || 0;

              // Last message preview
              const lastMsg = conv.lastMessage;
              let preview = '';
              if (lastMsg) {
                if (lastMsg.message_type === 'system') {
                  preview = lastMsg.content;
                } else {
                  const senderName =
                    lastMsg.sender_id === profile?.id
                      ? 'You'
                      : lastMsg.sender?.full_name?.split(' ')[0] || '';
                  preview = conv.type === 'group'
                    ? `${senderName}: ${lastMsg.content}`
                    : lastMsg.content;
                }
              }

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                    ${isActive
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50 border border-transparent'
                    }
                  `}
                  id={`chat-conversation-${conv.id}`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className={`text-xs font-medium ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {isDm ? initials : <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    {isDm && isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${unread > 0 ? 'font-bold' : 'font-medium'}`}>
                        {displayName}
                      </span>
                      {lastMsg && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatLastMessageTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {preview || 'No messages yet'}
                      </p>
                      {unread > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary text-primary-foreground rounded-full shrink-0 flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
