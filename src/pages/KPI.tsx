import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth, addDays, parseISO } from 'date-fns';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ActivitySquare, TrendingUp, TrendingDown, Calendar, Settings2,
  CheckCircle2, AlertCircle, Clock, ChevronLeft, ChevronRight,
  Award, Zap, BarChart2, Save, Info, Star, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface KPISettings {
  id?: string;
  daily_enabled: boolean;
  manager_max_points: number;
  attendance_present_score: number;
  attendance_halfday_score: number;
  attendance_absent_score: number;
  fill_window_days: number;
  score_bands: ScoreBand[];
  monthly_enabled: boolean;
  monthly_max_score: number;
  monthly_fill_window_day: number;
  quarterly_enabled: boolean;
  quarterly_max_score: number;
}

interface ScoreBand {
  min: number;
  max: number;
  label: string;
  action: string;
  color: string;
}

interface DailyScore {
  id: string;
  employee_id: string;
  date: string;
  manager_points: number;
  attendance_score: number;
  kpi_score: number;
  notes?: string;
  locked: boolean;
  employees?: { first_name: string; last_name: string; avatar_url?: string; employee_code?: string };
}

interface MonthlyScore {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  score: number;
  remarks?: string;
  employees?: { first_name: string; last_name: string };
}

interface QuarterlyScore {
  id: string;
  employee_id: string;
  quarter: number;
  year: number;
  score: number;
  remarks?: string;
  employees?: { first_name: string; last_name: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: KPISettings = {
  daily_enabled: true,
  manager_max_points: 1.0,
  attendance_present_score: 1.0,
  attendance_halfday_score: 0.5,
  attendance_absent_score: 0.0,
  fill_window_days: 7,
  score_bands: [
    { min: -1.0, max: -0.01, label: 'Under Consideration', action: 'HR Review Required', color: '#ef4444' },
    { min: 0.0,  max: 0.49,  label: 'Satisfactory',        action: 'No Action',          color: '#f59e0b' },
    { min: 0.5,  max: 0.79,  label: 'Good',                action: 'Appreciation Note',  color: '#22c55e' },
    { min: 0.8,  max: 1.0,   label: 'Excellent',           action: 'Reward Eligible',    color: '#6366f1' },
  ],
  monthly_enabled: true,
  monthly_max_score: 10.0,
  monthly_fill_window_day: 5,
  quarterly_enabled: true,
  quarterly_max_score: 10.0,
};

function getBand(score: number, bands: ScoreBand[]): ScoreBand | null {
  return bands.find((b) => score >= b.min && score <= b.max) || null;
}

function getScoreColor(score: number, bands: ScoreBand[]): string {
  const band = getBand(score, bands);
  return band?.color || '#94a3b8';
}

function getQuarterLabel(q: number) {
  return `Q${q} ${['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'][q - 1]}`;
}

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function monthName(m: number) {
  return new Date(2024, m - 1, 1).toLocaleString('default', { month: 'long' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Badge Component
// ─────────────────────────────────────────────────────────────────────────────
function ScoreBadge({ score, bands }: { score: number; bands: ScoreBand[] }) {
  const band = getBand(score, bands);
  const color = band?.color || '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: color + '22', color, border: `1px solid ${color}44` }}
    >
      {score > 0 ? <TrendingUp className="w-3 h-3" /> : score < 0 ? <TrendingDown className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {score >= 0 ? '+' : ''}{score.toFixed(2)}
      {band && <span className="ml-1 opacity-80">{band.label}</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main KPI Component
// ─────────────────────────────────────────────────────────────────────────────
export default function KPI() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = ['company_admin', 'hr_manager', 'super_admin'].includes(profile?.platform_role || '');
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Tab state
  const [activeTab, setActiveTab] = useState('daily');

  // Daily tab state
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dailyInputs, setDailyInputs] = useState<Record<string, { points: string; notes: string }>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Monthly tab state
  const [monthlyMonth, setMonthlyMonth] = useState(today.getMonth() + 1);
  const [monthlyYear, setMonthlyYear] = useState(today.getFullYear());
  const [monthlyInputs, setMonthlyInputs] = useState<Record<string, { score: string; remarks: string }>>({});

  // Quarterly tab state
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter());
  const [quarterlyYear, setQuarterlyYear] = useState(today.getFullYear());
  const [quarterlyInputs, setQuarterlyInputs] = useState<Record<string, { score: string; remarks: string }>>({});

  // Settings edit state
  const [settingsForm, setSettingsForm] = useState<KPISettings>(DEFAULT_SETTINGS);

  // ── Fetch Settings ───────────────────────────────────────────
  const { data: settings } = useQuery<KPISettings>({
    queryKey: ['kpi-settings', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_settings')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .maybeSingle();
      return (data as KPISettings) || DEFAULT_SETTINGS;
    },
    enabled: !!profile?.company_id,
  });
  const s = settings || DEFAULT_SETTINGS;

  // ── Fetch Employees ───────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-kpi', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, avatar_url, employee_code, department_id')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('first_name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // ── Fetch My Employee Record (for employee view) ──────────────
  const { data: myEmployee } = useQuery({
    queryKey: ['my-employee-kpi', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', profile!.id!)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  // ── Fetch Daily Scores for selected date ──────────────────────
  const { data: dailyScores = [], isLoading: loadingDaily } = useQuery<DailyScore[]>({
    queryKey: ['kpi-daily', profile?.company_id, selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_daily_scores')
        .select('*, employees(first_name, last_name, avatar_url, employee_code)')
        .eq('company_id', profile!.company_id!)
        .eq('date', selectedDate);
      return (data as DailyScore[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  // ── Fetch 30-day rolling daily scores (for charts) ────────────
  const { data: rollingDaily = [] } = useQuery<DailyScore[]>({
    queryKey: ['kpi-daily-rolling', profile?.company_id, myEmployee?.id],
    queryFn: async () => {
      const since = format(subDays(today, 30), 'yyyy-MM-dd');
      const query = isAdmin
        ? supabase.from('kpi_daily_scores').select('*, employees(first_name, last_name)').eq('company_id', profile!.company_id!).gte('date', since).order('date')
        : supabase.from('kpi_daily_scores').select('*').eq('employee_id', myEmployee!.id).gte('date', since).order('date');
      const { data } = await query;
      return (data as DailyScore[]) || [];
    },
    enabled: !!profile?.company_id && (isAdmin || !!myEmployee?.id),
  });

  // ── Fetch Attendance for selected date ────────────────────────
  const { data: attendanceMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['attendance-for-kpi', profile?.company_id, selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .eq('company_id', profile!.company_id!)
        .eq('date', selectedDate);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.employee_id] = r.status; });
      return map;
    },
    enabled: !!profile?.company_id,
  });

  // ── Fetch Monthly Scores ───────────────────────────────────────
  const { data: monthlyScores = [], isLoading: loadingMonthly } = useQuery<MonthlyScore[]>({
    queryKey: ['kpi-monthly', profile?.company_id, monthlyMonth, monthlyYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_monthly_scores')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', profile!.company_id!)
        .eq('month', monthlyMonth)
        .eq('year', monthlyYear);
      return (data as MonthlyScore[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  // ── Fetch Quarterly Scores ────────────────────────────────────
  const { data: quarterlyScores = [], isLoading: loadingQuarterly } = useQuery<QuarterlyScore[]>({
    queryKey: ['kpi-quarterly', profile?.company_id, selectedQuarter, quarterlyYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_quarterly_scores')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', profile!.company_id!)
        .eq('quarter', selectedQuarter)
        .eq('year', quarterlyYear);
      return (data as QuarterlyScore[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  // ── Derived: Daily score lookup ───────────────────────────────
  const dailyScoreByEmployee = useMemo(() => {
    const map: Record<string, DailyScore> = {};
    dailyScores.forEach((ds) => { map[ds.employee_id] = ds; });
    return map;
  }, [dailyScores]);

  const monthlyScoreByEmployee = useMemo(() => {
    const map: Record<string, MonthlyScore> = {};
    monthlyScores.forEach((ms) => { map[ms.employee_id] = ms; });
    return map;
  }, [monthlyScores]);

  const quarterlyScoreByEmployee = useMemo(() => {
    const map: Record<string, QuarterlyScore> = {};
    quarterlyScores.forEach((qs) => { map[qs.employee_id] = qs; });
    return map;
  }, [quarterlyScores]);

  // ── Date window validation ────────────────────────────────────
  const minDate = format(subDays(today, s.fill_window_days), 'yyyy-MM-dd');
  const isDateLocked = (date: string) => date < minDate;

  // ── Attendance score helper ───────────────────────────────────
  function getAttendanceScore(empId: string): number {
    const status = attendanceMap[empId];
    if (status === 'present' || status === 'on_leave') return s.attendance_present_score;
    if (status === 'half_day') return s.attendance_halfday_score;
    return s.attendance_absent_score; // absent, weekend, holiday → 0
  }

  function getAttendanceBadge(empId: string): React.ReactNode {
    const status = attendanceMap[empId];
    if (!status) return <Badge variant="outline" className="text-[9px] text-muted-foreground">No Record</Badge>;
    const colorMap: Record<string, string> = {
      present: 'text-green-500 border-green-500/30 bg-green-500/10',
      half_day: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
      absent: 'text-red-500 border-red-500/30 bg-red-500/10',
      on_leave: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
    };
    return (
      <Badge variant="outline" className={`text-[9px] capitalize ${colorMap[status] || ''}`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  }

  // ── Save Settings ─────────────────────────────────────────────
  const saveSettingsMutation = useMutation({
    mutationFn: async (form: KPISettings) => {
      const payload = { ...form, company_id: profile!.company_id };
      if (form.id) {
        const { error } = await supabase.from('kpi_settings').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { error } = await supabase.from('kpi_settings').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-settings'] });
      toast.success('KPI settings saved!');
      setSettingsOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save settings'),
  });

  // ── Save Daily Score (single employee) ────────────────────────
  const saveDailyMutation = useMutation({
    mutationFn: async ({ empId, points, notes }: { empId: string; points: number; notes: string }) => {
      const attendanceScore = getAttendanceScore(empId);
      const existing = dailyScoreByEmployee[empId];
      const payload: any = {
        company_id: profile!.company_id,
        employee_id: empId,
        date: selectedDate,
        manager_points: points,
        attendance_score: attendanceScore,
        scored_by: profile!.id,
        notes: notes || null,
        locked: true,
      };
      if (existing) {
        const { error } = await supabase.from('kpi_daily_scores').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kpi_daily_scores').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['kpi-daily'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-daily-rolling'] });
      const inputs = { ...dailyInputs };
      delete inputs[empId];
      setDailyInputs(inputs);
      toast.success('Daily KPI score saved!');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save score'),
  });

  // ── Save Monthly Score ────────────────────────────────────────
  const saveMonthlySingle = useMutation({
    mutationFn: async ({ empId, score, remarks }: { empId: string; score: number; remarks: string }) => {
      const existing = monthlyScoreByEmployee[empId];
      const payload: any = {
        company_id: profile!.company_id,
        employee_id: empId,
        month: monthlyMonth,
        year: monthlyYear,
        score,
        remarks: remarks || null,
        scored_by: profile!.id,
        submitted_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from('kpi_monthly_scores').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kpi_monthly_scores').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['kpi-monthly'] });
      const inputs = { ...monthlyInputs };
      delete inputs[empId];
      setMonthlyInputs(inputs);
      toast.success('Monthly KPI score saved!');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save monthly score'),
  });

  // ── Save Quarterly Score ─────────────────────────────────────
  const saveQuarterlySingle = useMutation({
    mutationFn: async ({ empId, score, remarks }: { empId: string; score: number; remarks: string }) => {
      const existing = quarterlyScoreByEmployee[empId];
      const payload: any = {
        company_id: profile!.company_id,
        employee_id: empId,
        quarter: selectedQuarter,
        year: quarterlyYear,
        score,
        remarks: remarks || null,
        scored_by: profile!.id,
        submitted_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from('kpi_quarterly_scores').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kpi_quarterly_scores').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { empId }) => {
      queryClient.invalidateQueries({ queryKey: ['kpi-quarterly'] });
      const inputs = { ...quarterlyInputs };
      delete inputs[empId];
      setQuarterlyInputs(inputs);
      toast.success('Quarterly KPI score saved!');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save quarterly score'),
  });

  // ── Summary Stats ─────────────────────────────────────────────
  const avgDailyKPI = useMemo(() => {
    const scores = isAdmin
      ? rollingDaily
      : rollingDaily.filter((d: any) => d.employee_id === myEmployee?.id);
    if (!scores.length) return null;
    const avg = scores.reduce((acc, d) => acc + (d.kpi_score || 0), 0) / scores.length;
    return avg;
  }, [rollingDaily, isAdmin, myEmployee]);

  const chartData = useMemo(() => {
    if (!isAdmin && myEmployee?.id) {
      const myScores = rollingDaily.filter((d: any) => d.employee_id === myEmployee.id);
      return myScores.map((d) => ({
        date: format(parseISO(d.date), 'dd MMM'),
        kpi: d.kpi_score,
        manager: d.manager_points,
        attendance: d.attendance_score,
      }));
    }
    // For admin: aggregate by date
    const byDate: Record<string, { total: number; count: number }> = {};
    rollingDaily.forEach((d) => {
      if (!byDate[d.date]) byDate[d.date] = { total: 0, count: 0 };
      byDate[d.date].total += d.kpi_score;
      byDate[d.date].count += 1;
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date: format(parseISO(date), 'dd MMM'),
      kpi: parseFloat((v.total / v.count).toFixed(2)),
    }));
  }, [rollingDaily, isAdmin, myEmployee]);

  // ── Monthly fill window check ─────────────────────────────────
  const monthlyWindowOpen = today.getDate() <= s.monthly_fill_window_day ||
    (monthlyMonth !== today.getMonth() + 1 || monthlyYear !== today.getFullYear());
  const daysLeftMonthly = Math.max(0, s.monthly_fill_window_day - today.getDate() + 1);

  // ── Open settings form ────────────────────────────────────────
  function openSettings() {
    setSettingsForm({ ...s, id: (settings as any)?.id });
    setSettingsOpen(true);
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ActivitySquare className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">KPI Matrix</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold uppercase tracking-wider">
              ⚡ USP Feature
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Super Intelligent Performance Scoring — Daily · Monthly · Quarterly
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openSettings} className="gap-2 text-sm h-9">
            <Settings2 className="w-4 h-4" /> KPI Settings
          </Button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-5">
            <BarChart2 className="w-6 h-6 text-primary mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Daily KPI (30d)</p>
            <div className="text-2xl font-black">
              {avgDailyKPI !== null ? (
                <span style={{ color: getScoreColor(avgDailyKPI, s.score_bands) }}>
                  {avgDailyKPI >= 0 ? '+' : ''}{avgDailyKPI.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Calendar className="w-6 h-6 text-blue-500 mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scored Today</p>
            <div className="text-2xl font-black text-blue-500">
              {dailyScores.length}
              <span className="text-sm text-muted-foreground font-normal ml-1">/ {employees.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Award className="w-6 h-6 text-amber-500 mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Monthly Entries</p>
            <div className="text-2xl font-black text-amber-500">{monthlyScores.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Zap className="w-6 h-6 text-violet-500 mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Quarterly Entries</p>
            <div className="text-2xl font-black text-violet-500">{quarterlyScores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Score Formula Info ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4 flex flex-wrap gap-4 items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">Daily Formula:</span>
          </div>
          <code className="bg-background/70 px-2 py-0.5 rounded font-mono text-primary">
            Manager Points (0–{s.manager_max_points}) − Attendance Score = KPI Score
          </code>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-green-500 font-medium">Positive = Good</span>
            <span className="text-amber-500 font-medium">Zero = OK</span>
            <span className="text-red-500 font-medium">Negative = Under Consideration</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap ml-auto">
            <span>Present = {s.attendance_present_score}</span>
            <span>Half Day = {s.attendance_halfday_score}</span>
            <span>Absent = {s.attendance_absent_score}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="daily" className="gap-2 text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5" /> Daily Score
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2 text-xs sm:text-sm">
            <Calendar className="w-3.5 h-3.5" /> Monthly Score
          </TabsTrigger>
          <TabsTrigger value="quarterly" className="gap-2 text-xs sm:text-sm">
            <BarChart2 className="w-3.5 h-3.5" /> Quarterly Score
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════
            DAILY SCORE TAB
        ════════════════════════════════════════════════════════ */}
        <TabsContent value="daily" className="space-y-4 mt-4">
          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 border-b border-border/40">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {isAdmin ? 'Company Average' : 'My'} KPI Trend (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} domain={[-1, 1]} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="kpi" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} name="KPI Score" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Date Picker & Controls */}
          {isAdmin && (
            <Card>
              <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Score Date:</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    min={minDate}
                    max={todayStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
                {isDateLocked(selectedDate) && (
                  <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30 bg-red-500/10">
                    <AlertCircle className="w-3 h-3 mr-1" /> Outside {s.fill_window_days}-day window — locked
                  </Badge>
                )}
                <div className="flex gap-1 ml-auto">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                    disabled={selectedDate <= minDate}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(todayStr)}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                    disabled={selectedDate >= todayStr}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['kpi-daily', profile?.company_id, selectedDate] });
                  queryClient.invalidateQueries({ queryKey: ['attendance-for-kpi'] });
                }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Employee Score Table (Admin) */}
          {isAdmin ? (
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Daily KPI Scoring — {format(parseISO(selectedDate), 'dd MMM yyyy')}
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter manager points for each employee. Attendance is auto-fetched.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDaily ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs font-semibold w-48">Employee</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Attendance</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Att. Score</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-36">Manager Points</TableHead>
                          <TableHead className="text-xs font-semibold text-center">KPI Score</TableHead>
                          <TableHead className="text-xs font-semibold">Notes</TableHead>
                          <TableHead className="text-xs font-semibold w-20">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.map((emp: any) => {
                          const existing = dailyScoreByEmployee[emp.id];
                          const attScore = getAttendanceScore(emp.id);
                          const input = dailyInputs[emp.id];
                          const enteredPoints = input?.points !== undefined
                            ? parseFloat(input.points) || 0
                            : existing?.manager_points ?? 0;
                          const previewKPI = enteredPoints - attScore;
                          const isLocked = isDateLocked(selectedDate);
                          const hasExisting = !!existing;
                          const isEditing = !!input;

                          return (
                            <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                    {emp.first_name[0]}{emp.last_name[0]}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">{emp.first_name} {emp.last_name}</p>
                                    {emp.employee_code && <p className="text-[10px] text-muted-foreground">{emp.employee_code}</p>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {getAttendanceBadge(emp.id)}
                              </TableCell>
                              <TableCell className="text-center py-3 font-mono text-sm font-bold">
                                <span style={{ color: attScore > 0 ? '#22c55e' : '#ef4444' }}>
                                  {attScore.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {isLocked && !isEditing ? (
                                  <span className="text-xs text-muted-foreground">Locked</span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={s.manager_max_points}
                                    value={input?.points ?? (existing?.manager_points?.toString() ?? '')}
                                    placeholder={`0–${s.manager_max_points}`}
                                    className="h-8 text-xs text-center w-24 mx-auto font-mono"
                                    disabled={isLocked}
                                    onChange={(e) => setDailyInputs(prev => ({
                                      ...prev,
                                      [emp.id]: { ...prev[emp.id], points: e.target.value, notes: prev[emp.id]?.notes || existing?.notes || '' }
                                    }))}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {(isEditing || hasExisting) ? (
                                  <ScoreBadge score={previewKPI} bands={s.score_bands} />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <Input
                                  type="text"
                                  value={input?.notes ?? (existing?.notes || '')}
                                  placeholder="Optional notes..."
                                  className="h-8 text-xs w-full max-w-40"
                                  disabled={isLocked}
                                  onChange={(e) => setDailyInputs(prev => ({
                                    ...prev,
                                    [emp.id]: { ...prev[emp.id], notes: e.target.value, points: prev[emp.id]?.points ?? existing?.manager_points?.toString() ?? '' }
                                  }))}
                                />
                              </TableCell>
                              <TableCell className="py-3">
                                {!isLocked && (isEditing || !hasExisting) ? (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={!input?.points || saveDailyMutation.isPending}
                                    onClick={() => {
                                      const pts = parseFloat(dailyInputs[emp.id]?.points || '0');
                                      if (isNaN(pts) || pts < 0 || pts > s.manager_max_points) {
                                        toast.error(`Points must be between 0 and ${s.manager_max_points}`);
                                        return;
                                      }
                                      saveDailyMutation.mutate({
                                        empId: emp.id,
                                        points: pts,
                                        notes: dailyInputs[emp.id]?.notes || '',
                                      });
                                    }}
                                  >
                                    <Save className="w-3 h-3" /> Save
                                  </Button>
                                ) : hasExisting ? (
                                  <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30 bg-green-500/5 whitespace-nowrap">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                                  </Badge>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // ── Employee Self-View ──
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm">My Daily KPI History</CardTitle>
                <CardDescription className="text-xs">Your KPI scores over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {rollingDaily.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                    <ActivitySquare className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No daily scores yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-center">Manager Points</TableHead>
                        <TableHead className="text-xs text-center">Attendance</TableHead>
                        <TableHead className="text-xs text-center">KPI Score</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...rollingDaily].reverse().map((ds) => (
                        <TableRow key={ds.id}>
                          <TableCell className="text-xs font-medium">{format(parseISO(ds.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{ds.manager_points.toFixed(2)}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{ds.attendance_score.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <ScoreBadge score={ds.kpi_score} bands={s.score_bands} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{ds.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Score Bands Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Bands</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {s.score_bands.map((band, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs border"
                    style={{ borderColor: band.color + '44', background: band.color + '11' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: band.color }} />
                    <span className="font-semibold" style={{ color: band.color }}>{band.label}</span>
                    <span className="text-muted-foreground">{band.min} to {band.max}</span>
                    {band.action && <span className="opacity-60">→ {band.action}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════
            MONTHLY SCORE TAB
        ════════════════════════════════════════════════════════ */}
        <TabsContent value="monthly" className="space-y-4 mt-4">
          {/* Controls */}
          <Card>
            <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Month:</Label>
                <Select value={monthlyMonth.toString()} onValueChange={(v) => setMonthlyMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{monthName(i + 1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={monthlyYear.toString()} onValueChange={(v) => setMonthlyYear(parseInt(v))}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                monthlyWindowOpen ? (
                  <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Window Open — {daysLeftMonthly}d left
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30 bg-red-500/10">
                    <AlertCircle className="w-3 h-3 mr-1" /> Window Closed (after {s.monthly_fill_window_day}th)
                  </Badge>
                )
              )}
            </CardContent>
          </Card>

          {/* Monthly Bar Chart */}
          {monthlyScores.length > 0 && (
            <Card>
              <CardHeader className="pb-2 border-b border-border/40">
                <CardTitle className="text-sm">{monthName(monthlyMonth)} {monthlyYear} — Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={monthlyScores.map((ms: any) => ({
                    name: `${ms.employees?.first_name || ''} ${ms.employees?.last_name?.[0] || ''}`.trim(),
                    score: ms.score,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, s.monthly_max_score]} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {monthlyScores.map((_: any, index: number) => (
                        <Cell key={index} fill="hsl(var(--primary))" fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Monthly Score Table */}
          {isAdmin && (
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Monthly KPI — {monthName(monthlyMonth)} {monthlyYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Max score: {s.monthly_max_score} · Fill window: 1st–{s.monthly_fill_window_day}th of month
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingMonthly ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs w-48">Employee</TableHead>
                        <TableHead className="text-xs text-center w-32">Score (0–{s.monthly_max_score})</TableHead>
                        <TableHead className="text-xs">Remarks</TableHead>
                        <TableHead className="text-xs w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp: any) => {
                        const existing = monthlyScoreByEmployee[emp.id];
                        const input = monthlyInputs[emp.id];
                        const isWindowClosed = !monthlyWindowOpen;
                        const isEditing = !!input;

                        return (
                          <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                  {emp.first_name[0]}{emp.last_name[0]}
                                </div>
                                <span className="text-xs font-semibold">{emp.first_name} {emp.last_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              {isWindowClosed && !isEditing ? (
                                existing ? (
                                  <span className="font-bold font-mono text-sm">{existing.score.toFixed(1)}</span>
                                ) : <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={s.monthly_max_score}
                                  value={input?.score ?? (existing?.score?.toString() ?? '')}
                                  placeholder={`0–${s.monthly_max_score}`}
                                  className="h-8 text-xs text-center w-24 mx-auto font-mono"
                                  onChange={(e) => setMonthlyInputs(prev => ({
                                    ...prev,
                                    [emp.id]: { ...prev[emp.id], score: e.target.value, remarks: prev[emp.id]?.remarks || existing?.remarks || '' }
                                  }))}
                                />
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              {isWindowClosed && !isEditing ? (
                                <span className="text-xs text-muted-foreground">{existing?.remarks || '—'}</span>
                              ) : (
                                <Input
                                  type="text"
                                  value={input?.remarks ?? (existing?.remarks || '')}
                                  placeholder="Remarks..."
                                  className="h-8 text-xs w-full max-w-52"
                                  onChange={(e) => setMonthlyInputs(prev => ({
                                    ...prev,
                                    [emp.id]: { ...prev[emp.id], remarks: e.target.value, score: prev[emp.id]?.score ?? existing?.score?.toString() ?? '' }
                                  }))}
                                />
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              {!isWindowClosed && (isEditing || !existing) ? (
                                <Button size="sm" className="h-7 text-xs gap-1"
                                  disabled={!monthlyInputs[emp.id]?.score || saveMonthlySingle.isPending}
                                  onClick={() => {
                                    const sc = parseFloat(monthlyInputs[emp.id]?.score || '0');
                                    if (isNaN(sc) || sc < 0 || sc > s.monthly_max_score) {
                                      toast.error(`Score must be 0–${s.monthly_max_score}`);
                                      return;
                                    }
                                    saveMonthlySingle.mutate({ empId: emp.id, score: sc, remarks: monthlyInputs[emp.id]?.remarks || '' });
                                  }}
                                >
                                  <Save className="w-3 h-3" /> Save
                                </Button>
                              ) : existing ? (
                                <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                                </Badge>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employee monthly self-view */}
          {!isAdmin && (
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm">My Monthly KPI Score</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(() => {
                  const mine = myEmployee ? monthlyScoreByEmployee[myEmployee.id] : undefined;
                  if (!mine) return (
                    <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                      <Calendar className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No monthly score for {monthName(monthlyMonth)} {monthlyYear}</p>
                    </div>
                  );
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Score</p>
                          <p className="text-4xl font-black text-primary">{mine.score.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">/ {s.monthly_max_score}</p>
                        </div>
                        <Progress value={(mine.score / s.monthly_max_score) * 100} className="flex-1 h-3" />
                      </div>
                      {mine.remarks && <p className="text-sm text-muted-foreground italic">"{mine.remarks}"</p>}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════
            QUARTERLY SCORE TAB
        ════════════════════════════════════════════════════════ */}
        <TabsContent value="quarterly" className="space-y-4 mt-4">
          {/* Controls */}
          <Card>
            <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
              <Label className="text-xs">Quarter:</Label>
              {[1, 2, 3, 4].map(q => (
                <Button
                  key={q}
                  variant={selectedQuarter === q ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSelectedQuarter(q)}
                >
                  Q{q}
                </Button>
              ))}
              <Select value={quarterlyYear.toString()} onValueChange={(v) => setQuarterlyYear(parseInt(v))}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px] text-violet-500 border-violet-500/30 bg-violet-500/5">
                {getQuarterLabel(selectedQuarter)} {quarterlyYear}
              </Badge>
            </CardContent>
          </Card>

          {/* Quarterly Bar Chart */}
          {quarterlyScores.length > 0 && (
            <Card>
              <CardHeader className="pb-2 border-b border-border/40">
                <CardTitle className="text-sm">Q{selectedQuarter} {quarterlyYear} — Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={quarterlyScores.map((qs: any) => ({
                    name: `${qs.employees?.first_name || ''} ${qs.employees?.last_name?.[0] || ''}`.trim(),
                    score: qs.score,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, s.quarterly_max_score]} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {quarterlyScores.map((_: any, index: number) => (
                        <Cell key={index} fill="#6366f1" fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Quarterly Score Table */}
          {isAdmin ? (
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Quarterly KPI — {getQuarterLabel(selectedQuarter)} {quarterlyYear}
                </CardTitle>
                <CardDescription className="text-xs">Max score: {s.quarterly_max_score}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingQuarterly ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs w-48">Employee</TableHead>
                        <TableHead className="text-xs text-center w-32">Score (0–{s.quarterly_max_score})</TableHead>
                        <TableHead className="text-xs">Remarks</TableHead>
                        <TableHead className="text-xs w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp: any) => {
                        const existing = quarterlyScoreByEmployee[emp.id];
                        const input = quarterlyInputs[emp.id];
                        const isEditing = !!input;

                        return (
                          <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 text-xs font-bold shrink-0">
                                  {emp.first_name[0]}{emp.last_name[0]}
                                </div>
                                <span className="text-xs font-semibold">{emp.first_name} {emp.last_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max={s.quarterly_max_score}
                                value={input?.score ?? (existing?.score?.toString() ?? '')}
                                placeholder={`0–${s.quarterly_max_score}`}
                                className="h-8 text-xs text-center w-24 mx-auto font-mono"
                                onChange={(e) => setQuarterlyInputs(prev => ({
                                  ...prev,
                                  [emp.id]: { ...prev[emp.id], score: e.target.value, remarks: prev[emp.id]?.remarks || existing?.remarks || '' }
                                }))}
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <Input
                                type="text"
                                value={input?.remarks ?? (existing?.remarks || '')}
                                placeholder="Remarks..."
                                className="h-8 text-xs w-full max-w-52"
                                onChange={(e) => setQuarterlyInputs(prev => ({
                                  ...prev,
                                  [emp.id]: { ...prev[emp.id], remarks: e.target.value, score: prev[emp.id]?.score ?? existing?.score?.toString() ?? '' }
                                }))}
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              {(isEditing || !existing) ? (
                                <Button size="sm" className="h-7 text-xs gap-1"
                                  disabled={!quarterlyInputs[emp.id]?.score || saveQuarterlySingle.isPending}
                                  onClick={() => {
                                    const sc = parseFloat(quarterlyInputs[emp.id]?.score || '0');
                                    if (isNaN(sc) || sc < 0 || sc > s.quarterly_max_score) {
                                      toast.error(`Score must be 0–${s.quarterly_max_score}`);
                                      return;
                                    }
                                    saveQuarterlySingle.mutate({ empId: emp.id, score: sc, remarks: quarterlyInputs[emp.id]?.remarks || '' });
                                  }}
                                >
                                  <Save className="w-3 h-3" /> Save
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm">My Quarterly KPI — {getQuarterLabel(selectedQuarter)} {quarterlyYear}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(() => {
                  const mine = myEmployee ? quarterlyScoreByEmployee[myEmployee.id] : undefined;
                  if (!mine) return (
                    <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                      <Zap className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No quarterly score for Q{selectedQuarter} {quarterlyYear}</p>
                    </div>
                  );
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Score</p>
                          <p className="text-4xl font-black text-violet-500">{mine.score.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">/ {s.quarterly_max_score}</p>
                        </div>
                        <Progress value={(mine.score / s.quarterly_max_score) * 100} className="flex-1 h-3" />
                      </div>
                      {mine.remarks && <p className="text-sm text-muted-foreground italic">"{mine.remarks}"</p>}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════
          KPI SETTINGS DIALOG
      ════════════════════════════════════════════════════════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> KPI Matrix Settings
            </DialogTitle>
            <DialogDescription>
              Configure scoring logic, attendance weights, and score band actions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Daily Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-border/50 pb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Daily Score Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Manager Points</Label>
                  <Input type="number" step="0.1" min="0.1" max="10"
                    value={settingsForm.manager_max_points}
                    onChange={(e) => setSettingsForm(f => ({ ...f, manager_max_points: parseFloat(e.target.value) || 1 }))}
                    className="h-8 text-xs font-mono" />
                  <p className="text-[10px] text-muted-foreground">Manager can award 0 to this value</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fill Window (days)</Label>
                  <Input type="number" min="1" max="30"
                    value={settingsForm.fill_window_days}
                    onChange={(e) => setSettingsForm(f => ({ ...f, fill_window_days: parseInt(e.target.value) || 7 }))}
                    className="h-8 text-xs font-mono" />
                  <p className="text-[10px] text-muted-foreground">Past days manager can fill scores for</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Present Score</Label>
                  <Input type="number" step="0.1" min="0" max="2"
                    value={settingsForm.attendance_present_score}
                    onChange={(e) => setSettingsForm(f => ({ ...f, attendance_present_score: parseFloat(e.target.value) || 1 }))}
                    className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Half Day Score</Label>
                  <Input type="number" step="0.1" min="0" max="2"
                    value={settingsForm.attendance_halfday_score}
                    onChange={(e) => setSettingsForm(f => ({ ...f, attendance_halfday_score: parseFloat(e.target.value) || 0.5 }))}
                    className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Absent Score</Label>
                  <Input type="number" step="0.1" min="0" max="2"
                    value={settingsForm.attendance_absent_score}
                    onChange={(e) => setSettingsForm(f => ({ ...f, attendance_absent_score: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono" />
                </div>
              </div>
            </div>

            {/* Score Bands */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-border/50 pb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Score Bands & Actions
              </h3>
              <p className="text-xs text-muted-foreground">Define what each KPI score range means and what action to take.</p>
              <div className="space-y-2">
                {settingsForm.score_bands.map((band, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center p-2 rounded-lg border border-border/40 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={band.color}
                        onChange={(e) => {
                          const bands = [...settingsForm.score_bands];
                          bands[i] = { ...bands[i], color: e.target.value };
                          setSettingsForm(f => ({ ...f, score_bands: bands }));
                        }}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <Input
                        type="number" step="0.01" value={band.min} placeholder="Min"
                        className="h-7 text-xs font-mono"
                        onChange={(e) => {
                          const bands = [...settingsForm.score_bands];
                          bands[i] = { ...bands[i], min: parseFloat(e.target.value) };
                          setSettingsForm(f => ({ ...f, score_bands: bands }));
                        }}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">to</span>
                      <Input
                        type="number" step="0.01" value={band.max} placeholder="Max"
                        className="h-7 text-xs font-mono"
                        onChange={(e) => {
                          const bands = [...settingsForm.score_bands];
                          bands[i] = { ...bands[i], max: parseFloat(e.target.value) };
                          setSettingsForm(f => ({ ...f, score_bands: bands }));
                        }}
                      />
                    </div>
                    <Input
                      value={band.label} placeholder="Label"
                      className="h-7 text-xs col-span-2"
                      onChange={(e) => {
                        const bands = [...settingsForm.score_bands];
                        bands[i] = { ...bands[i], label: e.target.value };
                        setSettingsForm(f => ({ ...f, score_bands: bands }));
                      }}
                    />
                    <Input
                      value={band.action} placeholder="Action"
                      className="h-7 text-xs col-span-2"
                      onChange={(e) => {
                        const bands = [...settingsForm.score_bands];
                        bands[i] = { ...bands[i], action: e.target.value };
                        setSettingsForm(f => ({ ...f, score_bands: bands }));
                      }}
                    />
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => setSettingsForm(f => ({
                    ...f,
                    score_bands: [...f.score_bands, { min: 0, max: 0, label: '', action: '', color: '#94a3b8' }]
                  }))}>
                  + Add Band
                </Button>
              </div>
            </div>

            {/* Monthly Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-border/50 pb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Monthly Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Monthly Score</Label>
                  <Input type="number" step="1" min="1" max="100"
                    value={settingsForm.monthly_max_score}
                    onChange={(e) => setSettingsForm(f => ({ ...f, monthly_max_score: parseFloat(e.target.value) || 10 }))}
                    className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fill Window (day of month)</Label>
                  <Input type="number" min="1" max="28"
                    value={settingsForm.monthly_fill_window_day}
                    onChange={(e) => setSettingsForm(f => ({ ...f, monthly_fill_window_day: parseInt(e.target.value) || 5 }))}
                    className="h-8 text-xs font-mono" />
                  <p className="text-[10px] text-muted-foreground">Manager can fill score from 1st to this date</p>
                </div>
              </div>
            </div>

            {/* Quarterly Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-border/50 pb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-500" /> Quarterly Settings
              </h3>
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-xs">Max Quarterly Score</Label>
                <Input type="number" step="1" min="1" max="100"
                  value={settingsForm.quarterly_max_score}
                  onChange={(e) => setSettingsForm(f => ({ ...f, quarterly_max_score: parseFloat(e.target.value) || 10 }))}
                  className="h-8 text-xs font-mono" />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveSettingsMutation.mutate(settingsForm)}
              disabled={saveSettingsMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
