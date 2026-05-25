import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Laptop, UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AssetManagementTabProps {
  companyId?: string | null;
}

const CATEGORIES = ['Laptop', 'Mobile Phone', 'Tablet', 'Monitor', 'Keyboard/Mouse', 'Accessory', 'Other'];
const STATUS_COLORS: Record<string, string> = {
  available: 'border-success text-success bg-success/5',
  assigned: 'border-info text-info bg-info/5',
  damaged: 'border-destructive text-destructive bg-destructive/5',
  retired: 'border-muted text-muted-foreground bg-muted/5',
};

export default function AssetManagementTab({ companyId }: AssetManagementTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState<string>('unassigned');
  
  // Asset Form
  const [form, setForm] = useState({
    serial_number: '',
    model_name: '',
    category: 'Laptop',
    purchase_date: '',
    purchase_value: '',
    status: 'available',
  });

  // Queries
  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['company-assets', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('assets')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .is('deleted_at', null)
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Mutations
  const createAsset = useMutation({
    mutationFn: async () => {
      if (!form.serial_number.trim() || !form.model_name.trim()) {
        throw new Error('Serial number and Model name are required');
      }
      const { error } = await supabase.from('assets').insert([{
        company_id: companyId!,
        serial_number: form.serial_number,
        model_name: form.model_name,
        category: form.category,
        purchase_date: form.purchase_date || null,
        purchase_value: form.purchase_value ? parseFloat(form.purchase_value) : null,
        status: form.status,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
      toast.success('Asset created successfully');
      setDialogOpen(false);
      setForm({
        serial_number: '',
        model_name: '',
        category: 'Laptop',
        purchase_date: '',
        purchase_value: '',
        status: 'available',
      });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create asset'),
  });

  const assignAsset = useMutation({
    mutationFn: async () => {
      if (!selectedAssetId) return;
      const isUnassigned = assignEmployeeId === 'unassigned';
      const { error } = await supabase
        .from('assets')
        .update({
          assigned_employee_id: isUnassigned ? null : assignEmployeeId,
          assignment_date: isUnassigned ? null : new Date().toISOString().split('T')[0],
          status: isUnassigned ? 'available' : 'assigned',
          signature_url: isUnassigned ? null : undefined,
          signed_at: isUnassigned ? null : undefined,
        })
        .eq('id', selectedAssetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
      toast.success('Asset assignment updated successfully');
      setAssignDialogOpen(false);
      setSelectedAssetId(null);
      setAssignEmployeeId('unassigned');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update assignment'),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
      toast.success('Asset deleted successfully');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete asset'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('assets')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
      toast.success('Asset status updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update status'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-base font-semibold">IT Asset Ledger</h3>
          <p className="text-xs text-muted-foreground">Track laptops, smartphones, monitors, and equipment assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border-border/50">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
              <DialogDescription>Register a physical asset in your hardware inventory.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Serial Number / Asset Tag</Label>
                  <Input 
                    placeholder="e.g. SN-987241A" 
                    value={form.serial_number} 
                    onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model Name</Label>
                  <Input 
                    placeholder="e.g. MacBook Pro 16" 
                    value={form.model_name} 
                    onChange={(e) => setForm(f => ({ ...f, model_name: e.target.value }))} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 
                    value={form.category} 
                    onValueChange={(val) => setForm(f => ({ ...f, category: val }))}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={form.status} 
                    onValueChange={(val) => setForm(f => ({ ...f, status: val }))}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input 
                    type="date" 
                    value={form.purchase_date} 
                    onChange={(e) => setForm(f => ({ ...f, purchase_date: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Value</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={form.purchase_value} 
                    onChange={(e) => setForm(f => ({ ...f, purchase_value: e.target.value }))} 
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createAsset.mutate()} disabled={createAsset.isPending}>Add Asset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loadingAssets ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-xl bg-muted/5">
          <Laptop className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
          <p className="text-sm font-medium">No assets registered yet</p>
          <p className="text-xs text-muted-foreground mt-1">Register hardware components above to track assignments and handovers.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assets.map((asset: any) => (
            <div key={asset.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-background/60 transition-all shadow-sm gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{asset.model_name}</p>
                    <Badge variant="outline" className={`uppercase text-[9px] px-1.5 py-0 ${STATUS_COLORS[asset.status] || ''}`}>
                      {asset.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">SN: <span className="font-mono">{asset.serial_number}</span> · Category: {asset.category}</p>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:justify-end">
                {asset.assigned_employee_id ? (
                  <div className="flex flex-col text-left sm:text-right">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1 sm:justify-end">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      Assigned: {asset.employees?.first_name} {asset.employees?.last_name}
                    </p>
                    {asset.signed_at ? (
                      <p className="text-[10px] text-success font-semibold flex items-center gap-1 sm:justify-end mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Signed off on {new Date(asset.signed_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-warning font-semibold flex items-center gap-1 sm:justify-end mt-0.5">
                        <XCircle className="w-3 h-3" /> Pending Handover Sign-off
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Unassigned</p>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-border/10 pt-2 sm:pt-0 sm:border-none w-full sm:w-auto justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-8"
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      setAssignEmployeeId(asset.assigned_employee_id || 'unassigned');
                      setAssignDialogOpen(true);
                    }}
                  >
                    Manage
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm('Delete this asset from inventory?')) {
                        deleteAsset.mutate(asset.id);
                      }
                    }}
                    aria-label="Delete asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignment / Status management dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => {
        setAssignDialogOpen(open);
        if (!open) {
          setSelectedAssetId(null);
          setAssignEmployeeId('unassigned');
        }
      }}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Manage Asset Allocation</DialogTitle>
            <DialogDescription>Assign this device to an employee or adjust its availability status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Assign to Employee</Label>
              <Select 
                value={assignEmployeeId} 
                onValueChange={(val) => setAssignEmployeeId(val)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Assign employee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Keep Unassigned / Release Asset</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedAssetId && (
              <div className="space-y-2">
                <Label>Operational Status Override</Label>
                <div className="flex gap-2">
                  {['available', 'damaged', 'retired'].map((status) => {
                    const assetObj = assets.find((a: any) => a.id === selectedAssetId);
                    const isActive = assetObj?.status === status;
                    return (
                      <Button
                        key={status}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs capitalize flex-1 h-9"
                        onClick={() => updateStatus.mutate({ id: selectedAssetId, status })}
                      >
                        {status}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => assignAsset.mutate()} disabled={assignAsset.isPending}>Save Allocation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
