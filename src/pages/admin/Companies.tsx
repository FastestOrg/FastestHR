import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Building2, Loader2, Power, ShieldCheck, Database } from 'lucide-react';
import { toast } from 'sonner';

export default function Companies() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['admin-companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url, plan, is_active, byos_enabled, created_at, license_limit')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: employeeCounts = {} } = useQuery({
    queryKey: ['admin-companies-emp-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('company_id');

      if (error || !data) return {};
      const counts: Record<string, number> = {};
      data.forEach((e: any) => {
        if (e.company_id) {
          counts[e.company_id] = (counts[e.company_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies-list'] });
      toast.success(newStatus ? 'Tenant activated successfully' : 'Tenant suspended');
    },
    onError: (err: any) => {
      toast.error('Failed to update tenant status: ' + err.message);
    },
  });

  const filtered = companies.filter((c: any) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return c.is_active;
    if (statusFilter === 'suspended') return !c.is_active;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Platform Companies</h1>
          <p className="text-muted-foreground mt-1">SuperAdmin — Live Multi-Tenant Directory</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs bg-primary/10 border-primary/20 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Total Tenants: {companies.length}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, slug or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 text-sm" 
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Badge 
            variant="outline" 
            onClick={() => setStatusFilter('all')}
            className={`cursor-pointer text-xs font-medium uppercase px-3 py-1 ${
              statusFilter === 'all' 
                ? 'border-primary text-primary bg-primary/10' 
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({companies.length})
          </Badge>
          <Badge 
            variant="outline" 
            onClick={() => setStatusFilter('active')}
            className={`cursor-pointer text-xs font-medium uppercase px-3 py-1 ${
              statusFilter === 'active' 
                ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' 
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Active ({companies.filter((c: any) => c.is_active).length})
          </Badge>
          <Badge 
            variant="outline" 
            onClick={() => setStatusFilter('suspended')}
            className={`cursor-pointer text-xs font-medium uppercase px-3 py-1 ${
              statusFilter === 'suspended' 
                ? 'border-destructive text-destructive bg-destructive/10' 
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Suspended ({companies.filter((c: any) => !c.is_active).length})
          </Badge>
        </div>
      </div>

      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span>Loading tenants from platform database...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No company tenants match your filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3">Tenant & ID</th>
                    <th className="px-6 py-3">Plan / Mode</th>
                    <th className="px-6 py-3">Active Employees</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((company: any) => {
                    const empCount = employeeCounts[company.id] || 0;
                    return (
                      <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                              {company.logo_url ? (
                                <img src={company.logo_url} alt="" className="w-full h-full object-contain rounded-xl" />
                              ) : (
                                <Building2 className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-2">
                                {company.name}
                                {company.byos_enabled && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-purple-500/30 text-purple-600 bg-purple-500/10 flex items-center gap-0.5">
                                    <Database className="w-2.5 h-2.5" /> BYOS
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">{company.slug || company.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize text-xs border-border/50">
                            {company.plan || 'Free Trial'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {empCount} {empCount === 1 ? 'employee' : 'employees'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] uppercase px-2 py-0.5 ${
                              company.is_active 
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                                : 'bg-destructive/10 text-destructive border-destructive/30'
                            }`}
                          >
                            {company.is_active ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggleStatusMutation.isPending}
                            onClick={() => toggleStatusMutation.mutate({ id: company.id, newStatus: !company.is_active })}
                            className={`text-xs gap-1.5 ${
                              company.is_active 
                                ? 'text-destructive hover:text-destructive hover:bg-destructive/10' 
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {company.is_active ? 'Suspend' : 'Activate'}
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
    </div>
  );
}
