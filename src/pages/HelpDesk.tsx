import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Search, Plus, LifeBuoy, Clock, AlertCircle, Send, MessageSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

interface TicketForm {
  subject: string;
  description: string;
  category: string;
  priority: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: 'open' | 'in_progress' | 'pending_reply' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  raised_by: string;
  company_id: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

const emptyForm: TicketForm = { subject: '', description: '', category: 'other', priority: 'medium' };

export default function HelpDesk() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [commentText, setCommentText] = useState('');

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets', debouncedSearch, profile?.company_id],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (debouncedSearch) {
        query = query.or(`subject.ilike.%${debouncedSearch}%,ticket_number.ilike.%${debouncedSearch}%`);
      }
      const { data } = await query;
      return (data as Ticket[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery<TicketComment[]>({
    queryKey: ['ticket-comments', selectedTicket?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ticket_comments')
        .select('*, profiles:author_id(full_name)')
        .eq('ticket_id', selectedTicket!.id)
        .order('created_at', { ascending: true });
      return (data as unknown as TicketComment[]) || [];
    },
    enabled: !!selectedTicket?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (f: TicketForm) => {
      const { error } = await supabase.from('tickets').insert([{
        company_id: profile!.company_id!,
        raised_by: profile!.id,
        subject: f.subject,
        description: f.description,
        category: f.category,
        priority: f.priority as 'low' | 'medium' | 'high' | 'urgent',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket created successfully');
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to create ticket';
      toast.error(msg);
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim() || !selectedTicket) return;
      if (commentText.length > 1000) {
        throw new Error('Comment exceeds 1000 characters limit.');
      }
      const { error } = await supabase.from('ticket_comments').insert([{
        ticket_id: selectedTicket.id,
        author_id: profile!.id,
        content: commentText.trim(),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments'] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to add comment';
      toast.error(msg);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'in_progress' | 'resolved' | 'closed' }) => {
      // ⚡ Enforce resolution guard: A ticket cannot be resolved without at least one comment explaining the resolution.
      if (status === 'resolved') {
        const { data: existingComments, error: commentError } = await supabase
          .from('ticket_comments')
          .select('id')
          .eq('ticket_id', id);
        
        if (commentError) throw commentError;

        if (!existingComments || existingComments.length === 0) {
          throw new Error('Audit Constraint: Please post a comment explaining the resolution details before marking this ticket as Resolved.');
        }
      }

      const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(`Ticket status updated to ${variables.status.replace('_', ' ')}`);
      
      // Update selected ticket in local state securely on success
      setSelectedTicket((prev) => 
        prev && prev.id === variables.id ? { ...prev, status: variables.status } : prev
      );
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    }
  });

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  const priorityStyle: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive',
    critical: 'bg-destructive/10 text-destructive',
    urgent: 'bg-destructive/10 text-destructive',
    medium: 'bg-warning/10 text-warning',
    low: 'bg-info/10 text-info',
  };

  const statusStyle: Record<string, string> = {
    open: 'border-primary text-primary bg-primary/10',
    in_progress: 'border-info text-info bg-info/10',
    pending_reply: 'border-warning text-warning bg-warning/10',
    resolved: 'border-success text-success bg-success/10',
    closed: 'border-muted text-muted-foreground',
  };

  // Premium SLA Calculations helper
  const getSLAInfo = (ticket: { created_at: string; updated_at: string; priority: string; status: string }) => {
    const created = new Date(ticket.created_at);
    const priority = ticket.priority?.toLowerCase() || 'medium';
    
    // SLA hours mapping
    const slaMap: Record<string, number> = {
      urgent: 8,
      high: 24,
      medium: 48,
      low: 72,
    };
    
    const slaHours = slaMap[priority] || 48;
    const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
    const now = new Date();
    const isCompleted = ticket.status === 'resolved' || ticket.status === 'closed';
    
    if (isCompleted) {
      const resolvedAt = new Date(ticket.updated_at || ticket.created_at);
      const metSLA = resolvedAt.getTime() <= deadline.getTime();
      if (metSLA) {
        return {
          badgeText: 'Resolved within SLA',
          style: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400',
        };
      } else {
        return {
          badgeText: 'Resolved (SLA Breached)',
          style: 'bg-rose-500/5 border-rose-500/20 text-rose-500/80',
        };
      }
    } else {
      const breached = now.getTime() > deadline.getTime();
      if (breached) {
        return {
          badgeText: 'SLA Breached',
          style: 'bg-rose-500/10 border-rose-500/35 text-rose-600 dark:text-rose-400 font-semibold animate-pulse',
        };
      } else {
        const remainingHours = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
        if (remainingHours <= 4) {
          return {
            badgeText: `Due in ${remainingHours}h (Urgent)`,
            style: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold',
          };
         }
        return {
          badgeText: `Due in ${remainingHours}h`,
          style: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        };
      }
    }
  };

  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT & HR Help Desk</h1>
          <p className="text-muted-foreground mt-1 text-sm">Service requests & issue tracking</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 h-9 text-xs sm:text-sm rounded-xl"><Plus className="h-4 w-4" /> Raise Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Raise a Support Ticket</DialogTitle>
              <DialogDescription>Describe your issue and we'll get back to you</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Subject</Label>
                <Input placeholder="Brief description of the issue" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} className="rounded-lg shadow-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Description</Label>
                <Textarea placeholder="Describe the issue in detail..." rows={4} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-lg resize-none shadow-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                      <SelectItem value="benefits">Benefits</SelectItem>
                      <SelectItem value="it">IT Support</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">Cancel</Button>
              <Button onClick={() => { if (!form.subject.trim()) { toast.error('Subject is required'); return; } createMutation.mutate(form); }} disabled={createMutation.isPending} className="rounded-lg">
                {createMutation.isPending ? 'Creating...' : 'Submit Ticket'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {[
          { label: 'Open Tickets', value: openCount, color: 'text-warning' },
          { label: 'In Progress', value: inProgressCount, color: 'text-info' },
          { label: 'Resolved', value: resolvedCount, color: 'text-success' },
          { label: 'Total', value: tickets.length, color: 'text-foreground' },
        ].map(stat => (
          <Card key={stat.label} className="rounded-xl shadow-sm border border-border/50">
            <CardContent className="p-4 flex items-center justify-between gap-2 bg-card/20">
              <h3 className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</h3>
              <span className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/50 pb-4 gap-4 bg-muted/5">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold"><LifeBuoy className="w-5 h-5 text-primary/80" /> Tickets</CardTitle>
            <CardDescription className="mt-1 text-xs">Manage support requests</CardDescription>
          </div>
          <div className="w-full sm:w-64 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search tickets..." className="pl-8 bg-background border-border/50 text-sm w-full rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-card/10">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <LifeBuoy className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-semibold">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {tickets.map((ticket) => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="p-4 hover:bg-muted/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${priorityStyle[ticket.priority] || 'bg-muted/10 text-muted-foreground'}`}>
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{ticket.ticket_number}</span>
                        <h4 className="font-bold text-foreground text-sm line-clamp-1">{ticket.subject}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        <span className="font-semibold text-primary/80">{ticket.category}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" /> {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                    {/* Dynamic SLA Badge */}
                    {(() => {
                      const sla = getSLAInfo(ticket);
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide ${sla.style}`}>
                          {sla.badgeText}
                        </span>
                      );
                    })()}
                    <Badge variant="outline" className={`text-[9px] uppercase tracking-wider rounded-full ${statusStyle[ticket.status] || ''}`}>
                      {ticket.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader className="border-b border-border/20 pb-4">
                <SheetTitle className="flex items-center gap-2 text-base font-bold">
                  <span className="text-muted-foreground font-mono font-bold">{selectedTicket.ticket_number}</span>
                  {selectedTicket.subject}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap pt-1.5">
                  <Badge variant="outline" className={`${statusStyle[selectedTicket.status] || ''} text-[10px] uppercase rounded-full`}>{selectedTicket.status?.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className={`${priorityStyle[selectedTicket.priority] || ''} text-[10px] uppercase rounded-full`}>{selectedTicket.priority}</Badge>
                  {/* Dynamic Detail SLA Badge */}
                  {(() => {
                    const sla = getSLAInfo(selectedTicket);
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${sla.style}`}>
                        {sla.badgeText}
                      </span>
                    );
                  })()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {selectedTicket.description && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Description</h4>
                    <p className="text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-xl p-3 border border-border/50">{selectedTicket.description}</p>
                  </div>
                )}

                {isAdmin && (
                  <div className="space-y-2 border border-border/40 p-3.5 rounded-xl bg-muted/5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">HelpDesk Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status === 'open' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg text-xs"
                          onClick={() => { 
                            updateStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' }); 
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          Mark In Progress
                        </Button>
                      )}
                      {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg text-xs font-semibold"
                          onClick={() => { 
                            updateStatusMutation.mutate({ id: selectedTicket.id, status: 'resolved' }); 
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          Resolve Ticket
                        </Button>
                      )}
                      {selectedTicket.status !== 'closed' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg text-xs"
                          onClick={() => { 
                            updateStatusMutation.mutate({ id: selectedTicket.id, status: 'closed' }); 
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          Close Ticket
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-primary/70" /> Comments
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {loadingComments ? (
                      <Skeleton className="h-12 w-full rounded-lg" />
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 italic font-medium">No comments yet</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="bg-muted/10 rounded-xl p-3 border border-border/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-primary">{c.profiles?.full_name || 'User'}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Premium Comment Guard Input box */}
                  <div className="space-y-2 mt-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Write a comment explaining resolution or details..." 
                        value={commentText} 
                        maxLength={1000}
                        onChange={(e) => setCommentText(e.target.value)} 
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter' && commentText.trim() && commentText.length <= 1000) {
                            addCommentMutation.mutate(); 
                          } 
                        }} 
                        className="rounded-lg shadow-sm"
                      />
                      <Button 
                        size="icon" 
                        onClick={() => addCommentMutation.mutate()} 
                        disabled={!commentText.trim() || commentText.length > 1000 || addCommentMutation.isPending} 
                        aria-label="Send comment"
                        className="rounded-lg"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-end text-[10px] font-bold tracking-wide">
                      <span className={commentText.length >= 900 ? 'text-rose-500' : commentText.length >= 800 ? 'text-amber-500' : 'text-muted-foreground'}>
                        {commentText.length}/1000 characters
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
