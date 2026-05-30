import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Settings2, Trash2, Loader2 } from 'lucide-react';

export default function LeaveTypesSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    name: '', code: '', max_days_per_year: '12', color: '#4F46E5', is_active: true, carry_forward: false, requires_document: false 
  });

  const { data: leaveTypes = [], isLoading } = useQuery({
    queryKey: ['leave-types', companyId],
    queryFn: async () => { 
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', companyId)
        .order('name'); 
      if (error) throw error;
      return data || []; 
    },
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name required');
      const payload = { 
        company_id: companyId!, 
        name: form.name.trim(), 
        code: form.code.trim() || null, 
        max_days_per_year: parseFloat(form.max_days_per_year) || 0, 
        color: form.color,
        is_active: form.is_active,
        carry_forward: form.carry_forward,
        requires_document: form.requires_document
      };
      
      if (editingType) {
        const { error } = await supabase.from('leave_types').update(payload).eq('id', editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('leave_types').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['leave-types'] }); 
      toast.success(editingType ? 'Leave type updated' : 'Leave type created'); 
      setDialogOpen(false); 
      resetForm();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save leave type')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { 
      const { error } = await supabase.from('leave_types').delete().eq('id', id); 
      if (error) throw error; 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['leave-types'] }); 
      toast.success('Leave type deleted'); 
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed. Leave type might be in use.')),
  });

  const resetForm = () => {
    setForm({ name: '', code: '', max_days_per_year: '12', color: '#4F46E5', is_active: true, carry_forward: false, requires_document: false });
    setEditingType(null);
  };

  const handleEdit = (lt: any) => {
    setEditingType(lt);
    setForm({ 
      name: lt.name, 
      code: lt.code || '', 
      max_days_per_year: lt.max_days_per_year?.toString() || '0', 
      color: lt.color || '#4F46E5',
      is_active: lt.is_active,
      carry_forward: lt.carry_forward,
      requires_document: lt.requires_document
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Leave Categories</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure different types of leaves, carry-forwards, and quotas</p>
        </div>
        <Button size="sm" className="gap-1 font-semibold" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" /> Add Type
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : leaveTypes.length === 0 ? (
        <Card className="border-border/50 bg-card py-12 text-center text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20 text-primary" />
          <p className="font-medium text-sm">No leave types defined yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">You need to add at least one leave type to allow employees to submit requests.</p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Create Leave Type</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leaveTypes.map((lt: any) => (
            <Card key={lt.id} className="border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-200 shadow-sm overflow-hidden group">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: lt.color }}>
                    {lt.code || lt.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{lt.name}</p>
                      {!lt.is_active && <Badge variant="secondary" className="text-[9px] h-4 py-0">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{lt.max_days_per_year} days/year • {lt.carry_forward ? 'Carry forward' : 'Non-cumulative'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(lt)} aria-label="Edit leave type">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(lt.id)} aria-label="Delete leave type">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
            <DialogDescription>Define the name, quota and behavior for this leave category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input placeholder="e.g. Sick Leave" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Short Code</Label>
                <Input placeholder="e.g. SL" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days per Year</Label>
                <Input type="number" value={form.max_days_per_year} onChange={(e) => setForm(f => ({ ...f, max_days_per_year: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pick a Color</Label>
                <div className="flex gap-2 items-center h-10 px-3 rounded-md border border-border/50 bg-background/50">
                  <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} className="w-6 h-6 rounded border-none bg-transparent cursor-pointer" />
                  <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-is-active">
                  <Label className="text-sm">Active</Label>
                  <p className="text-[10px] text-muted-foreground">Visible to employees for applications</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.is_active}
                  aria-labelledby="label-is-active"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-carry-forward">
                  <Label className="text-sm">Carry Forward</Label>
                  <p className="text-[10px] text-muted-foreground">Allow unused days to transfer to next year</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.carry_forward}
                  aria-labelledby="label-carry-forward"
                  onClick={() => setForm(f => ({ ...f, carry_forward: !f.carry_forward }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.carry_forward ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.carry_forward ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-requires-document">
                  <Label className="text-sm">Requires Document</Label>
                  <p className="text-[10px] text-muted-foreground">Require employees to upload medical or supporting docs</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.requires_document}
                  aria-labelledby="label-requires-document"
                  onClick={() => setForm(f => ({ ...f, requires_document: !f.requires_document }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.requires_document ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.requires_document ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-8 shadow-md shadow-primary/20">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingType ? 'Save Changes' : 'Create Type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
