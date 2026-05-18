import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, Users, Plus, Loader2, Send, Star, Pencil,
  Share2, ExternalLink, UserCheck, BarChart3, Crown, Sparkles, Bot, Zap, Layers, BrainCircuit,
  Mail, Phone, UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { AddCandidateDialog } from '@/components/recruitment/AddCandidateDialog';
import { CandidateActions } from '@/components/recruitment/CandidateActions';
import { JobActions } from '@/components/recruitment/JobActions';
import { StageAIConfigDialog } from '@/components/recruitment/StageAIConfigDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferTemplateList } from '@/components/recruitment/OfferTemplateEditor';
import { EditScoreDialog } from '@/components/recruitment/EditScoreDialog';
import { AssignCandidateDialog } from '@/components/recruitment/AssignCandidateDialog';
import { RecruitmentLeadsBoard } from './recruitment/RecruitmentLeadsBoard';
import { RecruitmentTeam } from './recruitment/RecruitmentTeam';
import { RecruitmentAnalytics } from './recruitment/RecruitmentAnalytics';
import { JobSelectionView } from '@/components/recruitment/JobSelectionView';
import { RecruiterCopilot } from '@/components/recruitment/RecruiterCopilot';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';


const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-blue-500',
  screening: 'bg-yellow-500',
  interview: 'bg-purple-500',
  assessment: 'bg-indigo-500',
  offer: 'bg-orange-500',
  hired: 'bg-green-500',
  rejected: 'bg-red-500',
};

const DEFAULT_STAGES = [
  'applied',
  'screening',
  'interview',
  'assessment',
  'offer',
  'hired'
];

