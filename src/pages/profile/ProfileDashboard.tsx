import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CalendarDays, Bell, ChevronRight, CalendarCheck, Send,
  Headset, Upload, FileText, Receipt, Clock, CheckCircle2,
  AlertCircle, TrendingUp
} from 'lucide-react';

interface ProfileDashboardProps {
  employee: any;
}

function computeCompletion(employee: any): { percent: number; missing: string[] } {
  const missing: string[] = [];
  const checks: [boolean, string][] = [
    // Personal (20%)
    [!!employee.first_name && !!employee.last_name, 'Complete basic info'],
    [!!employee.date_of_birth, 'Add date of birth'],
    [!!employee.phone, 'Add phone number'],
    [!!employee.personal_email, 'Add personal email'],
    // Identity (10%)
    [!!(employee.custom_fields?.identity_docs?.pan_number), 'Upload PAN Card'],
    [!!(employee.custom_fields?.identity_docs?.aadhaar_number), 'Add Aadhaar/National ID'],
    // Address (10%)
    [!!(employee.address?.line1), 'Add current address'],
    // Emergency (10%)
    [!!(employee.emergency_contact?.primary_name || employee.emergency_contact?.name), 'Add emergency contact'],
    // Bank (10%)
    [!!(employee.bank_details?.account_number), 'Add bank details'],
    // Education (10%)
    [!!(employee.custom_fields?.education?.academics?.length), 'Add education'],
    // Work Experience (10%)
    [!!(employee.custom_fields?.work_experience?.companies?.length), 'Add work experience'],
    // Skills (5%)
    [!!(employee.custom_fields?.skills?.technical?.length), 'Add skills'],
    // Family (5%)
    [!!(employee.custom_fields?.family?.spouse?.name || employee.custom_fields?.family?.parents?.father_name), 'Add family info'],
    // Health (5%)
    [!!(employee.custom_fields?.health?.blood_group || employee.blood_group), 'Add health info'],
    // Social (5%)
    [!!(employee.custom_fields?.social_links?.linkedin), 'Add LinkedIn profile'],
  ];

  let filled = 0;
  for (const [ok, label] of checks) {
    if (ok) filled++;
    else missing.push(label);
  }

  return { percent: Math.round((filled / checks.length) * 100), missing };
}

export default function ProfileDashboard({ employee }: ProfileDashboardProps) {
  const navigate = useNavigate();
  const { percent, missing } = computeCompletion(employee);

  // Fetch leave balances
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['leave-balances-profile', employee.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name, code)')
        .eq('employee_id', employee.id)
        .eq('year', year);
      return data || [];
    },
    enabled: !!employee.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements-profile', employee.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, published_at')
        .eq('company_id', employee.company_id)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!employee.company_id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending leave requests
  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['pending-leaves-profile', employee.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'pending');
      return data || [];
    },
    enabled: !!employee.id,
    staleTime: 60 * 1000,
  });

  const quickActions = [
    { label: 'Apply Leave', icon: CalendarDays, href: '/leave/apply', color: 'from-violet-500/20 to-violet-600/5 text-violet-600 dark:text-violet-400' },
    { label: 'Submit Expense', icon: Receipt, href: '/helpdesk', color: 'from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-400' },
    { label: 'Raise Ticket', icon: Headset, href: '/helpdesk', color: 'from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Grid: Completion + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Completion */}
        <Card className="border-border/40 shadow-sm overflow-hidden col-span-1 lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Profile Completion</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Complete your profile to unlock all features</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold tabular-nums ${
                  percent >= 80 ? 'text-emerald-500' : percent >= 50 ? 'text-amber-500' : 'text-destructive'
                }`}>{percent}%</span>
              </div>
            </div>
            <Progress value={percent} className="h-2.5 mb-4" />
            {missing.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pending Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {missing.slice(0, 5).map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-medium border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                      <AlertCircle className="h-2.5 w-2.5 mr-1" />
                      {m}
                    </Badge>
                  ))}
                  {missing.length > 5 && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      +{missing.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Leave Balance</h3>
              <CalendarCheck className="h-4 w-4 text-primary/50" />
            </div>
            {leaveBalances.length > 0 ? (
              <div className="space-y-2.5">
                {leaveBalances.slice(0, 4).map((lb: any) => {
                  const remaining = Number(lb.total_days) - Number(lb.used_days) - Number(lb.pending_days);
                  return (
                    <div key={lb.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">
                        {lb.leave_types?.code || lb.leave_types?.name || 'Leave'}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{remaining}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">CL: 5 &nbsp;|&nbsp; SL: 3 &nbsp;|&nbsp; EL: 12</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Sample data</p>
              </div>
            )}
            {pendingLeaves.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  <span>{pendingLeaves.length} pending approval{pendingLeaves.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Quick Actions + Upcoming + Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.href)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${action.color} border border-border/20 hover:border-border/40 transition-all hover:shadow-sm group`}
                >
                  <action.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium flex-1 text-left">{action.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/10">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Performance Review</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Due: 15 Jan</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/10">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Training Session</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">20 Jan</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Announcements */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Announcements</h3>
              <Bell className="h-4 w-4 text-primary/50" />
            </div>
            {announcements.length > 0 ? (
              <div className="space-y-2.5">
                {announcements.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => navigate('/announcements')}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/10 transition-colors group"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {a.published_at ? new Date(a.published_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No recent announcements</p>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs text-muted-foreground hover:text-primary"
              onClick={() => navigate('/announcements')}>
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
