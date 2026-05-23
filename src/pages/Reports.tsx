import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PieChart, BarChart3, Download, Filter, Users, Calendar, ShieldAlert, Search, Eye, Clock, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';
import { toast } from 'sonner';

// Custom visual JSON diff viewer component for premium experience
function JSONDiffViewer({ before, after }: { before: any; after: any }) {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};

  // Gather union of keys
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();

  return (
    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-3 font-mono text-xs border-b border-border/50 pb-2 text-muted-foreground font-semibold">
        <div>Field</div>
        <div>Before State</div>
        <div>After State</div>
      </div>
      {allKeys.length === 0 ? (
        <div className="text-sm text-center text-muted-foreground py-6">No change data recorded.</div>
      ) : (
        allKeys.map(key => {
          const valB = b[key];
          const valA = a[key];
          const strB = valB !== undefined ? (typeof valB === 'object' ? JSON.stringify(valB) : String(valB)) : undefined;
          const strA = valA !== undefined ? (typeof valA === 'object' ? JSON.stringify(valA) : String(valA)) : undefined;

          const isAdded = strB === undefined && strA !== undefined;
          const isDeleted = strB !== undefined && strA === undefined;
          const isChanged = strB !== undefined && strA !== undefined && strB !== strA;

          if (!isAdded && !isDeleted && !isChanged) {
            return (
              <div key={key} className="grid grid-cols-3 gap-3 font-mono text-[11px] text-muted-foreground/60 py-1 hover:bg-muted/5 rounded">
                <div className="truncate font-medium">{key}</div>
                <div className="truncate">{strB}</div>
                <div className="truncate">{strA}</div>
              </div>
            );
          }

          let diffClass = '';
          if (isAdded) diffClass = 'bg-success/10 text-success border-l-2 border-success/60 px-1';
          else if (isDeleted) diffClass = 'bg-destructive/10 text-destructive line-through border-l-2 border-destructive/60 px-1';
          else if (isChanged) diffClass = 'bg-warning/10 text-warning border-l-2 border-warning/60 px-1';

          return (
            <div key={key} className={`grid grid-cols-3 gap-3 font-mono text-[11px] py-1.5 rounded transition-all ${diffClass}`}>
              <div className="truncate font-semibold">{key}</div>
              <div className="break-all">{strB !== undefined ? strB : <span className="opacity-40 italic">undefined</span>}</div>
              <div className="break-all">{strA !== undefined ? strA : <span className="opacity-40 italic">undefined</span>}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function Reports() {
  const { profile } = useAuthStore();
  
  // UI states for Audit Logs search and visualizer
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any>(null);

  // Headcount by department
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['report-departments', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').eq('company_id', profile!.company_id!);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ['report-employees', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, work_email, phone, department_id, designation_id, employment_type, status, gender, date_of_joining')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Query audit logs joined with profiles
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['audit-logs', profile?.company_id, entityFilter, actionFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*, actor:profiles(first_name, last_name, email)')
        .eq('company_id', profile!.company_id!);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }
      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59Z`);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && activeTab === 'audit-trail',
  });

  // Client-side search filters for instant responsive feedback
  const filteredAuditLogs = auditLogs.filter((log: any) => {
    const actorName = log.actor ? `${log.actor.first_name || ''} ${log.actor.last_name || ''}`.toLowerCase() : 'system';
    const email = log.actor?.email?.toLowerCase() || '';
    const action = log.action?.toLowerCase() || '';
    const entity = log.entity_type?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();

    return (
      actorName.includes(search) ||
      email.includes(search) ||
      action.includes(search) ||
      entity.includes(search)
    );
  });

  // Compute department headcount
  const deptHeadcount = departments.map((dept: any) => ({
    name: dept.name,
    count: employees.filter((e: any) => e.department_id === dept.id).length,
  })).sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...deptHeadcount.map(d => d.count), 1);

  // Employment type breakdown
  const empTypes = employees.reduce((acc: Record<string, number>, e: any) => {
    const t = e.employment_type || 'unknown';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const handleExport = () => {
    try {
      if (!employees || employees.length === 0) return;

      const headers = [
        'Employee ID', 
        'First Name', 
        'Last Name', 
        'Email', 
        'Phone', 
        'Department', 
        'Employment Type', 
        'Status', 
        'Gender',
        'Date of Joining'
      ];
      
      const csvContent = [
        headers.join(','),
        ...employees.map((emp: any) => {
          const deptName = departments.find((d: any) => d.id === emp.department_id)?.name || 'N/A';
          return [
            emp.id,
            `"${emp.first_name || ''}"`,
            `"${emp.last_name || ''}"`,
            `"${emp.work_email || ''}"`,
            `"${emp.phone || ''}"`,
            `"${deptName}"`,
            emp.employment_type || 'N/A',
            emp.status || 'N/A',
            emp.gender || 'N/A',
            emp.date_of_joining || 'N/A'
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `employees_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Core employee report exported');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export employee report');
    }
  };

  const handleExportAuditLogs = () => {
    try {
      if (filteredAuditLogs.length === 0) {
        toast.error('No audit log records to export');
        return;
      }

      const headers = [
        'Timestamp',
        'Actor Name',
        'Actor Email',
        'Action',
        'Entity Type',
        'Entity ID',
        'IP Address',
        'User Agent'
      ];
      
      const csvContent = [
        headers.join(','),
        ...filteredAuditLogs.map((log: any) => {
          const actorName = log.actor ? `${log.actor.first_name || ''} ${log.actor.last_name || ''}` : 'System';
          const actorEmail = log.actor?.email || 'N/A';
          return [
            log.created_at,
            `"${actorName}"`,
            `"${actorEmail}"`,
            `"${log.action || ''}"`,
            `"${log.entity_type || ''}"`,
            `"${log.entity_id || ''}"`,
            `"${log.ip_address || ''}"`,
            `"${(log.user_agent || '').replace(/"/g, '""')}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Audit trail logs exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const isLoading = loadingDepts || loadingEmps;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">Reports & Security Audit</h1>
          <p className="text-muted-foreground mt-1">Data visualization, exports & enterprise compliance logs</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center border-b border-border/50 pb-2">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="gap-2 rounded-lg py-2 px-3 text-sm font-medium"><BarChart3 className="h-4 w-4" /> Overview & Charts</TabsTrigger>
            <TabsTrigger value="audit-trail" className="gap-2 rounded-lg py-2 px-3 text-sm font-medium"><ShieldAlert className="h-4 w-4" /> Compliance Audit Trail</TabsTrigger>
          </TabsList>
          
          {activeTab === 'overview' ? (
            <Button className="gap-2 shadow-sm rounded-lg" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export Directory
            </Button>
          ) : (
            <Button className="gap-2 shadow-sm rounded-lg bg-info hover:bg-info/90 text-white" onClick={handleExportAuditLogs}>
              <Download className="h-4 w-4" /> Export Security Audit
            </Button>
          )}
        </div>

        {/* ── Overview & Charts Tab ── */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="glass shadow-sm border-border/40"><CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary"><Users className="h-6 w-6" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Total Headcount</p>
                <p className="text-3xl font-bold mt-0.5">{employees.length}</p>
              </div>
            </CardContent></Card>
            <Card className="glass shadow-sm border-border/40"><CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-info/10 rounded-xl text-info"><BarChart3 className="h-6 w-6" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Active Departments</p>
                <p className="text-3xl font-bold mt-0.5">{departments.length}</p>
              </div>
            </CardContent></Card>
            <Card className="glass shadow-sm border-border/40"><CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-xl text-success"><PieChart className="h-6 w-6" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Type Configurations</p>
                <p className="text-3xl font-bold mt-0.5">{Object.keys(empTypes).length}</p>
              </div>
            </CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Headcount by Department */}
            <Card className="col-span-1 lg:col-span-2 glass border-border/40 overflow-hidden shadow-sm">
              <CardHeader className="border-b border-border/30 pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Headcount by Department</CardTitle>
                  <CardDescription className="text-xs">Distribution of active employees across company divisions</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : deptHeadcount.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No department data available</p>
                  </div>
                ) : (
                  <div className="h-64 flex items-end gap-4 pt-6">
                    {deptHeadcount.slice(0, 8).map(bar => (
                      <div key={bar.name} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                        <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-muted px-1.5 py-0.5 rounded text-[10px] shadow-sm mb-1">{bar.count}</span>
                        <div
                          className="w-full max-w-[44px] bg-gradient-to-t from-primary/70 to-primary hover:from-primary hover:to-primary-hover rounded-t-lg transition-all cursor-pointer shadow-sm group-hover:shadow"
                          style={{ height: `${(bar.count / maxCount) * 100}%`, minHeight: bar.count > 0 ? '12px' : '0' }}
                        />
                        <span className="text-[10px] text-muted-foreground text-center line-clamp-1 w-full uppercase font-medium mt-1">{bar.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employment Type Breakdown */}
            <Card className="glass border-border/40 overflow-hidden shadow-sm">
              <CardHeader className="border-b border-border/30 pb-4">
                <CardTitle className="text-base font-semibold">Employment Type Breakdown</CardTitle>
                <CardDescription className="text-xs">Contractual structures overview</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : Object.keys(empTypes).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data configured</p>
                ) : (
                  <div className="space-y-6">
                    <div className="relative w-40 h-40 mx-auto rounded-full border-8 border-primary/10 flex items-center justify-center shadow-inner">
                      <div className="text-center">
                        <span className="text-3xl font-extrabold tracking-tight text-primary">{employees.length}</span>
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block mt-0.5">Total Staff</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {Object.entries(empTypes).map(([type, count]) => (
                        <div key={type} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors border border-border/10">
                          <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                          <div>
                            <span className="text-[11px] text-muted-foreground capitalize block leading-none">{type.replace('_', ' ')}</span>
                            <span className="text-sm font-bold mt-1 block leading-none">{count as number}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Compliance Audit Trail Tab ── */}
        <TabsContent value="audit-trail" className="space-y-6 mt-0">
          {/* Filters Bar */}
          <Card className="glass border-border/30 shadow-sm">
            <CardContent className="p-4 grid gap-4 md:grid-cols-5 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Search logs</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Search by actor name, email, action, entity..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 border-border/50 focus-visible:ring-primary rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Entity Type</label>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="h-9 border-border/50 rounded-lg text-xs">
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="employees">Employees</SelectItem>
                    <SelectItem value="leave_requests">Leaves</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="goals">Goals</SelectItem>
                    <SelectItem value="payroll_runs">Payroll Runs</SelectItem>
                    <SelectItem value="tickets">Support Tickets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 border-border/50 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 border-border/50 rounded-lg text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail Logs List */}
          <Card className="glass border-border/30 overflow-hidden shadow-sm">
            <CardContent className="p-0">
              {loadingAudit ? (
                <div className="p-12 text-center space-y-3">
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded" />
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No security logs matching filters</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-md">
                    Audit logs are generated automatically when records (e.g. employee details, leaves, attendance overrides) are created, updated, or deleted.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Actor</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Entity</th>
                        <th className="p-4">IP Address</th>
                        <th className="p-4 text-right">View Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredAuditLogs.map((log: any) => {
                        const actorName = log.actor ? `${log.actor.first_name || ''} ${log.actor.last_name || ''}` : 'System';
                        const actorEmail = log.actor?.email || 'N/A';
                        
                        // Action Badge styling
                        const act = (log.action || '').toLowerCase();
                        let badgeVariant: 'default' | 'outline' | 'secondary' | 'destructive' = 'outline';
                        let actColor = 'border-border text-foreground/80';
                        if (act.includes('insert') || act.includes('create')) {
                          actColor = 'border-success/30 text-success bg-success/5';
                        } else if (act.includes('update') || act.includes('edit') || act.includes('resolve') || act.includes('approve')) {
                          actColor = 'border-warning/30 text-warning bg-warning/5';
                        } else if (act.includes('delete') || act.includes('remove') || act.includes('terminate')) {
                          actColor = 'border-destructive/30 text-destructive bg-destructive/5';
                        }

                        return (
                          <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4 font-mono text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Date(log.created_at).toLocaleString()}</span>
                            </td>
                            <td className="p-4">
                              <div>
                                <span className="font-semibold text-foreground text-xs block">{actorName}</span>
                                <span className="text-[10px] text-muted-foreground block">{actorEmail}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={`text-[10px] capitalize ${actColor}`}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium text-xs">
                              <span className="capitalize">{log.entity_type?.replace('_', ' ')}</span>
                            </td>
                            <td className="p-4 font-mono text-[11px] text-muted-foreground">{log.ip_address || 'N/A'}</td>
                            <td className="p-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-primary hover:bg-primary/10"
                                onClick={() => setSelectedAuditLog(log)}
                                title="View Visual Difference"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── visual side-by-side JSON diff dialog explorer ── */}
      <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
        {selectedAuditLog && (
          <DialogContent className="max-w-3xl glass border-border/50 rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <ShieldAlert className="h-5 w-5 text-warning" /> Visual Change Tracker Explorer
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Tracked change inside <strong>{selectedAuditLog.entity_type?.replace('_', ' ')}</strong> on {new Date(selectedAuditLog.created_at).toLocaleString()} by {selectedAuditLog.actor ? `${selectedAuditLog.actor.first_name} ${selectedAuditLog.actor.last_name}` : 'System'}.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Metadata row */}
              <div className="grid grid-cols-3 gap-4 text-xs p-3 rounded-xl bg-muted/40 border border-border/10 font-medium">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Action Trigger</span>
                  <span className="font-bold text-foreground mt-0.5 block">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">User IP Address</span>
                  <span className="font-mono text-foreground mt-0.5 block">{selectedAuditLog.ip_address || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Platform Entity ID</span>
                  <span className="font-mono text-muted-foreground mt-0.5 block truncate" title={selectedAuditLog.entity_id}>{selectedAuditLog.entity_id || 'N/A'}</span>
                </div>
              </div>

              {/* visual diff container */}
              <div className="border border-border/50 rounded-xl p-3 bg-card shadow-inner">
                <JSONDiffViewer
                  before={selectedAuditLog.before_state}
                  after={selectedAuditLog.after_state}
                />
              </div>

              {/* User agent row */}
              <div className="text-[10px] text-muted-foreground font-mono truncate p-2 rounded bg-muted/20">
                User Agent: {selectedAuditLog.user_agent || 'N/A'}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-lg text-xs" onClick={() => setSelectedAuditLog(null)}>Close Tracker</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
