import { useState, useMemo } from 'react';
import { Eye, Search, Users, MessageSquare, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminConversations, useMessages } from '@/hooks/use-chat';
import type { ConversationWithMeta, ChatMessage } from '@/hooks/use-chat';
import { format } from 'date-fns';

interface AdminMonitorViewProps {
  onViewConversation: (conversation: ConversationWithMeta) => void;
}

export function AdminMonitorView({ onViewConversation }: AdminMonitorViewProps) {
  const [search, setSearch] = useState('');
  const { data: conversations = [], isLoading } = useAdminConversations();

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = c.type === 'dm'
        ? c.participants.map((p) => p.profiles?.full_name || '').join(' ')
        : c.name || '';
      return name.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Admin header */}
      <div className="p-4 pb-3 space-y-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-bold tracking-tight">Admin Monitor</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          View all conversations across your organization
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all conversations..."
            className="pl-9 h-9 rounded-xl bg-muted/30 border-border/50 text-sm"
            id="admin-monitor-search"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm font-medium">No conversations found</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isDm = conv.type === 'dm';
              const participantNames = conv.participants
                .map((p) => p.profiles?.full_name || 'Unknown')
                .join(', ');

              const displayName = isDm
                ? participantNames
                : conv.name || 'Unnamed Group';

              const lastMsg = conv.lastMessage;
              const messageCount = '—'; // Could be fetched if needed

              return (
                <button
                  key={conv.id}
                  onClick={() => onViewConversation(conv)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left border border-transparent hover:border-border/50"
                >
                  <div className="shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-amber-500/10 text-amber-600 text-xs">
                        {isDm ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                        {isDm ? 'DM' : 'Group'}
                      </Badge>
                    </div>
                    {lastMsg && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg.sender?.full_name}: {lastMsg.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {conv.participants.length} participant{conv.participants.length !== 1 ? 's' : ''}
                      </span>
                      {lastMsg && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            Last active {format(new Date(lastMsg.created_at), 'MMM d, h:mm a')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Eye className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
