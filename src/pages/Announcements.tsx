import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Megaphone, Pin, CalendarDays, MoreVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';
import { toast } from 'sonner';

interface AnnouncementForm {
  title: string;
  content: string;
  target_audience: string;
  is_pinned: boolean;
}

const emptyForm: AnnouncementForm = { title: '', content: '', target_audience: 'all', is_pinned: false };

export default function Announcements() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: AnnouncementForm) => {
      if (editingId) {
        const { error } = await supabase.from('announcements').update({
          title: formData.title,
          content: formData.content,
          target_audience: formData.target_audience,
          is_pinned: formData.is_pinned,
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert([{
          company_id: profile!.company_id!,
          title: formData.title,
          content: formData.content,
          target_audience: formData.target_audience,
          is_pinned: formData.is_pinned,
          created_by: profile!.id,
          published_at: new Date().toISOString(),
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(editingId ? 'Announcement updated' : 'Announcement published');
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Pin status updated');
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (ann: any) => {
    setEditingId(ann.id);
    setForm({ title: ann.title, content: ann.content || '', target_audience: ann.target_audience || 'all', is_pinned: ann.is_pinned || false });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Announcements</h1>
          <p className="text-muted-foreground mt-1">Updates & news across the organization</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else { setEditingId(null); setForm(emptyForm); setDialogOpen(true); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New Announcement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
                <DialogDescription>Share updates with your organization</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ann-title">Title</Label>
                  <Input id="ann-title" placeholder="Announcement title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ann-content">Content</Label>
                  <Textarea id="ann-content" placeholder="Write your announcement..." rows={4} value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select value={form.target_audience} onValueChange={(v) => setForm(f => ({ ...f, target_audience: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        <SelectItem value="managers">Managers Only</SelectItem>
                        <SelectItem value="hr">HR Team</SelectItem>
                        <SelectItem value="leadership">Leadership</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pin Announcement</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={form.is_pinned} onCheckedChange={(c) => setForm(f => ({ ...f, is_pinned: c }))} />
                      <span className="text-sm text-muted-foreground">{form.is_pinned ? 'Pinned' : 'Not pinned'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Publish'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="max-w-4xl space-y-6">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16">
              <Megaphone className="h-16 w-16 text-muted-foreground/30" />
              <div className="text-center">
                <p className="text-lg font-medium">No announcements yet</p>
                <p className="text-sm text-muted-foreground">Create your first announcement to share with the team</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          announcements.map((ann: any) => (
            <Card key={ann.id} className={`shadow-none overflow-hidden relative ${ann.is_pinned ? 'border-primary/60 bg-primary/5' : 'border-border/50 bg-card/40'}`}>
              {ann.is_pinned && (
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                  <div className="absolute -rotate-45 transform bg-primary text-primary-foreground text-[10px] font-bold uppercase py-1 right-[-35px] top-[15px] w-[120px] text-center shadow-lg">
                    Pinned
                  </div>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded bg-background border ${ann.is_pinned ? 'border-primary' : 'border-border/50'} flex items-center justify-center flex-shrink-0`}>
                    {ann.is_pinned ? <Pin className="w-6 h-6 text-primary" /> : <Megaphone className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1 pr-14">
                      <CardTitle className={`text-lg ${ann.is_pinned ? 'text-primary' : ''}`}>
                        {ann.title}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] uppercase border-border/50 bg-background/50 text-muted-foreground">
                        {ann.target_audience || 'All'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" aria-label="Announcement actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(ann)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePinMutation.mutate({ id: ann.id, pinned: !ann.is_pinned })}>
                          <Pin className="h-4 w-4 mr-2" /> {ann.is_pinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(ann.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              {ann.content && (
                <CardContent>
                  <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-border/50 pl-4 py-1">
                    {ann.content}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
