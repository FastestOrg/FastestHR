
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, Upload, CheckCircle2, Circle, 
  Loader2, PartyPopper, AlertCircle, Eye,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { useSecureUpload } from '@/hooks/use-secure-upload';

interface EmployeeOnboardingViewProps {
  employeeId: string;
  companyId: string;
}

export function EmployeeOnboardingView({ employeeId, companyId }: EmployeeOnboardingViewProps) {
  const queryClient = useQueryClient();
  const { validateFile } = useSecureUpload();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});

  // Fetch Definitions
  const { data: steps = [] } = useQuery({
    queryKey: ['onboarding-steps', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('onboarding_steps').select('*').eq('company_id', companyId).order('order_index');
      return data || [];
    },
  });

  const { data: docRequirements = [] } = useQuery({
    queryKey: ['onboarding-doc-requirements', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('onboarding_document_requirements').select('*').eq('company_id', companyId).order('created_at');
      return data || [];
    },
  });

  // Fetch Progress
  const { data: stepProgress = [] } = useQuery({
    queryKey: ['onboarding-progress', employeeId],
    queryFn: async () => {
      const { data } = await supabase.from('onboarding_progress').select('*').eq('employee_id', employeeId);
      return data || [];
    },
  });

  const { data: docSubmissions = [] } = useQuery({
    queryKey: ['onboarding-doc-submissions', employeeId],
    queryFn: async () => {
      const { data } = await supabase.from('onboarding_document_submissions').select('*').eq('employee_id', employeeId);
      return data || [];
    },
  });

  // ⚡ Bolt: Convert O(N*M) lookup to O(1) by pre-computing submission map
  const submissionMap = useMemo(() => {
    return docSubmissions.reduce((acc: Record<string, any>, s: any) => {
      acc[s.requirement_id] = s;
      return acc;
    }, {});
  }, [docSubmissions]);

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async ({ requirementId, file }: { requirementId: string, file: File }) => {
      setUploadingId(requirementId);
      
      const fileExt = file.name.split('.').pop();
      const filePath = `onboarding/${employeeId}/${requirementId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      // Clean up previous submission if any before inserting new one
      await supabase
        .from('onboarding_document_submissions')
        .delete()
        .eq('employee_id', employeeId)
        .eq('requirement_id', requirementId);
      
      const { error: dbError } = await supabase
        .from('onboarding_document_submissions')
        .insert({
          employee_id: employeeId,
          requirement_id: requirementId,
          file_url: filePath,
          status: 'pending'
        });
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-doc-submissions', employeeId] });
      toast.success('Document uploaded successfully');
      setUploadingId(null);
    },
    onError: (error: any) => {
      toast.error('Upload failed: ' + error.message);
      setUploadingId(null);
    }
  });

  const submitTextMutation = useMutation({
    mutationFn: async ({ requirementId, text }: { requirementId: string, text: string }) => {
      // Clean up previous submission if any before inserting new one
      await supabase
        .from('onboarding_document_submissions')
        .delete()
        .eq('employee_id', employeeId)
        .eq('requirement_id', requirementId);

      const { error } = await supabase
        .from('onboarding_document_submissions')
        .insert({
          employee_id: employeeId,
          requirement_id: requirementId,
          text_content: text,
          status: 'pending'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-doc-submissions', employeeId] });
      toast.success('Information submitted');
    },
  });

  const totalPossible = steps.length + docRequirements.length;
  const totalDone = stepProgress.length + docSubmissions.length;
  const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Profile Card */}
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary to-primary-foreground text-white shadow-xl shadow-primary/20">
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                Welcome Aboard! <PartyPopper className="h-8 w-8 text-white/80" />
              </h2>
              <p className="text-white/70 max-w-md">
                We're excited to have you join our team. Please complete the following steps to finalize your onboarding.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
              <span className="text-5xl font-black">{overallPct}%</span>
              <span className="text-xs uppercase tracking-widest font-bold opacity-70">Complete</span>
              <Progress value={overallPct} className="h-1.5 w-32 bg-white/20" />
            </div>
          </div>
        </CardContent>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Upload className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Upload Documents</h3>
          </div>
          
          <div className="space-y-3">
            {docRequirements.map((req: any) => {
              const submission = submissionMap[req.id];
              const isUploading = uploadingId === req.id;
              
              const status = submission?.status || 'none';
              const isApproved = status === 'approved';
              const isPending = status === 'pending';
              const isRejected = status.startsWith('rejected');
              const rejectionReason = isRejected ? (status.split('rejected:')[1]?.trim() || 'Please re-upload a valid document.') : '';

              let cardBg = 'bg-card border-border/50';
              let badge = null;
              let rightIcon = <Upload className="h-5 w-5 text-primary" />;

              if (submission) {
                if (isApproved) {
                  cardBg = 'bg-success/5 border-success/20 hover:bg-success/10';
                  badge = <Badge className="bg-success text-white text-[9px] h-4 font-mono font-semibold uppercase">APPROVED</Badge>;
                  rightIcon = <CheckCircle2 className="h-5 w-5 text-success animate-in zoom-in duration-300" />;
                } else if (isPending) {
                  cardBg = 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10';
                  badge = <Badge className="bg-amber-500 text-white text-[9px] h-4 font-mono font-semibold uppercase">PENDING REVIEW</Badge>;
                  rightIcon = <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
                } else if (isRejected) {
                  cardBg = 'bg-destructive/5 border-destructive/20';
                  badge = <Badge className="bg-destructive text-white text-[9px] h-4 font-mono font-semibold uppercase">REJECTED</Badge>;
                  rightIcon = <AlertCircle className="h-5 w-5 text-destructive animate-bounce" />;
                }
              } else if (req.is_mandatory) {
                badge = <Badge variant="outline" className="text-[9px] h-4 border-amber-500/30 text-amber-600 bg-amber-500/5 font-mono uppercase">REQUIRED</Badge>;
              }

              return (
                <Card key={req.id} className={`transition-all duration-300 shadow-sm hover:shadow-md border ${cardBg}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm tracking-tight text-foreground">{req.title}</h4>
                          {badge}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{req.description}</p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center border border-border/50">
                          {rightIcon}
                        </div>
                      </div>
                    </div>

                    {isRejected && (
                      <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex gap-2 animate-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">Rejection Note from HR:</p>
                          <p className="text-destructive/90">{rejectionReason}</p>
                        </div>
                      </div>
                    )}

                    {(!submission || isRejected) && (
                      <div className="mt-4 pt-4 border-t border-dashed border-border/80">
                        {req.type === 'file' ? (
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              {isRejected ? 'Upload corrected file' : 'Upload document file'}
                            </Label>
                            <div className="flex items-center gap-3">
                              <Input 
                                type="file" 
                                className="text-xs h-9 cursor-pointer bg-background border-border/50 focus:border-primary transition-colors" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const isValid = await validateFile(file);
                                    if (isValid) {
                                      uploadMutation.mutate({ requirementId: req.id, file });
                                    }
                                  }
                                }}
                                disabled={isUploading}
                              />
                              {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              {isRejected ? 'Enter corrected information' : 'Enter requested details'}
                            </Label>
                            <Textarea 
                              placeholder="Type details here..." 
                              className="text-xs min-h-[80px] bg-background border-border/50 focus:border-primary transition-colors"
                              value={textValues[req.id] || ''}
                              onChange={(e) => setTextValues(p=>({...p, [req.id]: e.target.value}))}
                            />
                            <Button 
                              size="sm" 
                              className="w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md shadow-sm h-8"
                              onClick={() => {
                                if (!textValues[req.id]?.trim()) {
                                  toast.error('Please enter details before submitting');
                                  return;
                                }
                                submitTextMutation.mutate({ requirementId: req.id, text: textValues[req.id] });
                              }}
                            >
                              Submit Details
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Task Progress Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Onboarding Tasks</h3>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {steps.map((step: any) => {
                  const isDone = stepProgress.some((p: any) => p.step_id === step.id);
                  return (
                    <div key={step.id} className="p-5 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                      <div className="pt-1">
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-sm font-bold ${isDone ? 'line-through text-muted-foreground' : ''}`}>{step.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                        {isDone && (
                            <p className="text-[10px] text-success font-medium mt-2 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Completed by HR
                            </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-muted/30 rounded-2xl border border-dashed flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider">Note to Employee</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tasks in the checklist are marked off by HR once they verify the step is completed. 
                Documents you upload are immediately visible to the HR team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
