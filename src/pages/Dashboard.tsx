import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Clock, CalendarDays, Briefcase, DollarSign, UserPlus,
  Megaphone, TrendingUp, ArrowRight, BarChart3, PieChart, Cake, PartyPopper, TrendingDown, MessageSquare, Bot, Sparkles, BrainCircuit
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

function MetricCard({ title, value, icon: Icon, trend, color }: {
  title: string; value: string | number; icon: any; trend?: string; color: string;
}) {
  return (
    <Card className="relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            {trend && <p className="mt-1 text-xs text-success">{trend}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border/50 ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyAdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const thisYear = new Date().getFullYear();

  // ⚡ Bolt: Use a single-pass iteration to calculate multiple derived statistics instead of multiple filter/forEach passes over allEmployees
  const { data: employeeData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employee-metrics', profile?.company_id, thisYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, date_of_birth, date_of_joining, avatar_url, deleted_at, departments(name)')
        .eq('company_id', profile!.company_id!);

      const allEmployees = data || [];

      let employeeCount = 0;
      let attritionCount = 0;
      let thisYearHiresCount = 0;
      const deptMap: Record<string, number> = {};
      const monthlyHires: Record<number, number> = {};
      const upcomingBdays: any[] = [];
      const upcomingAnnis: any[] = [];

      const now = new Date();
      const currentYear = now.getFullYear();

      for (let i = 0; i < allEmployees.length; i++) {
        const e = allEmployees[i];

        if (e.deleted_at !== null) {
          if (new Date(e.deleted_at).getFullYear() === thisYear) {
            attritionCount++;
          }
          continue;
        }

        employeeCount++;

        // Department Stats
        const n = e.departments?.name || 'Unassigned';
        deptMap[n] = (deptMap[n] || 0) + 1;

        // Hiring Stats
        if (e.date_of_joining) {
          const doj = new Date(e.date_of_joining);
          if (doj.getFullYear() === thisYear) {
            thisYearHiresCount++;
            const m = doj.getMonth();
            monthlyHires[m] = (monthlyHires[m] || 0) + 1;
          }

          // Anniversaries
          const anni = new Date(currentYear, doj.getMonth(), doj.getDate());
          const diffAnni = (anni.getTime() - now.getTime()) / (1000*60*60*24);
          if (diffAnni >= 0 && diffAnni <= 30 && currentYear > doj.getFullYear()) {
            upcomingAnnis.push(e);
          }
        }

        // Birthdays
        if (e.date_of_birth) {
          const dob = new Date(e.date_of_birth);
          const bday = new Date(currentYear, dob.getMonth(), dob.getDate());
          const diffBday = (bday.getTime() - now.getTime()) / (1000*60*60*24);
          if (diffBday >= 0 && diffBday <= 30) {
            upcomingBdays.push(e);
          }
        }
      }

      const departmentStats = Object.entries(deptMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const hiringStats = { total: thisYearHiresCount, monthly: monthlyHires };

      upcomingBdays.sort((a: any, b: any) => {
        const da = new Date(a.date_of_birth), db = new Date(b.date_of_birth);
        return new Date(currentYear, da.getMonth(), da.getDate()).getTime() - new Date(currentYear, db.getMonth(), db.getDate()).getTime();
      }).splice(5);

      upcomingAnnis.sort((a: any, b: any) => {
        const da = new Date(a.date_of_joining), db = new Date(b.date_of_joining);
        return new Date(currentYear, da.getMonth(), da.getDate()).getTime() - new Date(currentYear, db.getMonth(), db.getDate()).getTime();
      }).splice(5);

      const celebrations = { birthdays: upcomingBdays, anniversaries: upcomingAnnis };

      return {
        employeeCount,
        departmentStats,
        hiringStats,
        attritionCount,
        celebrations
      };
    },
    enabled: !!profile?.company_id,
  });

  const employeeCount = employeeData?.employeeCount || 0;
  const departmentStats = employeeData?.departmentStats || [];
  const hiringStats = employeeData?.hiringStats || { total: 0, monthly: {} };
  const attritionCount = employeeData?.attritionCount || 0;
  const celebrations = employeeData?.celebrations || { birthdays: [], anniversaries: [] };

  const { data: leaveRequests = [], isLoading: loadingLeave } = useQuery({
    queryKey: ['pending-leaves', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*, employees!leave_requests_employee_id_fkey(first_name, last_name)')
        .eq('company_id', profile!.company_id!)
        .eq('status', 'pending')
        .limit(5);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: openJobs = 0 } = useQuery({
    queryKey: ['open-jobs', profile?.company_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile!.company_id!)
        .eq('status', 'open');
      return count || 0;
    },
    enabled: !!profile?.company_id,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['recent-announcements', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: payrollSummary } = useQuery({
    queryKey: ['payroll-summary', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payroll_runs')
        .select('total_gross, total_net, total_deductions, period_end')
        .eq('company_id', profile!.company_id!)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const { data: aiRecruitmentStats, isLoading: loadingAI } = useQuery({
    queryKey: ['ai-recruitment-stats', profile?.company_id],
    queryFn: async () => {
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, full_name, ai_interview_result')
        .eq('company_id', profile!.company_id!)
        .not('ai_interview_result', 'is', null);

      const interviewedCount = candidates?.length || 0;
      const avgScore = interviewedCount > 0 
        ? (candidates!.reduce((acc, curr) => acc + ((curr.ai_interview_result as any)?.ai_score || 0), 0) / interviewedCount).toFixed(1)
        : '0.0';
      
      const topCandidates = [...(candidates || [])]
        .sort((a, b) => ((b.ai_interview_result as any)?.ai_score || 0) - ((a.ai_interview_result as any)?.ai_score || 0))
        .slice(0, 3);

      return { interviewedCount, avgScore, topCandidates };
    },
    enabled: !!profile?.company_id,
  });

  const attritionRate = employeeCount > 0 ? (attritionCount / (employeeCount + attritionCount) * 100).toFixed(1) : '0.0';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Employees" value={loadingEmployees ? '...' : employeeCount} icon={Users} color="bg-primary/10 text-primary" />
        <MetricCard title="Pending Leaves" value={leaveRequests.length} icon={CalendarDays} color="bg-warning/10 text-warning" />
        <MetricCard title="Open Positions" value={openJobs} icon={Briefcase} color="bg-info/10 text-info" />
        <MetricCard title="Announcements" value={announcements.length} icon={Megaphone} color="bg-success/10 text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Leave Requests */}
        <Card className="lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4 relative z-10">
            <CardTitle>Pending Leave Requests</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leave')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingLeave ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No pending leave requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3 hover:border-border/50 hover:bg-muted/30 transition-all cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {req.employees?.first_name} {req.employees?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.start_date} — {req.end_date} · {req.total_days} days
                      </p>
                    </div>
                    <Badge variant="outline" className="border-warning text-warning">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/employees/new')}>
              <UserPlus className="h-4 w-4" /> Add Employee
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/payroll')}>
              <DollarSign className="h-4 w-4" /> Run Payroll
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/recruitment')}>
              <Briefcase className="h-4 w-4" /> Post a Job
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/announcements')}>
              <Megaphone className="h-4 w-4" /> Send Announcement
            </Button>
          </CardContent>
        </Card>

        {/* AI Recruitment Insights */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="border-b border-primary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" /> AI Recruitment Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-background border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Interviews</p>
                <p className="text-xl font-bold">{aiRecruitmentStats?.interviewedCount || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg. AI Score</p>
                <p className="text-xl font-bold text-primary">{aiRecruitmentStats?.avgScore || '0.0'}<span className="text-xs text-muted-foreground">/10</span></p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Bot className="h-3 w-3 text-primary" /> Top AI-Ranked
              </p>
              {loadingAI ? (
                <Skeleton className="h-20 w-full" />
              ) : aiRecruitmentStats?.topCandidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No AI data available yet.</p>
              ) : (
                aiRecruitmentStats?.topCandidates.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                    <span className="text-xs font-medium truncate max-w-[100px]">{c.full_name}</span>
                    <Badge variant="secondary" className="h-5 text-[10px] bg-primary/10 text-primary border-none">
                      {c.ai_interview_result?.ai_score}/10
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <Button 
              variant="link" 
              className="w-full text-xs text-primary h-auto p-0" 
              onClick={() => navigate('/recruitment')}
            >
              View Detailed AI Reports
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Announcements */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((a: any) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{a.title}</p>
                  {a.is_pinned && <Badge>Pinned</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department Distribution */}
        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="w-4 h-4" /> Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {departmentStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No department data</p>
            ) : (
              <div className="space-y-3">
                {departmentStats.map((dept: any, i: number) => {
                  const colors = ['bg-primary', 'bg-info', 'bg-warning', 'bg-success', 'bg-destructive'];
                  const pct = employeeCount > 0 ? Math.round((dept.count / (employeeCount as number)) * 100) : 0;
                  return (
                    <div key={dept.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{dept.name}</span>
                        <span className="text-muted-foreground">{dept.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/30">
                        <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payroll Cost Summary */}
        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> Payroll Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!payrollSummary ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No payroll data yet</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/payroll')}>Run Payroll</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Latest cycle ending {payrollSummary.period_end}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="text-lg font-bold text-primary">${((payrollSummary.total_gross || 0) / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="text-center p-3 rounded bg-destructive/5 border border-destructive/20">
                    <p className="text-xs text-muted-foreground">Deductions</p>
                    <p className="text-lg font-bold text-destructive">${((payrollSummary.total_deductions || 0) / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="text-center p-3 rounded bg-success/5 border border-success/20">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="text-lg font-bold text-success">${((payrollSummary.total_net || 0) / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hiring Stats & Attrition */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" /> Hiring Trend ({thisYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-end gap-1 h-32">
              {months.map((m, i) => {
                const count = hiringStats?.monthly?.[i] || 0;
                const maxCount = Math.max(...Object.values(hiringStats?.monthly || { 0: 1 }), 1);
                const pct = Math.max(4, (count / maxCount) * 100);
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{count || ''}</span>
                    <div className="w-full rounded-t bg-primary/20 hover:bg-primary/40 transition-colors" style={{ height: `${pct}%` }} />
                    <span className="text-[9px] text-muted-foreground">{m}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Total hires this year</span>
              <span className="font-bold text-primary">{hiringStats?.total || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">Workforce</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="text-center p-4 rounded bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Headcount</p>
              <p className="text-3xl font-bold text-primary">{employeeCount}</p>
            </div>
            <div className="text-center p-4 rounded bg-destructive/5 border border-destructive/20">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" /> Attrition Rate</p>
              <p className="text-3xl font-bold text-destructive">{attritionRate}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{attritionCount} exits this year</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Birthdays & Anniversaries */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><Cake className="w-4 h-4" /> Upcoming Birthdays</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {celebrations.birthdays.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6"><Cake className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No upcoming birthdays</p></div>
            ) : (
              <div className="space-y-2">
                {celebrations.birthdays.map((emp: any) => {
                  const dob = new Date(emp.date_of_birth);
                  const now2 = new Date();
                  const bday = new Date(now2.getFullYear(), dob.getMonth(), dob.getDate());
                  const daysUntil = Math.ceil((bday.getTime() - now2.getTime()) / (1000*60*60*24));
                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded bg-background/50 border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success"><Cake className="w-4 h-4" /></div>
                      <div className="flex-1"><p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p><p className="text-xs text-muted-foreground">{dob.toLocaleDateString('en-US', {month:'short',day:'numeric'})}</p></div>
                      <Badge variant="outline" className={`text-[10px] ${daysUntil === 0 ? 'border-success text-success bg-success/10' : ''}`}>{daysUntil === 0 ? 'Today! 🎉' : `${daysUntil}d`}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><PartyPopper className="w-4 h-4" /> Work Anniversaries</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {celebrations.anniversaries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6"><PartyPopper className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No upcoming anniversaries</p></div>
            ) : (
              <div className="space-y-2">
                {celebrations.anniversaries.map((emp: any) => {
                  const doj = new Date(emp.date_of_joining);
                  const now2 = new Date();
                  const anni = new Date(now2.getFullYear(), doj.getMonth(), doj.getDate());
                  const daysUntil = Math.ceil((anni.getTime() - now2.getTime()) / (1000*60*60*24));
                  const years = now2.getFullYear() - doj.getFullYear();
                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded bg-background/50 border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><PartyPopper className="w-4 h-4" /></div>
                      <div className="flex-1"><p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p><p className="text-xs text-muted-foreground">{years} year{years > 1 ? 's' : ''} · {doj.toLocaleDateString('en-US', {month:'short',day:'numeric'})}</p></div>
                      <Badge variant="outline" className={`text-[10px] ${daysUntil === 0 ? 'border-primary text-primary bg-primary/10' : ''}`}>{daysUntil === 0 ? 'Today! 🎊' : `${daysUntil}d`}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id').eq('user_id', profile!.id).is('deleted_at', null).maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['leave-balances', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name)')
        .eq('employee_id', employee!.id)
        .eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!employee?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{greeting}, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-muted-foreground">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Clock In Card */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Clock className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold">Today's Attendance</p>
            <Button size="lg" className="w-full" onClick={() => navigate('/attendance')}>Clock In</Button>
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leave Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {leaveBalances.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No leave data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveBalances.slice(0, 4).map((lb: any) => {
                  const remaining = (lb.total_days || 0) - (lb.used_days || 0);
                  return (
                    <div key={lb.id} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{lb.leave_types?.name || 'Leave'}</span>
                      <span className="font-semibold text-primary">{remaining} <span className="text-xs text-muted-foreground">/ {lb.total_days}</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/leave/apply')}>
              <CalendarDays className="h-4 w-4" /> Apply Leave
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/performance')}>
              <TrendingUp className="h-4 w-4" /> My Goals
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/helpdesk')}>
              <Briefcase className="h-4 w-4" /> Raise Ticket
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/documents')}>
              <BarChart3 className="h-4 w-4" /> Documents
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => navigate('/onboarding')}>
              <PartyPopper className="h-4 w-4" /> Complete Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SuperAdminDashboard() {
  const { data: companyCount = 0 } = useQuery({
    queryKey: ['company-count'],
    queryFn: async () => {
      const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-muted-foreground">Super Admin Dashboard</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Companies" value={companyCount} icon={Users} color="bg-primary/10 text-primary" />
        <MetricCard title="Active Subscriptions" value="—" icon={DollarSign} color="bg-success/10 text-success" />
        <MetricCard title="Trial Companies" value="—" icon={Clock} color="bg-warning/10 text-warning" />
        <MetricCard title="Monthly Revenue" value="—" icon={TrendingUp} color="bg-info/10 text-info" />
      </div>
    </div>
  );
}

function HRManagerDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  // ⚡ Bolt: Single pass iteration for HR metrics
  const { data: employeeData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['hr-employee-metrics', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, date_of_birth, avatar_url, deleted_at')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null);

      const activeEmployees = data || [];
      let employeeCount = 0;
      const birthdays: any[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();

      for (let i = 0; i < activeEmployees.length; i++) {
        const e = activeEmployees[i];
        employeeCount++;

        if (e.date_of_birth) {
          const dob = new Date(e.date_of_birth);
          const bday = new Date(currentYear, dob.getMonth(), dob.getDate());
          const diff = (bday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= 30) {
            birthdays.push(e);
          }
        }
      }

      birthdays.sort((a: any, b: any) => {
        const da = new Date(a.date_of_birth), db = new Date(b.date_of_birth);
        return new Date(currentYear, da.getMonth(), da.getDate()).getTime() - new Date(currentYear, db.getMonth(), db.getDate()).getTime();
      }).splice(5);

      return { employeeCount, birthdays };
    },
    enabled: !!profile?.company_id,
  });

  const employeeCount = employeeData?.employeeCount || 0;
  const birthdays = employeeData?.birthdays || [];

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['pending-leaves', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('leave_requests').select('*, employees!leave_requests_employee_id_fkey(first_name, last_name)').eq('company_id', profile!.company_id!).eq('status', 'pending').limit(5);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: openTickets = 0 } = useQuery({
    queryKey: ['open-tickets', profile?.company_id],
    queryFn: async () => {
      const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('company_id', profile!.company_id!).in('status', ['open', 'in_progress']);
      return count || 0;
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Employees" value={employeeCount} icon={Users} color="bg-primary/10 text-primary" />
        <MetricCard title="Pending Leaves" value={pendingLeaves.length} icon={CalendarDays} color="bg-warning/10 text-warning" />
        <MetricCard title="Open Tickets" value={openTickets} icon={MessageSquare} color="bg-info/10 text-info" />
        <MetricCard title="Upcoming Birthdays" value={birthdays.length} icon={Cake} color="bg-success/10 text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <CardTitle>Pending Leave Requests</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leave')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8"><CalendarDays className="h-10 w-10 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No pending requests</p></div>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
                    <div>
                      <p className="text-sm font-medium">{req.employees?.first_name} {req.employees?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{req.start_date} — {req.end_date} · {req.total_days} days</p>
                    </div>
                    <Badge variant="outline" className="border-warning text-warning">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2"><Cake className="w-4 h-4" /> Upcoming Birthdays</CardTitle>
          </CardHeader>
          <CardContent>
            {birthdays.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6"><Cake className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No upcoming birthdays</p></div>
            ) : (
              <div className="space-y-3">
                {birthdays.map((emp: any) => {
                  const dob = new Date(emp.date_of_birth);
                  const now = new Date();
                  const bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
                  const daysUntil = Math.ceil((bday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded bg-background/50 border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success"><Cake className="w-4 h-4" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-muted-foreground">{dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${daysUntil === 0 ? 'border-success text-success bg-success/10' : 'border-muted text-muted-foreground'}`}>
                        {daysUntil === 0 ? 'Today! 🎉' : `${daysUntil}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/employees')}><Users className="h-4 w-4" /> Manage Employees</Button>
        <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/attendance')}><Clock className="h-4 w-4" /> Attendance</Button>
        <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/payroll')}><DollarSign className="h-4 w-4" /> Payroll</Button>
        <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/helpdesk')}><MessageSquare className="h-4 w-4" /> Help Desk</Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuthStore();

  if (profile?.platform_role === 'super_admin') return <SuperAdminDashboard />;
  if (profile?.platform_role === 'company_admin') return <CompanyAdminDashboard />;
  if (profile?.platform_role === 'hr_manager') return <HRManagerDashboard />;
  // recruiter and user both get employee dashboard
  return <EmployeeDashboard />;
}
