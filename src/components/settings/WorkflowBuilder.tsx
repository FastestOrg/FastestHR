import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Plus, Trash2, GitBranch, AlertCircle, Settings2, Power, ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowBuilderProps {
  companyId?: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  candidate_stage_updated: 'Candidate Pipeline Stage Updated',
  leave_created: 'Leave Request Received',
  leave_updated: 'Leave Request Status Changed',
  employee_created: 'New Employee Profile Created',
  ticket_created: 'New Helpdesk Ticket Created',
};

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Automated Email Notification' },
  { value: 'create_checklist', label: 'Generate Onboarding Checklist Item' },
];

export default function WorkflowBuilder({ companyId }: WorkflowBuilderProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'workflows' | 'runs'>('workflows');
  
  // Workflow Form State
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<string>('leave_created');
  
  // Conditions & Actions Builders
  const [conditions, setConditions] = useState<any[]>([{ field: '', operator: '==', value: '' }]);
  const [actions, setActions] = useState<any[]>([{ type: 'send_email', template_name: 'Standard Alert', subject: '', body: '' }]);

  // Fetch workflows
  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery({
    queryKey: ['company-workflows', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch workflow runs
  const { data: workflowRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['workflow-runs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('*, workflows(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Mutations
  const createWorkflow = useMutation({
    mutationFn: async () => {
      if (!workflowName.trim()) throw new Error('Workflow Name is required');

      // Filter out incomplete conditions/actions
      const filteredConditions = conditions.filter(c => c.field.trim() !== '');
      const filteredActions = actions.filter(a => a.subject?.trim() !== '' || a.body?.trim() !== '');

      const { error } = await supabase.from('workflows').insert([{
        company_id: companyId!,
        name: workflowName,
        description: workflowDesc,
        trigger_event: triggerEvent,
        conditions: filteredConditions,
        actions: filteredActions,
        is_active: true
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-workflows'] });
      toast.success('Workflow automation created');
      setDialogOpen(false);
      setWorkflowName('');
      setWorkflowDesc('');
      setTriggerEvent('leave_created');
      setConditions([{ field: '', operator: '==', value: '' }]);
      setActions([{ type: 'send_email', template_name: 'Standard Alert', subject: '', body: '' }]);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create workflow'),
  });

  const toggleWorkflow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-workflows'] });
      toast.success('Workflow status updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update status'),
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-workflows'] });
      toast.success('Workflow automation deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete workflow'),
  });

  // Conditions helpers
  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: '==', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: string, val: string) => {
    const updated = [...conditions];
    updated[index][key] = val;
    setConditions(updated);
  };

  // Actions helpers
  const addAction = () => {
    setActions([...actions, { type: 'send_email', template_name: 'Standard Alert', subject: '', body: '' }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, key: string, val: string) => {
    const updated = [...actions];
    updated[index][key] = val;
    setActions(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-base font-semibold">Workflow Automation Builder</h3>
          <p className="text-xs text-muted-foreground">Build conditional, trigger-based HR recipes and lifecycle workflows</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shadow-sm bg-primary hover:bg-primary/95">
              <Plus className="w-3.5 h-3.5" /> Create Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-card border-border/50 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Custom Workflow Rule</DialogTitle>
              <DialogDescription>Setup a trigger-based action recipe. Conditions are optional.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Automation Name</Label>
                  <Input 
                    placeholder="e.g. High-Days Leave Alert" 
                    value={workflowName} 
                    onChange={(e) => setWorkflowName(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    placeholder="e.g. Notify management of long leaves" 
                    value={workflowDesc} 
                    onChange={(e) => setWorkflowDesc(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Operational Trigger Event</Label>
                <Select value={triggerEvent} onValueChange={(val) => setTriggerEvent(val)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditions Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Conditions (When...)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={addCondition}>
                    + Add Condition
                  </Button>
                </div>
                <div className="space-y-2">
                  {conditions.map((cond, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input 
                        placeholder="Field (e.g. total_days, status)" 
                        value={cond.field} 
                        onChange={(e) => updateCondition(index, 'field', e.target.value)} 
                        className="flex-2 h-9 text-xs"
                      />
                      <Select value={cond.operator} onValueChange={(val) => updateCondition(index, 'operator', val)}>
                        <SelectTrigger className="w-24 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="==">Equals</SelectItem>
                          <SelectItem value="!=">Not Equals</SelectItem>
                          <SelectItem value=">">Greater Than</SelectItem>
                          <SelectItem value="<">Less Than</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Value (e.g. 5, approved)" 
                        value={cond.value} 
                        onChange={(e) => updateCondition(index, 'value', e.target.value)} 
                        className="flex-1 h-9 text-xs"
                      />
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeCondition(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Builder */}
              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Action Sequences (Then...)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={addAction}>
                    + Add Action Step
                  </Button>
                </div>
                <div className="space-y-4">
                  {actions.map((act, index) => (
                    <div key={index} className="p-4 border border-border/50 rounded-xl bg-muted/20 space-y-3 relative">
                      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 text-destructive" onClick={() => removeAction(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <div className="grid sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Action Type</Label>
                          <Select value={act.type} onValueChange={(val) => updateAction(index, 'type', val)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Step Label / Name</Label>
                          <Input 
                            placeholder="e.g. Email Alert Step" 
                            value={act.template_name} 
                            onChange={(e) => updateAction(index, 'template_name', e.target.value)} 
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input 
                          placeholder="Email Subject / Title" 
                          value={act.subject} 
                          onChange={(e) => updateAction(index, 'subject', e.target.value)} 
                          className="h-8 text-xs"
                        />
                        <textarea 
                          placeholder="Action message body details (supports tags like {{first_name}}, {{status}})" 
                          value={act.body} 
                          onChange={(e) => updateAction(index, 'body', e.target.value)} 
                          className="w-full text-xs p-2 rounded-lg border border-border/50 bg-background h-16 resize-none focus-visible:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createWorkflow.mutate()} disabled={createWorkflow.isPending}>Save Automation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeSubTab} onValueChange={(val: any) => setActiveSubTab(val)} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-sm h-9 p-1 bg-muted/40 mb-4">
          <TabsTrigger value="workflows" className="text-xs gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Workflow Rules
          </TabsTrigger>
          <TabsTrigger value="runs" className="text-xs gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Execution Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows">
          {loadingWorkflows ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/50 rounded-xl bg-muted/5">
              <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
              <p className="text-sm font-medium">No custom workflows created</p>
              <p className="text-xs text-muted-foreground mt-1">Configure event-driven workflows to automate tasks and alerts.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {workflows.map((wf: any) => (
                <div key={wf.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-background/60 transition-all shadow-sm gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${wf.is_active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-muted text-muted-foreground'}`}>
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{wf.name}</p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${wf.is_active ? 'border-success text-success bg-success/5' : 'border-muted text-muted-foreground bg-muted/5'}`}>
                          {wf.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{wf.description || 'No description provided'}</p>
                      <p className="text-[10px] text-primary/80 font-medium mt-1">Trigger: {TRIGGER_LABELS[wf.trigger_event] || wf.trigger_event}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end border-t border-border/10 pt-2 sm:pt-0 sm:border-none w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className={`h-8 w-8 rounded-full ${wf.is_active ? 'text-success hover:bg-success/10 hover:text-success' : 'text-muted-foreground hover:bg-muted'}`}
                      onClick={() => toggleWorkflow.mutate({ id: wf.id, is_active: !wf.is_active })}
                      title={wf.is_active ? "Pause workflow" : "Activate workflow"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm('Delete this workflow automation?')) {
                          deleteWorkflow.mutate(wf.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs">
          {loadingRuns ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : workflowRuns.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/50 rounded-xl bg-muted/5">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
              <p className="text-sm font-medium">No execution history</p>
              <p className="text-xs text-muted-foreground mt-1">Logs will appear here once workflows trigger and run.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {workflowRuns.map((run: any) => (
                <div key={run.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-background/60 transition-all shadow-sm gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Play className="w-4.5 h-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">Rule: {run.workflows?.name || 'Deleted Rule'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Run ID: <span className="font-mono">{run.id.slice(0, 8)}</span></p>
                      {run.execution_log && Array.isArray(run.execution_log) && run.execution_log.map((log: any, idx: number) => (
                        <p key={idx} className="text-[10px] text-muted-foreground mt-1 bg-muted/30 p-1.5 rounded border border-border/30 max-w-md italic">
                          {log.message || JSON.stringify(log)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 justify-center">
                    {run.status === 'success' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </Badge>
                    ) : run.status === 'failed' ? (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[9px] uppercase tracking-wide flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Failed
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] uppercase tracking-wide flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Pending
                      </Badge>
                    )}
                    <span className="text-[9px] text-muted-foreground mt-1">{new Date(run.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
