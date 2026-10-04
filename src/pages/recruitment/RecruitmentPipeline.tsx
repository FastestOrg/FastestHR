import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Plus, Loader2, Send, Star, Pencil,
  Share2, Sparkles, Bot, Zap, Layers, BrainCircuit,
  Mail, Phone, UserCheck, UserPlus, FileSpreadsheet, ClipboardPaste, Linkedin, X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useMemo, useEffect } from 'react';
import { AddCandidateDialog } from '@/components/recruitment/AddCandidateDialog';
import { PasteLeadsDialog } from '@/components/recruitment/PasteLeadsDialog';
import { CandidateActions } from '@/components/recruitment/CandidateActions';
import { JobActions } from '@/components/recruitment/JobActions';
import { StageAIConfigDialog } from '@/components/recruitment/StageAIConfigDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EditScoreDialog } from '@/components/recruitment/EditScoreDialog';
import { AssignCandidateDialog } from '@/components/recruitment/AssignCandidateDialog';
import { BulkAssignLeadsDialog } from '@/components/recruitment/BulkAssignLeadsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { JobSelectionView } from '@/components/recruitment/JobSelectionView';
import { RecruiterCopilot } from '@/components/recruitment/RecruiterCopilot';
import { ResumeScreener } from '@/components/recruitment/ResumeScreener';
import { toast } from 'sonner';
import { motion } from 'framer-motion';


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

