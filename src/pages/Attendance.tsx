import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MapPin, Play, Square, Coffee, Building, Home, Globe, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const LATE_THRESHOLD_HOUR = 9; // 9 AM
const LATE_THRESHOLD_MIN = 15; // 9:15 AM grace period

// ⚡ Bolt: Hoisted static object configuration outside of component body
// to prevent unnecessary memory reallocation on every render.
const workTypeIcons: Record<string, any> = { office: Building, remote: Home, hybrid: Globe };

const statusColors: Record<string, string> = {
  present: 'border-success text-success bg-success/10',
  late: 'border-warning text-warning bg-warning/10',
  early_leave: 'border-info text-info bg-info/10',
  absent: 'border-destructive text-destructive bg-destructive/10',
  half_day: 'border-orange-500 text-orange-500 bg-orange-500/10',
};

export default function Attendance() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workType, setWorkType] = useState<'office' | 'remote' | 'hybrid'>('office');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const today = new Date().toISOString().split('T')[0];
  const { data: todayRecord } = useQuery({
    queryKey: ['attendance-today', employee?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee!.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id,
  });

  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['attendance', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select(`*, employees (first_name, last_name)`)
        .eq('company_id', employee!.company_id)
        .order('date', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!employee?.company_id,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error('Employee record not found');
      if (todayRecord?.clock_in) throw new Error('Already clocked in today');
      const clockInTime = new Date();
      const isLate = clockInTime.getHours() > LATE_THRESHOLD_HOUR ||
        (clockInTime.getHours() === LATE_THRESHOLD_HOUR && clockInTime.getMinutes() > LATE_THRESHOLD_MIN);
      const { error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: employee.id,
          company_id: employee.company_id,
          date: today,
          clock_in: clockInTime.toISOString(),
          status: (isLate ? 'late' : 'present') as any,
          clock_in_location: { work_type: workType },
        }]);
      if (error) throw error;
      if (isLate) toast.warning('You clocked in late today');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Clocked in (${workType})`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to clock in'),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord?.id) throw new Error('No clock-in record found for today');
      if (todayRecord.clock_out) throw new Error('Already clocked out today');
      const clockOut = new Date();
      const clockIn = new Date(todayRecord.clock_in);
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const isEarlyLeave = clockOut.getHours() < 17; // before 5 PM
      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out: clockOut.toISOString(),
          total_hours: parseFloat(totalHours.toFixed(2)),
          status: (isEarlyLeave ? 'early_leave' : todayRecord.status) as any,
        })
        .eq('id', todayRecord.id);
      if (error) throw error;
      if (isEarlyLeave) toast.info('Early leave recorded');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Clocked out successfully');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to clock out'),
  });

  const breakMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord?.id) throw new Error('No clock-in record found for today');
      const { error } = await supabase
        .from('attendance')
        .update({
          break_minutes: (todayRecord.break_minutes || 0) + 15,
        })
        .eq('id', todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      toast.info('Break recorded (+15 min)');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to record break'),
  });

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const isClockedOut = !!todayRecord?.clock_out;

  let runningTotal = '00:00:00';
  if (todayRecord?.clock_in) {
    const start = new Date(todayRecord.clock_in);
    const end = todayRecord.clock_out ? new Date(todayRecord.clock_out) : currentTime;
    const diff = Math.max(0, end.getTime() - start.getTime());
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    runningTotal = `${h}:${m}:${s}`;
  }

  const getWorkTypeFromRecord = (record: any) => {
    const loc = record.clock_in_location;
    if (loc && typeof loc === 'object' && 'work_type' in loc) return loc.work_type;
    return null;
  };

  const todayWorkType = todayRecord ? getWorkTypeFromRecord(todayRecord) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Tracking</h1>
          <p className="text-muted-foreground mt-1">Real-time attendance & timesheet management</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardHeader className="border-b border-border/50 pb-4 relative z-10">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Current Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 relative z-10">
            <div className="text-center">
              <div className="text-6xl font-display font-bold tracking-tight mb-2 text-foreground">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <p className="text-muted-foreground text-sm font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Work Type Selector — only before clock-in */}
            {!todayRecord?.clock_in && (
              <div className="flex justify-center gap-2">
                {(['office', 'remote', 'hybrid'] as const).map(type => {
                  const Icon = workTypeIcons[type];
                  return (
                    <Button
                      key={type}
                      variant={workType === type ? 'default' : 'outline'}
                      size="sm"
                      className="gap-2 capitalize"
                      onClick={() => setWorkType(type)}
                    >
                      <Icon className="w-4 h-4" />
                      {type}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Show work type after clock-in */}
            {todayWorkType && (
              <div className="flex justify-center">
                <Badge variant="outline" className="gap-1 capitalize border-primary/30 text-primary">
                  {todayWorkType === 'office' && <Building className="w-3 h-3" />}
                  {todayWorkType === 'remote' && <Home className="w-3 h-3" />}
                  {todayWorkType === 'hybrid' && <Globe className="w-3 h-3" />}
                  {todayWorkType}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 w-full max-w-md mx-auto sm:flex sm:justify-center sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:w-32 bg-success text-success-foreground hover:bg-success/90 px-2 sm:px-4 text-xs sm:text-sm"
                onClick={() => clockInMutation.mutate()}
                disabled={isClockedIn || isClockedOut || clockInMutation.isPending}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Clock In
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-32 border-warning text-warning hover:bg-warning/10 px-2 sm:px-4 text-xs sm:text-sm"
                onClick={() => breakMutation.mutate()}
                disabled={!isClockedIn || breakMutation.isPending}
              >
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Break
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-32 border-destructive text-destructive hover:bg-destructive/10 px-2 sm:px-4 text-xs sm:text-sm"
                onClick={() => clockOutMutation.mutate()}
                disabled={!isClockedIn || clockOutMutation.isPending}
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Clock Out
              </Button>
            </div>

            <div className="pt-4 border-t border-border/50 flex justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{isClockedIn ? 'Active Session' : isClockedOut ? 'Session Complete' : 'Not Clocked In'}</span>
                {(todayRecord?.status as string) === 'late' && (
                  <Badge variant="outline" className="border-warning text-warning bg-warning/10 text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> Late
                  </Badge>
                )}
              </div>
              <div className="font-medium text-foreground">Total: <span className="text-primary">{runningTotal}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Clock In</span>
                <span className="font-medium">{todayRecord?.clock_in ? new Date(todayRecord.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Clock Out</span>
                <span className="font-medium">{todayRecord?.clock_out ? new Date(todayRecord.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Work Type</span>
                <span className="font-medium capitalize">{todayWorkType || '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Break</span>
                <span className="font-medium">{todayRecord?.break_minutes || 0} min</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-medium text-primary">{todayRecord?.total_hours?.toFixed(2) || runningTotal}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={statusColors[todayRecord?.status || ''] || 'border-muted text-muted-foreground'}>
                  {(todayRecord?.status as string) === 'late' ? '⚠ Late' : isClockedIn ? 'Active' : isClockedOut ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
            {isLoading ? <p className="text-muted-foreground py-4 text-center">Loading Data...</p> : attendanceData.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">No recent records found.</p>
            ) : (
                <div className="divide-y divide-border/50">
                  {attendanceData.map((record: any) => {
                    const wt = getWorkTypeFromRecord(record);
                    return (
                    <div key={record.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-muted/30 p-2.5 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-semibold text-foreground">
                            {(record.employees as any)?.first_name} {(record.employees as any)?.last_name}
                          </div>
                          <div className="text-muted-foreground text-xs flex items-center gap-2 mt-0.5">
                            {record.date}
                            {wt && (
                              <Badge variant="outline" className="text-[9px] capitalize gap-1">
                                {wt === 'remote' && <Home className="w-2.5 h-2.5" />}
                                {wt === 'office' && <Building className="w-2.5 h-2.5" />}
                                {wt === 'hybrid' && <Globe className="w-2.5 h-2.5" />}
                                {wt}
                              </Badge>
                            )}
                            {record.status === 'late' && (
                              <Badge variant="outline" className="text-[9px] border-warning text-warning bg-warning/10">Late</Badge>
                            )}
                            {record.status === 'early_leave' && (
                              <Badge variant="outline" className="text-[9px] border-info text-info bg-info/10">Early</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-left sm:text-right justify-between sm:justify-end border-t border-border/10 pt-2 sm:pt-0 sm:border-none w-full sm:w-auto">
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase block">In</span>
                          <span className="font-medium text-foreground">{record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase block">Out</span>
                          <span className="font-medium text-foreground">{record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                        </div>
                        <div className="w-16">
                          <span className="text-muted-foreground text-[10px] uppercase block">Total</span>
                          <span className="font-semibold text-primary">{record.total_hours?.toFixed(2) || '0.00'}h</span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
