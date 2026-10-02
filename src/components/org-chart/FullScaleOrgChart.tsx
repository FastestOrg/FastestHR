import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { OrgNodeCard, OrgNodeData } from './OrgNodeCard';
import { EmployeeHierarchyDrawer } from './EmployeeHierarchyDrawer';
import { ChangeManagerDialog } from './ChangeManagerDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Search, Maximize2, Minimize2, Users, Building2,
  Filter, RotateCcw, ArrowDownUp, ArrowLeftRight,
  ShieldCheck, FolderTree, ChevronsDown, ChevronsUp,
  Download, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const nodeTypes = {
  custom: OrgNodeCard,
};

const NODE_WIDTH = 260;
const NODE_HEIGHT = 145;

interface FullScaleOrgChartProps {
  employees: any[];
  canManage?: boolean;
  onRefresh?: () => void;
  className?: string;
  defaultFocusId?: string | null;
}

// Helper to layout elements using Dagre
function getLayoutedElements(
  nodes: Node<OrgNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: direction === 'TB' ? 40 : 50,
    ranksep: direction === 'TB' ? 60 : 70,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'TB' ? ('top' as any) : ('left' as any),
      sourcePosition: direction === 'TB' ? ('bottom' as any) : ('right' as any),
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function OrgChartCanvas({
  employees,
  canManage = false,
  onRefresh,
  className,
  defaultFocusId = null,
}: FullScaleOrgChartProps) {
  const { setCenter, fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusManagerId, setFocusManagerId] = useState<string | null>(defaultFocusId);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer and Dialog state
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'overview' | 'logs'>('overview');
  const [changeManagerEmp, setChangeManagerEmp] = useState<any | null>(null);

  // Build department options
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.departments?.name) set.add(emp.departments.name);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Map employee children & counts
  const { childrenMap, subordinatesCountMap } = useMemo(() => {
    const cMap = new Map<string, string[]>();
    employees.forEach((e) => {
      if (e.reporting_manager_id && e.reporting_manager_id !== e.id) {
        const list = cMap.get(e.reporting_manager_id) || [];
        list.push(e.id);
        cMap.set(e.reporting_manager_id, list);
      }
    });

    // Compute total recursive subordinates count
    const sMap = new Map<string, number>();
    const countSubordinates = (id: string, visited: Set<string>): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const kids = cMap.get(id) || [];
      let total = kids.length;
      for (const kid of kids) {
        total += countSubordinates(kid, new Set(visited));
      }
      return total;
    };

    employees.forEach((e) => {
      sMap.set(e.id, countSubordinates(e.id, new Set()));
    });

    return { childrenMap: cMap, subordinatesCountMap: sMap };
  }, [employees]);

  // Compute set of hidden node IDs based on collapsed state and focus mode
  const visibleEmployeeIds = useMemo(() => {
    let basePool = employees;

    // If focused on a specific manager, isolate to that manager + descendants
    if (focusManagerId) {
      const allowed = new Set<string>([focusManagerId]);
      const queue = [focusManagerId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const kids = childrenMap.get(current) || [];
        kids.forEach((k) => {
          if (!allowed.has(k)) {
            allowed.add(k);
            queue.push(k);
          }
        });
      }
      basePool = employees.filter((e) => allowed.has(e.id));
    }

    // Apply department filter if active
    if (selectedDept !== 'all') {
      basePool = basePool.filter(
        (e) => e.departments?.name === selectedDept || !e.reporting_manager_id
      );
    }

    // Now prune collapsed subtrees
    const hidden = new Set<string>();
    collapsedIds.forEach((collapsedId) => {
      // Find all recursive descendants of collapsedId
      const queue = [...(childrenMap.get(collapsedId) || [])];
      while (queue.length > 0) {
        const kid = queue.shift()!;
        if (!hidden.has(kid)) {
          hidden.add(kid);
          const grandKids = childrenMap.get(kid) || [];
          queue.push(...grandKids);
        }
      }
    });

    return new Set(
      basePool.filter((e) => !hidden.has(e.id)).map((e) => e.id)
    );
  }, [employees, focusManagerId, selectedDept, collapsedIds, childrenMap]);

  // Toggle node collapse
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Open Drawer
  const handleOpenDrawer = useCallback(
    (id: string, initialTab: 'overview' | 'logs' = 'overview') => {
      const emp = employees.find((e) => e.id === id);
      if (emp) {
        setSelectedEmployee(emp);
        setDrawerInitialTab(initialTab);
        setDrawerOpen(true);
      }
    },
    [employees]
  );

  // Focus branch
  const handleFocusBranch = useCallback((id: string) => {
    setFocusManagerId(id);
    toast.info(`Focused on branch manager`);
  }, []);

  // Expand all / Collapse all
  const handleExpandAll = useCallback(() => {
    setCollapsedIds(new Set());
    toast.success('Expanded all organization branches');
  }, []);

  const handleCollapseAll = useCallback(() => {
    // Collapse all nodes that have children
    const withKids = employees
      .filter((e) => (childrenMap.get(e.id) || []).length > 0)
      .map((e) => e.id);
    setCollapsedIds(new Set(withKids));
    toast.info('Collapsed all manager branches');
  }, [employees, childrenMap]);

  // Build nodes and edges
  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    const rawNodes: Node<OrgNodeData>[] = [];
    const rawEdges: Edge[] = [];

    employees.forEach((emp) => {
      if (!visibleEmployeeIds.has(emp.id)) return;

      const directKids = childrenMap.get(emp.id) || [];
      const hasKids = directKids.length > 0;
      const isRoot = !emp.reporting_manager_id || (focusManagerId === emp.id);

      rawNodes.push({
        id: emp.id,
        type: 'custom',
        data: {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          employee_code: emp.employee_code,
          avatar_url: emp.avatar_url,
          designation: emp.designations?.title || 'Team Member',
          department: emp.departments?.name || '',
          status: emp.status || 'active',
          is_root: isRoot,
          direct_reports_count: directKids.length,
          total_subordinates_count: subordinatesCountMap.get(emp.id) || 0,
          isCollapsed: collapsedIds.has(emp.id),
          hasChildren: hasKids,
          direction,
          onToggleCollapse: handleToggleCollapse,
          onFocusBranch: handleFocusBranch,
          onOpenDrawer: handleOpenDrawer,
        },
        position: { x: 0, y: 0 },
      });

      // Add edge to manager if both are visible
      if (
        emp.reporting_manager_id &&
        emp.reporting_manager_id !== emp.id &&
        visibleEmployeeIds.has(emp.reporting_manager_id) &&
        focusManagerId !== emp.id
      ) {
        rawEdges.push({
          id: `edge-${emp.reporting_manager_id}-${emp.id}`,
          source: emp.reporting_manager_id,
          target: emp.id,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
            opacity: 0.6,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'hsl(var(--primary))',
            width: 16,
            height: 16,
          },
        });
      }
    });

    return getLayoutedElements(rawNodes, rawEdges, direction);
  }, [
    employees,
    visibleEmployeeIds,
    childrenMap,
    subordinatesCountMap,
    collapsedIds,
    direction,
    focusManagerId,
    handleToggleCollapse,
    handleFocusBranch,
    handleOpenDrawer,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  // Synchronize layout when computed elements update
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  // Search logic and auto-focus
  useEffect(() => {
    if (!searchTerm) {
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      return;
    }

    const term = searchTerm.toLowerCase();
    let firstMatch: any = null;

    setNodes((prev) =>
      prev.map((n) => {
        const matches =
          n.data.first_name.toLowerCase().includes(term) ||
          n.data.last_name.toLowerCase().includes(term) ||
          n.data.designation.toLowerCase().includes(term) ||
          n.data.department.toLowerCase().includes(term);

        if (matches && !firstMatch) {
          firstMatch = n;
        }

        return { ...n, selected: matches };
      })
    );

    if (firstMatch) {
      setCenter(
        firstMatch.position.x + NODE_WIDTH / 2,
        firstMatch.position.y + NODE_HEIGHT / 2,
        { zoom: 1.1, duration: 800 }
      );
    }
  }, [searchTerm, setCenter, setNodes]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const focusedEmployee = useMemo(() => {
    if (!focusManagerId) return null;
    return employees.find((e) => e.id === focusManagerId);
  }, [focusManagerId, employees]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-[780px] rounded-2xl overflow-hidden border border-border/60 bg-background/50 shadow-2xl backdrop-blur-sm",
        isFullscreen && "fixed inset-0 z-50 h-screen w-screen rounded-none border-none",
        className
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background/85 !border-border/60 !rounded-xl !bottom-5 !right-5 shadow-xl"
          maskColor="rgba(var(--primary), 0.06)"
        />
        <Controls className="!bg-background/85 !border-border/60 !rounded-xl !shadow-xl" />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="hsl(var(--primary) / 0.12)" />

        {/* Top Floating Control Bar */}
        <Panel position="top-left" className="m-4 flex flex-col gap-2 max-w-lg">
          <div className="bg-card/90 backdrop-blur-xl p-3.5 rounded-2xl border border-border/60 shadow-2xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <FolderTree className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-none">
                    Organisational Chart
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {nodes.length} visible of {employees.length} employees
                  </p>
                </div>
              </div>

              {/* View Orientation & Fullscreen */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title={direction === 'TB' ? 'Switch to Horizontal' : 'Switch to Vertical'}
                  onClick={() => setDirection((d) => (d === 'TB' ? 'LR' : 'TB'))}
                >
                  {direction === 'TB' ? (
                    <ArrowDownUp className="w-4 h-4" />
                  ) : (
                    <ArrowLeftRight className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Toggle Fullscreen"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Find by name, role, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/60 border-border/60"
              />
            </div>

            {/* Department Filter & Action Buttons */}
            <div className="flex items-center gap-2">
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60 flex-1">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 border-border/60"
                onClick={handleExpandAll}
                title="Expand All Branches"
              >
                <ChevronsDown className="w-3.5 h-3.5" /> Expand
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 border-border/60"
                onClick={handleCollapseAll}
                title="Collapse All Branches"
              >
                <ChevronsUp className="w-3.5 h-3.5" /> Collapse
              </Button>
            </div>
          </div>

          {/* Focus Mode Alert / Banner */}
          {focusManagerId && focusedEmployee && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/15 border border-primary/30 backdrop-blur-md shadow-lg text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>
                  Focused Branch: <strong>{focusedEmployee.first_name} {focusedEmployee.last_name}</strong>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary hover:bg-primary/20"
                onClick={() => setFocusManagerId(null)}
              >
                Reset to Company
              </Button>
            </div>
          )}
        </Panel>

        {/* Bottom Left Status Pill */}
        <Panel position="bottom-left" className="m-4">
          <div className="bg-card/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/50 text-[11px] text-muted-foreground font-medium flex items-center gap-2.5 shadow-lg">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Org Hierarchy
            </span>
            <span className="text-border">|</span>
            <span>{direction === 'TB' ? 'Vertical Layout' : 'Horizontal Layout'}</span>
            <span className="text-border">|</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px] text-primary"
              onClick={() => fitView({ duration: 800 })}
            >
              Fit View
            </Button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Side Profile & Hierarchy Drawer */}
      <EmployeeHierarchyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        employee={selectedEmployee}
        allEmployees={employees}
        initialTab={drawerInitialTab}
        onFocusBranch={(id) => {
          handleFocusBranch(id);
          setDrawerOpen(false);
        }}
        onChangeManager={(emp) => {
          setChangeManagerEmp(emp);
          setDrawerOpen(false);
        }}
        canManage={canManage}
      />

      {/* Change Reporting Manager Dialog */}
      <ChangeManagerDialog
        open={!!changeManagerEmp}
        onOpenChange={(open) => !open && setChangeManagerEmp(null)}
        employee={changeManagerEmp}
        allEmployees={employees}
        onSuccess={() => onRefresh?.()}
      />
    </div>
  );
}

export function FullScaleOrgChart(props: FullScaleOrgChartProps) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvas {...props} />
    </ReactFlowProvider>
  );
}
