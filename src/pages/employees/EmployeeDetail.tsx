import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Save, Pencil, X, Loader2,
  Mail, Phone, Building2, Briefcase, CalendarDays,
  Clock, UserCheck, AlertTriangle, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/40',
  probation: 'bg-warning/10 text-warning border-warning/40',
  on_leave: 'bg-info/10 text-info border-info/40',
  resigned: 'bg-muted text-muted-foreground',
  terminated: 'bg-destructive/10 text-destructive border-destructive/40',
};

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const;
const STATUS_OPTIONS = ['active', 'probation', 'on_leave', 'resigned', 'terminated'] as const;
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

type Tab = 'profile' | 'attendance' | 'leaves' | 'payroll';

interface EmployeeRecord {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  work_email: string;
  personal_email: string | null;
  phone: string | null;
  employee_code: string | null;
  status: string;
  gender: string | null;
  employment_type: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  department_id: string | null;
  designation_id: string | null;
  reporting_manager_id: string | null;
  custom_fields?: any;
  departments?: { name: string } | null;
  designations?: { title: string } | null;
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [form, setForm] = useState<Partial<EmployeeRecord>>({});
  const [isNewDepartment, setIsNewDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isNewDesignation, setIsNewDesignation] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');

  const { data: employee, isLoading } = useQuery<EmployeeRecord>({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, departments(name), designations(title)')
        .eq('id', id!)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      const record = data as any;
      return {
        ...record,
        middle_name: record.custom_fields?.middle_name || ''
      } as EmployeeRecord;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (employee) setForm({ ...employee });
  }, [employee]);

