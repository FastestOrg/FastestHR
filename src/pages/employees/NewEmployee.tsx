import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const;
const STATUSES = ['active', 'probation', 'on_leave', 'resigned', 'terminated'] as const;
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

const Field = ({ label, name, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <Input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="bg-background/50 border-border/50 text-sm h-10 focus:border-primary"
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options, required = false }: {
  label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[]; required?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export default function NewEmployee() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  const [createPortalAccount, setCreatePortalAccount] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomValues = new Uint32Array(12);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(randomValues[i] % chars.length);
    }
    return password;
  };

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    work_email: '',
    personal_email: '',
    phone: '',
    employee_code: '',
    department_id: '',
    designation_id: '',
    date_of_joining: '',
    date_of_birth: '',
    gender: 'male' as typeof GENDERS[number],
    employment_type: 'full_time' as typeof EMPLOYMENT_TYPES[number],
    status: 'active' as typeof STATUSES[number],
    reporting_manager_id: '',
    location_id: '',
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').eq('company_id', profile!.company_id!).order('name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('designations').select('id, title').eq('company_id', profile!.company_id!).order('title');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['company-locations', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('company_locations').select('id, name').eq('company_id', profile!.company_id!).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ['managers', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('company_id', profile!.company_id!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('first_name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: licenseData, isLoading: isLoadingLicense } = useQuery({
    queryKey: ['license-status', profile?.company_id],
    queryFn: async () => {
      const { data: company } = await supabase
        .from('companies')
        .select('license_limit')
        .eq('id', profile!.company_id!)
        .single();
        
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile!.company_id!)
        .eq('status', 'active')
        .is('deleted_at', null);
        
      return {
        limit: company?.license_limit || 1, // Fallback if no limit specified
        used: count || 0
      };
    },
    enabled: !!profile?.company_id,
  });

  const isLicenseFull = licenseData ? licenseData.used >= licenseData.limit : false;

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { middle_name, ...basePayload } = payload;
      const { data, error } = await supabase
        .from('employees')
        .insert([
          {
            ...basePayload,
            company_id: profile?.company_id,
            department_id: payload.department_id || null,
            designation_id: payload.designation_id || null,
            reporting_manager_id: payload.reporting_manager_id || null,
            location_id: payload.location_id || null,
            date_of_birth: payload.date_of_birth || null,
            date_of_joining: payload.date_of_joining || null,
            personal_email: payload.personal_email || null,
            phone: payload.phone || null,
            employee_code: payload.employee_code || null,
            custom_fields: {
              middle_name: middle_name
            },
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-count'] });
      
      if (createPortalAccount) {
        const toastId = toast.loading('CREATING_PORTAL_ACCOUNT::DISPATCHING_WELCOME_EMAIL...');
        try {
          const { data: resData, error: fnError } = await supabase.functions.invoke('create-portal-account', {
            body: {
              employee_id: data.id,
              email: data.work_email,
              password: portalPassword,
              company_id: profile?.company_id,
              first_name: data.first_name,
              last_name: data.last_name
            }
          });
          
          if (fnError) throw fnError;
          if (resData?.error) throw new Error(resData.error);
          
          toast.success('SYSTEM::PORTAL_ACCOUNT_READY — Credentials dispatched to work email.', { id: toastId });
        } catch (err: any) {
          toast.error(`ERROR::PORTAL_CREATION_FAILED — ${err.message || 'Check your SMTP settings.'}`, { 
            id: toastId,
            duration: 6000 
          });
        }
      } else {
        toast.success('SYSTEM::EMPLOYEE_CREATED — ' + (data.first_name + ' ' + data.last_name).toUpperCase());
      }
      
      navigate('/employees/' + data.id);
    },
    onError: (err: any) => {
      toast.error('ERROR::' + (err?.message || 'Failed to create employee'));
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.work_email.trim()) {
      toast.error('ERROR::MISSING_REQUIRED_FIELDS');
      return;
    }
    if (createPortalAccount && (!portalPassword || portalPassword.length < 6)) {
      toast.error('ERROR::PASSWORD_MIN_LENGTH_6');
      return;
    }
    createMutation.mutate(form);
  };



  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <UserPlus className="h-6 w-6" /> Add New Employee
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">EMPLOYEE_ONBOARDING::FORM_v1</p>
        </div>
      </div>

      {isLicenseFull && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="bg-destructive/20 p-2 rounded-full shrink-0">
            <UserPlus className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">License Limit Reached</h3>
            <p className="text-sm text-destructive/80 mt-1">
              Your company has reached its license limit ({licenseData?.used}/{licenseData?.limit} seats used). 
              To add more employees, please upgrade your subscription plan.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/billing')} 
            variant="default"
            className="shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Upgrade Plan
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">01</span>
              PERSONAL_INFORMATION
            </CardTitle>
            <CardDescription className="text-xs font-medium">Basic personal details of the employee</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
            <Field label="First Name" name="first_name" value={form.first_name} onChange={handleChange} required placeholder="John" />
            <Field label="Middle Name" name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="Quincy" />
            <Field label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} required placeholder="Doe" />
            <Field label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" />
            <SelectField
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              options={GENDERS.map((g) => ({ value: g, label: g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
            />
            <Field label="Personal Email" name="personal_email" value={form.personal_email} onChange={handleChange} type="email" placeholder="john@personal.com" />
            <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
          </CardContent>
        </Card>

        {/* Employment Info */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">02</span>
              EMPLOYMENT_DETAILS
            </CardTitle>
            <CardDescription className="text-xs font-medium">Work-related information</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
            <Field label="Work Email" name="work_email" value={form.work_email} onChange={handleChange} type="email" required placeholder="john@company.com" />
            <Field label="Employee Code" name="employee_code" value={form.employee_code} onChange={handleChange} placeholder="EMP-001" />
            <Field label="Date of Joining" name="date_of_joining" value={form.date_of_joining} onChange={handleChange} type="date" />
            <SelectField
              label="Employment Type"
              name="employment_type"
              value={form.employment_type}
              onChange={handleChange}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
            />
            <SelectField
              label="Department"
              name="department_id"
              value={form.department_id}
              onChange={handleChange}
              options={departments.map((d: any) => ({ value: d.id, label: d.name }))}
            />
            <SelectField
              label="Designation / Role"
              name="designation_id"
              value={form.designation_id}
              onChange={handleChange}
              options={designations.map((d: any) => ({ value: d.id, label: d.title }))}
            />
            <SelectField
              label="Reporting Manager"
              name="reporting_manager_id"
              value={form.reporting_manager_id}
              onChange={handleChange}
              options={managers.map((m: any) => ({
                value: m.id,
                label: `${m.first_name} ${m.last_name}${m.employee_code ? ` (${m.employee_code})` : ''}`,
              }))}
            />
            <SelectField
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
            />
            <SelectField
              label="Office Location / Branch"
              name="location_id"
              value={form.location_id}
              onChange={handleChange}
              options={locations.map((l: any) => ({ value: l.id, label: l.name }))}
            />
          </CardContent>
        </Card>

        {/* Portal Access */}
        {form.status !== 'resigned' && form.status !== 'terminated' && (
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">03</span>
                PORTAL_ACCESS_SETUP
              </CardTitle>
              <CardDescription className="text-xs font-medium">Configure credentials and welcome notifications</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                <Checkbox 
                  id="createPortalAccount"
                  checked={createPortalAccount} 
                  onCheckedChange={(c) => {
                    const checked = !!c;
                    setCreatePortalAccount(checked);
                    if (checked && !portalPassword) {
                      setPortalPassword(generateRandomPassword());
                    }
                  }}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <label htmlFor="createPortalAccount" className="text-sm font-semibold text-foreground cursor-pointer select-none">
                    Create Portal Account Immediately
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If enabled, a user account will be created automatically in Supabase Auth, and a welcome email containing their credentials will be dispatched using your custom company SMTP configuration.
                  </p>
                </div>
              </div>

              {createPortalAccount && (
                <div className="space-y-2 grid sm:grid-cols-2 gap-4 items-end pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Temporary Password <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        name="portalPassword"
                        value={portalPassword}
                        onChange={(e) => setPortalPassword(e.target.value)}
                        required={createPortalAccount}
                        minLength={6}
                        placeholder="Enter temporary password"
                        className="bg-background/50 border-border/50 text-sm h-10 focus:border-primary flex-1 font-mono"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setPortalPassword(generateRandomPassword())}
                        className="h-10 px-3 text-xs"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed pb-2.5 sm:col-span-1">
                    Password must be at least 6 characters. The password will be visible to the employee in the welcome email.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/employees')}
            className="border-border/50 hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> CANCEL
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || isLicenseFull || isLoadingLicense}
            className={`gap-2 min-w-[160px] ${isLicenseFull ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {createMutation.isPending || isLoadingLicense ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {createMutation.isPending ? 'SAVING...' : isLicenseFull ? 'LIMIT_REACHED' : 'SAVE_EMPLOYEE'}
          </Button>
        </div>
      </form>
    </div>
  );
}
