
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Hash, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface AssignIdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  companyId: string;
}

export function AssignIdDialog({ open, onOpenChange, employeeId, employeeName, companyId }: AssignIdDialogProps) {
  const queryClient = useQueryClient();

  // Fetch Company Settings
  const { data: company } = useQuery({
    queryKey: ['company-settings', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('employee_id_prefix, employee_id_next_number')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const nextId = company ? `${company.employee_id_prefix}${company.employee_id_next_number}` : 'Loading...';

  const assignIdMutation = useMutation({
    mutationFn: async () => {
      // 1. Update employee code
      const { error: empError } = await supabase
        .from('employees')
        .update({ employee_code: nextId })
        .eq('id', employeeId);
      if (empError) throw empError;

      // 2. Increment next number in company
      const { error: compError } = await supabase
        .from('companies')
        .update({ employee_id_next_number: (company?.employee_id_next_number || 1) + 1 })
        .eq('id', companyId)
        .select('id');
      if (compError) throw compError;

      // 3. Trigger email automation (Simplified for now - can be expanded to edge function)
      // We'll just toast success for now.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['new-hires', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-settings', companyId] });
      toast.success(`Employee ID ${nextId} assigned to ${employeeName}`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to assign ID: ${error.message}`);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Assign Employee ID
          </DialogTitle>
          <DialogDescription>
            This will assign the next sequential ID to <strong>{employeeName}</strong> and update company records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 space-y-4 bg-muted/20 rounded-lg border border-dashed text-center">
           <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Next Available ID</div>
           <div className="text-4xl font-mono font-bold text-primary tracking-tighter">{nextId}</div>
           <Badge variant="outline" className="animate-pulse">Global Sequence</Badge>
        </div>

        <DialogFooter className="flex sm:justify-between items-center mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => assignIdMutation.mutate()} 
            disabled={assignIdMutation.isPending || !company}
            className="gap-2"
          >
            {assignIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