export default function Recruitment() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean; candidateId: string; candidateName: string;
    currentAssignee: string | null; jobId: string;
  }>({ open: false, candidateId: '', candidateName: '', currentAssignee: null, jobId: '' });
  const [isRankingAll, setIsRankingAll] = useState(false);
  const [stageAIConfig, setStageAIConfig] = useState<{
    open: boolean;
    stageId: string;
    stageName: string;
  }>({ open: false, stageId: '', stageName: '' });
  const queryClient = useQueryClient();

  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');
  const isManager = profile?.platform_role === 'hr_manager';
  const isRecruiter = profile?.platform_role === 'recruiter';
  const canManageJobs = isAdmin || isManager;

  // Default tab: recruiters start on Leads, others on Pipeline
  const defaultTab = isRecruiter ? 'leads' : 'pipeline';

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['jobs', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, departments(name), companies(slug, custom_domain)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const handleRankAll = async () => {
    if (!activeJob) return;
    setIsRankingAll(true);
    toast.info('⚡ Ranking all applied candidates with AI…');
    try {
      const { data, error } = await supabase.functions.invoke('ai-resume-ranker', {
        body: { jobId: activeJob, bulk: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const count = data?.results?.length || 0;
      toast.success(`✦ Ranked ${count} candidate${count !== 1 ? 's' : ''} with AI!`);
      queryClient.invalidateQueries({ queryKey: ['candidates', activeJob] });
    } catch (err: any) {
      toast.error(err?.message || 'Bulk AI ranking failed');
    } finally {
      setIsRankingAll(false);
    }
  };

  useEffect(() => {
    // Removed auto-selection of first job to ensure HR starts with Job Selection
    // if (jobs.length > 0 && !activeJob) {
    //   setActiveJob(jobs[0].id);
    // }
  }, [jobs, activeJob]);

  const activeJobData = jobs.find(j => j.id === activeJob);
  const currentPipelineStages = (activeJobData as any)?.pipeline_stages || DEFAULT_STAGES;

  const pipelineStages = currentPipelineStages.map((s: string) => ({
    id: s,
    name: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '),
    color: STAGE_COLORS[s] || 'bg-slate-500'
  }));

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['candidates', activeJob],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidates')
        .select('*,assigned_profile:profiles!candidates_assigned_to_fkey(id,full_name)')
        .eq('job_id', activeJob!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!activeJob,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-background/50 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => setActiveJob(null)}
          >
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
              <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setActiveJob(null)}>Recruitment</span>
              {activeJobData && (
                <>
                  <span>/</span>
                  <span className="text-foreground max-w-[120px] sm:max-w-none truncate">{activeJobData.title}</span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground -mt-0.5">
              {activeJobData ? 'Talent Pipeline' : 'Recruitment Dashboard'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {activeJobData && (
            <div className="flex items-center gap-2 lg:mr-4 lg:border-r border-border/50 lg:pr-4">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary h-9 px-3" onClick={() => setActiveJob(null)}>
                <Layers className="w-4 h-4" />
                Switch Job
              </Button>
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2">
            {activeJobData && (
              <>
                <Button variant="outline" size="sm" className="rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm" onClick={() => {
                  const c = (activeJobData as any).companies;
                  const slug = activeJobData.job_slug || activeJobData.id;
                  const url = c?.custom_domain
                    ? `https://${c.custom_domain}/jobs/${slug}`
                    : `${window.location.origin}/company/${c?.slug}/jobs/${slug}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Job link copied');
                }}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                </Button>

                {canManageJobs && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRankingAll}
                    onClick={handleRankAll}
                    className="rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm gap-1.5 text-primary border-primary/30 hover:bg-primary/5 bg-primary/5 shadow-sm shadow-primary/10"
                  >
                    {isRankingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Rank
                  </Button>
                )}

                <Button
                  variant={isCopilotOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCopilotOpen(!isCopilotOpen)}
                  className={`rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm gap-1.5 transition-all duration-300 ${
                    isCopilotOpen 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'hover:bg-primary/5'
                  }`}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  Copilot
                </Button>

                <AddCandidateDialog jobId={activeJob!} />
              </>
            )}
            
            {!activeJob && canManageJobs && (
              <Button onClick={() => navigate('/recruitment/new')} className="rounded-full px-4 sm:px-6 h-8 sm:h-9 text-xs sm:text-sm gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-3.5 h-3.5" />
                Post New Job
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-border/50">
          {!isRecruiter && (
            <TabsTrigger value="pipeline" className="gap-2">
              <Briefcase className="h-4 w-4" /> Pipeline
            </TabsTrigger>
          )}
          <TabsTrigger value="leads" className="gap-2">
            <UserCheck className="h-4 w-4" />
            {isRecruiter ? 'My Leads' : 'Leads Board'}
          </TabsTrigger>
          {(isAdmin || isManager) && (
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Analytics
            </TabsTrigger>
          )}
          {(isAdmin || isManager) && (
            <TabsTrigger value="team" className="gap-2">
              <Crown className="h-4 w-4" /> Team
            </TabsTrigger>
          )}
          <TabsTrigger value="templates" className="gap-2">
            <Send className="h-4 w-4" /> Offer Templates
          </TabsTrigger>
        </TabsList>

        {/* ── PIPELINE TAB ─────────────────────────────────────────── */}
        {!isRecruiter && (
          <TabsContent value="pipeline">
            {!activeJob ? (
              <JobSelectionView 
                jobs={jobs} 
                loading={loadingJobs}
                onSelectJob={(id) => setActiveJob(id)}
                onCreateJob={() => navigate('/recruitment/new')}
                canManageJobs={canManageJobs}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Jobs List Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="glass-card h-full border-none shadow-none">
                    <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Positions</CardTitle>
                      {canManageJobs && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10 rounded-full"
                          onClick={() => navigate('/recruitment/new')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto scrollbar-hide">
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => setActiveJob(job.id)}
                          className={`group relative w-full flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            activeJob === job.id
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                              : 'hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="font-bold text-xs truncate">
                              {job.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] uppercase font-bold tracking-tighter ${activeJob === job.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {(job as any).departments?.name || 'General'}
                              </span>
                            </div>
                          </div>
                          {activeJob === job.id && (
                            <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                          )}
                          {canManageJobs && (
                            <div 
                              className={`ml-2 transition-opacity ${activeJob === job.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <JobActions jobId={job.id} onDeleted={() => activeJob === job.id && setActiveJob(null)} />
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Pipeline Kanban */}
                <div className="lg:col-span-3">
                  <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
                    {loadingCandidates ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="flex-shrink-0 w-80 space-y-4">
                          <Skeleton className="h-10 w-full rounded-xl" />
                          <Skeleton className="h-64 w-full rounded-xl" />
                        </div>
                      ))
                    ) : (
                      pipelineStages.map((stage: any) => (
                        <div key={stage.id} className="flex-shrink-0 w-80 space-y-4">
                          <div className="flex items-center justify-between px-3 bg-muted/40 p-2 rounded-xl border border-border/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-2.5 w-2.5 rounded-full ${stage.color} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} />
                              <h3 className="font-bold text-[11px] uppercase tracking-widest text-foreground/80">{stage.name}</h3>
                              <div className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/10">
                                {candidates.filter(c => c.stage === stage.id).length}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {stage.id === 'applied' && canManageJobs && (
                                <AddCandidateDialog jobId={activeJob!} variant="icon" />
                              )}
                              {canManageJobs && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-lg"
                                  onClick={() => setStageAIConfig({ 
                                    open: true, 
                                    stageId: stage.id, 
                                    stageName: stage.name 
                                  })}
                                >
                                  <Bot className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 min-h-[500px] p-2 rounded-2xl bg-muted/20 border border-dashed border-border/30">
                            {candidates
                              .filter(c => c.stage === stage.id)
                              .map((candidate) => (
                                <motion.div
                                  key={candidate.id}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  whileHover={{ y: -2 }}
                                >
                                  <Card className="bg-background border-border/40 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group relative rounded-xl overflow-hidden">
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-sm">
                                            <AvatarImage src={(candidate as any).avatar_url} />
                                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-black uppercase">
                                              {candidate.full_name?.split(' ').map((n: string) => n[0]).join('')}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div>
                                            <p className="font-bold text-sm text-foreground leading-none mb-1">{candidate.full_name}</p>
                                            <div className="flex flex-col gap-0.5 mb-1">
                                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                <Mail className="h-2.5 w-2.5 text-primary/60" />
                                                <a href={`mailto:${candidate.email}`} className="truncate max-w-[140px] hover:text-primary transition-colors">
                                                  {candidate.email}
                                                </a>
                                              </div>
                                              {candidate.phone && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                  <Phone className="h-2.5 w-2.5 text-primary/60" />
                                                  <a href={`tel:${candidate.phone}`} className="hover:text-primary transition-colors">
                                                    {candidate.phone}
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                              <Send className="h-2.5 w-2.5" />
                                              {candidate.source || 'Direct'}
                                            </p>
                                          </div>
                                        </div>
                                        <CandidateActions
                                          candidateId={candidate.id}
                                          jobId={activeJob}
                                          currentStage={candidate.stage}
                                          pipelineStages={currentPipelineStages}
                                          candidateName={candidate.full_name}
                                          score={candidate.score}
                                        />
                                      </div>

                                      {/* Assigned To chip */}
                                      {(candidate as any).assigned_profile ? (
                                        <div className="flex items-center gap-1.5 mb-3 bg-primary/5 p-1 px-2 rounded-lg border border-primary/10">
                                          <UserCheck className="h-3 w-3 text-primary" />
                                          <span className="text-[9px] font-bold text-primary/80 uppercase tracking-tight">
                                            {(candidate as any).assigned_profile.full_name}
                                          </span>
                                        </div>
                                      ) : canManageJobs && (
                                        <button
                                          className="text-[9px] text-muted-foreground hover:text-primary flex items-center gap-1 mb-3 transition-colors uppercase font-bold tracking-tight"
                                          onClick={() => setAssignDialog({
                                            open: true,
                                            candidateId: candidate.id,
                                            candidateName: candidate.full_name,
                                            currentAssignee: null,
                                            jobId: activeJob,
                                          })}
                                        >
                                          <UserCheck className="h-3 w-3" />
                                          Assign Recruiter
                                        </button>
                                      )}

                                      {/* Referrer chip */}
                                      {(candidate as any).referrer && (
                                        <div className="flex items-center gap-1.5 mb-3 bg-emerald-500/5 p-1 px-2 rounded-lg border border-emerald-500/10">
                                          <UserPlus className="h-3 w-3 text-emerald-500" />
                                          <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-tight">
                                            Added by {(candidate as any).referrer.full_name}
                                          </span>
                                        </div>
                                      )}

                                      <div className="flex flex-wrap gap-1.5">
                                        {candidate.score !== null ? (
                                          <Badge
                                            variant="secondary"
                                            className="text-[9px] font-bold border-none bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors px-2 py-0.5"
                                            onClick={() => {
                                              setSelectedCandidate(candidate);
                                              setIsScoreDialogOpen(true);
                                            }}
                                          >
                                            <Star className="h-3 w-3 mr-1 text-primary fill-primary" />
                                            {candidate.score}
                                          </Badge>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[9px] text-muted-foreground hover:text-primary gap-1 uppercase font-bold"
                                            onClick={() => {
                                              setSelectedCandidate(candidate);
                                              setIsScoreDialogOpen(true);
                                            }}
                                          >
                                            <Plus className="h-3 w-3" />
                                            Score
                                          </Button>
                                        )}
                                        {/* AI Analysis badges */}
                                        {(candidate as any).ai_analysis && (
                                          <Badge variant="secondary" className="text-[9px] font-bold border-none bg-indigo-500/10 text-indigo-500 gap-1 px-2 py-0.5">
                                            <Sparkles className="h-2.5 w-2.5" />
                                            AI Match
                                          </Badge>
                                        )}
                                        {(candidate as any).ai_interview_result && (
                                          <Badge variant="secondary" className="text-[9px] font-bold border-none bg-violet-500/10 text-violet-500 gap-1 px-2 py-0.5 shadow-sm">
                                            <Bot className="h-2.5 w-2.5" />
                                            AI IV: {(candidate as any).ai_interview_result.ai_score}
                                          </Badge>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            {candidates.filter(c => c.stage === stage.id).length === 0 && (
                              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/20 border-2 border-dashed border-muted-foreground/5 rounded-2xl">
                                <Users className="h-6 w-6 mb-1" />
                                <p className="text-[9px] font-bold uppercase tracking-widest">Empty</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {stageAIConfig.open && activeJob && (
          <StageAIConfigDialog
            isOpen={stageAIConfig.open}
            onOpenChange={(open) => setStageAIConfig({ ...stageAIConfig, open })}
            jobId={activeJob}
            stageName={stageAIConfig.stageName}
          />
        )}

        {/* ── LEADS BOARD TAB ──────────────────────────────────────── */}
        <TabsContent value="leads">
          <RecruitmentLeadsBoard />
        </TabsContent>

        {/* ── ANALYTICS TAB ────────────────────────────────────────── */}
        {(isAdmin || isManager) && (
          <TabsContent value="analytics">
            <RecruitmentAnalytics />
          </TabsContent>
        )}

        {/* ── TEAM TAB ─────────────────────────────────────────────── */}
        {(isAdmin || isManager) && (
          <TabsContent value="team">
            <RecruitmentTeam />
          </TabsContent>
        )}

        {/* ── OFFER TEMPLATES TAB ──────────────────────────────────── */}
        <TabsContent value="templates">
          <OfferTemplateList />
        </TabsContent>
      </Tabs>

      {selectedCandidate && (
        <EditScoreDialog
          isOpen={isScoreDialogOpen}
          onOpenChange={setIsScoreDialogOpen}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.full_name}
          currentScore={selectedCandidate.score}
          jobId={activeJob!}
        />
      )}

      {assignDialog.open && (
        <AssignCandidateDialog
          open={assignDialog.open}
          onOpenChange={(o) => setAssignDialog((prev) => ({ ...prev, open: o }))}
          candidateId={assignDialog.candidateId}
          candidateName={assignDialog.candidateName}
          currentAssignee={assignDialog.currentAssignee}
          jobId={assignDialog.jobId}
        />
      )}

      <RecruiterCopilot 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)}
        activeJob={activeJobData || null}
        candidates={candidates}
      />
    </div>
  );
}
