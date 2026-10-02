import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useOrgClient } from '@/hooks/useOrgClient';
import { makeBYOSQueryKey } from '@/utils/byosUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FullScaleOrgChart } from '@/components/org-chart/FullScaleOrgChart';
import { 
  Network, Users, Building2, UserCheck, ShieldCheck, 
  ExternalLink, Layers, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OrgChart() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { orgClient, isBYOS } = useOrgClient();
  const isAdminOrHR = 
    profile?.platform_role === 'company_admin' || 
    profile?.platform_role === 'super_admin' ||
    profile?.platform_role === 'hr_manager';

  // Fetch all active company employees
  const { 
    data: employees = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: makeBYOSQueryKey('org-chart-employees', orgClient, profile?.company_id, []),
    queryFn: async () => {
      let query = orgClient
        .from('employees')
        .select('*, departments(name), designations(title)')
        .is('deleted_at', null)
        .order('first_name');

      if (!isBYOS && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Calculate high-level hierarchy statistics
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    
    // Find unique departments
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.departments?.name) depts.add(e.departments.name);
    });

    // Find managers (employees who have at least one direct report)
    const managerIds = new Set<string>();
    employees.forEach(e => {
      if (e.reporting_manager_id && e.reporting_manager_id !== e.id) {
        managerIds.add(e.reporting_manager_id);
      }
    });

    // Compute max hierarchy depth
    const memoDepth = new Map<string, number>();
    const getDepth = (id: string, visited: Set<string>): number => {
      if (visited.has(id)) return 1;
      visited.add(id);
      if (memoDepth.has(id)) return memoDepth.get(id)!;
      const emp = employees.find(e => e.id === id);
      if (!emp || !emp.reporting_manager_id || emp.reporting_manager_id === emp.id) {
        return 1;
      }
      const d = 1 + getDepth(emp.reporting_manager_id, new Set(visited));
      memoDepth.set(id, d);
      return d;
    };

    let maxD = 1;
    employees.forEach(e => {
      maxD = Math.max(maxD, getDepth(e.id, new Set()));
    });

    return {
      totalEmployees,
      totalDepartments: depts.size,
      totalManagers: managerIds.size,
      maxDepth: maxD,
    };
  }, [employees]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Organisational Chart
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Explore reporting relationships, leadership structure, and team hierarchies.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 text-xs h-9 border-border/60 hover:border-primary/40 shadow-sm"
            onClick={() => navigate('/hierarchy-logs')}
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            Team Login Logs
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="default"
            className="gap-2 text-xs h-9 shadow-md shadow-primary/20"
            onClick={() => navigate('/employees')}
          >
            <Users className="h-4 w-4" />
            Employees List
          </Button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Headcount
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoading ? <Skeleton className="h-7 w-14" /> : stats.totalEmployees}
              </h3>
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
                People Managers
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoading ? <Skeleton className="h-7 w-14" /> : stats.totalManagers}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Departments
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoading ? <Skeleton className="h-7 w-14" /> : stats.totalDepartments}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Hierarchy Depth
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {isLoading ? <Skeleton className="h-7 w-14" /> : `${stats.maxDepth} Levels`}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Canvas */}
      {isLoading ? (
        <Card className="h-[700px] border-border/60 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              Mapping Organization Structure...
            </p>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <Card className="p-12 text-center border-border/60">
          <Network className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-semibold">No Employee Records Available</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add team members and assign reporting managers to build your organizational tree.
          </p>
          <Button className="mt-4" onClick={() => navigate('/employees/new')}>
            Add First Employee
          </Button>
        </Card>
      ) : (
        <FullScaleOrgChart
          employees={employees}
          canManage={isAdminOrHR}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}
