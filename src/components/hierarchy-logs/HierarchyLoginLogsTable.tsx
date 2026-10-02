import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useOrgClient } from '@/hooks/useOrgClient';
import { makeBYOSQueryKey } from '@/utils/byosUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ShieldAlert, ShieldCheck, Laptop, Smartphone,
  Tablet, Download, RefreshCw, ChevronLeft, ChevronRight,
  Filter, MapPin, Globe, User, Users, AlertCircle, Calendar
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface HierarchyLoginLogsTableProps {
  employeeId?: string; // Optional: Lock to a specific employee
  employeeName?: string;
  showSubordinateSelect?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
}

export function HierarchyLoginLogsTable({
  employeeId,
  employeeName,
  showSubordinateSelect = true,
  compact = false,
  title,
  description,
}: HierarchyLoginLogsTableProps) {
  const { profile } = useAuthStore();
  const { orgClient } = useOrgClient();
  const [search, setSearch] = useState('');
  const [selectedSubordinate, setSelectedSubordinate] = useState<string>(employeeId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = compact ? 10 : 25;

  // If locked employeeId changes, sync it
  if (employeeId && selectedSubordinate !== employeeId) {
    setSelectedSubordinate(employeeId);
  }

  // Fetch subordinate list for filter dropdown
  const { data: subordinates = [], isLoading: isLoadingSubs } = useQuery({
    queryKey: makeBYOSQueryKey('hierarchy-subordinates', orgClient, profile?.company_id, []),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hierarchy_subordinates');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id && showSubordinateSelect && !employeeId,
  });

  // Fetch paginated login logs via recursive RPC
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: makeBYOSQueryKey('hierarchy-login-logs', orgClient, profile?.company_id, [
      selectedSubordinate,
      search,
      statusFilter,
      deviceFilter,
      page,
      pageSize,
    ]),
    queryFn: async () => {
      const targetEmp = selectedSubordinate !== 'all' ? selectedSubordinate : null;
      const status = statusFilter !== 'all' ? statusFilter : null;
      const device = deviceFilter !== 'all' ? deviceFilter : null;

      const { data, error } = await supabase.rpc('get_hierarchy_login_logs', {
        p_filter_employee_id: targetEmp,
        p_search: search.trim() || null,
        p_status: status,
        p_device_type: device,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const logs = logsData || [];
  const totalCount = logs[0]?.total_count ? Number(logs[0].total_count) : logs.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Device icon helper
  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <Laptop className="w-3.5 h-3.5 text-primary" />;
    }
  };

  // Hierarchy depth badge helper
  const getHierarchyBadge = (relation?: string, depth?: number) => {
    if (relation === 'Self' || depth === 0) {
      return (
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
          Self
        </Badge>
      );
    }
    if (relation === 'Direct Report' || depth === 1) {
      return (
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          Direct Report
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
        {relation || `Level ${depth} Subordinate`}
      </Badge>
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!logs.length) {
      toast.error('No login logs to export');
      return;
    }

    const headers = [
      'Timestamp',
      'Employee Name',
      'Employee Code',
      'Hierarchy Relation',
      'Manager Name',
      'Status',
      'IP Address',
      'Location',
      'Device Type',
      'Browser',
      'OS',
      'Login Method'
    ];

    const rows = logs.map((log) => [
      `"${format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}"`,
      `"${log.first_name} ${log.last_name}"`,
      `"${log.employee_code || ''}"`,
      `"${log.hierarchy_relation || ''}"`,
      `"${log.manager_name || ''}"`,
      `"${log.status}"`,
      `"${log.ip_address || ''}"`,
      `"${[log.city, log.country].filter(Boolean).join(', ')}"`,
      `"${log.device_type || ''}"`,
      `"${log.browser || ''}"`,
      `"${log.os || ''}"`,
      `"${log.login_method || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hierarchy_login_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Login logs exported to CSV');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      {(title || description) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {title && <h3 className="text-lg font-bold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={exportToCSV}
              disabled={!logs.length}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employee, email, IP, city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8 h-9 text-xs bg-background/50"
          />
        </div>

        {/* Subordinate Selector */}
        {showSubordinateSelect && !employeeId && (
          <Select
            value={selectedSubordinate}
            onValueChange={(val) => {
              setSelectedSubordinate(val);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 text-xs bg-background/50">
              <SelectValue placeholder="All Subordinates & Self" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">
                <span className="font-semibold">All Accessible People ({subordinates.length})</span>
              </SelectItem>
              {subordinates.map((sub: any) => (
                <SelectItem key={sub.id} value={sub.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{sub.first_name} {sub.last_name}</span>
                    <span className="text-[10px] text-muted-foreground">({sub.relation_label})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Device Filter */}
        <Select
          value={deviceFilter}
          onValueChange={(val) => {
            setDeviceFilter(val);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="All Devices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            <SelectItem value="desktop">Desktop / Laptop</SelectItem>
            <SelectItem value="mobile">Mobile Phones</SelectItem>
            <SelectItem value="tablet">Tablets</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success Only</SelectItem>
            <SelectItem value="failed">Failed Logins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Scope Info Banner */}
      {!employeeId && subordinates.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>
              Hierarchy Scope: Monitoring <strong>{subordinates.length}</strong> team member{subordinates.length > 1 ? 's' : ''} under your reporting line.
            </span>
          </div>
          <span className="font-mono text-[11px] text-foreground/70">
            Showing {logs.length} of {totalCount} log{totalCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Table Content */}
      <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden backdrop-blur-sm shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border/60">
              <TableHead className="text-xs font-semibold">Employee</TableHead>
              <TableHead className="text-xs font-semibold">Hierarchy Position</TableHead>
              <TableHead className="text-xs font-semibold">Login Time</TableHead>
              <TableHead className="text-xs font-semibold">Device & Browser</TableHead>
              <TableHead className="text-xs font-semibold">Network & IP</TableHead>
              <TableHead className="text-xs font-semibold text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingLogs ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-10 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ShieldAlert className="w-8 h-8 opacity-40" />
                    <p className="font-medium text-sm">No login activity records found</p>
                    <p className="text-xs text-muted-foreground/70 max-w-sm">
                      {search || selectedSubordinate !== 'all' || statusFilter !== 'all'
                        ? 'No logs matched your active search or filters.'
                        : 'No team login events have been logged under your hierarchy branch yet.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log: any) => {
                const isFailed = log.status === 'failed';
                const createdDate = new Date(log.created_at);

                return (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors border-b border-border/40">
                    {/* Employee Profile */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-border/60">
                          <AvatarImage src={log.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {log.first_name?.[0]}{log.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-foreground truncate">
                            {log.first_name} {log.last_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {log.designation_title} · {log.department_name}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Hierarchy Info */}
                    <TableCell>
                      <div className="space-y-1">
                        {getHierarchyBadge(log.hierarchy_relation, log.hierarchy_depth)}
                        <p className="text-[10px] text-muted-foreground truncate" title={`Reports to: ${log.manager_name}`}>
                          Reports to: <span className="text-foreground/80">{log.manager_name}</span>
                        </p>
                      </div>
                    </TableCell>

                    {/* Timestamp */}
                    <TableCell>
                      <div className="text-xs text-foreground">
                        <span className="font-medium">
                          {formatDistanceToNow(createdDate, { addSuffix: true })}
                        </span>
                        <div className="text-[10px] text-muted-foreground">
                          {format(createdDate, 'MMM d, yyyy · HH:mm:ss')}
                        </div>
                      </div>
                    </TableCell>

                    {/* Device & Browser */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-muted/60 shrink-0">
                          {getDeviceIcon(log.device_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {log.browser || 'Browser'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {log.os || 'OS'} · <span className="capitalize">{log.device_type || 'Desktop'}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* IP & Location */}
                    <TableCell>
                      <div className="text-xs">
                        <span className="font-mono text-xs text-foreground/90">
                          {log.ip_address || 'Direct'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          <span className="truncate">
                            {[log.city, log.country].filter(Boolean).join(', ') || 'Unknown Location'}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase font-semibold tracking-wider",
                          isFailed
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {isFailed ? (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> Success
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong> ({totalCount} total entries)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoadingLogs}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoadingLogs}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
