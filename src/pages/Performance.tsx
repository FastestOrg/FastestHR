import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, TrendingUp, Award, Zap, Plus, Pencil, Star, MessageSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';
import { toast } from 'sonner';

interface GoalForm {
  title: string;
  description: string;
  due_date: string;
  type: string;
}
const emptyGoalForm: GoalForm = { title: '', description: '', due_date: '', type: 'individual' };

// ⚡ Bolt: Hoisted static object configuration outside of component body
// to prevent unnecessary memory reallocation on every render.
const statusColor: Record<string, string> = {
  active: 'border-success text-success bg-success/10',
  on_track: 'border-success text-success bg-success/10',
  at_risk: 'border-warning text-warning bg-warning/10',
  completed: 'border-info text-info bg-info/10',
  missed: 'border-destructive text-destructive bg-destructive/10',
};

export default function Performance() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'hr_manager' || profile?.platform_role === 'super_admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(emptyGoalForm);
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null);
  const [feedbackGoal, setFeedbackGoal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { rating: number; comment: string }>>({});
  const [cycleForm, setCycleForm] = useState({ name: '', start_date: '', end_date: '', type: 'quarterly' });

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase.from('employees').select('id, company_id').eq('user_id', profile.id).is('deleted_at', null).maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['goals', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('goals')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: reviewCycles = [] } = useQuery({
    queryKey: ['review-cycles', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('review_cycles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (f: GoalForm) => {
      if (!employee) throw new Error('Employee record not found');
      if (!profile?.company_id) throw new Error('Profile or company not found');
      const { error } = await supabase.from('goals').insert([{
        company_id: profile.company_id,
        employee_id: employee.id,
        title: f.title,
        description: f.description,
        due_date: f.due_date || null,
        type: f.type,
        created_by: profile.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Objective created');
      setDialogOpen(false);
      setForm(emptyGoalForm);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create'),
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const status = progress >= 100 ? 'completed' : progress >= 70 ? 'on_track' : 'active';
      const { error } = await supabase.from('goals').update({ progress, status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setUpdatingGoal(null);
      toast.success('Progress updated');
    },
  });

  const createCycleMutation = useMutation({
    mutationFn: async () => {
      if (!cycleForm.name.trim()) throw new Error('Name is required');
      if (!profile?.company_id) throw new Error('Company ID is required');
      const { error } = await supabase.from('review_cycles').insert([{
        company_id: profile.company_id,
        name: cycleForm.name,
        start_date: cycleForm.start_date,
        end_date: cycleForm.end_date,
        type: cycleForm.type,
        status: 'active',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      toast.success('Review cycle created');
      setCycleDialogOpen(false);
      setCycleForm({ name: '', start_date: '', end_date: '', type: 'quarterly' });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create cycle'),
  });

  const saveFeedbackMutation = useMutation({
    mutationFn: async ({ goalId, rating, comment }: { goalId: string; rating: number; comment: string }) => {
      const { error } = await supabase
        .from('goals')
        .update({
          key_results: {
            rating,
            comment,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', goalId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setFeedbackGoal(null);
      toast.success('Manager feedback saved successfully');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save feedback'),
  });

  const saveFeedback = (goalId: string) => {
    const fb = feedback[goalId];
    if (!fb || !fb.comment.trim()) { toast.error('Please add feedback text'); return; }
    saveFeedbackMutation.mutate({
      goalId,
      rating: fb.rating || 0,
      comment: fb.comment
    });
  };

  const activeGoals = goals.filter((g: any) => g.status === 'active' || g.status === 'on_track' || g.status === 'at_risk');
  const completedGoals = goals.filter((g: any) => g.status === 'completed');
  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((s: number, g: any) => s + (g.progress || 0), 0) / goals.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance & Goals</h1>
          <p className="text-muted-foreground mt-1">OKR tracking & appraisal cycles</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isAdmin && (
            <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none gap-2 text-xs sm:text-sm h-9 px-3"><Zap className="h-4 w-4" /> New Cycle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Review Cycle</DialogTitle>
                  <DialogDescription>Set up a performance review period</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Cycle Name</Label>
                    <Input placeholder="e.g., Q1 2026 Review" value={cycleForm.name} onChange={(e) => setCycleForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={cycleForm.type} onValueChange={(v) => setCycleForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="half_yearly">Half-Yearly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="360_degree">360° Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={cycleForm.start_date} onChange={(e) => setCycleForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={cycleForm.end_date} onChange={(e) => setCycleForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createCycleMutation.mutate()} disabled={createCycleMutation.isPending}>Create Cycle</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none gap-2 text-xs sm:text-sm h-9 px-3"><Plus className="h-4 w-4" /> New Goal</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Objective</DialogTitle>
                <DialogDescription>Define a goal with measurable key results</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Objective Title</Label>
                  <Input placeholder="e.g., Increase customer satisfaction" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Describe the objective and key results..." rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => { if (!form.title.trim()) { toast.error('Title is required'); return; } createGoalMutation.mutate(form); }} disabled={createGoalMutation.isPending}>
                  {createGoalMutation.isPending ? 'Creating...' : 'Create Objective'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4 sm:p-6">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary mb-3 sm:mb-4" />
          <h3 className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Avg Progress</h3>
          <div className="text-2xl sm:text-4xl font-black">{avgProgress}%</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 sm:p-6">
          <Target className="w-6 h-6 sm:w-8 sm:h-8 text-warning mb-3 sm:mb-4" />
          <h3 className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Active Goals</h3>
          <div className="text-2xl sm:text-4xl font-black text-warning">{activeGoals.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 sm:p-6">
          <Award className="w-6 h-6 sm:w-8 sm:h-8 text-success mb-3 sm:mb-4" />
          <h3 className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Completed</h3>
          <div className="text-2xl sm:text-4xl font-black text-success">{completedGoals.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 sm:p-6">
          <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-info mb-3 sm:mb-4" />
          <h3 className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cycles</h3>
          <div className="text-2xl sm:text-4xl font-black text-info">{reviewCycles.length}</div>
        </CardContent></Card>
      </div>

      {/* Review Cycles */}
      {reviewCycles.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> Active Review Cycles</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {reviewCycles.map((cycle: any) => (
                <div key={cycle.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-background/50 gap-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{cycle.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cycle.start_date} → {cycle.end_date}</p>
                  </div>
                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                    <Badge variant="outline" className="capitalize text-[9px] tracking-tight">{cycle.type?.replace('_', ' ')}</Badge>
                    <Badge variant="outline" className={`text-[9px] ${cycle.status === 'active' ? 'border-success text-success bg-success/10' : 'border-muted text-muted-foreground'}`}>
                      {cycle.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Current Objectives</CardTitle>
          <CardDescription>Track progress on your goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingGoals ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Target className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No goals created yet</p>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Create Your First Goal</Button>
            </div>
          ) : (
            goals.map((goal: any) => (
              <div key={goal.id} className="space-y-3 p-3.5 rounded-xl border border-border/50 bg-background/30 hover:bg-background/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground text-sm sm:text-base">{goal.title}</div>
                    {goal.employees && (
                      <span className="text-xs text-muted-foreground mt-0.5 block">{goal.employees.first_name} {goal.employees.last_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                    <Badge variant="outline" className={`text-[10px] capitalize ${statusColor[goal.status] || ''}`}>
                      {goal.status?.replace('_', ' ')}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg" onClick={() => setUpdatingGoal(updatingGoal === goal.id ? null : goal.id)} aria-label="Update goal">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg" 
                        onClick={() => {
                          if (feedbackGoal !== goal.id) {
                            const existing = goal.key_results as any;
                            if (existing && typeof existing === 'object' && 'comment' in existing) {
                              setFeedback(prev => ({
                                ...prev,
                                [goal.id]: {
                                  rating: existing.rating || 0,
                                  comment: existing.comment || ''
                                }
                              }));
                            } else {
                              setFeedback(prev => ({
                                ...prev,
                                [goal.id]: {
                                  rating: 0,
                                  comment: ''
                                }
                              }));
                            }
                            setFeedbackGoal(goal.id);
                          } else {
                            setFeedbackGoal(null);
                          }
                        }} 
                        aria-label="Add feedback"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={goal.progress || 0} className="h-2" />
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground w-12 text-right">{goal.progress || 0}%</span>
                </div>
                {updatingGoal === goal.id && (
                  <div className="flex items-center gap-4 pt-2 border-t border-border/30">
                    <span className="text-xs text-muted-foreground w-20">Update:</span>
                    <Slider
                      defaultValue={[goal.progress || 0]}
                      max={100}
                      step={5}
                      className="flex-1"
                      onValueCommit={(value) => updateProgressMutation.mutate({ id: goal.id, progress: value[0] })}
                    />
                  </div>
                )}
                {/* Manager Feedback Section */}
                {feedbackGoal === goal.id && isAdmin && (
                  <div className="pt-3 mt-2 border-t border-border/30 space-y-3">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Manager Feedback
                    </h5>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedback(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], rating: star, comment: prev[goal.id]?.comment || '' } }))}
                          className="focus:outline-none"
                        >
                          <Star className={`w-5 h-5 transition-colors ${(feedback[goal.id]?.rating || 0) >= star ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2 self-center">{feedback[goal.id]?.rating || 0}/5</span>
                    </div>
                    <Textarea
                      placeholder="Add your feedback, observations, and improvement areas..."
                      rows={2}
                      value={feedback[goal.id]?.comment || ''}
                      onChange={(e) => setFeedback(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], rating: prev[goal.id]?.rating || 0, comment: e.target.value } }))}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" type="button" onClick={() => saveFeedback(goal.id)} disabled={saveFeedbackMutation.isPending}>
                        {saveFeedbackMutation.isPending ? 'Saving...' : 'Save Feedback'}
                      </Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => setFeedbackGoal(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {/* Display Saved Feedback to everyone */}
                {goal.key_results && typeof goal.key_results === 'object' && 'comment' in (goal.key_results as any) && (
                  <div className="pt-3 mt-2 border-t border-border/20 bg-muted/20 p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Manager Feedback
                      </h5>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${((goal.key_results as any).rating || 0) >= star ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/20'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-foreground italic">"{(goal.key_results as any).comment}"</p>
                  </div>
                )}
                {goal.due_date && (
                  <p className="text-xs text-muted-foreground">Due: {goal.due_date}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
