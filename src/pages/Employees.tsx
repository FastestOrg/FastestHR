import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Plus, Search, Grid3X3, List, Network } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { EmployeeOrgChart } from '@/components/employees/EmployeeOrgChart';
import { OrgChartPro } from '@/components/employees/OrgChartPro';

// ⚡ Bolt: Hoisted static object configuration outside of component body
// to prevent unnecessary memory reallocation on every render.
const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success',
  probation: 'bg-warning/10 text-warning',
  on_leave: 'bg-info/10 text-info',
  resigned: 'bg-muted text-muted-foreground',
  terminated: 'bg-destructive/10 text-destructive',
  absconded: 'bg-destructive/10 text-destructive',
};

export default function Employees() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [search, setSearch] = useState('');
  // ⚡ Bolt: Debounce search input to prevent firing an API call on every keystroke.
  // This reduces Supabase queries and React Query cache invalidations significantly.
  const debouncedSearch = useDebounce(search, 300);
  const [view, setView] = useState<'grid' | 'list' | 'org'>('grid');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', debouncedSearch, profile?.company_id],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('*, departments(name), designations(title)')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null);

      if (view !== 'org') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('first_name');
      }

      if (debouncedSearch) {
        query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,work_email.ilike.%${debouncedSearch}%`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">{employees.length} total employees</p>
        </div>
        <Button onClick={() => navigate('/employees/new')}>
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-9 bg-background/50 backdrop-blur-sm w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex justify-between sm:justify-start rounded-md border border-border/50 bg-background/50 p-1 backdrop-blur-sm">
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('grid')} title="Grid View" aria-label="Grid view" className="flex-1 sm:flex-none">
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')} title="List View" aria-label="List view" className="flex-1 sm:flex-none">
            <List className="h-4 w-4" />
          </Button>
          <Button variant={view === 'org' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('org')} title="Hierarchy View" aria-label="Hierarchy view" className="flex-1 sm:flex-none">
            <Network className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Users className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-lg font-medium">No employees yet</p>
              <p className="text-sm text-muted-foreground">Add your first employee to get started</p>
            </div>
            <Button onClick={() => navigate('/employees/new')}>
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </CardContent>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((emp: any) => (
            <Card key={emp.id} className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md hover:bg-card/80" onClick={() => navigate(`/employees/${emp.id}`)}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={emp.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary font-medium">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-semibold text-foreground">{emp.first_name} {emp.last_name}</p>
                    <p className="truncate text-sm text-muted-foreground mt-1">{(emp as any).designations?.title || 'No designation'}</p>
                    <p className="truncate text-xs text-muted-foreground/70 mt-0.5">{(emp as any).departments?.name || 'No department'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{emp.employee_code || '—'}</span>
                  <Badge className={statusColor[emp.status || 'active'] || ''} variant="secondary">
                    {emp.status || 'active'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : view === 'list' ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {employees.map((emp: any) => (
              <div key={emp.id} className="flex cursor-pointer items-center gap-4 p-4 transition-all hover:bg-muted/50" onClick={() => navigate(`/employees/${emp.id}`)}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={emp.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary font-medium text-sm">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{emp.first_name} {emp.last_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{(emp as any).designations?.title || '—'} · {(emp as any).departments?.name || '—'}</p>
                </div>
                <Badge className={statusColor[emp.status || 'active'] || ''} variant="secondary">
                  {emp.status || 'active'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground md:hidden text-center italic">✦ Swipe / drag to explore the organization chart</p>
          <div className="w-full overflow-x-auto pb-4 scrollbar-hide border border-border/40 rounded-xl bg-background/20 p-2">
            <div className="min-w-[640px]">
              <OrgChartPro employees={employees} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
