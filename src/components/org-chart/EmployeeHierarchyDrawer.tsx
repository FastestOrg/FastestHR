import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mail, Phone, Calendar, Briefcase, Building2, MapPin, 
  Users, ChevronRight, Focus, UserCheck, ShieldCheck, 
  ExternalLink, UserMinus, UserPlus, ArrowRight
} from 'lucide-react';
import { HierarchyLoginLogsTable } from '@/components/hierarchy-logs/HierarchyLoginLogsTable';
import { useNavigate } from 'react-router-dom';

export interface EmployeeHierarchyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any | null;
  allEmployees: any[];
  initialTab?: 'overview' | 'logs';
  onFocusBranch?: (id: string) => void;
  onChangeManager?: (employee: any) => void;
  canManage?: boolean;
}

export function EmployeeHierarchyDrawer({
  open,
  onOpenChange,
  employee,
  allEmployees,
  initialTab = 'overview',
  onFocusBranch,
  onChangeManager,
  canManage = false,
}: EmployeeHierarchyDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>(initialTab);

  if (!employee) return null;

  // Find direct reports
  const directReports = allEmployees.filter(
    (e) => e.reporting_manager_id === employee.id && e.id !== employee.id
  );

  // Compute reporting chain (ancestors from root to employee)
  const reportingChain: any[] = [];
  let currentMgrId = employee.reporting_manager_id;
  const visited = new Set<string>();

  while (currentMgrId && !visited.has(currentMgrId)) {
    visited.add(currentMgrId);
    const mgr = allEmployees.find((e) => e.id === currentMgrId);
    if (mgr) {
      reportingChain.unshift(mgr);
      currentMgrId = mgr.reporting_manager_id;
    } else {
      break;
    }
  }

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l border-border/60">
        {/* Drawer Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border/40 bg-card/40">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/40 shadow-lg shadow-primary/10 shrink-0">
              <AvatarImage src={employee.avatar_url} />
              <AvatarFallback className="text-xl bg-primary/15 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-xl font-bold text-foreground truncate">
                  {employee.first_name} {employee.last_name}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className={
                    employee.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]'
                      : 'bg-muted text-muted-foreground text-[10px]'
                  }
                >
                  {employee.status || 'active'}
                </Badge>
              </div>

              <SheetDescription className="text-sm font-medium text-primary mt-0.5 truncate">
                {employee.designations?.title || 'Team Member'}
              </SheetDescription>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {employee.departments?.name && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    <Building2 className="w-2.5 h-2.5 mr-1" />
                    {employee.departments.name}
                  </Badge>
                )}
                {employee.employee_code && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ID: {employee.employee_code}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted/60">
              <TabsTrigger value="overview" className="text-xs gap-1.5">
                <Users className="w-3.5 h-3.5" /> Overview & Team
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs gap-1.5 text-primary font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Login History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' ? (
            <>
              {/* Quick Actions Row */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs gap-1.5"
                  onClick={() => navigate(`/employees/${employee.id}`)}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full Employee Profile
                </Button>
                {directReports.length > 0 && onFocusBranch && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => {
                      onFocusBranch(employee.id);
                      onOpenChange(false);
                    }}
                  >
                    <Focus className="w-3.5 h-3.5" /> Focus Branch
                  </Button>
                )}
                {canManage && onChangeManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5"
                    onClick={() => onChangeManager(employee)}
                  >
                    Change Manager
                  </Button>
                )}
              </div>

              {/* Reporting Chain Breadcrumbs */}
              <div className="space-y-2 p-3.5 rounded-xl bg-card/60 border border-border/50">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Hierarchy Chain
                </h4>
                
                <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                  {reportingChain.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      ✦ Top of the hierarchy (No reporting manager)
                    </span>
                  ) : (
                    reportingChain.map((mgr, idx) => (
                      <div key={mgr.id} className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground/90 bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                          {mgr.first_name} {mgr.last_name}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      </div>
                    ))
                  )}
                  <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/30">
                    {employee.first_name} {employee.last_name} (Current)
                  </span>
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-card/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>Work Email</span>
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {employee.work_email || 'Not assigned'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>Phone</span>
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {employee.phone || 'Not shared'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                    <span>Employment Type</span>
                  </div>
                  <p className="text-xs font-medium text-foreground capitalize truncate">
                    {employee.employment_type?.replace('_', ' ') || 'Full Time'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-card/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Date of Joining</span>
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {employee.date_of_joining
                      ? new Date(employee.date_of_joining).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Direct Subordinates Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Direct Reports ({directReports.length})
                  </h4>
                </div>

                {directReports.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                    No direct reports. This employee is an individual contributor.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 border border-border/60 rounded-xl overflow-hidden bg-card/40">
                    {directReports.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8 border border-border/60 shrink-0">
                            <AvatarImage src={sub.avatar_url} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {sub.first_name[0]}{sub.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {sub.first_name} {sub.last_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {sub.designations?.title || 'Team Member'}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary hover:bg-primary/10"
                          onClick={() => {
                            navigate(`/employees/${sub.id}`);
                            onOpenChange(false);
                          }}
                        >
                          View <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Login Logs Tab */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Hierarchy Login Audit</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Viewing secure sign-in history for <strong>{employee.first_name} {employee.last_name}</strong>.
                  Only managers positioned above this employee in the organizational hierarchy and administrators can access these records.
                </p>
              </div>

              <HierarchyLoginLogsTable
                employeeId={employee.id}
                employeeName={`${employee.first_name} ${employee.last_name}`}
                compact={true}
                showSubordinateSelect={false}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
