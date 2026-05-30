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
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Plus, Trash2, Loader2 } from 'lucide-react';

export default function WorkScheduleSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', start_time: '09:00', end_time: '18:00', break_minutes: '60' });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const createShift = useMutation({
    mutationFn: async () => {
      if (!shiftForm.name.trim()) throw new Error('Name required');
      const { error } = await supabase
        .from('shifts')
        .insert([{
          company_id: companyId!,
          name: shiftForm.name,
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          break_minutes: parseInt(shiftForm.break_minutes) || 60
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift created');
      setDialogOpen(false);
      setShiftForm({ name: '', start_time: '09:00', end_time: '18:00', break_minutes: '60' });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to create shift')),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete shift')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Shift Definitions</h2>
          <p className="text-sm text-muted-foreground mt-1">Create and manage work shifts and duty hours for your organization</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 font-semibold">
              <Plus className="w-4 h-4" /> Add Shift
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border-border/50">
            <DialogHeader>
              <DialogTitle>Create Shift</DialogTitle>
              <DialogDescription>Define a new work schedule shift</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Shift Name</Label>
                <Input placeholder="e.g. Morning Shift" value={shiftForm.name} onChange={(e) => setShiftForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm(f => ({ ...f, start_time: e.target.value }))} className="bg-background/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm(f => ({ ...f, end_time: e.target.value }))} className="bg-background/50 border-border/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Break Duration (minutes)</Label>
                <Input type="number" value={shiftForm.break_minutes} onChange={(e) => setShiftForm(f => ({ ...f, break_minutes: e.target.value }))} className="bg-background/50 border-border/50" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createShift.mutate()} disabled={createShift.isPending}>
                {createShift.isPending ? 'Creating...' : 'Create Shift'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : shifts.length === 0 ? (
        <Card className="border-border/50 bg-card py-12 text-center text-muted-foreground text-sm">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-20 text-primary" />
          <p className="font-medium text-sm">No shifts defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your company's first duty shift above.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shifts.map((shift: any) => (
            <Card key={shift.id} className="border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-200 shadow-sm overflow-hidden">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{shift.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {shift.start_time} — {shift.end_time} · {shift.break_minutes}m break
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteShift.mutate(shift.id)} aria-label="Delete shift">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
