import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  UserPlus, CheckCircle2, Circle, ClipboardList, 
  Upload, Users as UsersIcon, Monitor, PartyPopper,
  Settings2, Hash, Mail, FileText, Download,
  ExternalLink, Eye
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useMemo } from 'react';
import { OnboardingSettingsDialog } from '@/components/onboarding/OnboardingSettingsDialog';
import { AssignIdDialog } from '@/components/onboarding/AssignIdDialog';
import { InviteToPortalDialog } from '@/components/onboarding/InviteToPortalDialog';
import { EmployeeOnboardingView } from '@/components/onboarding/EmployeeOnboardingView';
import { toast } from 'sonner';

const iconMap: Record<string, any> = {
  PartyPopper,
  Upload,
  ClipboardList,
  Monitor,
  Users: UsersIcon,
  FileText,
};

export default function Onboarding() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin' || profile?.platform_role === 'hr_manager';

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assignIdOpen, setAssignIdOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch current employee context if user is an employee
  const { data: currentEmployee } = useQuery({
    queryKey: ['active-employee', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', profile!.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id && !isAdmin,
  });

  // Queries
  const { data: newHires = [], isLoading: isLoadingHires } = useQuery({
    queryKey: ['new-hires', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select(`
          id, first_name, last_name, work_email, date_of_joining, status, 
          department_id, avatar_url, employee_code, departments(name)
        `)
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null)
        .in('status', ['probation', 'active'])
        .order('date_of_joining', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: steps = [], isLoading: isLoadingSteps } = useQuery({
    queryKey: ['onboarding-steps', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_steps')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('order_index');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: docRequirements = [] } = useQuery({
    queryKey: ['onboarding-doc-requirements', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['onboarding-progress', selectedEmployee],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('employee_id', selectedEmployee!);
      return data || [];
    },
    enabled: !!selectedEmployee,
  });

  const { data: docSubmissions = [] } = useQuery({
    queryKey: ['onboarding-doc-submissions', selectedEmployee],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_document_submissions')
        .select('*')
        .eq('employee_id', selectedEmployee!);
      return data || [];
    },
    enabled: !!selectedEmployee,
  });

  // ⚡ Bolt: Convert O(N*M) lookup to O(1) by pre-computing submission map
  const submissionMap = useMemo(() => {
    return (docSubmissions || []).reduce((acc: Record<string, any>, s: any) => {
      acc[s.requirement_id] = s;
      return acc;
    }, {});
  }, [docSubmissions]);

  // Mutations
  const toggleStepMutation = useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: string, completed: boolean }) => {
      if (completed) {
        await supabase.from('onboarding_progress').upsert({
          employee_id: selectedEmployee!,
          step_id: stepId,
          completed_at: new Date().toISOString(),
          completed_by: profile!.id
        });
      } else {
        await supabase.from('onboarding_progress').delete().eq('employee_id', selectedEmployee!).eq('step_id', stepId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', selectedEmployee] });
    },
  });

  const verifyDocMutation = useMutation({
    mutationFn: async ({ submissionId, status }: { submissionId: string, status: string }) => {
      const { error } = await supabase
        .from('onboarding_document_submissions')
        .update({ status })
        .eq('id', submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-doc-submissions', selectedEmployee] });
      toast.success('Document updated successfully');
      setRejectingDocId(null);
      setRejectionReason('');
    },
    onError: (err: any) => {
      toast.error('Failed to update status: ' + err.message);
    }
  });

  // Helpers
  // ⚡ Bolt: Memoize recentHires calculation to prevent O(N) filtering on every render
  const recentHires = useMemo(() => {
    return newHires.filter((e: any) => {
      if (!e.date_of_joining) return true;
      const joinDate = new Date(e.date_of_joining);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return joinDate >= ninetyDaysAgo;
    });
  }, [newHires]);

  // ⚡ Bolt: Calculate stats in a single O(N) pass using useMemo
  // instead of multiple O(N) .filter(...).length calls in the render loop.
  const hireStats = useMemo(() => {
    let probationCount = 0;
    let activeCount = 0;
    let pendingCount = 0;

    for (const emp of recentHires) {
      if (emp.status === 'probation') probationCount++;
      if (emp.status === 'active') activeCount++;
      if (!emp.employee_code) pendingCount++;
    }

    return { probationCount, activeCount, pendingCount };
  }, [recentHires]);

  if (!isAdmin && currentEmployee) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <EmployeeOnboardingView
           employeeId={currentEmployee.id}
           companyId={currentEmployee.company_id}
        />
      </div>
    );
  }

  const selectedEmpData = newHires.find((e: any) => e.id === selectedEmployee);

  const getTaskProgress = (empId: string) => {
    if (empId !== selectedEmployee) return 0;
    if (steps.length === 0) return 100;
    return Math.round((progress.length / steps.length) * 100);
  };

  const getDocProgress = (empId: string) => {
    if (empId !== selectedEmployee) return 0;
    const mandatory = docRequirements.filter((r: any) => r.is_mandatory);
    if (mandatory.length === 0) return 100;
    // O(1) lookups using submissionMap instead of O(N*M) nested some/filter
    let completedCount = 0;
    for (const req of mandatory) {
      if (submissionMap[req.id]) {
        completedCount++;
      }
    }
    return Math.round((completedCount / mandatory.length) * 100);
  };

  const handleDownload = async (submission: any) => {
    if (!submission.file_url) return;
    try {
      const { data, error } = await supabase.storage.from('documents').download(submission.file_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = submission.file_url.split('/').pop() || 'document';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
        toast.error('Failed to download: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Onboarding</h1>
          <p className="text-muted-foreground mt-1">Digital onboarding workflow for new hires</p>
        </div>
        {isAdmin && (
          <Button variant="outline" className="w-full sm:w-auto gap-2 border-primary/20 hover:bg-primary/5 h-9 text-xs sm:text-sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Onboarding Settings
          </Button>
        )}
      </div>

      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent shrink-0 w-[180px] sm:w-auto">
          <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
            <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active</p>
              <p className="text-xl sm:text-3xl font-black">{hireStats.probationCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/5 to-transparent shrink-0 w-[180px] sm:w-auto">
          <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
            <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">Invited</p>
              <p className="text-xl sm:text-3xl font-black text-success">{hireStats.activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/5 to-transparent shrink-0 w-[180px] sm:w-auto">
          <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
            <Circle className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pending</p>
              <p className="text-xl sm:text-3xl font-black text-warning">{hireStats.pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Employee List */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">New Hires</CardTitle>
            <CardDescription>Select an employee to manage</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingHires ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentHires.map((emp: any) => {
                  const isSelected = selectedEmployee === emp.id;
                  const taskPct = isSelected ? getTaskProgress(emp.id) : 0;
                  const docPct = isSelected ? getDocProgress(emp.id) : 0;
                  return (
                    <div
                      key={emp.id}
                      className={`p-4 cursor-pointer hover:bg-muted/30 transition-all ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                      onClick={() => setSelectedEmployee(emp.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/10">
                          <AvatarImage src={emp.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {emp.first_name?.[0]}{emp.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{emp.first_name} {emp.last_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={`text-[9px] px-1 h-4 ${emp.status === 'active' ? 'bg-success/5 text-success border-success/20' : 'bg-warning/5 text-warning border-warning/20'}`}>
                              {emp.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <div className="flex-1 space-y-1">
                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Tasks</p>
                            <Progress value={taskPct} className="h-1" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Docs</p>
                            <Progress value={docPct} className="h-1" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Area */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedEmployee ? (
            <Card className="flex flex-col items-center justify-center py-24 text-center">
              <ClipboardList className="h-16 w-16 text-muted-foreground/10 mb-4" />
              <p className="text-muted-foreground">Select a new hire to start the onboarding process</p>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-4 border-b border-border/50">
                   <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-primary/20">
                            <AvatarImage src={selectedEmpData?.avatar_url || ''} />
                            <AvatarFallback>{selectedEmpData?.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-lg sm:text-xl font-bold">{selectedEmpData?.first_name} {selectedEmpData?.last_name}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">{selectedEmpData?.work_email}</CardDescription>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-3 sm:pt-0 sm:border-none">
                        {!selectedEmpData?.employee_code && (
                           <Button size="sm" className="flex-1 sm:flex-none gap-1.5 text-xs h-8 px-2.5" onClick={() => setAssignIdOpen(true)}>
                             <Hash className="h-3.5 w-3.5" /> Assign ID
                           </Button>
                        )}
                        {selectedEmpData?.status === 'probation' && (
                           <Button size="sm" variant="secondary" className="flex-1 sm:flex-none gap-1.5 text-xs h-8 px-2.5" onClick={() => setInviteOpen(true)}>
                             <Mail className="h-3.5 w-3.5" /> Invite
                           </Button>
                        )}
                     </div>
                   </div>
                </CardHeader>
              </Card>

              <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="tasks" className="gap-2">
                        <ClipboardList className="h-4 w-4" /> Tasks
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="gap-2">
                        <FileText className="h-4 w-4" /> Documents
                        <Badge variant="secondary" className="ml-2 h-4 px-1 text-[9px]">{docSubmissions.length} / {docRequirements.length}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-4">
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-muted/20 border-b pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">Onboarding Checklist</CardTitle>
                                <Badge className="bg-primary/10 text-primary border-primary/20">{progress.length} / {steps.length} Done</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {steps.map((step: any) => {
                                    const isCompleted = progress.some((p: any) => p.step_id === step.id);
                                    const Icon = iconMap[step.icon_name || 'ClipboardList'] || ClipboardList;
                                    return (
                                        <div key={step.id} className={`p-4 flex items-start gap-4 transition-all ${isCompleted ? 'bg-success/5' : ''}`}>
                                            <div className="pt-0.5">
                                                <Checkbox checked={isCompleted} onCheckedChange={(c) => toggleStepMutation.mutate({ stepId: step.id, completed: !!c })} />
                                            </div>
                                            <div className="p-2 rounded bg-muted/40 text-muted-foreground"><Icon className="w-4 h-4" /></div>
                                            <div className="flex-1">
                                                <h4 className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{step.title}</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3 border-b border-border/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm">Submitted Documents</CardTitle>
                                    <CardDescription className="text-xs">Review mandatory employee documents</CardDescription>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-primary">{getDocProgress(selectedEmployee)}%</p>
                                    <p className="text-[10px] uppercase text-muted-foreground">Compliance Score</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {docRequirements.map((req: any) => {
                                    const submission = submissionMap[req.id];
                                    return (
                                        <div key={req.id} className="p-4 flex items-center justify-between hover:bg-muted/20">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${submission ? 'bg-success/10 text-success' : 'bg-muted/50 text-muted-foreground'}`}>
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{req.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.description || 'Mandatory file'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {submission ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-success/10 text-success border-success/20">UPLOADED</Badge>
                                                        {req.type === 'file' ? (
                                                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(submission)} aria-label="Download submission">
                                                                <Download className="h-4 w-4" />
                                                              </Button>
                                                        ) : (
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="View text entry"><Eye className="h-4 w-4" /></Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>{req.title}</DialogTitle>
                                                                        <DialogDescription>Text entry from employee</DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="p-4 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                                                                        {(submission as any).text_content}
                                                                    </div>
                                                                </DialogContent>
                                                            </Dialog>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="border-warning text-warning bg-warning/5 animate-pulse">PENDING</Badge>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {docRequirements.length === 0 && (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <p className="text-xs">No document requirements defined in settings.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {profile?.company_id && (
        <OnboardingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} companyId={profile.company_id} />
      )}

      {selectedEmployee && selectedEmpData && profile?.company_id && (
        <>
          <AssignIdDialog open={assignIdOpen} onOpenChange={setAssignIdOpen} employeeId={selectedEmployee} employeeName={`${selectedEmpData.first_name} ${selectedEmpData.last_name}`} companyId={profile.company_id} />
          <InviteToPortalDialog open={inviteOpen} onOpenChange={setInviteOpen} employeeId={selectedEmployee} employeeName={`${selectedEmpData.first_name} ${selectedEmpData.last_name}`} employeeEmail={selectedEmpData.work_email} companyId={profile.company_id} />
        </>
      )}
    </div>
  );
}
