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
import { Search, Plus, LifeBuoy, Clock, AlertCircle, Send, ArrowLeft, MessageSquare } from 'lucide-react';
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
const emptyForm: TicketForm = { subject: '', description: '', category: 'other', priority: 'medium' };

export default function HelpDesk() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // ⚡ Bolt: Debounce search input to prevent firing an API call on every keystroke.
  // This reduces Supabase queries and React Query cache invalidations significantly.
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [commentText, setCommentText] = useState('');

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id, company_id').eq('user_id', profile!.id).is('deleted_at', null).maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: tickets = [], isLoading } = useQuery({
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
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['ticket-comments', selectedTicket?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ticket_comments')
        .select('*, profiles:author_id(full_name)')
        .eq('ticket_id', selectedTicket!.id)
        .order('created_at', { ascending: true });
      return data || [];
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
        priority: f.priority as any,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket created');
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create ticket'),
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim() || !selectedTicket) return;
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
    onError: (err: any) => toast.error(err?.message || 'Failed to add comment'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('tickets').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Status updated');
    },
  });

  const openCount = tickets.filter((t: any) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t: any) => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;

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

  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT & HR Help Desk</h1>
          <p className="text-muted-foreground mt-1">Service requests & issue tracking</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 h-9 text-xs sm:text-sm"><Plus className="h-4 w-4" /> Raise Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Raise a Support Ticket</DialogTitle>
              <DialogDescription>Describe your issue and we'll get back to you</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input placeholder="Brief description of the issue" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the issue in detail..." rows={4} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => { if (!form.subject.trim()) { toast.error('Subject is required'); return; } createMutation.mutate(form); }} disabled={createMutation.isPending}>
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
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <h3 className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</h3>
              <span className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><LifeBuoy className="w-5 h-5" /> Tickets</CardTitle>
            <CardDescription className="mt-1">Manage support requests</CardDescription>
          </div>
          <div className="w-full sm:w-64 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search tickets..." className="pl-8 bg-background/50 border-border/50 text-sm w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <LifeBuoy className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tickets.map((ticket: any) => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${priorityStyle[ticket.priority] || 'bg-muted/10 text-muted-foreground'}`}>
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground">{ticket.ticket_number}</span>
                        <h4 className="font-semibold text-foreground text-sm line-clamp-1">{ticket.subject}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                        <span className="font-medium">{ticket.category}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" /> {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                    <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${statusStyle[ticket.status] || ''}`}>
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
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <span className="text-muted-foreground">{selectedTicket.ticket_number}</span>
                  {selectedTicket.subject}
                </SheetTitle>
                <SheetDescription>
                  <Badge variant="outline" className={`${statusStyle[selectedTicket.status] || ''} text-[10px] uppercase mr-2`}>{selectedTicket.status?.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className={`${priorityStyle[selectedTicket.priority] || ''} text-[10px] uppercase`}>{selectedTicket.priority}</Badge>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {selectedTicket.description && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Description</h4>
                    <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 rounded p-3 border border-border/50">{selectedTicket.description}</p>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2">
                    {selectedTicket.status !== 'in_progress' && (
                      <Button size="sm" variant="outline" onClick={() => { updateStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' }); setSelectedTicket({ ...selectedTicket, status: 'in_progress' }); }}>
                        Mark In Progress
                      </Button>
                    )}
                    {selectedTicket.status !== 'resolved' && (
                      <Button size="sm" variant="outline" className="border-success text-success" onClick={() => { updateStatusMutation.mutate({ id: selectedTicket.id, status: 'resolved' }); setSelectedTicket({ ...selectedTicket, status: 'resolved' }); }}>
                        Resolve
                      </Button>
                    )}
                    {selectedTicket.status !== 'closed' && (
                      <Button size="sm" variant="outline" onClick={() => { updateStatusMutation.mutate({ id: selectedTicket.id, status: 'closed' }); setSelectedTicket({ ...selectedTicket, status: 'closed' }); }}>
                        Close
                      </Button>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Comments
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {loadingComments ? (
                      <Skeleton className="h-12 w-full" />
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                    ) : (
                      comments.map((c: any) => (
                        <div key={c.id} className="bg-background/50 rounded p-3 border border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-primary">{(c as any).profiles?.full_name || 'User'}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-foreground/80">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) addCommentMutation.mutate(); }} />
                    <Button size="icon" onClick={() => addCommentMutation.mutate()} disabled={!commentText.trim() || addCommentMutation.isPending} aria-label="Send comment">
                      <Send className="h-4 w-4" />
                    </Button>
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
