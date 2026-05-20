import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, Search, Filter, UserCheck, Briefcase,
  Star, Clock, ChevronDown, LayoutList, Columns, Loader2,
  Mail, Phone, UserPlus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { AssignCandidateDialog } from '@/components/recruitment/AssignCandidateDialog';
import { BulkAssignLeadsDialog } from '@/components/recruitment/BulkAssignLeadsDialog';
import { BulkDeleteLeadsDialog } from '@/components/recruitment/BulkDeleteLeadsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  screening: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  interview: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  assessment: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  offer: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  hired: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

type ViewMode = 'list' | 'kanban';

export function RecruitmentLeadsBoard() {
  const { profile } = useAuthStore();
  const [search, setSearch] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    candidateId: string;
    candidateName: string;
    currentAssignee: string | null;
    jobId: string;
  }>({ open: false, candidateId: '', candidateName: '', currentAssignee: null, jobId: '' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');
  const isManager = profile?.platform_role === 'hr_manager';
  const canFilter = isAdmin || isManager;
  const queryClient = useQueryClient();

  const updateStageMutation = useMutation({
    mutationFn: async ({ candidateId, newStage }: { candidateId: string, newStage: string }) => {
      const { error } = await supabase
        .from('candidates')
        .update({ stage: newStage as any })
        .eq('id', candidateId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads-board'] });
      queryClient.invalidateQueries({ queryKey: ['new-hires'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      toast.success(variables.newStage === 'hired' 
        ? 'This user has been hired successfully and joined in the company'
        : `Candidate moved to ${variables.newStage}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update stage');
    }
  });

  // Fetch recruiters for filter
  const { data: recruiters = [] } = useQuery({
    queryKey: ['recruiters-filter', profile?.company_id],
    queryFn: async () => {
      let query = (supabase as any)
        .from('profiles')
        .select('id, full_name, platform_role')
        .eq('company_id', profile!.company_id!)
        .in('platform_role', ['recruiter', 'hr_manager'])
        .eq('is_active', true)
        .order('full_name');

      if (isManager) {
        query = query.eq('manager_id', profile!.id);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.company_id && canFilter,
  });

  // Fetch jobs for filter
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-filter', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('company_id', profile!.company_id!)
        .order('title');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch leads (candidates)
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-board', profile?.company_id, profile?.id, recruiterFilter, jobFilter, stageFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('candidates')
        .select('*,jobs(title,id),assigned_profile:profiles!candidates_assigned_to_fkey(id,full_name,platform_role)')
        .eq('company_id', profile!.company_id!)
        .order('assigned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      // Recruiter sees only their leads
      if (profile?.platform_role === 'recruiter') {
        query = query.eq('assigned_to', profile.id);
      }

      // HR Manager sees their team's leads
      if (isManager) {
        const { data: teamIds } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', profile!.id);
        const ids = [profile!.id, ...(teamIds?.map((t) => t.id) || [])];
        query = query.in('assigned_to', ids);
      }

      // Filters
      if (recruiterFilter !== 'all' && canFilter) {
        query = query.eq('assigned_to', recruiterFilter);
      }
      if (jobFilter !== 'all') {
        query = query.eq('job_id', jobFilter);
      }
      if (stageFilter !== 'all') {
        query = query.eq('stage', stageFilter);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const filtered = leads.filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.full_name?.toLowerCase().includes(s) ||
      l.email?.toLowerCase().includes(s) ||
      l.jobs?.title?.toLowerCase().includes(s)
    );
  });

  const getInitials = (name: string) =>
    name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filtered.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filtered.map((l: any) => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const ALL_STAGES = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected'];

  // ⚡ Bolt: Pre-group filtered leads by stage to eliminate O(N*M) filtering inside the Kanban render loop
  const filteredLeadsByStage = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filtered.forEach((l: any) => {
      if (l.stage) {
        if (!grouped[l.stage]) grouped[l.stage] = [];
        grouped[l.stage].push(l);
      }
    });
    return grouped;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates, jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {canFilter && (
          <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <UserCheck className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Recruiters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recruiters</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {recruiters.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <Briefcase className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.map((j: any) => (
              <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {ALL_STAGES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border border-border/50 rounded-md overflow-hidden">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-9 px-3"
            onClick={() => setViewMode('list')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-9 px-3"
            onClick={() => setViewMode('kanban')}
          >
            <Columns className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Count and Bulk Actions */}
      <div className="flex items-center justify-between h-8">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span> lead{filtered.length !== 1 ? 's' : ''} found
        </p>

        {selectedLeadIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full mr-2">
              {selectedLeadIds.length} selected
            </span>
            {(isAdmin || isManager) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setBulkAssignOpen(true)}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Bulk Assign
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Users className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedLeadIds([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/50 rounded-lg">
          <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">No leads found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Try adjusting your filters</p>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium items-center">
            <div className="col-span-3 flex items-center gap-3">
              {(isAdmin || isManager) && (
                <Checkbox
                  checked={selectedLeadIds.length === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              )}
              <span>Candidate</span>
            </div>
            <div className="col-span-1">Ref</div>
            <div className="col-span-2">Job</div>
            <div className="col-span-1">Stage</div>
            <div className="col-span-2">Assigned To</div>
            <div className="col-span-1 text-center">Score</div>
            <div className="col-span-2">Last Updated</div>
          </div>

          {filtered.map((lead: any) => (
            <Card key={lead.id} className="bg-background/50 border-border/40 hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Candidate */}
                  <div className="col-span-3 flex items-center gap-3 min-w-0">
                    {(isAdmin || isManager) && (
                      <Checkbox
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={() => toggleSelectLead(lead.id)}
                        aria-label={`Select ${lead.full_name}`}
                        className="flex-shrink-0"
                      />
                    )}
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                        {getInitials(lead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{lead.full_name}</p>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate font-medium">
                          <Mail className="h-2.5 w-2.5 text-primary/60" />
                          <a href={`mailto:${lead.email}`} className="hover:text-primary transition-colors">
                            {lead.email}
                          </a>
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate font-medium">
                            <Phone className="h-2.5 w-2.5 text-primary/60" />
                            <a href={`tel:${lead.phone}`} className="hover:text-primary transition-colors">
                              {lead.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Referrer */}
                  <div className="col-span-1">
                    {lead.referrer ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/5 px-2 py-0.5 rounded-full w-fit border border-emerald-500/10">
                        <UserPlus className="h-2.5 w-2.5" />
                        {lead.referrer.full_name}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30 px-2">—</span>
                    )}
                  </div>

                  {/* Job */}
                  <div className="col-span-2">
                    <p className="text-sm truncate text-muted-foreground">{lead.jobs?.title || '—'}</p>
                  </div>

                  {/* Stage */}
                  <div className="col-span-2">
                    <Select
                      value={lead.stage}
                      onValueChange={(newStage) => updateStageMutation.mutate({ candidateId: lead.id, newStage })}
                      disabled={updateStageMutation.isPending}
                    >
                      <SelectTrigger className={`h-7 w-fit text-[10px] capitalize border-none shadow-none focus:ring-0 px-2 ${STAGE_COLORS[lead.stage] || 'bg-muted/50 text-muted-foreground'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-[10px]">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assigned To */}
                  <div className="col-span-2">
                    {lead.assigned_profile ? (
                      <div
                        className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setAssignDialog({
                          open: true,
                          candidateId: lead.id,
                          candidateName: lead.full_name,
                          currentAssignee: lead.assigned_to,
                          jobId: lead.job_id,
                        })}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-muted">
                            {getInitials(lead.assigned_profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate">{lead.assigned_profile.full_name}</span>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
                        onClick={() => setAssignDialog({
                          open: true,
                          candidateId: lead.id,
                          candidateName: lead.full_name,
                          currentAssignee: null,
                          jobId: lead.job_id,
                        })}
                      >
                        <UserCheck className="h-3 w-3" />
                        Assign
                      </Button>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-1 text-center">
                    {lead.score !== null ? (
                      <span className="text-xs font-medium flex items-center justify-center gap-0.5">
                        <Star className="h-3 w-3 text-primary fill-primary/30" />
                        {lead.score}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  {/* Last Updated */}
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(lead.updated_at), 'dd MMM, HH:mm')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* KANBAN VIEW */
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {ALL_STAGES.filter((s) => stageFilter === 'all' || stageFilter === s).map((stage) => {
            const stageLeads = filteredLeadsByStage[stage] || [];
            return (
              <div key={stage} className="flex-shrink-0 w-72 space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className={`h-2 w-2 rounded-full ${stage === 'hired' ? 'bg-green-500' : stage === 'rejected' ? 'bg-red-500' : stage === 'offer' ? 'bg-orange-500' : stage === 'interview' ? 'bg-purple-500' : stage === 'screening' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <h3 className="font-semibold text-sm uppercase tracking-wider capitalize">{stage}</h3>
                  <Badge variant="secondary" className="text-[10px] bg-muted/50 border-none">{stageLeads.length}</Badge>
                </div>
                <div className="min-h-[200px] space-y-2 p-2 rounded-lg bg-muted/20 border border-dashed border-border/40">
                  {stageLeads.map((lead: any) => (
                    <Card key={lead.id} className={`bg-background border-border/40 shadow-sm transition-all ${selectedLeadIds.includes(lead.id) ? 'ring-1 ring-primary' : ''}`}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          {(isAdmin || isManager) && (
                            <Checkbox
                              checked={selectedLeadIds.includes(lead.id)}
                              onCheckedChange={() => toggleSelectLead(lead.id)}
                              aria-label={`Select ${lead.full_name}`}
                              className="mt-1"
                            />
                          )}
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px]">
                              {getInitials(lead.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate leading-none mb-1">{lead.full_name}</p>
                            <div className="flex flex-col gap-0.5 mb-1.5 mt-1 border-y border-border/5 py-1">
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate font-medium">
                                <Mail className="h-2.5 w-2.5 text-primary/60" />
                                <a href={`mailto:${lead.email}`} className="truncate hover:text-primary transition-colors">
                                  {lead.email}
                                </a>
                              </div>
                              {lead.phone && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate font-medium">
                                  <Phone className="h-2.5 w-2.5 text-primary/60" />
                                  <a href={`tel:${lead.phone}`} className="hover:text-primary transition-colors">
                                    {lead.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate font-bold uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-opacity">
                              <Briefcase className="h-2.5 w-2.5 inline mr-1" />
                              {lead.jobs?.title}
                            </p>
                            {lead.referrer && (
                              <div className="flex items-center gap-1 mt-2 bg-emerald-500/5 p-1 px-1.5 rounded-md border border-emerald-500/10 w-fit">
                                <UserPlus className="h-2.5 w-2.5 text-emerald-500" />
                                <span className="text-[8px] font-bold text-emerald-500/80 uppercase">
                                  Ref: {lead.referrer.full_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Select
                            value={lead.stage}
                            onValueChange={(newStage) => updateStageMutation.mutate({ candidateId: lead.id, newStage })}
                            disabled={updateStageMutation.isPending}
                          >
                            <SelectTrigger className={`h-5 w-fit text-[9px] capitalize border-none shadow-none focus:ring-0 px-1.5 ${STAGE_COLORS[lead.stage] || 'bg-muted/50 text-muted-foreground'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STAGES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize text-[9px]">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {lead.assigned_profile ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              {lead.assigned_profile.full_name}
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground/60 hover:text-primary gap-1"
                              onClick={() => setAssignDialog({
                                open: true,
                                candidateId: lead.id,
                                candidateName: lead.full_name,
                                currentAssignee: null,
                                jobId: lead.job_id,
                              })}
                            >
                              <UserCheck className="h-3 w-3" />
                              Assign
                            </Button>
                          )}
                          {lead.score !== null && (
                            <span className="text-[10px] flex items-center gap-0.5 text-primary">
                              <Star className="h-3 w-3 fill-primary/30" />
                              {lead.score}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="h-20 flex items-center justify-center text-muted-foreground/30 text-xs">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Dialog */}
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

      {/* Bulk Assign Dialog */}
      {bulkAssignOpen && (
        <BulkAssignLeadsDialog
          open={bulkAssignOpen}
          onOpenChange={setBulkAssignOpen}
          leadIds={selectedLeadIds}
          leadNames={filtered
            .filter((l: any) => selectedLeadIds.includes(l.id))
            .map((l: any) => l.full_name)}
          onSuccess={() => setSelectedLeadIds([])}
        />
      )}

      {/* Bulk Delete Dialog */}
      {bulkDeleteOpen && (
        <BulkDeleteLeadsDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          leadIds={selectedLeadIds}
          onSuccess={() => setSelectedLeadIds([])}
        />
      )}
    </div>
  );
}