  const { data: departments = [], refetch: refetchDepartments } = useQuery({
    queryKey: ['departments', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase.from('departments').select('id, name').eq('company_id', profile.company_id).order('name');
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: designations = [], refetch: refetchDesignations } = useQuery({
    queryKey: ['designations', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase.from('designations').select('id, title').eq('company_id', profile.company_id).order('title');
      return (data || []) as { id: string; title: string }[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ['managers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('first_name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: leaveHistory = [] } = useQuery({
    queryKey: ['leave-history', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id && activeTab === 'leaves',
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', id!)
        .order('date', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!id && activeTab === 'attendance',
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<EmployeeRecord>) => {
      if (!profile?.company_id) throw new Error('Company profile missing');

      let deptId = payload.department_id || null;
      let desigId = payload.designation_id || null;

      if (isNewDepartment && newDepartmentName.trim()) {
        const { data: newDept, error } = await supabase
          .from('departments')
          .insert({ company_id: profile.company_id, name: newDepartmentName.trim() })
          .select()
          .single();
        if (error) throw error;
        deptId = newDept.id;
        await refetchDepartments();
      }

      if (isNewDesignation && newDesignationName.trim()) {
        const { data: newDesig, error } = await supabase
          .from('designations')
          .insert({ company_id: profile.company_id, title: newDesignationName.trim() })
          .select()
          .single();
        if (error) throw error;
        desigId = newDesig.id;
        await refetchDesignations();
      }

      const updateData = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        work_email: payload.work_email,
        personal_email: payload.personal_email || null,
        phone: payload.phone || null,
        employee_code: payload.employee_code || null,
        department_id: deptId,
        designation_id: desigId,
        reporting_manager_id: payload.reporting_manager_id || null,
        date_of_joining: payload.date_of_joining || null,
        date_of_birth: payload.date_of_birth || null,
        gender: payload.gender,
        employment_type: payload.employment_type,
        status: payload.status,
        custom_fields: {
          ...(employee?.custom_fields || {}),
          middle_name: payload.middle_name
        },
      } as any;
      const { data, error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id!)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated successfully');
      setEditing(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Update failed');
    },
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error('Company profile missing');

      const { error: empError } = await supabase
        .from('employees')
        .update({ status: 'terminated', deleted_at: new Date().toISOString() })
        .eq('id', id!);
      if (empError) throw empError;

      const { error: exitError } = await supabase
        .from('employee_exits')
        .insert({
          company_id: profile.company_id,
          employee_id: id!,
          status: 'initiated',
          reason: 'Terminated by company',
          last_working_day: new Date().toISOString().split('T')[0]
        });
      // Ignore unique violation if the employee already has an exit record
      if (exitError && exitError.code !== '23505') throw exitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      toast.success('Employee terminated successfully');
      navigate('/employees');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to terminate');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'department_id') {
      if (value === 'ADD_NEW') {
        setIsNewDepartment(true);
        setForm((prev) => ({ ...prev, department_id: '' }));
      } else {
        setIsNewDepartment(false);
        setForm((prev) => ({ ...prev, department_id: value }));
      }
    } else if (name === 'designation_id') {
      if (value === 'ADD_NEW') {
        setIsNewDesignation(true);
        setForm((prev) => ({ ...prev, designation_id: '' }));
      } else {
        setIsNewDesignation(false);
        setForm((prev) => ({ ...prev, designation_id: value }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 animate-in fade-in zoom-in-95 duration-500">
        <AlertTriangle className="h-16 w-16 text-destructive/40" />
        <p className="text-lg">Employee not found</p>
        <Button onClick={() => navigate('/employees')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
        </Button>
      </div>
    );
  }

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leaves', label: 'Leave History' },
    { id: 'payroll', label: 'Payroll' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/employees')}
          className="border border-border/50 hover:border-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {employee.first_name} {employee.middle_name ? `${employee.middle_name} ` : ''}{employee.last_name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {employee.employee_code && <span className="mr-3">{employee.employee_code}</span>}
            {employee.designations?.title || '—'}
          </p>
        </div>
        <Badge
          className={`font-mono uppercase text-xs ${STATUS_BADGE[employee.status] || ''}`}
          variant="outline"
        >
          {employee.status}
        </Badge>
        <div className="flex items-center gap-3">
          {!editing ? (
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="transition-all shadow-sm hover:shadow-md bg-primary text-primary-foreground font-medium px-6 rounded-full"
            >
              <Pencil className="h-4 w-4 mr-2" /> Edit Profile
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
                className="font-medium bg-success hover:bg-success/90 text-success-foreground rounded-full px-6 shadow-sm"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { 
                  setForm({ ...employee }); 
                  setIsNewDepartment(false);
                  setIsNewDesignation(false);
                  setNewDepartmentName('');
                  setNewDesignationName('');
                  setEditing(false); 
                }}
                className="font-medium rounded-full px-6"
              >
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden border-border/40 shadow-sm transition-all hover:shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="h-20 w-20 border-2 border-border/50">
              <AvatarImage src={employee.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 grid sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary/60" />
                <span className="truncate">{employee.work_email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary/60" />
                <span>{employee.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary/60" />
                <span>{employee.departments?.name || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4 text-primary/60" />
                <span>{employee.employment_type?.replace(/_/g, ' ') || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary/60" />
                <span>Joined: {employee.date_of_joining || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCheck className="h-4 w-4 text-primary/60" />
                <span>Gender: {employee.gender || '—'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <Card className="overflow-hidden border-border/40 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="border-b border-border/10 bg-muted/20 pb-4">
            <CardTitle className="text-foreground font-medium text-base">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-x-12 gap-y-8">
            {([
              { label: 'First Name', name: 'first_name', required: true },
              { label: 'Middle Name', name: 'middle_name' },
              { label: 'Last Name', name: 'last_name', required: true },
              { label: 'Work Email', name: 'work_email', type: 'email', required: true },
              { label: 'Personal Email', name: 'personal_email', type: 'email' },
              { label: 'Phone', name: 'phone' },
              { label: 'Employee Code', name: 'employee_code' },
              { label: 'Date of Joining', name: 'date_of_joining', type: 'date' },
              { label: 'Date of Birth', name: 'date_of_birth', type: 'date' },
            ] as { label: string; name: keyof EmployeeRecord; type?: string; required?: boolean }[]).map(({ label, name, type = 'text', required }) => (
              <div key={name as string} className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  {label}{required && editing && <span className="text-destructive">*</span>}
                </label>
                {!editing ? (
                  <p className="text-sm font-medium text-foreground py-1 border-b border-transparent">
                    {employee[name] ? String(employee[name]) : <span className="text-muted-foreground italic font-normal">Not provided</span>}
                  </p>
                ) : (
                  <Input
                    type={type}
                    name={name as string}
                    value={(form[name] as string) || ''}
                    onChange={handleChange}
                    className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm"
                  />
                )}
              </div>
            ))}

            {/* Select fields */}
            {([
              {
                label: 'Gender', name: 'gender',
                options: GENDERS.map(g => ({ value: g, label: g.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
              },
              {
                label: 'Employment Type', name: 'employment_type',
                options: EMPLOYMENT_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
              },
              {
                label: 'Status', name: 'status',
                options: STATUS_OPTIONS.map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
              },
              {
                label: 'Department', name: 'department_id',
                options: departments.map(d => ({ value: d.id, label: d.name }))
              },
              {
                label: 'Designation', name: 'designation_id',
                options: designations.map(d => ({ value: d.id, label: d.title }))
              },
              {
                label: 'Reporting Manager', name: 'reporting_manager_id',
                options: managers.map((m: any) => ({
                  value: m.id,
                  label: `${m.first_name} ${m.last_name}${m.employee_code ? ` (${m.employee_code})` : ''}`,
                }))
              },
            ] as { label: string; name: string; options: { value: string; label: string }[] }[]).map(({ label, name, options }) => {
              const selectedOption = options.find(o => o.value === (employee as any)[name]);
              const isDepartment = name === 'department_id';
              const isDesignation = name === 'designation_id';
              const addingNew = (isDepartment && isNewDepartment) || (isDesignation && isNewDesignation);
              
              let selectValue = (form as any)[name] || '';
              if (addingNew) selectValue = 'ADD_NEW';

              return (
              <div key={name} className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                {!editing ? (
                  <p className="text-sm font-medium text-foreground py-1 border-b border-transparent">
                    {selectedOption ? selectedOption.label : <span className="text-muted-foreground italic font-normal">Not assigned</span>}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <select
                      name={name}
                      value={selectValue}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm"
                    >
                      <option value="">— Select —</option>
                      {options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                      {(isDepartment || isDesignation) && (
                        <option value="ADD_NEW" className="font-semibold text-primary">+ Add New {label}</option>
                      )}
                    </select>
                    {isDepartment && isNewDepartment && (
                      <Input
                        type="text"
                        placeholder="e.g. Engineering"
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm"
                      />
                    )}
                    {isDesignation && isNewDesignation && (
                      <Input
                        type="text"
                        placeholder="e.g. Senior Developer"
                        value={newDesignationName}
                        onChange={(e) => setNewDesignationName(e.target.value)}
                        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            )})}
          </CardContent>
        </Card>
      )}

      {/* Attendance tab */}
      {activeTab === 'attendance' && (
        <Card className="overflow-hidden border-border/40 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="border-b border-border/10 bg-muted/20 pb-4">
            <CardTitle className="text-foreground font-medium text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary/70" /> Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center animate-in fade-in duration-500">
                <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground">No attendance records found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 pt-2">
                {attendanceRecords.map((rec: Tables<'attendance'>) => (
                  <div key={rec.id} className="flex items-center justify-between py-4 text-sm hover:bg-muted/10 transition-colors px-2 rounded-md">
                    <span className="text-primary font-medium">{rec.date}</span>
                    <span className="text-muted-foreground font-mono bg-muted/30 px-3 py-1 rounded-md">
                      {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'} 
                      <span className="mx-2 text-muted-foreground/50">→</span> 
                      {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                    </span>
                    <Badge variant="outline" className={`uppercase text-[10px] tracking-wider font-semibold ${
                      rec.status === 'present' ? 'bg-success/10 text-success border-success/30' :
                      rec.status === 'absent' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      'bg-warning/10 text-warning border-warning/30'
                    }`}>
                      {rec.status || 'present'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leave history tab */}
      {activeTab === 'leaves' && (
        <Card className="overflow-hidden border-border/40 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="border-b border-border/10 bg-muted/20 pb-4">
            <CardTitle className="text-foreground font-medium text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary/70" /> Leave History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaveHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center animate-in fade-in duration-500">
                <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground">No leave records found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 pt-2">
                {leaveHistory.map((leave: Tables<'leave_requests'>) => (
                  <div key={leave.id} className="flex items-center justify-between py-4 text-sm hover:bg-muted/10 transition-colors px-2 rounded-md">
                    <div>
                      <p className="text-foreground font-medium">{leave.leave_type_id || 'Leave'}</p>
                      <p className="text-muted-foreground text-xs mt-1 bg-muted/30 inline-flex px-2 py-0.5 rounded">
                        {leave.start_date} <span className="mx-1 opacity-50">→</span> {leave.end_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-muted-foreground font-medium">{leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}</span>
                      <Badge
                        variant="outline"
                        className={`uppercase text-[10px] tracking-wider font-semibold ${
                          leave.status === 'approved' ? 'bg-success/10 text-success border-success/30' :
                          leave.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                          'bg-warning/10 text-warning border-warning/30'
                        }`}
                      >
                        {leave.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll tab */}
      {activeTab === 'payroll' && (
        <Card className="overflow-hidden border-border/40 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="py-24 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl mb-2 hover:scale-110 transition-transform cursor-default">💰</div>
            <h3 className="text-lg font-medium text-foreground">Payroll Management</h3>
            <p className="text-muted-foreground max-w-sm">Manage employee compensation, generate payslips, and view payment history in the main Payroll section.</p>
            <Button onClick={() => navigate('/payroll')} className="mt-4 shadow-sm hover:shadow-md transition-all group">
              Go to Payroll <ArrowLeft className="ml-2 h-4 w-4 rotate-180 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5 backdrop-blur-sm shadow-none animate-in fade-in duration-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-destructive text-sm flex items-center gap-2 uppercase tracking-wider font-semibold">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-foreground">Terminate Employee</p>
            <p className="text-xs font-medium text-muted-foreground">Marks the employee as terminated and soft-deletes their record.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => {
              if (confirm('CONFIRM::Terminate this employee? This action cannot be undone easily.')) {
                terminateMutation.mutate();
              }
            }}
            disabled={terminateMutation.isPending}
          >
            {terminateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            TERMINATE
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
