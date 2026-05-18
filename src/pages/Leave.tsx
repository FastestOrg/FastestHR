import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Plus, CheckCircle, XCircle, Clock, BarChart3, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

export default function Leave() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin' || profile?.platform_role === 'hr_manager';

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, company_id')
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
        .select('*, leave_types(name, color)')
        .eq('employee_id', employee!.id)
        .eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const { data: leaveRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['leave-requests', profile?.platform_role, employee?.id, profile?.company_id],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(first_name, last_name), leave_types(name)')
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

  const actionMutation = useMutation({
    mutationFn: async ({ id, status, employeeId, totalDays, leaveTypeId }: { id: string; status: 'approved' | 'rejected'; employeeId: string; totalDays: number; leaveTypeId: string }) => {
      const { error } = await supabase.from('leave_requests').update({
        status: status as any,
        approved_by: employee?.id,
      }).eq('id', id);
      if (error) throw error;

      // If approved, update leave balance
      if (status === 'approved') {
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('id, used_days')
          .eq('employee_id', employeeId)
          .eq('leave_type_id', leaveTypeId)
          .eq('year', new Date().getFullYear())
          .maybeSingle();

        if (balance) {
          await supabase.from('leave_balances').update({
            used_days: (balance.used_days || 0) + totalDays,
          }).eq('id', balance.id);
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      toast.success(`Leave request ${vars.status}`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

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
          leaveBalances.map((lb: any) => {
            const remaining = (lb.total_days || 0) - (lb.used_days || 0);
            return (
              <Card key={lb.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-sm text-muted-foreground mb-4 uppercase">{lb.leave_types?.name || 'Leave'}</h3>
                  <div className="flex items-end justify-between">
                    <div className="text-4xl font-bold text-primary">{remaining}</div>
                    <div className="text-sm text-muted-foreground pb-1">/ {lb.total_days || 0} remaining</div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Recent Requests */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Recent Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
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
                return (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background/40 border border-border/50 gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className={`p-3 rounded-full bg-background ${s.class.includes('success') ? 'text-success' : s.class.includes('destructive') ? 'text-destructive' : 'text-warning'} border border-current flex-shrink-0 mt-1 sm:mt-0`}>
                        <s.Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-primary text-sm sm:text-base">
                          {req.leave_types?.name || 'Leave'}
                          {req.employees && <span className="text-muted-foreground font-normal text-xs sm:text-sm ml-2">— {req.employees.first_name} {req.employees.last_name}</span>}
                        </h4>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{req.start_date} — {req.end_date} &bull; {req.total_days} Day{(req.total_days || 0) > 1 ? 's' : ''}</p>
                        {req.reason && <p className="text-xs text-muted-foreground/70 mt-1 italic">"{req.reason}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-3 sm:pt-0 sm:border-none">
                      {isAdmin && req.status === 'pending' && (
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-success text-success hover:bg-success/10 h-8 text-xs px-2.5"
                            disabled={actionMutation.isPending}
                            onClick={() => actionMutation.mutate({
                              id: req.id,
                              status: 'approved',
                              employeeId: req.employee_id,
                              totalDays: req.total_days || 0,
                              leaveTypeId: req.leave_type_id,
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
                              employeeId: req.employee_id,
                              totalDays: req.total_days || 0,
                              leaveTypeId: req.leave_type_id,
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
          )}
        </CardContent>
      </Card>

      {/* Leave Analytics — Admin/HR only */}
      {isAdmin && (
        <Card>
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
                    {(() => {
                      const typeCounts: Record<string, number> = {};
                      leaveRequests.forEach((r: any) => {
                        const name = r.leave_types?.name || 'Other';
                        typeCounts[name] = (typeCounts[name] || 0) + 1;
                      });
                      const total = leaveRequests.length;
                      const colors = ['bg-primary', 'bg-info', 'bg-warning', 'bg-success', 'bg-destructive'];
                      return Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([name, count], i) => {
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{name}</span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted/30">
                              <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-3">By Status</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Approved', count: leaveRequests.filter((r: any) => r.status === 'approved').length, color: 'text-success bg-success/10 border-success/30' },
                      { label: 'Pending', count: leaveRequests.filter((r: any) => r.status === 'pending').length, color: 'text-warning bg-warning/10 border-warning/30' },
                      { label: 'Rejected', count: leaveRequests.filter((r: any) => r.status === 'rejected').length, color: 'text-destructive bg-destructive/10 border-destructive/30' },
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
                    {(() => {
                      const empCounts: Record<string, { name: string; days: number }> = {};
                      leaveRequests.filter((r: any) => r.status === 'approved').forEach((r: any) => {
                        const key = r.employee_id;
                        const name = r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : 'Unknown';
                        if (!empCounts[key]) empCounts[key] = { name, days: 0 };
                        empCounts[key].days += r.total_days || 0;
                      });
                      return Object.values(empCounts).sort((a, b) => b.days - a.days).slice(0, 5).map((emp, i) => (
                        <div key={i} className="flex items-center justify-between text-sm p-2 rounded border border-border/50 bg-background/50">
                          <span>{emp.name}</span>
                          <Badge variant="outline">{emp.days} days</Badge>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
