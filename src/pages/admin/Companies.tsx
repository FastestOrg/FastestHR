import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Building2, MoreHorizontal } from 'lucide-react';

export default function Companies() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Platform Companies</h1>
          <p className="text-muted-foreground mt-1">SuperAdmin - Multi-tenant management</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> ONBOARD_TENANT
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="SEARCH_TENANTS..." className="pl-9 bg-background/50 border-border/50 text-sm" />
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="border-primary text-primary bg-primary/10 cursor-pointer text-[10px] font-medium uppercase">All</Badge>
           <Badge variant="outline" className="border-transparent text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-medium uppercase">Active</Badge>
           <Badge variant="outline" className="border-transparent text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-medium uppercase">Suspended</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase bg-primary/5 text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="px-6 py-3">Tenant / ID</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Employees</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {[
                  { id: 'T-10042', name: 'CyberDyne Systems', plan: 'Enterprise', empCount: 1450, status: 'Active' },
                  { id: 'T-10043', name: 'Weyland-Yutani Corp', plan: 'Enterprise', empCount: 8900, status: 'Active' },
                  { id: 'T-10044', name: 'Initech', plan: 'Growth', empCount: 42, status: 'Trial' },
                  { id: 'T-10045', name: 'Hooli', plan: 'Starter', empCount: 12, status: 'Suspended' },
                ].map(company => (
                  <tr key={company.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary border border-border/50 shadow-[0_0_5px_currentColor]">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-primary">{company.name}</div>
                          <div className="text-[10px] text-muted-foreground">{company.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="border-border/50 text-xs">{company.plan}</Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{company.empCount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`text-[10px] uppercase px-2 py-0 h-5 ${
                        company.status === 'Active' ? 'bg-success/10 text-success border-success/30' :
                        company.status === 'Trial' ? 'bg-info/10 text-info border-info/30' :
                        'bg-destructive/10 text-destructive border-destructive/30'
                      }`}>
                        {company.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Company actions" title="Company actions">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
