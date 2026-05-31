import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListTodo, Plus, Timer, Play, Square, CheckCircle, Clock, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO, addHours } from 'date-fns';

export function TaskList() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

  // Fetch tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', profile?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addHours(parseISO(today + 'T00:00:00Z'), 24), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_time_logs(duration_seconds)
        `)
        .eq('assigned_to', profile!.id)
        .gte('scheduled_start', `${today}T00:00:00Z`)
        .lt('scheduled_start', `${tomorrow}T00:00:00Z`)
        .order('scheduled_start', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Check for active timer
  useQuery({
    queryKey: ['active-timer', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .select('task_id, start_time')
        .eq('user_id', profile!.id)
        .is('end_time', null)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setRunningTaskId(data.task_id);
      }
      return data;
    },
    enabled: !!profile?.id,
  });

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (runningTaskId) {
      interval = setInterval(() => {
        setElapsed(prev => ({
          ...prev,
          [runningTaskId]: (prev[runningTaskId] || 0) + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [runningTaskId]);

  const addTaskMutation = useMutation({
    mutationFn: async ({ title, start, end }: { title: string, start: string, end: string }) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title,
          company_id: profile!.company_id!,
          assigned_to: profile!.id,
          assigned_by: profile!.id,
          type: 'self_managed',
          scheduled_start: `${today}T${start}:00Z`,
          scheduled_end: `${today}T${end}:00Z`,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', profile?.id] });
      setNewTaskTitle('');
      setIsAddingTask(false);
      toast({ title: "Task Scheduled", description: "Your daily focus has been added to the schedule." });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('task_time_logs')
        .insert({
          task_id: taskId,
          user_id: profile!.id,
          start_time: new Date().toISOString(),
        });
      if (error) throw error;
      
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      return taskId;
    },
    onSuccess: (taskId) => {
      setRunningTaskId(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks', profile?.id] });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: activeLog, error: fetchError } = await supabase
        .from('task_time_logs')
        .select('id, start_time')
        .eq('task_id', taskId)
        .eq('user_id', profile!.id)
        .is('end_time', null)
        .single();
      
      if (fetchError) throw fetchError;

      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - new Date(activeLog.start_time).getTime()) / 1000);

      const { error: updateError } = await supabase
        .from('task_time_logs')
        .update({
          end_time: endTime.toISOString(),
          duration_seconds: duration
        })
        .eq('id', activeLog.id);

      if (updateError) throw updateError;
      return taskId;
    },
    onSuccess: () => {
      setRunningTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', profile?.id] });
    },
  });

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ⚡ Bolt: Pre-calculate all task base durations once when tasks change.
  // This prevents O(N*M) `.reduce()` recalculations on every single render
  // (which happens every second when the timer is ticking due to `elapsed` updates).
  const baseDurations = useMemo(() => {
    if (!tasks) return {};
    const dict: Record<string, number> = {};
    for (const task of tasks) {
      let logged = 0;
      if (task.task_time_logs) {
        for (const log of task.task_time_logs) {
          logged += log.duration_seconds || 0;
        }
      }
      dict[task.id] = logged;
    }
    return dict;
  }, [tasks]);

  const getTaskDuration = (task: any) => {
    const logged = baseDurations[task.id] || 0;
    if (runningTaskId === task.id) {
      return logged + (elapsed[task.id] || 0);
    }
    return logged;
  };

  const formatScheduledTime = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    try {
      return format(new Date(dateStr), 'h:mm a');
    } catch (e) {
      return 'Invalid Time';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListTodo className="h-6 w-6 text-primary" />
            </div>
            Daily Focus
          </h2>
          <p className="text-muted-foreground mt-1">Execute your plan for {format(new Date(), 'EEEE')}.</p>
        </div>
        <Button onClick={() => setIsAddingTask(true)} className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 hover:scale-105 transition-all">
          <Plus className="h-5 w-5 mr-2" />
          Schedule Task
        </Button>
      </div>

      {isAddingTask && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top duration-300 rounded-3xl overflow-hidden shadow-2xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">What's the goal for this time block?</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input 
                  placeholder="Focus title..." 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="h-12 bg-background border-primary/20 text-lg rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-12 bg-background border-primary/20 rounded-xl" />
                </div>
                <div className="flex items-center justify-center font-bold text-muted-foreground">-</div>
                <div className="flex-1">
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-12 bg-background border-primary/20 rounded-xl" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:col-span-1">
                <Button onClick={() => addTaskMutation.mutate({ title: newTaskTitle, start: startTime, end: endTime })} disabled={!newTaskTitle} className="h-12 rounded-xl flex-1">Add to Schedule</Button>
                <Button variant="ghost" onClick={() => setIsAddingTask(false)} className="h-12 rounded-xl w-full sm:w-auto">Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12"><Clock className="h-12 w-12 animate-spin text-primary/30" /></div>
        ) : tasks?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-secondary/10 rounded-3xl border-2 border-dashed border-border/50">
            <div className="h-20 w-20 rounded-full bg-secondary/30 flex items-center justify-center mb-2">
              <Calendar className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground/80">Nothing scheduled yet</h3>
              <p className="text-muted-foreground">Start by picking a time slot and adding a focus.</p>
            </div>
          </div>
        ) : (
          tasks?.map((task) => (
            <div key={task.id} className="relative group md:pl-20 py-2">
              {/* Timeline Connector - visible on desktop only */}
              <div className="hidden md:block absolute left-10 top-0 bottom-0 w-[2px] bg-border/50 group-last:bottom-auto group-last:h-12" />
              <div className={`hidden md:block absolute left-8 top-12 -translate-y-1/2 h-4 w-4 rounded-full border-2 bg-background z-10 transition-all ${runningTaskId === task.id ? 'border-primary ring-4 ring-primary/20' : 'border-border group-hover:border-primary/50'}`} />
              
              {/* Time Label - visible on desktop only */}
              <div className="hidden md:block absolute left-0 top-11 -translate-y-1/2 w-20 text-right pr-8 text-xs font-bold uppercase tracking-tighter text-muted-foreground whitespace-nowrap">
                {formatScheduledTime(task.scheduled_start)}
              </div>
 
              <Card className={`overflow-hidden transition-all duration-300 border border-border/10 md:border-none shadow-sm hover:shadow-xl ${task.status === 'completed' ? 'opacity-60 bg-secondary/10' : 'bg-card'}`}>
                <CardContent className="p-4 sm:p-6">
                  {/* Mobile Time Badge - hidden on desktop */}
                  <div className="md:hidden flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                      {formatScheduledTime(task.scheduled_start)} - {formatScheduledTime(task.scheduled_end)}
                    </span>
                    {task.task_time_logs?.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 px-2.5 py-1 rounded-full border border-green-500/20 flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {formatTime(getTaskDuration(task))}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-lg sm:text-xl transition-all ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </h3>
                        {task.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                      <div className="hidden md:flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 bg-secondary/30 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="font-semibold text-xs sm:text-sm">{formatScheduledTime(task.scheduled_start)} - {formatScheduledTime(task.scheduled_end)}</span>
                        </div>
                        {task.task_time_logs?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-primary font-bold">
                            <Timer className="h-3.5 w-3.5" />
                            <span className="text-xs sm:text-sm">{formatTime(getTaskDuration(task))} tracked</span>
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
                      {runningTaskId === task.id ? (
                        <Button 
                          onClick={() => stopTimerMutation.mutate(task.id)}
                          variant="destructive"
                          className="flex-1 md:flex-none h-11 px-6 rounded-xl animate-pulse"
                        >
                          <Square className="h-4 w-4 mr-2 fill-current" />
                          Stop Timer
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => startTimerMutation.mutate(task.id)}
                          disabled={task.status === 'completed' || (!!runningTaskId && runningTaskId !== task.id)}
                          variant="outline"
                          className="flex-1 md:flex-none h-11 px-6 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                        >
                          <Play className="h-4 w-4 mr-2 fill-current" />
                          Start Track
                        </Button>
                      )}
                      
                      {task.status !== 'completed' && !runningTaskId && (
                         <Button 
                          variant="ghost" 
                          size="icon" 
                          aria-label="Task alert"
                          className="h-11 w-11 rounded-xl text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity"
                        >
                          <AlertCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
