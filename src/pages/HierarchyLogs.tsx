import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useOrgClient } from '@/hooks/useOrgClient';
import { makeBYOSQueryKey } from '@/utils/byosUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HierarchyLoginLogsTable } from '@/components/hierarchy-logs/HierarchyLoginLogsTable';
import { 
  ShieldCheck, ShieldAlert, Users, Network, Laptop, 
  Smartphone, ArrowRight, ArrowUpRight, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HierarchyLogs() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { orgClient } = useOrgClient();

  // Fetch subordinate scope for quick KPIs
  const { data: subordinates = [], isLoading: isLoadingSubs } = useQuery({
    queryKey: makeBYOSQueryKey('hierarchy-subordinates-kpi', orgClient, profile?.company_id, []),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hierarchy_subordinates');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch high-level summary of logs
  const { data: recentLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: makeBYOSQueryKey('hierarchy-logs-summary', orgClient, profile?.company_id, []),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hierarchy_login_logs', {
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const kpis = useMemo(() => {
    const totalMonitored = subordinates.length;
    const directReports = subordinates.filter((s: any) => s.depth === 1).length;
    const downlineSubordinates = subordinates.filter((s: any) => s.depth > 1).length;

    let failedCount = 0;
    let mobileCount = 0;
    let desktopCount = 0;

    recentLogs.forEach((l: any) => {
      if (l.status === 'failed') failedCount++;
      if (l.device_type === 'mobile') mobileCount++;
      if (l.device_type === 'desktop') desktopCount++;
    });

    return {
      totalMonitored,
      directReports,
      downlineSubordinates,
      failedCount,
      mobileCount,
      desktopCount,
      totalRecent: recentLogs.length,
    };
  }, [subordinates, recentLogs]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Hierarchy Login Logs
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Audit sign-in history, active sessions, and client device telemetry across your organizational downline.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 text-xs h-9 border-border/60 hover:border-primary/40 shadow-sm"
            onClick={() => navigate('/org-chart')}
          >
            <Network className="h-4 w-4 text-primary" />
            Explore Org Chart
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Team Subordinates
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoadingSubs ? <Skeleton className="h-7 w-12" /> : kpis.totalMonitored}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {kpis.directReports} direct · {kpis.downlineSubordinates} indirect
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Audit Entries
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoadingLogs ? <Skeleton className="h-7 w-12" /> : kpis.totalRecent}
              </h3>
              <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                Live hierarchy telemetry
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Device Distribution
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoadingLogs ? <Skeleton className="h-7 w-12" /> : `${kpis.desktopCount}D / ${kpis.mobileCount}M`}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Desktop vs Mobile
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
              <Laptop className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Security Alerts
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoadingLogs ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className={kpis.failedCount > 0 ? 'text-rose-400' : 'text-foreground'}>
                    {kpis.failedCount} failed
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {kpis.failedCount > 0 ? 'Review failed attempts below' : 'All logins normal'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Logs Table */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-lg p-5">
        <HierarchyLoginLogsTable
          title="Team Activity Log"
          description="Login sessions recorded for employees in your reporting chain. Filter by subordinate, device type, or search by IP and location."
          showSubordinateSelect={true}
        />
      </Card>
    </div>
  );
}
