import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, ChevronDown, ChevronUp, ShieldCheck, Focus, 
  Eye, Building2, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export interface OrgNodeData {
  id: string;
  first_name: string;
  last_name: string;
  employee_code?: string | null;
  avatar_url?: string | null;
  designation: string;
  department: string;
  status?: string;
  is_root?: boolean;
  direct_reports_count: number;
  total_subordinates_count: number;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  direction?: 'TB' | 'LR';
  canViewLogs?: boolean;
  onToggleCollapse?: (id: string) => void;
  onFocusBranch?: (id: string) => void;
  onOpenDrawer?: (id: string, initialTab?: 'overview' | 'logs') => void;
}

export const OrgNodeCard = memo(({ data, selected }: { data: OrgNodeData; selected?: boolean }) => {
  const isTB = (data.direction || 'TB') === 'TB';
  const hasReports = data.direct_reports_count > 0;
  const isRoot = data.is_root;

  const targetPosition = isTB ? Position.Top : Position.Left;
  const sourcePosition = isTB ? Position.Bottom : Position.Right;

  const initials = useMemo(() => {
    return `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase() || 'U';
  }, [data.first_name, data.last_name]);

  const statusVariant = useMemo(() => {
    switch (data.status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'probation':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'on_leave':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'resigned':
      case 'terminated':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border/40';
    }
  }, [data.status]);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "group relative rounded-2xl transition-all duration-300 select-none",
          "w-[260px] bg-card/85 backdrop-blur-xl border border-border/60 shadow-xl",
          "hover:shadow-2xl hover:border-primary/60 hover:-translate-y-0.5",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-primary/25",
          isRoot && "border-primary/40 bg-gradient-to-b from-primary/10 via-card/90 to-card/90"
        )}
      >
        {/* Connection Handles */}
        <Handle
          type="target"
          position={targetPosition}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background shadow-md transition-transform group-hover:scale-125"
        />
        <Handle
          type="source"
          position={sourcePosition}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background shadow-md transition-transform group-hover:scale-125"
        />

        {/* Top Header Strip for Root or Management */}
        {isRoot ? (
          <div className="flex items-center justify-between px-3 py-1 bg-primary/15 border-b border-primary/20 rounded-t-2xl text-[10px] font-semibold text-primary tracking-wider uppercase">
            <span>Executive / Root</span>
            {data.total_subordinates_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {data.total_subordinates_count} team
              </span>
            )}
          </div>
        ) : hasReports ? (
          <div className="flex items-center justify-between px-3 py-1 bg-muted/40 border-b border-border/40 rounded-t-2xl text-[10px] font-medium text-muted-foreground">
            <span>People Manager</span>
            <span className="flex items-center gap-1 font-semibold text-foreground/80">
              <Users className="w-3 h-3 text-primary" /> {data.direct_reports_count} direct · {data.total_subordinates_count} total
            </span>
          </div>
        ) : null}

        {/* Card Body */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <Avatar className={cn(
                "h-12 w-12 border-2 shadow-md transition-transform group-hover:scale-105",
                isRoot ? "border-primary shadow-primary/20" : "border-border/80"
              )}>
                <AvatarImage src={data.avatar_url || ''} alt={data.first_name} />
                <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                  data.status === 'active' ? "bg-emerald-500" :
                  data.status === 'on_leave' ? "bg-sky-500" :
                  data.status === 'probation' ? "bg-amber-500" : "bg-muted-foreground"
                )}
                title={data.status || 'active'}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {data.first_name} {data.last_name}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                {data.designation}
              </p>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {data.department && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/60 bg-muted/30 text-muted-foreground font-normal truncate max-w-[130px]">
                    <Building2 className="w-2.5 h-2.5 mr-1 shrink-0 opacity-60" />
                    {data.department}
                  </Badge>
                )}
                {data.employee_code && (
                  <span className="text-[9px] font-mono text-muted-foreground/70">
                    {data.employee_code}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-1">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onOpenDrawer?.(data.id, 'overview');
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  View Profile & Hierarchy
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onOpenDrawer?.(data.id, 'logs');
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  View Hierarchy Login Logs
                </TooltipContent>
              </Tooltip>

              {hasReports && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onFocusBranch?.(data.id);
                      }}
                    >
                      <Focus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Focus on this Manager's Branch
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Expand / Collapse Subtree Toggle */}
            {hasReports && (
              <Button
                variant={data.isCollapsed ? "default" : "secondary"}
                size="sm"
                className={cn(
                  "h-6 px-2 text-[10px] font-medium gap-1 rounded-full shrink-0 shadow-sm",
                  data.isCollapsed
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  data.onToggleCollapse?.(data.id);
                }}
              >
                {data.isCollapsed ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>+{data.direct_reports_count}</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>{data.direct_reports_count}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});

OrgNodeCard.displayName = 'OrgNodeCard';
