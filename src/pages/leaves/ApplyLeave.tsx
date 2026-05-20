import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarDays, Loader2, Send, Clock, CheckCircle, XCircle, FileText, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';

export default function ApplyLeave() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    document_url: '',
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Fetch logged-in employee record
  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, company_id')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch leave types for the company
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', employee!.company_id)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!employee?.company_id,
  });

  // Fetch leave balances
  const { data: leaveBalances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['leave-balances', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name, color, code, requires_document)')
        .eq('employee_id', employee!.id)
        .eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Auto-initialize mutation for missing leave balances
  const initBalancesMutation = useMutation({
    mutationFn: async (empId: string) => {
      const { error } = await supabase.rpc('initialize_employee_leave_balances', { emp_id: empId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    }
  });

  useEffect(() => {
    if (!loadingBalances && leaveBalances.length === 0 && employee?.id) {
      initBalancesMutation.mutate(employee.id);
    }
  }, [loadingBalances, leaveBalances.length, employee?.id]);

  // Fetch recent leave requests
  const { data: myLeaves = [] } = useQuery({
    queryKey: ['my-leaves', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*, leave_types(name)')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const totalDays =
    form.start_date && form.end_date
      ? Math.max(0, differenceInDays(parseISO(form.end_date), parseISO(form.start_date)) + 1)
      : 0;

  const selectedBalance = leaveBalances.find(lb => lb.leave_type_id === form.leave_type_id);
  const remainingDays = selectedBalance 
    ? (selectedBalance.total_days || 0) - (selectedBalance.used_days || 0) - (selectedBalance.pending_days || 0) 
    : 0;
  
  const requiresDoc = selectedBalance?.leave_types?.requires_document && totalDays >= 3;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employee?.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('leave-documents')
        .upload(fileName, file, { upsert: true });

      if (error) {
        if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
          toast.error('Leave documents storage bucket not found. Please upload to a cloud service (e.g. Google Drive) and enter the link directly.');
          setUploadingDoc(false);
          return;
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('leave-documents')
        .getPublicUrl(fileName);

      setForm(prev => ({ ...prev, document_url: publicUrl }));
      toast.success('Supporting document uploaded successfully!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error('Employee record not found.');
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          employee_id: employee.id,
          company_id: employee.company_id,
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: form.end_date,
          total_days: totalDays,
          reason: form.reason || null,
          document_url: form.document_url || null,
          status: 'pending' as const,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request submitted successfully');
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', document_url: '' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit leave request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (totalDays <= 0) {
      toast.error('Leave duration must be at least 1 day');
      return;
    }
    if (selectedBalance && totalDays > remainingDays) {
      toast.error(`Insufficient leave balance. You requested ${totalDays} days, but only have ${remainingDays} days remaining.`);
      return;
    }
    if (requiresDoc && !form.document_url) {
      toast.error(`A supporting document is required for ${selectedBalance?.leave_types?.name} requests of 3 or more days.`);
      return;
    }
    applyMutation.mutate();
  };

  const statusStyle: Record<string, string> = {
    approved: 'border-success text-success bg-success/10',
    rejected: 'border-destructive text-destructive bg-destructive/10',
    pending: 'border-warning text-warning bg-warning/10',
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'approved') return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === 'rejected') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leave')} className="border border-border/50" aria-label="Go back to leave page">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="h-6 w-6" /> Apply for Leave
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Submit a new leave request</p>
        </div>
      </div>

      {/* Leave Balances */}
      {leaveBalances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {leaveBalances.map((lb: any) => (
            <Card
              key={lb.id}
              className={`cursor-pointer transition-all shadow-none ${
                form.leave_type_id === lb.leave_type_id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 bg-card/40 hover:border-primary/50'
              }`}
              onClick={() => setForm((p) => ({ ...p, leave_type_id: lb.leave_type_id }))}
            >
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  {lb.leave_types?.name || 'Leave'}
                </p>
                <p className={`text-2xl font-bold ${form.leave_type_id === lb.leave_type_id ? 'text-primary' : 'text-foreground'}`}>
                  {((lb.total_days || 0) - (lb.used_days || 0) - (lb.pending_days || 0)).toFixed(0)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">of {lb.total_days || 0} remaining</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">New Leave Request</CardTitle>
            <CardDescription className="text-xs">Fill in the details below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Leave Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.leave_type_id}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type_id: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                >
                  <option value="">— Select Leave Type —</option>
                   {leaveTypes.length === 0 ? (
                    <option value="" disabled>
                      {profile?.platform_role === 'company_admin' 
                        ? 'No leave types found. Please add them in Settings.' 
                        : 'No leave types available. Contact your admin.'}
                    </option>
                  ) : (
                    leaveTypes.map((lt: any) => (
                      <option key={lt.id} value={lt.id}>{lt.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    From Date <span className="text-destructive">*</span>
                  </label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} required className="bg-background/50 border-border/50 text-sm h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    To Date <span className="text-destructive">*</span>
                  </label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} required min={form.start_date} className="bg-background/50 border-border/50 text-sm h-10" />
                </div>
              </div>

              {totalDays > 0 && (
                <div className="space-y-3">
                  <div className="rounded border border-border/50 bg-primary/5 px-4 py-3 text-sm text-primary flex justify-between items-center">
                    <span>Duration: <strong>{totalDays} working day{totalDays > 1 ? 's' : ''}</strong></span>
                    {selectedBalance && (
                      <span className="text-xs font-medium">
                        Remaining: <strong className={remainingDays >= totalDays ? 'text-success' : 'text-destructive'}>{remainingDays} days</strong>
                      </span>
                    )}
                  </div>
                  
                  {selectedBalance && totalDays > remainingDays && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <strong>Insufficient Balance:</strong> You only have {remainingDays} days remaining for this leave type, but requested {totalDays} days. Please adjust your dates.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Supporting Document Uploader (Conditional) */}
              {requiresDoc && (
                <div className="space-y-3 border border-border/50 bg-amber-500/5 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-2 text-xs text-amber-600 font-medium">
                    <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="uppercase tracking-wider font-bold">Supporting Document Required</p>
                      <p className="text-muted-foreground font-normal mt-0.5">A medical certificate or official proof is required for {selectedBalance?.leave_types?.name || 'this leave type'} of 3 or more days.</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Upload File</label>
                      <div className="relative flex items-center justify-center border border-dashed border-border/70 hover:border-primary/50 bg-background/50 h-10 rounded-md cursor-pointer transition-all">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          disabled={uploadingDoc}
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {uploadingDoc ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{uploadingDoc ? 'Uploading...' : 'Choose File (PDF, Image)'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Or Enter Document URL</label>
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={form.document_url}
                        onChange={(e) => setForm(p => ({ ...p, document_url: e.target.value }))}
                        className="bg-background/50 border-border/50 text-xs h-10"
                      />
                    </div>
                  </div>

                  {form.document_url && (
                    <div className="text-[10px] text-success font-semibold flex items-center gap-1.5 bg-success/5 px-2.5 py-1.5 rounded border border-success/20 w-fit">
                      <CheckCircle className="h-3 w-3" />
                      <span>Document Attached: <a href={form.document_url} target="_blank" rel="noreferrer" className="underline font-bold truncate max-w-[180px] inline-block align-bottom">View Document</a></span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason / Notes</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                  placeholder="Optional reason for leave..."
                  className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/leave')}>Cancel</Button>
                <Button type="submit" disabled={applyMutation.isPending || uploadingDoc} className="flex-1 gap-2">
                  {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {myLeaves.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground mt-1">No requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeaves.map((leave: any) => (
                  <div key={leave.id} className="rounded border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={leave.status} />
                        <span className="text-xs font-medium uppercase">{leave.leave_types?.name || 'Leave'}</span>
                      </div>
                      <Badge variant="outline" className={`uppercase text-[10px] py-0 ${statusStyle[leave.status] || ''}`}>
                        {leave.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {leave.start_date} → {leave.end_date} · {leave.total_days}d
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
