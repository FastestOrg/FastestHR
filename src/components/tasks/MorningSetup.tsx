import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sun, CheckCircle2, Loader2, Sparkles, Clock, Plus, Trash2, CalendarDays } from 'lucide-react';
import { format, parse, addHours } from 'date-fns';

interface TimeSlot {
  startTime: string;
  endTime: string;
  focus: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export function MorningSetup() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', profile?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (report?.morning_plan && Array.isArray(report.morning_plan)) {
      setSlots(report.morning_plan as unknown as TimeSlot[]);
    } else {
      setSlots([{ startTime: '09:00', endTime: '10:00', focus: '' }]);
    }
  }, [report]);

  const mutation = useMutation({
    mutationFn: async (updatedSlots: TimeSlot[]) => {
      // 1. Save to daily_reports
      const { error: reportError } = await supabase
        .from('daily_reports')
        .upsert({
          user_id: profile!.id,
          company_id: profile!.company_id!,
          date: today,
          morning_plan: updatedSlots as any,
        }, { onConflict: 'user_id,date' });

      if (reportError) throw reportError;

      // 2. Create/Sync tasks
      // ⚡ Bolt: Batch database operations to avoid N+1 query scaling issues
      const validSlots = updatedSlots.filter(s => s.focus.trim().length > 0);
      if (validSlots.length === 0) return true;

      const slotMap = validSlots.map(slot => {
        return {
          ...slot,
          startTs: `${today}T${slot.startTime}:00Z`,
          endTs: `${today}T${slot.endTime}:00Z`,
        };
      });

      const startTsList = slotMap.map(s => s.startTs);

      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('title, scheduled_start')
        .eq('assigned_to', profile!.id)
        .in('scheduled_start', startTsList);

      const tasksToInsert = slotMap.filter(slot => {
        const slotStartMs = new Date(slot.startTs).getTime();
        const exists = existingTasks?.some(t => {
          return t.title === slot.focus &&
                 new Date(t.scheduled_start).getTime() === slotStartMs;
        });
        return !exists;
      }).map(slot => ({
        title: slot.focus,
        company_id: profile!.company_id!,
        assigned_to: profile!.id,
        assigned_by: profile!.id,
        type: 'self_managed',
        scheduled_start: slot.startTs,
        scheduled_end: slot.endTs,
      }));

      if (tasksToInsert.length > 0) {
        await supabase.from('tasks').insert(tasksToInsert);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report', profile?.id, today] });
      queryClient.invalidateQueries({ queryKey: ['tasks', profile?.id] });
      toast({
        title: "Daily Plan Synced",
        description: "Your schedule has been locked in and tasks have been created in your tracker.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to sync schedule: " + error.message,
        variant: "destructive",
      });
    },
  });

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    let nextStart = '10:00';
    let nextEnd = '11:00';
    if (lastSlot) {
      try {
        const lastEnd = parse(lastSlot.endTime, 'HH:mm', new Date());
        nextStart = format(lastEnd, 'HH:mm');
        nextEnd = format(addHours(lastEnd, 1), 'HH:mm');
      } catch (e) {}
    }
    setSlots([...slots, { startTime: nextStart, endTime: nextEnd, focus: '' }]);
  };

  const removeSlot = (index: number) => setSlots(slots.filter((_, i) => i !== index));
  const updateSlot = (index: number, key: keyof TimeSlot, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [key]: value };
    setSlots(newSlots);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-2xl bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden transition-all duration-500">
        <CardHeader className="relative border-b border-border/50 pb-8">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20">
            <CalendarDays className="h-32 w-32 text-primary rotate-12" />
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl font-display font-bold">Daily Planner</CardTitle>
                <CardDescription className="text-lg">
                  Visualize your day. Allocate time for your priorities.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-8 space-y-8">
          <div className="space-y-4">
            {slots.map((slot, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-secondary/20 p-3 sm:p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-all group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="time" 
                      value={slot.startTime} 
                      onChange={(e) => updateSlot(index, 'startTime', e.target.value)} 
                      className="w-24 sm:w-28 bg-background border-border/50 rounded-lg h-11"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                      type="time" 
                      value={slot.endTime} 
                      onChange={(e) => updateSlot(index, 'endTime', e.target.value)} 
                      className="w-24 sm:w-28 bg-background border-border/50 rounded-lg h-11"
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeSlot(index)}
                    className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg sm:hidden transition-all"
                  >
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </Button>
                </div>
                <div className="flex-1 w-full flex items-center gap-2">
                  <Input 
                    placeholder="Focus: e.g. Design meeting, Deep work..."
                    className="h-11 bg-background border-border/50 focus:border-primary/50 transition-all"
                    value={slot.focus}
                    onChange={(e) => updateSlot(index, 'focus', e.target.value)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeSlot(index)}
                    className="hidden sm:flex h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              onClick={addSlot}
              className="w-full h-14 border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-muted-foreground rounded-xl"
            >
              <Plus className="h-5 w-5" />
              Add Time Slot
            </Button>
          </div>

          <div className="pt-6 border-t border-border/50 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-secondary/30 px-4 py-2 rounded-full">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Today is {format(new Date(), 'eeee, MMMM do')}
            </div>
            
            <Button 
              className="w-full sm:w-80 h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95 group"
              onClick={() => mutation.mutate(slots)}
              disabled={mutation.isPending || slots.some(s => !s.focus)}
            >
              {mutation.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
              ) : (
                <>
                  Lock Daily Schedule
                  <CheckCircle2 className="h-6 w-6 ml-2 group-hover:scale-110 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
