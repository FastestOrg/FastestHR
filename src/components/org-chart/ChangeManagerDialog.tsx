import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChangeManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any | null;
  allEmployees: any[];
  onSuccess: () => void;
}

export function ChangeManagerDialog({
  open,
  onOpenChange,
  employee,
  allEmployees,
  onSuccess,
}: ChangeManagerDialogProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  // Set initial selection when dialog opens
  useMemo(() => {
    if (employee) {
      setSelectedManagerId(employee.reporting_manager_id || 'none');
    }
  }, [employee]);

  // Compute all descendants of this employee to prevent cycles
  const descendantIds = useMemo(() => {
    if (!employee) return new Set<string>();
    const descendants = new Set<string>();
    const queue = [employee.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      allEmployees.forEach((emp) => {
        if (emp.reporting_manager_id === currentId && !descendants.has(emp.id)) {
          descendants.add(emp.id);
          queue.push(emp.id);
        }
      });
    }

    return descendants;
  }, [employee, allEmployees]);

  // Filter out the employee themself and all their descendants
  const eligibleManagers = useMemo(() => {
    if (!employee) return [];
    return allEmployees.filter(
      (emp) => emp.id !== employee.id && !descendantIds.has(emp.id)
    );
  }, [employee, allEmployees, descendantIds]);

  const currentManager = useMemo(() => {
    if (!employee?.reporting_manager_id) return null;
    return allEmployees.find((e) => e.id === employee.reporting_manager_id);
  }, [employee, allEmployees]);

  const handleSave = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const newManagerId = selectedManagerId === 'none' ? null : selectedManagerId;

      const { error } = await supabase
        .from('employees')
        .update({ reporting_manager_id: newManagerId })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success(
        newManagerId
          ? `Reporting manager updated successfully.`
          : `${employee.first_name} is now set as a top-level root executive.`
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update reporting manager');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Change Reporting Manager
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Reassign the reporting manager for {employee.first_name} {employee.last_name}. Subordinate loops are automatically prevented.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Relationship Preview */}
          <div className="p-3 rounded-xl bg-card/60 border border-border/50 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Employee</span>
              <p className="font-semibold text-foreground mt-0.5">
                {employee.first_name} {employee.last_name}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/60" />
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Current Manager</span>
              <p className="font-semibold text-foreground mt-0.5">
                {currentManager ? `${currentManager.first_name} ${currentManager.last_name}` : 'None (Root)'}
              </p>
            </div>
          </div>

          {/* New Manager Selector */}
          <div className="space-y-2">
            <Label htmlFor="manager-select" className="text-xs font-medium">
              Select New Reporting Manager
            </Label>
            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
              <SelectTrigger id="manager-select" className="h-10 text-xs bg-background/50">
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">
                  <span className="font-bold text-primary">✦ None (Top-Level Executive / Root)</span>
                </SelectItem>
                {eligibleManagers.map((mgr) => (
                  <SelectItem key={mgr.id} value={mgr.id}>
                    <div className="flex items-center gap-2">
                      <span>{mgr.first_name} {mgr.last_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({mgr.designations?.title || 'Team Member'})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {descendantIds.size > 0 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                {descendantIds.size} subordinate{descendantIds.size > 1 ? 's' : ''} in this employee's downline were excluded to prevent cycle loops.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Reporting Manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
