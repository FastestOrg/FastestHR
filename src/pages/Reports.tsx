import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, BarChart3, Download, Filter, Users, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useMemo } from 'react';

export default function Reports() {
  const { profile } = useAuthStore();

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

  // Compute department headcount
  const deptHeadcount = useMemo(() => {
    // Single-pass O(N) aggregation to avoid O(N*M) bottlenecks
    const deptMap = employees.reduce((acc: Record<string, number>, e: any) => {
      const id = e.department_id;
      if (id) {
        acc[id] = (acc[id] || 0) + 1;
      }
      return acc;
    }, {});

    return departments.map((dept: any) => ({
      name: dept.name,
      count: deptMap[dept.id] || 0,
    })).sort((a, b) => b.count - a.count);
  }, [departments, employees]);

  const maxCount = useMemo(() => Math.max(...deptHeadcount.map(d => d.count), 1), [deptHeadcount]);

  // Employment type breakdown
  const empTypes = useMemo(() => {
    return employees.reduce((acc: Record<string, number>, e: any) => {
      const t = e.employment_type || 'unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
  }, [employees]);

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
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const isLoading = loadingDepts || loadingEmps;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Data visualization & export</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-border/50 text-muted-foreground hover:text-primary">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-6 flex items-center gap-4">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Total Employees</p>
            <p className="text-3xl font-bold">{employees.length}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-6 flex items-center gap-4">
          <BarChart3 className="h-8 w-8 text-info" />
          <div>
            <p className="text-sm text-muted-foreground">Departments</p>
            <p className="text-3xl font-bold">{departments.length}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-6 flex items-center gap-4">
          <PieChart className="h-8 w-8 text-success" />
          <div>
            <p className="text-sm text-muted-foreground">Employment Types</p>
            <p className="text-3xl font-bold">{Object.keys(empTypes).length}</p>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Headcount by Department */}
        <Card className="overflow-hidden col-span-1 lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5" /> Headcount by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : deptHeadcount.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No department data available</p>
              </div>
            ) : (
              <div className="h-64 flex items-end gap-4">
                {deptHeadcount.slice(0, 8).map(bar => (
                  <div key={bar.name} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">{bar.count}</span>
                    <div
                      className="w-full max-w-[40px] bg-primary/80 hover:bg-primary rounded-t transition-all cursor-pointer"
                      style={{ height: `${(bar.count / maxCount) * 100}%`, minHeight: bar.count > 0 ? '8px' : '0' }}
                    />
                    <span className="text-[10px] text-muted-foreground text-center line-clamp-1 w-full uppercase">{bar.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employment Type Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="w-5 h-5" /> Employment Type
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : Object.keys(empTypes).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <div className="space-y-4">
                <div className="relative w-40 h-40 mx-auto rounded-full border-8 border-border/50 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-bold">{employees.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase block">Total</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {Object.entries(empTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded-full" />
                      <span className="text-xs text-muted-foreground capitalize">
                        {type.replace('_', ' ')} ({count as number})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
