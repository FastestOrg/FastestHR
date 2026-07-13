import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyMembers, useCreateDM } from '@/hooks/use-chat';
import { useChatStore } from '@/store/chat-store';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onConversationCreated }: NewChatDialogProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: members = [], isLoading } = useCompanyMembers(debouncedSearch);
  const createDM = useCreateDM();
  const { onlineUsers } = useChatStore();

  const handleSelect = async (userId: string) => {
    try {
      const conversationId = await createDM.mutateAsync(userId);
      onConversationCreated(conversationId);
      onOpenChange(false);
      setSearch('');
    } catch (err) {
      toast.error('Failed to start conversation');
    }
  };

  const roleLabel = (role: string | null) => {
    if (!role) return null;
    const labels: Record<string, string> = {
      company_admin: 'Admin',
      hr_manager: 'HR',
      recruiter: 'Recruiter',
      user: 'Employee',
      super_admin: 'Super Admin',
    };
    return labels[role] || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Search for a team member to start a conversation</DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="pl-9 h-9 rounded-xl bg-muted/30 border-border/50 text-sm"
              autoFocus
              id="new-chat-search"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="px-2 pb-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            ) : members.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No members found</p>
              </div>
            ) : (
              members.map((member: any) => {
                const isOnline = onlineUsers.has(member.id);
                const initials = member.full_name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || '?';

                return (
                  <button
                    key={member.id}
                    onClick={() => handleSelect(member.id)}
                    disabled={createDM.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    id={`new-chat-member-${member.id}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {roleLabel(member.platform_role) && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border">
                            {roleLabel(member.platform_role)}
                          </Badge>
                        )}
                        <span className={`text-[10px] ${isOnline ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
