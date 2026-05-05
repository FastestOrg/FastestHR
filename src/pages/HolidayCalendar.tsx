import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCheck, Plus, Trash2, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HolidayCalendar() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'hr_manager' || profile?.platform_role === 'super_admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', type: 'public' });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', profile?.company_id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('holidays')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order('date');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.date) throw new Error('Name and date are required');
      const { error } = await supabase.from('holidays').insert([{
        company_id: profile!.company_id!,
        name: form.name.trim(),
        date: form.date,
        type: form.type,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday added');
      setDialogOpen(false);
      setForm({ name: '', date: '', type: 'public' });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add holiday'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete'),
  });

  const typeColor: Record<string, string> = {
    public: 'border-success text-success bg-success/10',
    restricted: 'border-warning text-warning bg-warning/10',
    optional: 'border-info text-info bg-info/10',
    company: 'border-primary text-primary bg-primary/10',
  };

  const today = useMemo(() => new Date(), []);

  // ⚡ Bolt Performance Optimization:
  // Instead of mapping and filtering the holidays array multiple times during
  // the render loop (which creates O(N * 4) complexity on every re-render),
  // we do a single pass over the data and memoize the result.
  const { upcomingHolidays, pastHolidays, byMonth } = useMemo(() => {
    const isUpcoming = (dateStr: string) => {
      const d = new Date(dateStr);
      return d >= today;
    };

    const upcoming: any[] = [];
    const past: any[] = [];
    const grouped: Record<number, any[]> = {};

    holidays.forEach((h: any) => {
      // Group by month
      const m = new Date(h.date).getMonth();
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(h);

      // Categorize as upcoming or past
      if (isUpcoming(h.date)) {
        upcoming.push(h);
      } else {
        past.push(h);
      }
    });

    return { upcomingHolidays: upcoming, pastHolidays: past, byMonth: grouped };
  }, [holidays, today]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holiday Calendar</h1>
          <p className="text-muted-foreground mt-1">Company holidays & observances for {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Add Holiday</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Holiday</DialogTitle>
                  <DialogDescription>Add a new company holiday or observance</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Holiday Name</Label>
                    <Input placeholder="e.g. New Year's Day" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public Holiday</SelectItem>
                        <SelectItem value="restricted">Restricted Holiday</SelectItem>
                        <SelectItem value="optional">Optional Holiday</SelectItem>
                        <SelectItem value="company">Company Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Add Holiday</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <CalendarCheck className="w-8 h-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Total Holidays</p>
              <p className="text-3xl font-bold">{holidays.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-3xl font-bold text-primary">{upcomingHolidays.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <CalendarCheck className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Past</p>
              <p className="text-3xl font-bold text-muted-foreground">{pastHolidays.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Calendar View */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((monthName, monthIdx) => {
          const items = byMonth[monthIdx] || [];
          return (
            <Card key={monthIdx} className={`overflow-hidden ${items.length > 0 ? 'border-primary/20' : 'opacity-60'}`}>
              <CardHeader className={`py-3 px-4 ${items.length > 0 ? 'bg-primary/5' : 'bg-muted/20'}`}>
                <CardTitle className="text-sm font-semibold">{monthName} {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent className="py-3 px-4">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No holidays</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((h: any) => {
                      const d = new Date(h.date);
                      const upcoming = new Date(h.date) >= new Date(new Date().setHours(0, 0, 0, 0));
                      return (
                        <div key={h.id} className={`flex items-center gap-2 p-2 rounded text-xs ${upcoming ? 'bg-background border border-border/50' : 'bg-muted/20 opacity-70'}`}>
                          <span className="font-bold text-primary w-6 text-center">{d.getDate()}</span>
                          <span className={`flex-1 ${upcoming ? 'font-medium' : 'text-muted-foreground'}`}>{h.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${typeColor[h.type] || ''}`}>
                            {h.type}
                          </Badge>
                          {isAdmin && (
                            <button
                              aria-label={`Delete ${h.name}`}
                              title={`Delete ${h.name}`}
                              className="text-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded transition-colors"
                              onClick={() => deleteMutation.mutate(h.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upcoming List */}
      <Card>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle>Upcoming Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingHolidays.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CalendarCheck className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No upcoming holidays for {selectedYear}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {upcomingHolidays.map((h: any) => {
                const d = new Date(h.date);
                const daysUntil = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={h.id} className="flex items-center justify-between py-3 px-2 hover:bg-muted/30 transition-colors rounded">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                        <span className="text-xs text-primary font-medium">{MONTHS[d.getMonth()]}</span>
                        <span className="text-lg font-bold text-primary leading-none">{d.getDate()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{h.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.toLocaleDateString('en-US', { weekday: 'long' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={typeColor[h.type] || ''}>{h.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
