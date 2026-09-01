import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, UserPlus, Search, ShieldCheck, Clock, Link2,
  Users, CheckCircle2, Loader2, Filter, BarChart3, Lock,
  ShieldAlert, Sparkles, FileCheck2, ArrowUpRight, LayoutGrid,
  Table as TableIcon, FileDown, MessageSquarePlus, Eye, Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { GlobalEmployeeSearch } from '@/components/global-employee/GlobalEmployeeSearch';
import { GlobalEmployeeCard, StarRating } from '@/components/global-employee/GlobalEmployeeCard';
import { AddGlobalEmployeeDialog } from '@/components/global-employee/AddGlobalEmployeeDialog';
import { VerificationLinkDialog } from '@/components/global-employee/VerificationLinkDialog';
import { RequestConsentDialog } from '@/components/global-employee/RequestConsentDialog';
import { CandidateQuickViewDrawer } from '@/components/global-employee/CandidateQuickViewDrawer';
import { EmployerFeedbackDialog } from '@/components/global-employee/EmployerFeedbackDialog';
import type { GlobalEmployee } from '@/types/global-employee';
import { toast } from 'sonner';

export default function GlobalEmployeeVerification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [verifyLinkDialog, setVerifyLinkDialog] = useState<{ open: boolean; id: string; name: string; link?: string | null }>({
    open: false, id: '', name: '',
  });
  const [consentDialog, setConsentDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false, id: '', name: '',
  });
  const [attestationDialog, setAttestationDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false, id: '', name: '',
  });
  const [quickViewEmployee, setQuickViewEmployee] = useState<GlobalEmployee | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // View Mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  // Filter: 'all' | 'verified' | 'pending' | 'top_rated'
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'pending' | 'top_rated'>('all');

  const isAdmin = ['super_admin', 'company_admin', 'hr_manager'].includes(profile?.platform_role || '');

  // Fetch my company's submissions
  const { data: mySubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ['global-employees-my-submissions', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_employee' as any)
        .select('*')
        .eq('added_by_company_id', profile?.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as GlobalEmployee[];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch pending (unverified) records
  const { data: pendingVerifications = [], isLoading: loadingPending } = useQuery({
    queryKey: ['global-employees-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_employee' as any)
        .select('*')
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as GlobalEmployee[];
    },
  });

  // Stats
  const totalSubmissions = mySubmissions.length;
  const verifiedCount = mySubmissions.filter((e) => e.verified).length;
  const pendingCount = pendingVerifications.length;

  const handleVerify = async (emp: GlobalEmployee) => {
    try {
      const { error } = await supabase
        .from('global_employee' as any)
        .update({
          verified: true,
          verification_date: new Date().toISOString(),
          verified_by: profile?.id,
          id_verification_status: 'verified_gov_id',
        } as any)
        .eq('id', emp.id);

      if (error) throw error;

      toast.success(`${emp.name}'s profile has been audited and verified.`);
      queryClient.invalidateQueries({ queryKey: ['global-employees-my-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['global-employees-pending'] });
    } catch (err: any) {
      console.error('Verify error:', err);
      toast.error(err.message || 'Failed to verify employee');
    }
  };

  const handleSelect = (emp: GlobalEmployee) => {
    setQuickViewEmployee(emp);
    setQuickViewOpen(true);
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['global-employees-my-submissions'] });
    queryClient.invalidateQueries({ queryKey: ['global-employees-pending'] });
  };

  // Filtered submissions list
  const filteredSubmissions = mySubmissions.filter((emp) => {
    if (filterType === 'verified') return emp.verified;
    if (filterType === 'pending') return !emp.verified;
    if (filterType === 'top_rated') return Number(emp.rating) >= 4.0;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Background Verification & Candidate Intelligence</h1>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                  <ShieldCheck className="h-3 w-3 mr-1" /> FCRA & GDPR Compliant
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Screen candidates, audit verified employment histories, evaluate reputation ratings, and generate BGV reports
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setVerifyLinkDialog({ open: true, id: '', name: 'Candidate' })}
              className="gap-2 rounded-xl"
            >
              <Link2 className="h-4 w-4" /> Link Suite
            </Button>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 rounded-xl"
            >
              <UserPlus className="h-4 w-4" /> Add Candidate to BGV
            </Button>
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5 rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{totalSubmissions}</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Screened Candidates</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5 rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{verifiedCount}</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verified Clean</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5 rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pending Audits</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5 rounded-2xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">99.8%</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Attestation Fidelity</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs Layout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Tabs defaultValue="submissions" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="bg-muted/50 backdrop-blur-xl border border-border/50 p-1 rounded-xl">
              <TabsTrigger value="submissions" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <BarChart3 className="h-4 w-4" /> Candidate Directory & BGV
                {totalSubmissions > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-5 min-w-5 justify-center">{totalSubmissions}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Search className="h-4 w-4" /> Global Lookup
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Clock className="h-4 w-4" /> Pending Audits
                {pendingCount > 0 && (
                  <Badge className="ml-1 text-[10px] h-5 min-w-5 justify-center bg-amber-500/20 text-amber-500 border-amber-500/30">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="compliance" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Lock className="h-4 w-4" /> Trust & Compliance
              </TabsTrigger>
            </TabsList>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 self-end sm:self-center">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs gap-1.5"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs gap-1.5"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table / BGV Matrix
              </Button>
            </div>
          </div>

          {/* TAB 1: CANDIDATE DIRECTORY & BGV (MY SUBMISSIONS) */}
          <TabsContent value="submissions" className="space-y-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
                <Filter className="h-3.5 w-3.5 text-primary" /> Filter:
              </span>
              <Badge
                onClick={() => setFilterType('all')}
                className={`cursor-pointer text-xs px-3 py-1 rounded-lg transition-all ${
                  filterType === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                All Candidates ({mySubmissions.length})
              </Badge>
              <Badge
                onClick={() => setFilterType('verified')}
                className={`cursor-pointer text-xs px-3 py-1 rounded-lg transition-all ${
                  filterType === 'verified'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                ✓ Verified Clean ({verifiedCount})
              </Badge>
              <Badge
                onClick={() => setFilterType('pending')}
                className={`cursor-pointer text-xs px-3 py-1 rounded-lg transition-all ${
                  filterType === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                ⏳ Pending Audit ({pendingCount})
              </Badge>
              <Badge
                onClick={() => setFilterType('top_rated')}
                className={`cursor-pointer text-xs px-3 py-1 rounded-lg transition-all ${
                  filterType === 'top_rated'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                ★ Top Rated (4.0+)
              </Badge>
            </div>

            {loadingSubmissions ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-16 space-y-4 border border-dashed rounded-2xl bg-muted/10">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-semibold">No candidates found in this view</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Add candidates to your background verification queue to inspect credentials and manage hiring decisions.
                </p>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2 mt-2 bg-gradient-to-r from-primary to-purple-600">
                  <UserPlus className="h-4 w-4" /> Add New Candidate
                </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSubmissions.map((emp) => (
                  <div key={emp.id} className="relative group">
                    <GlobalEmployeeCard
                      employee={emp}
                      onClick={() => handleSelect(emp)}
                      onRequestConsent={(e) => {
                        e.stopPropagation();
                        setConsentDialog({ open: true, id: emp.id, name: emp.name });
                      }}
                    />
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-background/90 backdrop-blur-sm shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerifyLinkDialog({ open: true, id: emp.id, name: emp.name, link: emp.verification_link });
                          }}
                        >
                          <Link2 className="h-3 w-3 mr-1" /> Links
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-background/90 backdrop-blur-sm shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttestationDialog({ open: true, id: emp.id, name: emp.name });
                          }}
                        >
                          <MessageSquarePlus className="h-3 w-3 mr-1 text-primary" /> Attest
                        </Button>
                        {!emp.verified && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerify(emp);
                            }}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* TABLE / BGV MATRIX VIEW */
              <div className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-lg">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold">Candidate</TableHead>
                      <TableHead className="font-bold">Current Role & Org</TableHead>
                      <TableHead className="font-bold">Identity & KYC</TableHead>
                      <TableHead className="font-bold">Unified Rating</TableHead>
                      <TableHead className="font-bold">BGV Verdict</TableHead>
                      <TableHead className="text-right font-bold">Quick Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((emp) => {
                      const initials = emp.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??';
                      const latestJob = emp.work_experience?.[0];
                      const maskedId = emp.masked_aadhaar || emp.masked_pan || emp.aadhaar;

                      return (
                        <TableRow
                          key={emp.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleSelect(emp)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border rounded-xl">
                                <AvatarImage src={emp.profile_picture || ''} className="rounded-xl object-cover" />
                                <AvatarFallback className="text-xs font-bold rounded-xl">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                  {emp.name}
                                  {emp.verified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{emp.email || 'No email'}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {latestJob ? (
                              <div>
                                <p className="font-semibold text-xs text-foreground">{latestJob.designation}</p>
                                <p className="text-[10px] text-muted-foreground">{latestJob.company_name}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No role logged</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {maskedId ? (
                              <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                                <Lock className="h-2.5 w-2.5 mr-1" /> Tokenized
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Pending
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <StarRating rating={Number(emp.rating) || 0} size="sm" />
                              <span className="text-xs font-bold font-mono">
                                {Number(emp.rating) > 0 ? Number(emp.rating).toFixed(1) : '0.0'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            {emp.verified ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold">
                                ✓ VERIFIED CLEAR
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 font-bold">
                                ⏳ AUDIT PENDING
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleSelect(emp)}
                              >
                                <Eye className="h-3 w-3" /> Review
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => navigate(`/employeebg/${emp.id}`)}
                              >
                                Passport →
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: GLOBAL SEARCH */}
          <TabsContent value="search" className="space-y-6">
            <GlobalEmployeeSearch
              onSelect={handleSelect}
              onAddNew={() => setAddDialogOpen(true)}
            />
          </TabsContent>

          {/* TAB 3: PENDING */}
          <TabsContent value="pending" className="space-y-6">
            {loadingPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-16 space-y-4 border border-dashed rounded-2xl bg-emerald-500/5">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                </div>
                <p className="text-lg font-semibold">All Verifications Up to Date</p>
                <p className="text-sm text-muted-foreground">No candidate submissions are currently awaiting audit.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingVerifications.map((emp) => (
                  <div key={emp.id} className="relative group">
                    <GlobalEmployeeCard
                      employee={emp}
                      onClick={() => handleSelect(emp)}
                    />
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(emp);
                          }}
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" /> Approve & Issue Passport
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: COMPLIANCE & TRUST */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-background/80 backdrop-blur-xl border-border/50 rounded-2xl p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base">FCRA CRA Standards</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  FastestHR structures candidate reports with mandatory Pre-Adverse Action notices and a strict 30-day statutory reinvestigation pipeline.
                </p>
              </Card>

              <Card className="bg-background/80 backdrop-blur-xl border-border/50 rounded-2xl p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base">GDPR & DPDP Tokenization</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  National ID numbers (Aadhaar, PAN, SSN) are zero-knowledge tokenized. Sensitive employment dossiers require cryptographic candidate consent.
                </p>
              </Card>

              <Card className="bg-background/80 backdrop-blur-xl border-border/50 rounded-2xl p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base">Objective STAR Attestations</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Arbitrary reviews are prohibited. Only verified work-email corporate representatives can submit standardized, non-defamatory rubrics.
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Candidate Quick-View Drawer */}
      <CandidateQuickViewDrawer
        employee={quickViewEmployee}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        onAuditApprove={(emp) => {
          handleVerify(emp);
          setQuickViewOpen(false);
        }}
        onRequestConsent={(emp) => {
          setConsentDialog({ open: true, id: emp.id, name: emp.name });
        }}
        onSubmitAttestation={(emp) => {
          setAttestationDialog({ open: true, id: emp.id, name: emp.name });
        }}
      />

      {/* Dialogs */}
      <AddGlobalEmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refreshData}
      />

      {verifyLinkDialog.id && (
        <VerificationLinkDialog
          open={verifyLinkDialog.open}
          onOpenChange={(open) => setVerifyLinkDialog((prev) => ({ ...prev, open }))}
          employeeId={verifyLinkDialog.id}
          employeeName={verifyLinkDialog.name}
          existingLink={verifyLinkDialog.link}
        />
      )}

      {consentDialog.id && (
        <RequestConsentDialog
          open={consentDialog.open}
          onOpenChange={(open) => setConsentDialog((prev) => ({ ...prev, open }))}
          employeeId={consentDialog.id}
          employeeName={consentDialog.name}
          onSuccess={refreshData}
        />
      )}

      {attestationDialog.id && (
        <EmployerFeedbackDialog
          open={attestationDialog.open}
          onOpenChange={(open) => setAttestationDialog((prev) => ({ ...prev, open }))}
          employeeId={attestationDialog.id}
          employeeName={attestationDialog.name}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}