export function RecruitmentPipeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuthStore();

  // Persist activeJob in URL search params
  const activeJob = searchParams.get('job') || null;
  const setActiveJob = (jobId: string | null) => {
    setSelectedCandidateIds([]);
    if (jobId) {
      setSearchParams({ job: jobId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isScreenerOpen, setIsScreenerOpen] = useState(false);
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
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [initialPasteText, setInitialPasteText] = useState('');
  const queryClient = useQueryClient();

  const toggleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSelectAll = (candidateList: any[]) => {
    const allIds = candidateList.map((c) => c.id);
    const areAllSelected = allIds.length > 0 && allIds.every((id) => selectedCandidateIds.includes(id));
    if (areAllSelected) {
      setSelectedCandidateIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  // Global paste handler to catch Excel clipboard pastes anywhere on pipeline page
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]')
        )
      ) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain') || '';
      // If text contains tabular data or multiple rows, auto-open the paste leads dialog
      if (text && (text.includes('\t') || text.includes('\n'))) {
        e.preventDefault();
        setInitialPasteText(text);
        setIsPasteDialogOpen(true);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');
  const isManager = profile?.platform_role === 'hr_manager';
  const canManageJobs = isAdmin || isManager;

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

  // ⚡ Bolt Performance Optimization:
  // Group candidates by stage in a single pass to prevent O(Stages * Candidates)
  // nested filtering during the Kanban board render cycle.
  const candidatesByStage = useMemo(() => {
    const grouped: Record<string, typeof candidates> = {};
    candidates.forEach((c: any) => {
      if (!grouped[c.stage]) grouped[c.stage] = [];
      grouped[c.stage].push(c);
    });
    return grouped;
  }, [candidates]);

  return (
    <>
      {/* Pipeline-specific action bar */}
      {activeJob && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary h-9 px-3" onClick={() => setActiveJob(null)}>
            <Layers className="w-4 h-4" />
            Switch Job
          </Button>

          {canManageJobs && candidates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll(candidates)}
              className="rounded-full px-3 h-8 sm:h-9 text-xs font-semibold gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              {candidates.every((c) => selectedCandidateIds.includes(c.id))
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          )}

          <div className="flex-1" />
          <Button variant="outline" size="sm" className="rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm" onClick={() => {
            const c = (activeJobData as any).companies;
            const slug = activeJobData.job_slug || activeJobData.id;
            const base = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
              ? 'https://fastesthr.com'
              : window.location.origin;
            const url = c?.custom_domain
              ? `https://${c.custom_domain}/jobs/${slug}`
              : `${base}/company/${c?.slug}/jobs/${slug}`;
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

          <Button
            variant={isScreenerOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsScreenerOpen(!isScreenerOpen)}
            className={`rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm gap-1.5 transition-all duration-300 ${
              isScreenerOpen 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                : 'hover:bg-primary/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Screener
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInitialPasteText('');
              setIsPasteDialogOpen(true);
            }}
            className="rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 bg-emerald-500/5 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Paste Excel
          </Button>

          <AddCandidateDialog jobId={activeJob!} />
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedCandidateIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background dark:bg-card dark:text-foreground dark:border dark:border-border shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
              {selectedCandidateIds.length}
            </span>
            <span>Selected</span>
          </div>

          <div className="h-4 w-px bg-muted-foreground/30" />

          <Button
            size="sm"
            onClick={() => setIsBulkAssignOpen(true)}
            className="rounded-full h-8 px-4 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Assign Recruiter
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCandidateIds([])}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/20"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
                pipelineStages.map((stage: any) => {
                  const stageCandidates = candidatesByStage[stage.id] || [];
                  const areAllStageSelected = stageCandidates.length > 0 && stageCandidates.every((c) => selectedCandidateIds.includes(c.id));
                  return (
                    <div key={stage.id} className="flex-shrink-0 w-80 space-y-4">
                      <div className="flex items-center justify-between px-3 bg-muted/40 p-2 rounded-xl border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          {canManageJobs && stageCandidates.length > 0 && (
                            <Checkbox
                              checked={areAllStageSelected}
                              onCheckedChange={() => handleSelectAll(stageCandidates)}
                              aria-label={`Select all in ${stage.name}`}
                              className="h-3.5 w-3.5 rounded"
                            />
                          )}
                          <div className={`h-2.5 w-2.5 rounded-full ${stage.color} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} />
                          <h3 className="font-bold text-[11px] uppercase tracking-widest text-foreground/80">{stage.name}</h3>
                          <div className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/10">
                            {stageCandidates.length}
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
                        {stageCandidates
                          .map((candidate: any) => {
                            const isSelected = selectedCandidateIds.includes(candidate.id);
                            return (
                              <motion.div
                                key={candidate.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ y: -2 }}
                              >
                                <Card className={`bg-background border-border/40 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group relative rounded-xl overflow-hidden ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/[0.02]' : ''}`}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        {canManageJobs && (
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelectCandidate(candidate.id)}
                                            aria-label={`Select ${candidate.full_name}`}
                                            className="h-4 w-4 rounded flex-shrink-0"
                                          />
                                        )}
                                        <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-sm flex-shrink-0">
                                          <AvatarImage src={(candidate as any).avatar_url} />
                                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-black uppercase">
                                            {candidate.full_name?.split(' ').map((n: string) => n[0]).join('')}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <p className="font-bold text-sm text-foreground leading-none mb-1 truncate">{candidate.full_name}</p>
                                          <div className="flex flex-col gap-0.5 mb-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                              <Mail className="h-2.5 w-2.5 text-primary/60 flex-shrink-0" />
                                              <a href={`mailto:${candidate.email}`} className="truncate max-w-[130px] hover:text-primary transition-colors">
                                                {candidate.email}
                                              </a>
                                            </div>
                                            {candidate.phone && (
                                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                <Phone className="h-2.5 w-2.5 text-primary/60 flex-shrink-0" />
                                                <a href={`tel:${candidate.phone}`} className="hover:text-primary transition-colors">
                                                  {candidate.phone}
                                                </a>
                                              </div>
                                            )}
                                            {((candidate.parsed_data as any)?.linkedin || (candidate.parsed_data as any)?.linkedin_url) && (
                                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                <Linkedin className="h-2.5 w-2.5 text-[#0A66C2] flex-shrink-0" />
                                                <a 
                                                  href={
                                                    ((candidate.parsed_data as any).linkedin || (candidate.parsed_data as any).linkedin_url).startsWith('http')
                                                      ? ((candidate.parsed_data as any).linkedin || (candidate.parsed_data as any).linkedin_url)
                                                      : `https://${(candidate.parsed_data as any).linkedin || (candidate.parsed_data as any).linkedin_url}`
                                                  }
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="truncate max-w-[130px] text-[#0A66C2] hover:underline"
                                                >
                                                  LinkedIn
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                            <Send className="h-2.5 w-2.5 flex-shrink-0" />
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
                                    onAssign={canManageJobs ? () => setAssignDialog({
                                      open: true,
                                      candidateId: candidate.id,
                                      candidateName: candidate.full_name,
                                      currentAssignee: candidate.assigned_to,
                                      jobId: activeJob,
                                    }) : undefined}
                                  />
                                </div>

                                {/* Assigned To chip */}
                                {(candidate as any).assigned_profile ? (
                                  canManageJobs ? (
                                    <button
                                      type="button"
                                      onClick={() => setAssignDialog({
                                        open: true,
                                        candidateId: candidate.id,
                                        candidateName: candidate.full_name,
                                        currentAssignee: candidate.assigned_to,
                                        jobId: activeJob,
                                      })}
                                      className="flex items-center gap-1.5 mb-3 bg-primary/5 hover:bg-primary/10 p-1 px-2 rounded-lg border border-primary/10 transition-colors group/assign"
                                      title="Click to reassign"
                                    >
                                      <UserCheck className="h-3 w-3 text-primary" />
                                      <span className="text-[9px] font-bold text-primary/80 group-hover/assign:text-primary uppercase tracking-tight">
                                        {(candidate as any).assigned_profile.full_name}
                                      </span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1.5 mb-3 bg-primary/5 p-1 px-2 rounded-lg border border-primary/10">
                                      <UserCheck className="h-3 w-3 text-primary" />
                                      <span className="text-[9px] font-bold text-primary/80 uppercase tracking-tight">
                                        {(candidate as any).assigned_profile.full_name}
                                      </span>
                                    </div>
                                  )
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
                        );
                      })}
                      {(candidatesByStage[stage.id] || []).length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/20 border-2 border-dashed border-muted-foreground/5 rounded-2xl">
                          <Users className="h-6 w-6 mb-1" />
                          <p className="text-[9px] font-bold uppercase tracking-widest">Empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}

      {stageAIConfig.open && activeJob && (
        <StageAIConfigDialog
          isOpen={stageAIConfig.open}
          onOpenChange={(open) => setStageAIConfig({ ...stageAIConfig, open })}
          jobId={activeJob}
          stageName={stageAIConfig.stageName}
        />
      )}

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

      {isBulkAssignOpen && (
        <BulkAssignLeadsDialog
          open={isBulkAssignOpen}
          onOpenChange={setIsBulkAssignOpen}
          leadIds={selectedCandidateIds}
          leadNames={candidates
            .filter((c) => selectedCandidateIds.includes(c.id))
            .map((c) => c.full_name)}
          jobId={activeJob || undefined}
          onSuccess={() => setSelectedCandidateIds([])}
        />
      )}

      <RecruiterCopilot 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)}
        activeJob={activeJobData || null}
        candidates={candidates}
      />

      <ResumeScreener
        isOpen={isScreenerOpen}
        onClose={() => setIsScreenerOpen(false)}
        activeJob={activeJobData || null}
        candidates={candidates}
      />

      <PasteLeadsDialog
        jobId={activeJob || undefined}
        isOpen={isPasteDialogOpen}
        onOpenChange={setIsPasteDialogOpen}
        initialClipboardText={initialPasteText}
      />
    </>
  );
}
