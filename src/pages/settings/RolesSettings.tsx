import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function RolesSettings() {
  const roles = [
    { name: 'Company Admin', key: 'company_admin', desc: 'Full access to all modules, settings, billing, and user management', color: 'text-primary bg-primary/10 border-primary/20' },
    { name: 'HR Manager', key: 'hr_manager', desc: 'Access to HR modules (employees, leave, attendance, payroll, performance, onboarding, exit)', color: 'text-info bg-info/10 border-info/20' },
    { name: 'Recruiter', key: 'recruiter', desc: 'Employee-level access plus Recruitment module', color: 'text-warning bg-warning/10 border-warning/20' },
    { name: 'Employee', key: 'user', desc: 'Self-service access: attendance, leave, performance, helpdesk, announcements, documents', color: 'text-success bg-success/10 border-success/20' },
  ];

  const permissions = ['Dashboard', 'Employees', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Recruitment', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Reports', 'Onboarding', 'Org Chart', 'Exit Mgmt', 'Settings'];
  const rolePerms: Record<string, string[]> = {
    company_admin: permissions,
    hr_manager: ['Dashboard', 'Employees', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Reports', 'Onboarding', 'Org Chart', 'Exit Mgmt'],
    recruiter: ['Dashboard', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Recruitment', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Org Chart'],
    user: ['Dashboard', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Org Chart'],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Roles & Access</h2>
        <p className="text-sm text-muted-foreground mt-1">Review system roles and their modular access privileges</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            {roles.map(role => (
              <div key={role.key} className={`rounded-xl border p-5 transition-all duration-200 ${role.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    {role.name}
                  </h4>
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold border-current/30">{role.key.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs opacity-90 mb-4">{role.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {permissions.map(perm => {
                    const hasPerm = rolePerms[role.key]?.includes(perm);
                    return (
                      <Badge 
                        key={perm} 
                        variant="outline" 
                        className={`text-[9px] font-semibold py-0.5 px-2 ${hasPerm ? 'bg-background/80 border-current/25 text-foreground' : 'opacity-25 line-through border-transparent'}`}
                      >
                        {perm}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
