import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Plus, CheckCircle, XCircle, Clock, BarChart3, PieChart, FileText, Sliders, UserCheck, Minus, History, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isSafeUrl } from '@/lib/utils';

type LeaveBalanceType = Tables<'leave_balances'> & {
  leave_types: { name: string; color: string | null; code: string | null; } | null;
};

interface LeaveTiers {
  tiers: {
    manager?: { status: 'pending' | 'approved' | 'rejected'; approved_by?: string; name?: string };
    hr?: { status: 'pending' | 'approved' | 'rejected'; approved_by?: string; name?: string };
  }
}

const parseLeaveTiers = (reasonStr: string | null): LeaveTiers | null => {
  if (!reasonStr) return null;
  try {
    if (reasonStr.trim().startsWith('{')) {
      const parsed = JSON.parse(reasonStr);
      if (parsed && parsed.tiers) {
        return parsed;
      }
    }
  } catch (e) {
    // legacy text
  }
  return null;
};

const renderTiersTracker = (req: any) => {
  const tiersData = parseLeaveTiers(req.rejection_reason);
  if (!tiersData) return null;

  const managerTier = tiersData.tiers.manager;
  const hrTier = tiersData.tiers.hr;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 p-2 rounded bg-muted/30 border border-border/40 text-xs w-full">
      <span className="font-semibold text-[9px] uppercase text-muted-foreground tracking-wider shrink-0">Workflow:</span>
      <div className="flex flex-wrap items-center gap-2.5">
        {managerTier && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Manager:</span>
            <Badge 
              variant="outline" 
              className={`text-[9px] px-1.5 py-0 h-4 capitalize font-semibold ${
                managerTier.status === 'approved' 
                  ? 'border-success text-success bg-success/5' 
                  : managerTier.status === 'rejected' 
                  ? 'border-destructive text-destructive bg-destructive/5' 
                  : 'border-warning text-warning bg-warning/5 animate-pulse'
              }`}
            >
              {managerTier.status} {managerTier.name ? `(${managerTier.name})` : ''}
            </Badge>
          </div>
        )}
        {hrTier && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">HR / Admin:</span>
            <Badge 
              variant="outline" 
              className={`text-[9px] px-1.5 py-0 h-4 capitalize font-semibold ${
                hrTier.status === 'approved' 
                  ? 'border-success text-success bg-success/5' 
                  : hrTier.status === 'rejected' 
                  ? 'border-destructive text-destructive bg-destructive/5' 
                  : 'border-warning text-warning bg-warning/5 animate-pulse'
              }`}
            >
              {hrTier.status} {hrTier.name ? `(${hrTier.name})` : ''}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Leave() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin' || profile?.platform_role === 'hr_manager';

  // Administrative Leave Balance Adjustments States
  const [selectedAdjustEmp, setSelectedAdjustEmp] = useState<string>('');
  const [selectedAdjustType, setSelectedAdjustType] = useState<string>('');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Leave Ledger states
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerLeave, setLedgerLeave] = useState<any>(null);

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['admin-all-employees', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });
      return data || [];
    },
    enabled: isAdmin && !!profile?.company_id,
  });

  const { data: allLeaveTypes = [] } = useQuery({
    queryKey: ['admin-all-leave-types', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_types')
        .select('id, name')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .order('name', { ascending: true });
      return data || [];
    },
    enabled: isAdmin && !!profile?.company_id,
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ employeeId, leaveTypeId, amount, reason }: { employeeId: string; leaveTypeId: string; amount: number; reason: string }) => {
      const currentYear = new Date().getFullYear();
      
      const { data: balanceRecord, error: findError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveTypeId)
        .eq('year', currentYear)
        .maybeSingle();
        
      if (findError) throw findError;
      
      let finalTotal = amount;
      if (balanceRecord) {
        finalTotal = (balanceRecord.total_days || 0) + amount;
        if (finalTotal < 0) {
          throw new Error('Leave balance cannot be adjusted below 0.');
        }
        
        const { error: updateError } = await supabase
          .from('leave_balances')
          .update({ 
            total_days: finalTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', balanceRecord.id);
          
        if (updateError) throw updateError;
      } else {
        if (finalTotal < 0) {
          throw new Error('Leave balance cannot be adjusted below 0.');
        }
        const { error: insertError } = await supabase
          .from('leave_balances')
          .insert({
            employee_id: employeeId,
            leave_type_id: leaveTypeId,
            year: currentYear,
            total_days: finalTotal,
            used_days: 0,
            pending_days: 0
          });
          
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      setSelectedAdjustEmp('');
      setSelectedAdjustType('');
      setAdjustAmount(0);
      setAdjustReason('');
      toast.success('Leave balance adjusted successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to adjust leave balance');
    }
  });

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, company_id, reporting_manager_id, first_name, last_name')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: leaveBalances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['leave-balances', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name, color, code)')
        .eq('employee_id', employee!.id)
        .eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Auto-initialize mutation for missing leave balances
  const initBalancesMutation = useMutation({
    mutationFn: async (empId: string) => {
      const { error } = await supabase.rpc('initialize_employee_leave_balances', { emp_id: empId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    }
  });

  useEffect(() => {
    if (!loadingBalances && leaveBalances.length === 0 && employee?.id) {
      initBalancesMutation.mutate(employee.id);
    }
  }, [loadingBalances, leaveBalances.length, employee?.id]);

  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  const { data: directReports = [] } = useQuery({
    queryKey: ['direct-reports', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('reporting_manager_id', employee.id)
        .is('deleted_at', null);
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const isManager = directReports.length > 0;
  const reporteeIds = directReports.map(r => r.id);

  const { data: reporteeLeaves = [], isLoading: loadingReporteeLeaves } = useQuery({
    queryKey: ['reportee-leave-requests', employee?.id, reporteeIds],
    queryFn: async () => {
      if (reporteeIds.length === 0) return [];
      const { data } = await supabase
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(first_name, last_name, reporting_manager_id), leave_types(name)')
        .in('employee_id', reporteeIds)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: reporteeIds.length > 0,
  });

  const { data: leaveRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['leave-requests', profile?.platform_role, employee?.id, profile?.company_id],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(first_name, last_name, reporting_manager_id), leave_types(name)')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!isAdmin && employee?.id) {
        query = query.eq('employee_id', employee.id);
      } else if (isAdmin && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!profile,
  });

  const ledgerItems = useMemo(() => {
    if (!ledgerLeave) return [];
    
    const items = [];
    
    // 1. Initial allotment
    items.push({
      date: new Date(ledgerLeave.created_at).toISOString().split('T')[0],
      timestamp: new Date(ledgerLeave.created_at).getTime(),
      description: 'Annual Leave Allotment (Prorated Initial Quota)',
      type: 'addition',
      amount: parseFloat(ledgerLeave.total_days || 0)
    });
    
    // 2. Filter approved requests matching this type
    const matchingRequests = leaveRequests.filter((r: any) => 
      r.leave_type_id === ledgerLeave.leave_type_id && 
      r.status === 'approved' &&
      r.employee_id === employee?.id
    );
    
    matchingRequests.forEach((req: any) => {
      items.push({
        date: req.start_date,
        timestamp: new Date(req.start_date).getTime(),
        description: `Approved Leave: ${req.start_date} to ${req.end_date} ("${req.reason || 'No reason provided'}")`,
        type: 'deduction',
        amount: parseFloat(req.total_days || 0)
      });
    });
    
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [ledgerLeave, leaveRequests, employee?.id]);

  const actionMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: 'approved' | 'rejected'; comment?: string }) => {
      const { data: req, error: fetchErr } = await supabase
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(reporting_manager_id)')
        .eq('id', id)
        .single();
      
      if (fetchErr) throw fetchErr;

      const empRepManagerId = (req.employees as any)?.reporting_manager_id;
      const tiersData = parseLeaveTiers(req.rejection_reason);

      let updatedStatus = req.status;
      let updatedReason = req.rejection_reason;

      const userName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim();

      const isApprovingAsManager = employee?.id === empRepManagerId;
      const isApprovingAsHR = isAdmin;

      if (status === 'rejected') {
        updatedStatus = 'rejected';
        if (tiersData) {
          if (isApprovingAsManager && tiersData.tiers.manager) {
            tiersData.tiers.manager.status = 'rejected';
            tiersData.tiers.manager.approved_by = employee?.id;
            tiersData.tiers.manager.name = userName;
          }
          if (isApprovingAsHR && tiersData.tiers.hr) {
            tiersData.tiers.hr.status = 'rejected';
            tiersData.tiers.hr.approved_by = employee?.id;
            tiersData.tiers.hr.name = userName;
          }
          updatedReason = JSON.stringify(tiersData);
        } else {
          updatedReason = comment || 'Rejected';
        }
      } else {
        if (tiersData) {
          if (isApprovingAsManager && tiersData.tiers.manager) {
            tiersData.tiers.manager.status = 'approved';
            tiersData.tiers.manager.approved_by = employee?.id;
            tiersData.tiers.manager.name = userName;
          }
          if (isApprovingAsHR && tiersData.tiers.hr) {
            tiersData.tiers.hr.status = 'approved';
            tiersData.tiers.hr.approved_by = employee?.id;
            tiersData.tiers.hr.name = userName;
          }

          const managerApproved = !tiersData.tiers.manager || tiersData.tiers.manager.status === 'approved';
          const hrApproved = !tiersData.tiers.hr || tiersData.tiers.hr.status === 'approved';

          if (managerApproved && hrApproved) {
            updatedStatus = 'approved';
          } else {
            updatedStatus = 'pending';
          }
          updatedReason = JSON.stringify(tiersData);
        } else {
          updatedStatus = 'approved';
          updatedReason = comment || null;
        }
      }

      const { error } = await supabase.from('leave_requests').update({
        status: updatedStatus,
        approved_by: employee?.id,
        rejection_reason: updatedReason,
      }).eq('id', id);

      if (error) throw error;

      // Real-time Notification Dispatch (Phase 5)
      try {
        const { data: leaveReq } = await supabase
          .from('leave_requests')
          .select('*, employees(user_id)')
          .eq('id', id)
          .single();

        const targetUserId = (leaveReq?.employees as any)?.user_id;
        if (targetUserId) {
          await supabase.from('notifications').insert({
            company_id: leaveReq.company_id,
            user_id: targetUserId,
            type: 'leave_status',
            title: `Leave Request ${updatedStatus.charAt(0).toUpperCase() + updatedStatus.slice(1)}`,
            message: `Your leave request from ${leaveReq.start_date} to ${leaveReq.end_date} has been ${updatedStatus}.`,
            link: '/leave'
          });
        }
      } catch (notifErr) {
        console.error("Error creating leave resolution notification:", notifErr);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['reportee-leave-requests'] });
      toast.success(`Action processed successfully`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

  const [cancelDialogRequestId, setCancelDialogRequestId] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['reportee-leave-requests'] });
      toast.success('Leave request cancelled successfully');
      setCancelDialogRequestId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel leave request');
    }
  });


  // ⚡ Bolt: Calculate leave analytics in a single pass instead of multiple inline filter loops
  const leaveStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;

    // ⚡ Bolt: Calculate stats in a single O(N) pass
    const typeCounts: Record<string, number> = {};
    const empCounts: Record<string, { name: string; days: number }> = {};

    for (const r of leaveRequests) {
      if (r.status === 'approved') {
        approved++;

        // Count for top takers (only approved)
        const key = r.employee_id;
        const name = r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : 'Unknown';
        if (!empCounts[key]) empCounts[key] = { name, days: 0 };
        empCounts[key].days += r.total_days || 0;
      }
      else if (r.status === 'pending') pending++;
      else if (r.status === 'rejected') rejected++;

      // Count types (all requests)
      const typeName = r.leave_types?.name || 'Other';
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    }

    const typeDistribution = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: leaveRequests.length > 0 ? Math.round((count / leaveRequests.length) * 100) : 0
      }));

    const topTakers = Object.values(empCounts)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);

    return { approved, pending, rejected, typeDistribution, topTakers };
  }, [leaveRequests]);

  const pendingReporteeCount = useMemo(() => {
    let count = 0;
    for (const r of reporteeLeaves) {
      if (r.status === 'pending') {
        count++;
      }
    }
    return count;
  }, [reporteeLeaves]);

  const statusStyle: Record<string, { class: string; Icon: any }> = {
    approved: { class: 'border-success text-success bg-success/10', Icon: CheckCircle },
    rejected: { class: 'border-destructive text-destructive bg-destructive/10', Icon: XCircle },
    pending: { class: 'border-warning text-warning bg-warning/10', Icon: Clock },
    cancelled: { class: 'border-muted text-muted-foreground', Icon: XCircle },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground mt-1">Time-off requests & balances</p>
        </div>
        <Button onClick={() => navigate('/leave/apply')} className="gap-2">
          <Plus className="h-4 w-4" /> Apply Leave
        </Button>
      </div>

      {/* Leave Balances */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingBalances ? (
          [1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : leaveBalances.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-4">
            <CardContent className="flex flex-col items-center gap-2 py-8">
              <Calendar className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No leave balances configured yet</p>
            </CardContent>
          </Card>
        ) : (
          leaveBalances.map((lb: LeaveBalanceType) => {
            const remaining = (lb.total_days || 0) - (lb.used_days || 0) - (lb.pending_days || 0);
            const color = lb.leave_types?.color || '#4F46E5';
            return (
              <Card key={lb.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all hover:shadow-md relative group">
                {/* Visual Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: color }} />
                <CardContent className="p-5 pt-7">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider line-clamp-1">{lb.leave_types?.name || 'Leave'}</h3>
                    <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: color, borderColor: `${color}30`, backgroundColor: `${color}10` }}>
                      {lb.leave_types?.code || 'LV'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-extrabold text-foreground tabular-nums">{remaining}</span>
                    <span className="text-xs text-muted-foreground">days left</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/10 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-medium">Used</p>
                      <p className="font-semibold text-foreground mt-0.5 tabular-nums">{lb.used_days || 0}d</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-medium text-amber-500">Pending</p>
                      <p className="font-semibold text-amber-500 mt-0.5 tabular-nums">{lb.pending_days || 0}d</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-2 text-primary hover:bg-primary/10 gap-1 flex items-center font-bold"
                      onClick={() => {
                        setLedgerLeave(lb);
                        setLedgerOpen(true);
                      }}
                    >
                      <History className="w-3 h-3" /> View Ledger
                    </Button>
                    <span className="text-[10px] text-muted-foreground font-mono">Year: {lb.year}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Tab Switcher if Manager */}
      {isManager && (
        <div className="flex border-b border-border/20 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all relative ${
              activeTab === 'my' 
                ? 'border-primary text-primary font-bold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My Time-Off
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 relative ${
              activeTab === 'team' 
                ? 'border-primary text-primary font-bold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Team Requests
            {pendingReporteeCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 min-w-4 justify-center text-[9px] animate-pulse">
                {pendingReporteeCount}
              </Badge>
            )}
          </button>
        </div>
      )}

      {/* Requests Section */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> 
            {activeTab === 'team' ? 'Direct Reports Requests' : 'Recent Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === 'team' ? (
            loadingReporteeLeaves ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : reporteeLeaves.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No leave requests from direct reports</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reporteeLeaves.map((req: any) => {
                  const s = statusStyle[req.status] || statusStyle.pending;
                  const tiersData = parseLeaveTiers(req.rejection_reason);
                  const isManagerPending = !tiersData || tiersData?.tiers?.manager?.status === 'pending';
                  
                  return (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background/40 border border-border/50 gap-4">
                      <div className="flex items-start sm:items-center gap-4 flex-1">
                        <div className={`p-3 rounded-full bg-background ${s.class.includes('success') ? 'text-success' : s.class.includes('destructive') ? 'text-destructive' : 'text-warning'} border border-current flex-shrink-0 mt-1 sm:mt-0`}>
                          <s.Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-primary text-sm sm:text-base">
                            {req.leave_types?.name || 'Leave'}
                            {req.employees && (
                              <span className="text-muted-foreground font-normal text-xs sm:text-sm ml-2">
                                — {req.employees.first_name} {req.employees.last_name}
                              </span>
                            )}
                          </h4>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{req.start_date} — {req.end_date} &bull; {req.total_days} Day{(req.total_days || 0) > 1 ? 's' : ''}</p>
                          {req.reason && <p className="text-xs text-muted-foreground/70 mt-1 italic">"{req.reason}"</p>}
                          {req.document_url && isSafeUrl(req.document_url) && (
                            <div className="mt-1.5">
                              <a 
                                href={req.document_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 w-fit bg-primary/5 px-2 py-0.5 rounded border border-primary/20"
                              >
                                <FileText className="w-3 h-3" /> View Supporting Document
                              </a>
                            </div>
                          )}
                          {renderTiersTracker(req)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-3 sm:pt-0 sm:border-none">
                        {req.status === 'pending' && isManagerPending && (
                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-success text-success hover:bg-success/10 h-8 text-xs px-2.5"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({
                                id: req.id,
                                status: 'approved',
                              })}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10 h-8 text-xs px-2.5"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({
                                id: req.id,
                                status: 'rejected',
                              })}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${s.class}`}>
                          {req.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            loadingRequests ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : leaveRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No leave requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map((req: any) => {
                  const s = statusStyle[req.status] || statusStyle.pending;
                  const tiersData = parseLeaveTiers(req.rejection_reason);
                  const isHRPending = !tiersData || tiersData?.tiers?.hr?.status === 'pending';

                  return (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background/40 border border-border/50 gap-4">
                      <div className="flex items-start sm:items-center gap-4 flex-1">
                        <div className={`p-3 rounded-full bg-background ${s.class.includes('success') ? 'text-success' : s.class.includes('destructive') ? 'text-destructive' : 'text-warning'} border border-current flex-shrink-0 mt-1 sm:mt-0`}>
                          <s.Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-primary text-sm sm:text-base">
                            {req.leave_types?.name || 'Leave'}
                            {req.employees && <span className="text-muted-foreground font-normal text-xs sm:text-sm ml-2">— {req.employees.first_name} {req.employees.last_name}</span>}
                          </h4>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{req.start_date} — {req.end_date} &bull; {req.total_days} Day{(req.total_days || 0) > 1 ? 's' : ''}</p>
                          {req.reason && <p className="text-xs text-muted-foreground/70 mt-1 italic">"{req.reason}"</p>}
                          {req.document_url && isSafeUrl(req.document_url) && (
                            <div className="mt-1.5">
                              <a 
                                href={req.document_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 w-fit bg-primary/5 px-2 py-0.5 rounded border border-primary/20"
                              >
                                <FileText className="w-3 h-3" /> View Supporting Document
                              </a>
                            </div>
                          )}
                          {renderTiersTracker(req)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-3 sm:pt-0 sm:border-none">
                        {isAdmin && req.status === 'pending' && isHRPending && (
                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-success text-success hover:bg-success/10 h-8 text-xs px-2.5"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({
                                id: req.id,
                                status: 'approved',
                              })}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10 h-8 text-xs px-2.5"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({
                                id: req.id,
                                status: 'rejected',
                              })}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {req.status === 'pending' && req.employee_id === employee?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10 h-8 text-xs px-2.5"
                            disabled={cancelMutation.isPending}
                            onClick={() => setCancelDialogRequestId(req.id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                          </Button>
                        )}
                        <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${s.class}`}>
                          {req.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Leave Analytics & Adjustments — Admin/HR only */}
      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Column 1: Leave Analytics */}
          <Card className="lg:col-span-7">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" /> Leave Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No leave data to analyze</p>
              ) : (
                <div className="space-y-6">
                  {/* Leave Type Distribution */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-1"><PieChart className="w-3.5 h-3.5" /> By Leave Type</h4>
                    <div className="space-y-2">
                      {leaveStats.typeDistribution.map((item, i) => {
                        const colors = ['bg-primary', 'bg-info', 'bg-warning', 'bg-success', 'bg-destructive'];
                        return (
                          <div key={item.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{item.name}</span>
                              <span className="text-muted-foreground">{item.count} ({item.pct}%)</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted/30">
                              <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${item.pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">By Status</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Approved', count: leaveStats.approved, color: 'text-success bg-success/10 border-success/30' },
                        { label: 'Pending', count: leaveStats.pending, color: 'text-warning bg-warning/10 border-warning/30' },
                        { label: 'Rejected', count: leaveStats.rejected, color: 'text-destructive bg-destructive/10 border-destructive/30' },
                      ].map(item => (
                        <div key={item.label} className={`text-center p-3 rounded border ${item.color}`}>
                          <p className="text-xs">{item.label}</p>
                          <p className="text-xl font-bold">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Leave Takers */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Top Leave Takers</h4>
                    <div className="space-y-2">
                      {leaveStats.topTakers.map((emp, i) => (
                        <div key={i} className="flex items-center justify-between text-sm p-2 rounded border border-border/50 bg-background/50">
                          <span>{emp.name}</span>
                          <Badge variant="outline">{emp.days} days</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 2: Adjust Leave Balances Console */}
          <Card className="lg:col-span-5 border border-border shadow-lg overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sliders className="w-4 h-4 text-primary" /> Adjust Leave Balances
              </CardTitle>
              <CardDescription className="text-xs">
                Manually credit or deduct leaves for any employee's balance pool.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adjustEmployee" className="text-xs font-semibold text-muted-foreground uppercase">Select Employee</Label>
                <Select value={selectedAdjustEmp} onValueChange={setSelectedAdjustEmp}>
                  <SelectTrigger id="adjustEmployee" className="h-9 text-xs">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustLeaveType" className="text-xs font-semibold text-muted-foreground uppercase">Leave Category</Label>
                <Select value={selectedAdjustType} onValueChange={setSelectedAdjustType}>
                  <SelectTrigger id="adjustLeaveType" className="h-9 text-xs">
                    <SelectValue placeholder="Choose type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allLeaveTypes.map((lt: any) => (
                      <SelectItem key={lt.id} value={lt.id} className="text-xs">
                        {lt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Adjustment Amount (Days)</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 border-border/60 hover:bg-destructive/10 hover:text-destructive shrink-0 transition-colors"
                    onClick={() => setAdjustAmount(prev => prev - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input 
                    type="number" 
                    step="0.5" 
                    className="h-9 text-center font-bold text-sm" 
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 border-border/60 hover:bg-success/10 hover:text-success shrink-0 transition-colors"
                    onClick={() => setAdjustAmount(prev => prev + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Use negative values (e.g. <span className="font-semibold text-destructive">-2.0</span>) to deduct, positive to credit.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustReason" className="text-xs font-semibold text-muted-foreground uppercase">Adjustment Reason</Label>
                <Input 
                  id="adjustReason" 
                  placeholder="e.g. Compensatory Off for weekend work" 
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <Button
                type="button"
                className="w-full h-9 text-xs font-semibold mt-2"
                disabled={!selectedAdjustEmp || !selectedAdjustType || adjustAmount === 0 || !adjustReason.trim() || adjustBalanceMutation.isPending}
                onClick={() => adjustBalanceMutation.mutate({
                  employeeId: selectedAdjustEmp,
                  leaveTypeId: selectedAdjustType,
                  amount: adjustAmount,
                  reason: adjustReason
                })}
              >
                {adjustBalanceMutation.isPending ? 'Applying...' : 'Apply Administrative Correction'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!cancelDialogRequestId} onOpenChange={(open) => !open && setCancelDialogRequestId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 animate-bounce" /> Cancel Leave Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this pending leave request? This action will restore your leave balances immediately and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogRequestId(null)}>Keep Request</Button>
            <Button 
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (cancelDialogRequestId) {
                  cancelMutation.mutate(cancelDialogRequestId);
                }
              }}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Balance Ledger Dialog */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <History className="h-5 w-5" /> Leave Balance Ledger
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Detailed audit trail of additions and deductions for <strong>{ledgerLeave?.leave_types?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[50vh] overflow-y-auto space-y-3 pr-1">
            {ledgerItems.map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-start p-3 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/10 transition-colors">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-mono">{item.date}</span>
                  <p className="text-xs font-semibold text-foreground leading-snug">{item.description}</p>
                </div>
                <div className={`text-sm font-extrabold tabular-nums shrink-0 ml-3 ${item.type === 'addition' ? 'text-success' : 'text-destructive'}`}>
                  {item.type === 'addition' ? `+${item.amount}` : `-${item.amount}`}
                </div>
              </div>
            ))}
            {ledgerItems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No ledger entries found.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="w-full h-9 font-semibold" onClick={() => setLedgerOpen(false)}>
              Close Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
