import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, Users, Target, Award, Loader2,
  Star, FileSignature, Send, CheckCircle2, Clock, Calendar,
  Shield, Briefcase, UserCheck, User, Search, Filter,
  ArrowUpRight, MailCheck, AlertCircle, Check
} from 'lucide-react';
import { format, isToday, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';

const STAGES = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected'];

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  assessment: 'Assessment',
  offer: 'Offer Letter',
  hired: 'Hired',
  rejected: 'Rejected',
};

const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-blue-500',
  screening: 'bg-yellow-500',
  interview: 'bg-purple-500',
  assessment: 'bg-indigo-500',
  offer: 'bg-amber-500',
  hired: 'bg-emerald-500',
  rejected: 'bg-rose-500',
};

export function RecruitmentAnalytics() {
  const { profile } = useAuthStore();
  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');
  const isManager = profile?.platform_role === 'hr_manager';

  const [searchMember, setSearchMember] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'recruiter' | 'hr_manager' | 'admin'>('all');
  const [sortBy, setSortBy] = useState<'total' | 'applied' | 'offer' | 'hired' | 'conversion'>('total');

  // 1. Fetch team members: recruiters, hr_managers, company_admins, super_admins
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['analytics-team-members', profile?.company_id],
    queryFn: async () => {
      let query = (supabase as any)
        .from('profiles')
        .select('id, full_name, platform_role, avatar_url, email')
        .eq('company_id', profile!.company_id!)
        .in('platform_role', ['recruiter', 'hr_manager', 'company_admin', 'super_admin'])
        .eq('is_active', true)
        .order('full_name');

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching analytics team members:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // 2. Fetch all candidates in scope
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['analytics-candidates', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('candidates')
        .select('id, full_name, email, stage, score, assigned_to, created_at, updated_at, job_id, jobs(id, title)')
        .eq('company_id', profile!.company_id!);

      if (error) {
        console.error('Error fetching analytics candidates:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // 3. Fetch candidate offers (for today's offer tracking & historical metrics)
  const { data: candidateOffers = [], isLoading: loadingOffers } = useQuery({
    queryKey: ['analytics-candidate-offers', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('candidate_offers')
        .select(`
          id, 
          offer_number, 
          joining_date, 
          payout, 
          status, 
          created_at, 
          candidate_id, 
          candidates(id, full_name, email, assigned_to), 
          jobs(id, title)
        `)
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching analytics candidate offers:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Compute Offer Metrics
  const offerMetrics = useMemo(() => {
    const today = startOfDay(new Date());

    const offersToday = candidateOffers.filter((o: any) => {
      try {
        return new Date(o.created_at) >= today;
      } catch {
        return false;
      }
    });

    const totalOffers = candidateOffers.length;
    const offersAcceptedToday = offersToday.filter((o: any) => o.status === 'accepted').length;
    const totalAcceptedOffers = candidateOffers.filter((o: any) => o.status === 'accepted').length;
    const totalPendingOffers = candidateOffers.filter((o: any) => ['sent', 'pending'].includes(o.status)).length;

    return {
      offersToday,
      offersTodayCount: offersToday.length,
      offersAcceptedToday,
      totalOffers,
      totalAcceptedOffers,
      totalPendingOffers,
      latestOffer: candidateOffers[0] || null,
    };
  }, [candidateOffers]);

  // Compute Funnel & Recruiter / Manager / Admin Breakdown
  const {
    funnelData,
    maxFunnelCount,
    totalApplied,
    totalOfferStage,
    totalHired,
    totalLeads,
    overallConversionRate,
    avgScore,
    teamWorkload
  } = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    STAGES.forEach(s => stageCounts[s] = 0);

    let scoredCount = 0;
    let totalScoreSum = 0;

    // Map each team member
    const memberMap: Record<string, {
      id: string;
      full_name: string;
      email?: string;
      platform_role: string;
      avatar_url?: string;
      total: number;
      applied: number;
      offer: number;
      hired: number;
      other: number;
      scoredCount: number;
      scoreSum: number;
      byStage: Record<string, number>;
      offersTodayCount: number;
    }> = {};

    // Initialize registered team members
    teamMembers.forEach((m: any) => {
      memberMap[m.id] = {
        id: m.id,
        full_name: m.full_name || 'Unnamed Member',
        email: m.email || '',
        platform_role: m.platform_role,
        avatar_url: m.avatar_url,
        total: 0,
        applied: 0,
        offer: 0,
        hired: 0,
        other: 0,
        scoredCount: 0,
        scoreSum: 0,
        byStage: STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
        offersTodayCount: 0,
      };
    });

    // Bucket for unassigned leads
    const unassignedBucket = {
      id: 'unassigned',
      full_name: 'Unassigned / Open Leads',
      email: '',
      platform_role: 'unassigned',
      avatar_url: undefined,
      total: 0,
      applied: 0,
      offer: 0,
      hired: 0,
      other: 0,
      scoredCount: 0,
      scoreSum: 0,
      byStage: STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
      offersTodayCount: 0,
    };

    // Calculate candidates per member
    candidates.forEach((c: any) => {
      const stage = c.stage || 'applied';
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      }

      if (c.score !== null && !isNaN(c.score)) {
        scoredCount++;
        totalScoreSum += Number(c.score);
      }

      const assignee = c.assigned_to ? memberMap[c.assigned_to] : null;
      const target = assignee || unassignedBucket;

      target.total++;
      if (target.byStage[stage] !== undefined) {
        target.byStage[stage]++;
      }

      if (stage === 'applied') {
        target.applied++;
      } else if (stage === 'offer') {
        target.offer++;
      } else if (stage === 'hired') {
        target.hired++;
      } else {
        target.other++;
      }

      if (c.score !== null && !isNaN(c.score)) {
        target.scoredCount++;
        target.scoreSum += Number(c.score);
      }
    });

    // Attribute today's offers to team members
    offerMetrics.offersToday.forEach((offer: any) => {
      const assignedToId = offer.candidates?.assigned_to;
      if (assignedToId && memberMap[assignedToId]) {
        memberMap[assignedToId].offersTodayCount++;
      } else if (!assignedToId) {
        unassignedBucket.offersTodayCount++;
      }
    });

    // Combine list of team members (include unassigned only if it has leads)
    const allMembers = Object.values(memberMap);
    if (unassignedBucket.total > 0) {
      allMembers.push(unassignedBucket);
    }

    // Format list with conversion rates
    const teamWorkload = allMembers.map((member) => {
      const conversion = member.total > 0
        ? ((member.hired / member.total) * 100).toFixed(1)
        : '0';
      const avgMemberScore = member.scoredCount > 0
        ? (member.scoreSum / member.scoredCount).toFixed(1)
        : null;

      return {
        ...member,
        conversion,
        avgScore: avgMemberScore,
      };
    });

    const funnelData = STAGES.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage] || stage,
      count: stageCounts[stage] || 0,
    }));

    const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);
    const totalLeads = candidates.length;
    const totalApplied = stageCounts['applied'] || 0;
    const totalOfferStage = stageCounts['offer'] || 0;
    const totalHired = stageCounts['hired'] || 0;
    const overallConversionRate = totalLeads > 0 ? ((totalHired / totalLeads) * 100).toFixed(1) : '0';
    const avgScore = scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : '—';

    return {
      funnelData,
      maxFunnelCount,
      totalApplied,
      totalOfferStage,
      totalHired,
      totalLeads,
      overallConversionRate,
      avgScore,
      teamWorkload,
    };
  }, [candidates, teamMembers, offerMetrics.offersToday]);

  // Filtered & Sorted Team Workload
  const filteredTeamWorkload = useMemo(() => {
    return teamWorkload
      .filter((m) => {
        // Role filter
        if (roleFilter === 'recruiter' && m.platform_role !== 'recruiter') return false;
        if (roleFilter === 'hr_manager' && m.platform_role !== 'hr_manager') return false;
        if (roleFilter === 'admin' && !['company_admin', 'super_admin'].includes(m.platform_role)) return false;

        // Search filter
        if (searchMember) {
          const query = searchMember.toLowerCase();
          const matchesName = m.full_name.toLowerCase().includes(query);
          const matchesEmail = m.email?.toLowerCase().includes(query);
          return matchesName || matchesEmail;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'applied') return b.applied - a.applied;
        if (sortBy === 'offer') return b.offer - a.offer;
        if (sortBy === 'hired') return b.hired - a.hired;
        if (sortBy === 'conversion') return parseFloat(b.conversion) - parseFloat(a.conversion);
        return b.total - a.total;
      });
  }, [teamWorkload, roleFilter, searchMember, sortBy]);

  // Totals for filtered table footer
  const tableTotals = useMemo(() => {
    return filteredTeamWorkload.reduce(
      (acc, curr) => ({
        total: acc.total + curr.total,
        applied: acc.applied + curr.applied,
        offer: acc.offer + curr.offer,
        hired: acc.hired + curr.hired,
        other: acc.other + curr.other,
      }),
      { total: 0, applied: 0, offer: 0, hired: 0, other: 0 }
    );
  }, [filteredTeamWorkload]);

  const getInitials = (name: string) =>
    name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'company_admin':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-semibold gap-1 py-0.5">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'hr_manager':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-semibold gap-1 py-0.5">
            <Briefcase className="h-3 w-3" />
            HR Manager
          </Badge>
        );
      case 'recruiter':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold gap-1 py-0.5">
            <User className="h-3 w-3" />
            Recruiter
          </Badge>
        );
      case 'unassigned':
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-semibold py-0.5">
            Unassigned
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold py-0.5 capitalize">
            {role.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  const isLoading = loadingTeam || loadingCandidates || loadingOffers;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading recruitment analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Offer Letters Sent Today */}
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 relative overflow-hidden shadow-sm">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileSignature className="h-4 w-4" />
                Offers Sent Today
              </span>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-none text-[10px] font-bold px-1.5 py-0">
                Today
              </Badge>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{offerMetrics.offersTodayCount}</p>
              <span className="text-xs text-muted-foreground font-medium">sent today</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 truncate">
              {offerMetrics.totalOffers} total all-time • {offerMetrics.totalAcceptedOffers} accepted
            </p>
          </CardContent>
        </Card>

        {/* Total Leads */}
        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Leads</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{totalLeads}</p>
              <span className="text-xs text-muted-foreground font-medium">candidates</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Active pipeline pool</p>
          </CardContent>
        </Card>

        {/* Applied Stage */}
        <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-indigo-500" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Applied Stage</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{totalApplied}</p>
              <span className="text-xs text-muted-foreground font-medium">in queue</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {totalLeads > 0 ? `${((totalApplied / totalLeads) * 100).toFixed(0)}% of total leads` : '0%'}
            </p>
          </CardContent>
        </Card>

        {/* Offer Letter Stage */}
        <Card className="bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border-orange-500/20 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-orange-500" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Offer Stage</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{totalOfferStage}</p>
              <span className="text-xs text-muted-foreground font-medium">candidates</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Currently in offer negotiation</p>
          </CardContent>
        </Card>

        {/* Hired Stage & Conversion */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Hired</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{totalHired}</p>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold ml-1">{overallConversionRate}% rate</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Avg Candidate Score: {avgScore}</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. TODAY'S OFFER LETTERS ACTIVITY PANEL */}
      <Card className="border-border/50 bg-background/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-amber-500" />
              Today's Offer Letters Sent
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Live status of offer letters generated and dispatched today ({format(new Date(), 'EEEE, dd MMMM yyyy')})
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold px-2.5 py-1">
            {offerMetrics.offersTodayCount} sent today
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {offerMetrics.offersToday.length > 0 ? (
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase">Offer #</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Candidate</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Position / Job</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Joining Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase">CTC / Payout</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Time Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerMetrics.offersToday.map((offer: any) => (
                    <TableRow key={offer.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {offer.offer_number || 'OFFER'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">
                          {offer.candidates?.full_name || 'Candidate'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {offer.candidates?.email || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {offer.jobs?.title || 'General Position'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3 text-muted-foreground/70" />
                          {offer.joining_date ? format(new Date(offer.joining_date), 'dd MMM yyyy') : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {offer.payout ? `₹${Number(offer.payout).toLocaleString('en-IN')}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold capitalize px-2 py-0.5 ${
                            offer.status === 'accepted'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : offer.status === 'declined'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          {offer.status || 'sent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground text-right">
                        <span className="flex items-center justify-end gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {format(new Date(offer.created_at), 'hh:mm a')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/10 rounded-lg border border-dashed border-border/40">
              <MailCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-semibold text-foreground">No offer letters have been sent yet today</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                Offers generated today will automatically appear here with their joining dates, CTC, and candidate status.
              </p>
              {offerMetrics.latestOffer && (
                <div className="mt-3 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border/40">
                  Last offer sent on {format(new Date(offerMetrics.latestOffer.created_at), 'dd MMM, hh:mm a')} to{' '}
                  <span className="font-semibold text-foreground">{offerMetrics.latestOffer.candidates?.full_name || 'Candidate'}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. RECRUITER, MANAGER & ADMIN LEAD DISTRIBUTION & STAGE MATRIX */}
      <Card className="border-border/50 bg-background/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Recruiter, Manager & Admin Lead Breakdown
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Which recruiter, manager, or admin has how many leads, broken down by Applied, Offer Letter, and Hired stages
              </CardDescription>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={roleFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => setRoleFilter('all')}
              >
                All ({teamWorkload.length})
              </Button>
              <Button
                variant={roleFilter === 'recruiter' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium gap-1 text-emerald-600 dark:text-emerald-400"
                onClick={() => setRoleFilter('recruiter')}
              >
                <User className="h-3 w-3" />
                Recruiters ({teamWorkload.filter((m) => m.platform_role === 'recruiter').length})
              </Button>
              <Button
                variant={roleFilter === 'hr_manager' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium gap-1 text-blue-600 dark:text-blue-400"
                onClick={() => setRoleFilter('hr_manager')}
              >
                <Briefcase className="h-3 w-3" />
                Managers ({teamWorkload.filter((m) => m.platform_role === 'hr_manager').length})
              </Button>
              <Button
                variant={roleFilter === 'admin' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium gap-1 text-purple-600 dark:text-purple-400"
                onClick={() => setRoleFilter('admin')}
              >
                <Shield className="h-3 w-3" />
                Admins ({teamWorkload.filter((m) => ['company_admin', 'super_admin'].includes(m.platform_role)).length})
              </Button>
            </div>
          </div>

          {/* Search & Sort Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search team member..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/70"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-muted-foreground">
              <span className="text-[11px] font-medium">Sort by:</span>
              <div className="inline-flex rounded-md border border-border/50 p-0.5 bg-muted/30">
                <button
                  onClick={() => setSortBy('total')}
                  className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                    sortBy === 'total' ? 'bg-background shadow-xs text-foreground font-bold' : 'hover:text-foreground'
                  }`}
                >
                  Total Leads
                </button>
                <button
                  onClick={() => setSortBy('applied')}
                  className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                    sortBy === 'applied' ? 'bg-background shadow-xs text-blue-600 font-bold' : 'hover:text-foreground'
                  }`}
                >
                  Applied
                </button>
                <button
                  onClick={() => setSortBy('offer')}
                  className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                    sortBy === 'offer' ? 'bg-background shadow-xs text-amber-600 font-bold' : 'hover:text-foreground'
                  }`}
                >
                  Offer Letter
                </button>
                <button
                  onClick={() => setSortBy('hired')}
                  className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                    sortBy === 'hired' ? 'bg-background shadow-xs text-emerald-600 font-bold' : 'hover:text-foreground'
                  }`}
                >
                  Hired
                </button>
                <button
                  onClick={() => setSortBy('conversion')}
                  className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                    sortBy === 'conversion' ? 'bg-background shadow-xs text-foreground font-bold' : 'hover:text-foreground'
                  }`}
                >
                  Conversion %
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase min-w-[200px]">Team Member</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center">Total Leads</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center text-blue-600 dark:text-blue-400">
                    Applied
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center text-amber-600 dark:text-amber-400">
                    Offer Letter
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center text-emerald-600 dark:text-emerald-400">
                    Hired
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center text-muted-foreground">
                    Other Stages
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase min-w-[180px]">Stage Distribution</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredTeamWorkload.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/20 transition-colors">
                    {/* Member Info */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-border/60">
                          {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-foreground truncate max-w-[150px]">
                              {member.full_name}
                            </span>
                            {getRoleBadge(member.platform_role)}
                          </div>
                          {member.email && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[170px] mt-0.5">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Total Leads */}
                    <TableCell className="text-center font-bold text-xs">
                      <span className="bg-muted/70 px-2 py-1 rounded-md text-foreground font-mono">
                        {member.total}
                      </span>
                    </TableCell>

                    {/* Applied */}
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold px-2 py-0.5 ${
                          member.applied > 0
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            : 'bg-muted/40 text-muted-foreground/60'
                        }`}
                      >
                        {member.applied}
                      </Badge>
                    </TableCell>

                    {/* Offer Letter */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Badge
                          variant="secondary"
                          className={`text-xs font-bold px-2 py-0.5 ${
                            member.offer > 0
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              : 'bg-muted/40 text-muted-foreground/60'
                          }`}
                        >
                          {member.offer}
                        </Badge>
                        {member.offersTodayCount > 0 && (
                          <span
                            className="text-[10px] bg-amber-500 text-amber-950 font-black px-1.5 py-0.2 rounded-full"
                            title={`${member.offersTodayCount} offer letter(s) sent today`}
                          >
                            +{member.offersTodayCount}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Hired */}
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold px-2 py-0.5 ${
                          member.hired > 0
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-muted/40 text-muted-foreground/60'
                        }`}
                      >
                        {member.hired}
                      </Badge>
                    </TableCell>

                    {/* Other Stages (Screening, Interview, Assessment, Rejected) */}
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground font-medium">
                        {member.other}
                      </span>
                    </TableCell>

                    {/* Stage Distribution Visual Bar */}
                    <TableCell>
                      {member.total > 0 ? (
                        <div className="space-y-1">
                          <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted/40 gap-0.5">
                            {/* Applied (Blue) */}
                            {member.applied > 0 && (
                              <div
                                className="bg-blue-500 h-full transition-all"
                                style={{ width: `${(member.applied / member.total) * 100}%` }}
                                title={`Applied: ${member.applied}`}
                              />
                            )}
                            {/* Other (Screening/Interview - Purple) */}
                            {member.other > 0 && (
                              <div
                                className="bg-purple-500 h-full transition-all"
                                style={{ width: `${(member.other / member.total) * 100}%` }}
                                title={`In Pipeline: ${member.other}`}
                              />
                            )}
                            {/* Offer (Amber) */}
                            {member.offer > 0 && (
                              <div
                                className="bg-amber-500 h-full transition-all"
                                style={{ width: `${(member.offer / member.total) * 100}%` }}
                                title={`Offer Letter: ${member.offer}`}
                              />
                            )}
                            {/* Hired (Green) */}
                            {member.hired > 0 && (
                              <div
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${(member.hired / member.total) * 100}%` }}
                                title={`Hired: ${member.hired}`}
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{((member.applied / member.total) * 100).toFixed(0)}% applied</span>
                            <span>{((member.offer / member.total) * 100).toFixed(0)}% offer</span>
                            <span className="text-emerald-600 font-semibold">{member.conversion}% hired</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 italic">No assigned leads</span>
                      )}
                    </TableCell>

                    {/* Conversion Rate */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold text-xs text-foreground">
                          {member.conversion}%
                        </span>
                        {parseFloat(member.conversion) > 0 && (
                          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredTeamWorkload.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                      No team members match your search or filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

              {/* Summary Totals Footer */}
              {filteredTeamWorkload.length > 0 && (
                <TableFooter className="bg-muted/40 font-bold border-t-2 border-border/60">
                  <TableRow>
                    <TableCell className="text-xs font-bold text-foreground">
                      Total Across Selected ({filteredTeamWorkload.length} Members)
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-foreground font-mono">
                      {tableTotals.total}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-blue-600 dark:text-blue-400">
                      {tableTotals.applied}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-amber-600 dark:text-amber-400">
                      {tableTotals.offer}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {tableTotals.hired}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-muted-foreground">
                      {tableTotals.other}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      Company-wide pipeline breakdown
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {tableTotals.total > 0
                        ? `${((tableTotals.hired / tableTotals.total) * 100).toFixed(1)}%`
                        : '0%'}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 4. PIPELINE FUNNEL & RECRUITER PERFORMANCE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card className="bg-background/50 border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/10">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Recruitment Pipeline Funnel
            </CardTitle>
            <CardDescription className="text-xs">
              Conversion flow of candidate volume from initial application down to hiring
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-3.5">
            {funnelData.map(({ stage, label, count }) => (
              <div key={stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <div className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] || 'bg-primary'}`} />
                    <span>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{count}</span>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">
                      {totalLeads > 0 ? `${((count / totalLeads) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${STAGE_COLORS[stage] || 'bg-primary'}`}
                    style={{ width: `${(count / maxFunnelCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {totalLeads === 0 && (
              <p className="text-center text-sm text-muted-foreground/50 py-4">No candidates in pipeline yet</p>
            )}
          </CardContent>
        </Card>

        {/* Legend & Stage Insights */}
        <Card className="bg-background/50 border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/10">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Key Pipeline Stage Summary
            </CardTitle>
            <CardDescription className="text-xs">
              Summary of key focus stages requested for executive and operational tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Applied Stage */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="p-2 rounded-md bg-blue-500/10 text-blue-500 mt-0.5">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">Applied Stage (Initial Inflow)</h4>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-bold">
                    {totalApplied} leads
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Candidates who have submitted resumes or have been bulk imported into the system awaiting screening.
                </p>
              </div>
            </div>

            {/* Offer Letter Stage */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="p-2 rounded-md bg-amber-500/10 text-amber-500 mt-0.5">
                <FileSignature className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">Offer Letter Stage (Pending Joining)</h4>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-bold">
                    {totalOfferStage} leads
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Candidates who have cleared interviews/assessments and have offer letters dispatched or in preparation.
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  <span>• {offerMetrics.offersTodayCount} sent today</span>
                  <span>• {offerMetrics.totalAcceptedOffers} total accepted</span>
                  <span>• {offerMetrics.totalPendingOffers} awaiting response</span>
                </div>
              </div>
            </div>

            {/* Hired Stage */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">Hired Stage (Successfully Converted)</h4>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold">
                    {totalHired} hired
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Candidates converted into employees with employee profiles, salary structures, and onboarding workflows activated.
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Overall pipeline conversion rate: {overallConversionRate}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
