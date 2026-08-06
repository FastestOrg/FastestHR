import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, UserPlus, Search, ShieldCheck, Clock, Link2,
  Users, CheckCircle2, Loader2, Filter, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { GlobalEmployeeSearch } from '@/components/global-employee/GlobalEmployeeSearch';
import { GlobalEmployeeCard } from '@/components/global-employee/GlobalEmployeeCard';
import { AddGlobalEmployeeDialog } from '@/components/global-employee/AddGlobalEmployeeDialog';
import { VerificationLinkDialog } from '@/components/global-employee/VerificationLinkDialog';
import type { GlobalEmployee } from '@/types/global-employee';

export default function GlobalEmployeeVerification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [verifyLinkDialog, setVerifyLinkDialog] = useState<{ open: boolean; id: string; name: string; link?: string | null }>({
    open: false, id: '', name: '',
  });

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
  const verifiedCount = mySubmissions.filter(e => e.verified).length;
  const pendingCount = pendingVerifications.length;

  const handleVerify = async (emp: GlobalEmployee) => {
    try {
      const { error } = await supabase
        .from('global_employee' as any)
        .update({
          verified: true,
          verification_date: new Date().toISOString(),
          verified_by: profile?.id,
        } as any)
        .eq('id', emp.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['global-employees-my-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['global-employees-pending'] });
    } catch (err) {
      console.error('Verify error:', err);
    }
  };

  const handleSelect = (emp: GlobalEmployee) => {
    navigate(`/employeebg/${emp.id}`);
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['global-employees-my-submissions'] });
    queryClient.invalidateQueries({ queryKey: ['global-employees-pending'] });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Global Employee Verification</h1>
              <p className="text-sm text-muted-foreground">Search, verify, and rate employees & candidates globally</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setVerifyLinkDialog({ open: true, id: '', name: 'New Candidate' })} className="gap-2">
              <Link2 className="h-4 w-4" /> Generate Link
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" /> Add Employee
            </Button>
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{totalSubmissions}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Records</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{verifiedCount}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verified</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="bg-muted/50 backdrop-blur-xl border border-border/50 p-1 rounded-xl">
            <TabsTrigger value="search" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Search className="h-4 w-4" /> Search & Verify
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="h-4 w-4" /> My Submissions
              {totalSubmissions > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-5 min-w-5 justify-center">{totalSubmissions}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="h-4 w-4" /> Pending
              {pendingCount > 0 && (
                <Badge className="ml-1 text-[10px] h-5 min-w-5 justify-center bg-amber-500/20 text-amber-500 border-amber-500/30">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <GlobalEmployeeSearch
              onSelect={handleSelect}
              onAddNew={() => setAddDialogOpen(true)}
            />
          </TabsContent>

          {/* My Submissions Tab */}
          <TabsContent value="submissions" className="space-y-6">
            {loadingSubmissions ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : mySubmissions.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-semibold">No submissions yet</p>
                <p className="text-sm text-muted-foreground">Add your first employee or candidate to the portal.</p>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2 mt-2">
                  <UserPlus className="h-4 w-4" /> Add Employee
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {mySubmissions.map((emp) => (
                  <div key={emp.id} className="relative group">
                    <GlobalEmployeeCard
                      employee={emp}
                      onClick={() => handleSelect(emp)}
                    />
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-background/90 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerifyLinkDialog({ open: true, id: emp.id, name: emp.name, link: emp.verification_link });
                          }}
                        >
                          <Link2 className="h-3 w-3 mr-1" /> Link
                        </Button>
                        {!emp.verified && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerify(emp);
                            }}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" /> Verify
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Tab */}
          <TabsContent value="pending" className="space-y-6">
            {loadingPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                </div>
                <p className="text-lg font-semibold">All caught up!</p>
                <p className="text-sm text-muted-foreground">No pending verifications at the moment.</p>
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
                          <ShieldCheck className="h-3 w-3 mr-1" /> Approve & Verify
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      <AddGlobalEmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refreshData}
      />

      {verifyLinkDialog.id && (
        <VerificationLinkDialog
          open={verifyLinkDialog.open}
          onOpenChange={(open) => setVerifyLinkDialog(prev => ({ ...prev, open }))}
          employeeId={verifyLinkDialog.id}
          employeeName={verifyLinkDialog.name}
          existingLink={verifyLinkDialog.link}
        />
      )}
    </div>
  );
}
