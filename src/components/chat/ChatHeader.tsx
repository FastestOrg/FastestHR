import { ArrowLeft, Users, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/store/chat-store';
import type { ConversationWithMeta, ChatParticipant } from '@/hooks/use-chat';

interface ChatHeaderProps {
  conversation: ConversationWithMeta;
  participants: ChatParticipant[];
  onInfoClick: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function ChatHeader({ conversation, participants, onInfoClick, showBackButton, onBack }: ChatHeaderProps) {
  const { onlineUsers } = useChatStore();

  const isDm = conversation.type === 'dm';
  const otherUser = conversation.otherUser;

  // Display name
  const displayName = isDm
    ? otherUser?.full_name || 'Unknown User'
    : conversation.name || 'Group';

  // Avatar
  const avatarUrl = isDm
    ? otherUser?.avatar_url || ''
    : conversation.avatar_url || '';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Online status for DMs
  const isOnline = isDm && otherUser ? onlineUsers.has(otherUser.id) : false;

  // Status text
  const statusText = isDm
    ? isOnline
      ? 'Online'
      : 'Offline'
    : `${participants.length} member${participants.length !== 1 ? 's' : ''}`;

  // Role badge for DMs
  const roleLabel = isDm && otherUser?.platform_role
    ? {
        company_admin: 'Admin',
        hr_manager: 'HR',
        recruiter: 'Recruiter',
        user: 'Employee',
        super_admin: 'Super Admin',
      }[otherUser.platform_role] || null
    : null;

  return (
    <div className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center gap-3 px-4 shrink-0">
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 -ml-1"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {!isDm ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        {isDm && isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{displayName}</h3>
          {roleLabel && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border shrink-0">
              {roleLabel}
            </Badge>
          )}
        </div>
        <p className={`text-xs ${isDm && isOnline ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {statusText}
        </p>
      </div>

      {conversation.type === 'group' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onInfoClick}
          aria-label="Group info"
          id="chat-group-info-btn"
        >
          <Info className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
