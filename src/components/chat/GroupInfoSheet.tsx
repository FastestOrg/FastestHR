import { Shield, UserMinus, Users, Crown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ConversationWithMeta, ChatParticipant } from '@/hooks/use-chat';

interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationWithMeta;
  participants: ChatParticipant[];
}

export function GroupInfoSheet({ open, onOpenChange, conversation, participants }: GroupInfoSheetProps) {
  const { profile } = useAuthStore();
  const { onlineUsers } = useChatStore();
  const queryClient = useQueryClient();

  const myParticipant = participants.find((p) => p.user_id === profile?.id);
  const isGroupAdmin = myParticipant?.role === 'admin';
  const isCompanyAdmin = profile?.platform_role === 'company_admin';

  const admins = participants.filter((p) => p.role === 'admin');
  const members = participants.filter((p) => p.role === 'member');

  const handleRemoveMember = async (participant: ChatParticipant) => {
    if (!isGroupAdmin && !isCompanyAdmin) return;

    try {
      await supabase
        .from('chat_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('id', participant.id);

      // Send system message
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        sender_id: profile!.id,
        content: `${participant.profiles?.full_name || 'User'} was removed from the group`,
        message_type: 'system',
      });

      queryClient.invalidateQueries({ queryKey: ['chat-participants', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      toast.success('Member removed');
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!myParticipant) return;

    try {
      await supabase
        .from('chat_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('id', myParticipant.id);

      // Send system message
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        sender_id: profile!.id,
        content: `${profile?.full_name} left the group`,
        message_type: 'system',
      });

      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      onOpenChange(false);
      toast.success('You left the group');
    } catch (err) {
      toast.error('Failed to leave group');
    }
  };

  const renderParticipant = (participant: ChatParticipant) => {
    const user = participant.profiles;
    if (!user) return null;

    const isOnline = onlineUsers.has(participant.user_id);
    const isSelf = participant.user_id === profile?.id;
    const initials = user.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

    return (
      <div key={participant.id} className="flex items-center gap-3 py-2.5">
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">
              {user.full_name}
              {isSelf && <span className="text-muted-foreground font-normal"> (You)</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {participant.role === 'admin' && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-600 gap-0.5">
                <Crown className="h-2.5 w-2.5" />
                Admin
              </Badge>
            )}
            <span className={`text-[10px] ${isOnline ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {(isGroupAdmin || isCompanyAdmin) && !isSelf && participant.role !== 'admin' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemoveMember(participant)}
            aria-label={`Remove ${user.full_name}`}
          >
            <UserMinus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 sm:w-96 p-0">
        <SheetHeader className="p-4 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Group Info
          </SheetTitle>
          <SheetDescription>
            {conversation.name}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-3">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary/40" />
            </div>
          </div>
          <h3 className="text-center text-lg font-semibold mt-3">{conversation.name}</h3>
          <p className="text-center text-xs text-muted-foreground mt-1">
            {participants.length} member{participants.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-4">
          {/* Admins */}
          {admins.length > 0 && (
            <div className="py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Admins ({admins.length})
              </p>
              {admins.map(renderParticipant)}
            </div>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div className="py-3">
              <Separator className="mb-3" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Members ({members.length})
              </p>
              {members.map(renderParticipant)}
            </div>
          )}
        </ScrollArea>

        {/* Leave group button */}
        {myParticipant && (
          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 rounded-xl"
              onClick={handleLeaveGroup}
            >
              Leave Group
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
