import { useState } from 'react';
import { Search, X, Users, ArrowRight, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyMembers, useCreateGroup } from '@/hooks/use-chat';
import { useChatStore } from '@/store/chat-store';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

interface SelectedMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function NewGroupDialog({ open, onOpenChange, onConversationCreated }: NewGroupDialogProps) {
  const [step, setStep] = useState<'members' | 'details'>(open ? 'members' : 'members');
  const [search, setSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [groupName, setGroupName] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: members = [], isLoading } = useCompanyMembers(debouncedSearch);
  const createGroup = useCreateGroup();
  const { onlineUsers } = useChatStore();

  const handleToggleMember = (member: any) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      if (exists) {
        return prev.filter((m) => m.id !== member.id);
      }
      return [...prev, { id: member.id, full_name: member.full_name, avatar_url: member.avatar_url }];
    });
  };

  const handleNext = () => {
    if (selectedMembers.length < 1) {
      toast.error('Select at least one member');
      return;
    }
    setStep('details');
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    try {
      const conversationId = await createGroup.mutateAsync({
        name: groupName.trim(),
        memberIds: selectedMembers.map((m) => m.id),
      });
      onConversationCreated(conversationId);
      handleClose();
      toast.success('Group created successfully');
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep('members');
      setSearch('');
      setSelectedMembers([]);
      setGroupName('');
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        {step === 'members' ? (
          <>
            <DialogHeader className="p-4 pb-3">
              <DialogTitle>New Group</DialogTitle>
              <DialogDescription>Select members for your group chat</DialogDescription>
            </DialogHeader>

            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <Badge
                    key={m.id}
                    variant="secondary"
                    className="gap-1 pl-1 pr-1.5 py-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => handleToggleMember(m)}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={m.avatar_url || ''} />
                      <AvatarFallback className="text-[8px]">{m.full_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px]">{m.full_name.split(' ')[0]}</span>
                    <X className="h-3 w-3 opacity-60" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="pl-9 h-9 rounded-xl bg-muted/30 border-border/50 text-sm"
                  autoFocus
                  id="new-group-search"
                />
              </div>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="px-2 pb-2">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))
                ) : (
                  members.map((member: any) => {
                    const isSelected = selectedMembers.some((m) => m.id === member.id);
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
                        onClick={() => handleToggleMember(member)}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left
                          ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                        `}
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
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 pt-3 border-t border-border">
              <Button
                onClick={handleNext}
                disabled={selectedMembers.length < 1}
                className="w-full gap-2 rounded-xl"
              >
                Next
                <ArrowRight className="h-4 w-4" />
                {selectedMembers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {selectedMembers.length}
                  </Badge>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="p-4 pb-3">
              <DialogTitle>Group Details</DialogTitle>
              <DialogDescription>Choose a name for your group</DialogDescription>
            </DialogHeader>

            <div className="px-4 pb-3 space-y-4">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Users className="h-10 w-10 text-primary/40" />
                </div>
              </div>

              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="h-11 rounded-xl text-center text-sm font-medium"
                autoFocus
                maxLength={50}
                id="new-group-name"
              />

              <div className="flex flex-wrap gap-1.5 justify-center">
                {selectedMembers.map((m) => (
                  <Badge key={m.id} variant="outline" className="text-[11px] gap-1 py-0.5">
                    <Avatar className="h-3.5 w-3.5">
                      <AvatarImage src={m.avatar_url || ''} />
                      <AvatarFallback className="text-[7px]">{m.full_name[0]}</AvatarFallback>
                    </Avatar>
                    {m.full_name.split(' ')[0]}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-[11px] py-0.5 text-primary">
                  + You (Admin)
                </Badge>
              </div>
            </div>

            <DialogFooter className="p-4 pt-3 border-t border-border flex gap-2">
              <Button variant="outline" onClick={() => setStep('members')} className="flex-1 rounded-xl">
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!groupName.trim() || createGroup.isPending}
                className="flex-1 rounded-xl"
              >
                {createGroup.isPending ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
