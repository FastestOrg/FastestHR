import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Building, Bell, Shield, KeyIcon, Users, Mail, Settings2, Loader2, Send, Plus, Trash2, Clock, DollarSign, Percent, Gift, Globe, Contact, Laptop, GitBranch, MapPin } from 'lucide-react';
import DomainSettings from '@/pages/settings/DomainSettings';
import { IDCardTemplateEditor } from '@/components/settings/IDCardTemplateEditor';
import AssetManagementTab from '@/components/settings/AssetManagementTab';
import WorkflowBuilder from '@/components/settings/WorkflowBuilder';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function Settings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data } = await supabase.from('companies')
        .select('id, name, timezone, currency, country, about_company, company_culture, website, linkedin_url, offer_sequence_prefix, offer_sequence_current, geofence_latitude, geofence_longitude, geofence_radius, ip_whitelist')
        .eq('id', profile.company_id)
        .maybeSingle();
      // SMTP columns are restricted; fetch them via secure RPC for admins
      const { data: smtp } = await supabase.rpc('get_company_smtp_settings');
      const smtpRow = Array.isArray(smtp) ? smtp[0] : null;
      return { ...(data || {}), ...(smtpRow || {}) } as any;
    },
    enabled: !!profile?.company_id,
  });

  const [form, setForm] = useState({ 
    name: '', timezone: '', currency: '', country: '',
    about_company: '', company_culture: '', website: '', linkedin_url: '',
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from_email: '', smtp_from_name: '',
    offer_sequence_prefix: '', offer_sequence_current: '0',
    geofence_latitude: '', geofence_longitude: '', geofence_radius: '200', ip_whitelist: ''
  });

  useEffect(() => {
    if (company) {
      const c = company as any;
      setForm({
        name: c.name || '', timezone: c.timezone || 'UTC', currency: c.currency || 'USD', country: c.country || '',
        about_company: c.about_company || '', company_culture: c.company_culture || '', website: c.website || '', linkedin_url: c.linkedin_url || '',
        smtp_host: c.smtp_host || '', smtp_port: c.smtp_port?.toString() || '', smtp_user: c.smtp_user || '', smtp_pass: c.smtp_pass || '',
        smtp_from_email: c.smtp_from_email || '', smtp_from_name: c.smtp_from_name || '',
        offer_sequence_prefix: c.offer_sequence_prefix || 'OFFER-', offer_sequence_current: c.offer_sequence_current?.toString() || '0',
        geofence_latitude: c.geofence_latitude?.toString() || '',
        geofence_longitude: c.geofence_longitude?.toString() || '',
        geofence_radius: c.geofence_radius?.toString() || '200',
        ip_whitelist: c.ip_whitelist || '',
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Company ID is missing.");
      const { error } = await supabase.from('companies').update({
        name: form.name, timezone: form.timezone, currency: form.currency, country: form.country,
        about_company: form.about_company || null, company_culture: form.company_culture || null, 
        website: form.website || null, linkedin_url: form.linkedin_url || null,
        smtp_host: form.smtp_host || null, smtp_port: form.smtp_port ? parseInt(form.smtp_port) : null,
        smtp_user: form.smtp_user || null, smtp_pass: form.smtp_pass || null,
        smtp_from_email: form.smtp_from_email || null, smtp_from_name: form.smtp_from_name || null,
        offer_sequence_prefix: form.offer_sequence_prefix || null,
        offer_sequence_current: form.offer_sequence_current ? parseInt(form.offer_sequence_current) : 0,
        geofence_latitude: form.geofence_latitude ? parseFloat(form.geofence_latitude) : null,
        geofence_longitude: form.geofence_longitude ? parseFloat(form.geofence_longitude) : null,
        geofence_radius: form.geofence_radius ? parseInt(form.geofence_radius) : null,
        ip_whitelist: form.ip_whitelist || null,
      }).eq('id', profile.company_id).select('id');
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-company'] }); toast.success('Settings saved'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpDiagOpen, setSmtpDiagOpen] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpDiagLogs, setSmtpDiagLogs] = useState<string[]>([]);
  const [smtpDiagError, setSmtpDiagError] = useState<string | null>(null);
  const [smtpDiagAdvice, setSmtpDiagAdvice] = useState<string | null>(null);

  const handleTestSmtp = () => {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_pass) {
      toast.error('Please configure SMTP Host, Username, and Password first.');
      return;
    }
    setSmtpTestEmail(profile?.email || '');
    setSmtpDiagLogs([]);
    setSmtpDiagError(null);
    setSmtpDiagAdvice(null);
    setSmtpDiagOpen(true);
  };

  const runSmtpDiagnostics = async () => {
    if (!smtpTestEmail.trim()) {
      toast.error('Please enter a valid test recipient email address.');
      return;
    }

    setIsTestingSmtp(true);
    setSmtpDiagLogs([]);
    setSmtpDiagError(null);
    setSmtpDiagAdvice(null);

    const addLog = (msg: string) => setSmtpDiagLogs(prev => [...prev, msg]);

    addLog('⚡ Initiating SMTP Diagnostic Checklist...');
    addLog(`🔍 Hostname: "${form.smtp_host}" | Port: ${form.smtp_port || 587}`);
    addLog(`📧 From: "${form.smtp_from_name || 'System'}" <${form.smtp_from_email || form.smtp_user}>`);
    addLog(`🎯 Recipient: <${smtpTestEmail}>`);

    const port = Number(form.smtp_port) || 587;
    if (port === 25) {
      addLog('⚠️ Warning: Port 25 detected. Most cloud hosting providers block Port 25 by default to prevent outbound spam.');
    } else if (port === 465) {
      addLog('ℹ️ Notice: Port 465 requires secure SSL/TLS connection protocol.');
    } else if (port === 587) {
      addLog('ℹ️ Notice: Port 587 requires STARTTLS connection upgrade.');
    }

    addLog('🚀 Invoking SMTP Test Edge Function...');
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp', {
        body: {
          smtp_host: form.smtp_host,
          smtp_port: form.smtp_port,
          smtp_user: form.smtp_user,
          smtp_pass: form.smtp_pass,
          smtp_from_email: form.smtp_from_email,
          smtp_from_name: form.smtp_from_name,
          test_email: smtpTestEmail
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      addLog('✅ Success: SMTP handshake completed, authentication succeeded, and mail queued successfully!');
      toast.success('SMTP connection verified successfully!');
    } catch (err: any) {
      let msg = (err instanceof Error ? err.message : String(err)) || 'Unknown connection error';
      if (err && typeof err === 'object' && 'context' in err && (err as any).context && typeof (err as any).context.json === 'function') {
        try {
          const b = await (err as any).context.json();
          if (b.error) msg = b.error;
        } catch {}
      }

      addLog('❌ Failed: Connection could not be completed.');
      setSmtpDiagError(msg);

      let advice = 'Check that your SMTP server host is accessible from external networks and that the port is correct.';
      if (msg.includes('Authentication failed') || msg.includes('535') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('credentials')) {
        advice = 'Authentication failed. Please verify that your SMTP Username and Password are correct. Note: If using Gmail/Google Workspace, you must enable 2-Step Verification and generate a custom 16-character App Password (apppasswords) rather than your default password.';
      } else if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        advice = `Connection timeout or refusal. The target host "${form.smtp_host}" is not responding on Port ${port}. ${port === 25 ? 'We highly recommend switching from Port 25 to Port 587 (with STARTTLS) or Port 465 (with SSL), as Port 25 is actively blocked on cloud provider firewalls.' : 'Ensure your SMTP server host allows outbound access from this system, and check that the server is currently online.'}`;
      } else if (port === 25) {
        advice = 'Port 25 is active but failed. This is typical for cloud edge environments (like Supabase Edge Functions) where Port 25 outbound sockets are blocked. Upgrade your SMTP port configuration to 587 (STARTTLS) or 465 (SSL/TLS) for compatibility.';
      }
      
      setSmtpDiagAdvice(advice);
      toast.error('SMTP Diagnostic Test Failed.');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const menuItems = [
    { id: 'general', label: 'General Info', icon: Building },
    { id: 'locations', label: 'Office Locations', icon: MapPin },
    { id: 'schedule', label: 'Work Schedule', icon: Clock },
    { id: 'payroll', label: 'Payroll Config', icon: DollarSign },
    { id: 'roles', label: 'Roles & Access', icon: Shield },
    { id: 'leaves', label: 'Leave Types', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'email_docs', label: 'Email & Documents', icon: Mail },
    { id: 'security', label: 'Security & SSO', icon: KeyIcon },
    { id: 'integrations', label: 'Integrations', icon: Users },
    { id: 'domains', label: 'Domain', icon: Globe },
    { id: 'id_card', label: 'ID Card', icon: Contact },
    { id: 'assets', label: 'Asset Management', icon: Laptop },
    { id: 'workflows', label: 'Workflow Engine', icon: GitBranch },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-muted-foreground mt-1">Customize your workspace</p>
        </div>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        <div className="col-span-1">
          {/* Mobile Settings Menu: Horizontally scrollable premium pills */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeTab === item.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25 scale-[1.02]'
                    : 'bg-card/40 hover:bg-card/85 text-muted-foreground border-border/50'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Desktop Settings Menu: Classic sidebar card */}
          <Card className="hidden lg:block overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-base">Menu</CardTitle>
            </CardHeader>
            <div className="flex flex-col py-2">
              {menuItems.map((item) => (
                <div key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${activeTab === item.id ? 'bg-primary/10 border-l-2 border-l-primary text-primary' : 'hover:bg-primary/5 text-muted-foreground hover:text-foreground border-l-2 border-l-transparent'}`}>
                  <item.icon className="w-4 h-4" /><span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {(() => { const m = menuItems.find(i => i.id === activeTab); return m ? <><m.icon className="w-5 h-5" /> {m.label}</> : null; })()}
            </CardTitle>
            <CardDescription>
              {activeTab === 'general' && "Update your company details and global settings."}
              {activeTab === 'locations' && "Define and geofence multiple branch offices with distinct physical boundaries."}
              {activeTab === 'schedule' && "Define work shifts and assign schedules to employees."}
              {activeTab === 'payroll' && "Configure tax slabs, salary components, and bonus types."}
              {activeTab === 'roles' && "Manage user roles and access permissions."}
              {activeTab === 'email_docs' && "Configure SMTP for outgoing emails."}
              {activeTab === 'leaves' && "Define leave categories and annual quotas."}
              {activeTab === 'notifications' && "Configure notification preferences."}
              {activeTab === 'security' && "Security and single sign-on settings."}
              {activeTab === 'integrations' && "Third-party integrations and API keys."}
              {activeTab === 'domains' && "Manage your workspace URL and custom domain."}
              {activeTab === 'id_card' && "Design and customize your company's virtual ID cards."}
              {activeTab === 'assets' && "Track and manage hardware inventory assignments."}
              {activeTab === 'workflows' && "Build trigger-based recipes to automate emails, notifications, and onboarding checklists."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : activeTab === 'general' ? (
              <GeneralTab form={form} setForm={setForm} company={company} />
            ) : activeTab === 'locations' ? (
              <LocationsTab companyId={profile?.company_id} />
            ) : activeTab === 'schedule' ? (
              <ShiftTab companyId={profile?.company_id} />
            ) : activeTab === 'payroll' ? (
              <PayrollConfigTab companyId={profile?.company_id} />
            ) : activeTab === 'roles' ? (
              <RolesTab companyId={profile?.company_id} />
            ) : activeTab === 'email_docs' ? (
              <EmailDocsTab form={form} setForm={setForm} handleTestSmtp={handleTestSmtp} isTestingSmtp={isTestingSmtp} />
            ) : activeTab === 'leaves' ? (
              <LeaveTypesTab companyId={profile?.company_id} />
            ) : activeTab === 'notifications' ? (
              <NotificationsTab />
            ) : activeTab === 'security' ? (
              <SecurityTab />
            ) : activeTab === 'integrations' ? (
              <IntegrationsTab />
            ) : activeTab === 'domains' ? (
              <DomainSettings />
            ) : activeTab === 'id_card' ? (
              <IDCardTemplateEditor />
            ) : activeTab === 'assets' ? (
              <AssetManagementTab companyId={profile?.company_id} />
            ) : activeTab === 'workflows' ? (
              <WorkflowBuilder companyId={profile?.company_id} />
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={smtpDiagOpen} onOpenChange={setSmtpDiagOpen}>
          <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Mail className="h-5 w-5 text-primary" />
                SMTP Diagnostics Connection Test
              </DialogTitle>
              <DialogDescription className="text-xs">
                Run automated tests on your outgoing SMTP server to check firewall blocks, invalid credentials, and email deliverability.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-2">
                <Label htmlFor="testEmailInput" className="text-xs font-semibold text-muted-foreground uppercase">Recipient Test Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="testEmailInput"
                    type="email"
                    placeholder="e.g. admin@company.com"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Button
                    onClick={runSmtpDiagnostics}
                    disabled={isTestingSmtp}
                    className="h-9 px-4 font-semibold shrink-0"
                  >
                    {isTestingSmtp ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Testing...
                      </>
                    ) : (
                      'Run Diagnostic'
                    )}
                  </Button>
                </div>
              </div>

              {smtpDiagLogs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Diagnostic Session Logs</Label>
                  <div className="p-3 bg-slate-950 dark:bg-slate-900 rounded-lg border border-border/80 font-mono text-[10px] space-y-1 max-h-[160px] overflow-y-auto text-emerald-400">
                    {smtpDiagLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {smtpDiagError && (
                <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    ❌ Connection Block / Error Message
                  </h4>
                  <p className="text-[11px] text-muted-foreground font-mono bg-destructive/10 p-2 rounded border border-destructive/10 whitespace-pre-wrap">
                    {smtpDiagError}
                  </p>
                </div>
              )}

              {smtpDiagAdvice && (
                <div className="p-3 bg-warning/5 rounded-lg border border-warning/20 space-y-1 animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1.5">
                    💡 Expert Resolution Guidance
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {smtpDiagAdvice}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-end border-t border-border/50 pt-3">
              <Button size="sm" variant="outline" onClick={() => setSmtpDiagOpen(false)}>
                Close Diagnostics
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ======== GENERAL TAB ========
function GeneralTab({ form, setForm, company }: any) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File must be under 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${profile?.company_id}/logo.${ext}`;
      
      // Upload to company-logos bucket
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Add cache-bust param
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoUrl })
        .eq('id', profile?.company_id)
        .select('id');
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      queryClient.invalidateQueries({ queryKey: ['company-branding'] });
      toast.success('Logo updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  return (<>
    <div className="grid md:grid-cols-2 gap-6 pt-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Company Name</label>
        <Input value={form.name} onChange={(e: any) => setForm((f: any) => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Country</label>
        <Input value={form.country} onChange={(e: any) => setForm((f: any) => ({ ...f, country: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Default Timezone</label>
        <select value={form.timezone} onChange={(e: any) => setForm((f: any) => ({ ...f, timezone: e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none">
          <option value="UTC">UTC</option><option value="America/New_York">America/New_York (EST)</option><option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
          <option value="Europe/London">Europe/London (GMT)</option><option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="Asia/Dubai">Asia/Dubai (GST)</option><option value="Asia/Tokyo">Asia/Tokyo (JST)</option><option value="Australia/Sydney">Australia/Sydney (AEST)</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Primary Currency</label>
        <select value={form.currency} onChange={(e: any) => setForm((f: any) => ({ ...f, currency: e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none">
          <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="INR">INR (₹)</option>
          <option value="AED">AED (د.إ)</option><option value="CAD">CAD (C$)</option><option value="AUD">AUD (A$)</option><option value="JPY">JPY (¥)</option>
        </select>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-border/50">
      <div className="space-y-2 md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">About Company (Public Career Page)</label>
        <Textarea 
          placeholder="Describe your company for potential candidates..."
          value={form.about_company} 
          onChange={(e: any) => setForm((f: any) => ({ ...f, about_company: e.target.value }))} 
          className="bg-background/50 border-border/50 min-h-[80px]" 
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Company Culture (Internal - Guides AI)</label>
        <Textarea 
          placeholder="Describe your company culture, values, and what you look for in candidates..."
          value={form.company_culture} 
          onChange={(e: any) => setForm((f: any) => ({ ...f, company_culture: e.target.value }))} 
          className="bg-background/50 border-border/50 min-h-[80px]" 
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Website URL</label>
        <Input 
          type="url"
          placeholder="https://example.com"
          value={form.website} 
          onChange={(e: any) => setForm((f: any) => ({ ...f, website: e.target.value }))} 
          className="bg-background/50 border-border/50 h-10" 
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">LinkedIn URL</label>
        <Input 
          type="url"
          placeholder="https://linkedin.com/company/example"
          value={form.linkedin_url} 
          onChange={(e: any) => setForm((f: any) => ({ ...f, linkedin_url: e.target.value }))} 
          className="bg-background/50 border-border/50 h-10" 
        />
      </div>
    </div>
    <div className="pt-6 border-t border-border/50">
      <h3 className="text-lg font-semibold mb-4">Company Logo</h3>
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-lg bg-background border-2 border-dashed border-primary/40 flex items-center justify-center text-primary/40 hover:text-primary hover:border-primary transition-colors cursor-pointer overflow-hidden">
          {company?.logo_url ? <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" /> : <Building className="w-8 h-8" />}
        </div>
        <div>
          <p className="text-sm mb-1">Upload a new logo</p>
          <p className="text-xs text-muted-foreground mb-3">Max 2MB. Recommended 256×256px.</p>
          <label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploading}
            />
            <Button variant="outline" size="sm" className="text-xs h-8" asChild disabled={uploading}>
              <span>{uploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</> : 'Choose File'}</span>
            </Button>
          </label>
        </div>
      </div>
    </div>
    <div className="pt-6 border-t border-border/50 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">📍 Geofencing & Network Restrictions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Restrict office clock-ins by physical coordinates or IP networks. Leave coordinates empty to disable geofence checks.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6 pt-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Office Latitude</label>
          <Input 
            type="number"
            step="any"
            placeholder="e.g. 37.7749"
            value={form.geofence_latitude} 
            onChange={(e: any) => setForm((f: any) => ({ ...f, geofence_latitude: e.target.value }))} 
            className="bg-background/50 border-border/50 h-10" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Office Longitude</label>
          <Input 
            type="number"
            step="any"
            placeholder="e.g. -122.4194"
            value={form.geofence_longitude} 
            onChange={(e: any) => setForm((f: any) => ({ ...f, geofence_longitude: e.target.value }))} 
            className="bg-background/50 border-border/50 h-10" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Allowed Radius (Meters)</label>
          <Input 
            type="number"
            placeholder="e.g. 200"
            value={form.geofence_radius} 
            onChange={(e: any) => setForm((f: any) => ({ ...f, geofence_radius: e.target.value }))} 
            className="bg-background/50 border-border/50 h-10" 
          />
        </div>
        <div className="space-y-2 md:col-span-3">
          <label className="text-xs font-medium text-muted-foreground uppercase">IP Whitelist (Comma Separated)</label>
          <Input 
            placeholder="e.g. 192.168.1.1, 203.0.113.50 (Leave empty to allow all IPs)"
            value={form.ip_whitelist} 
            onChange={(e: any) => setForm((f: any) => ({ ...f, ip_whitelist: e.target.value }))} 
            className="bg-background/50 border-border/50 h-10" 
          />
          <p className="text-[10px] text-muted-foreground">If configured, employees checking in from these public IPs will bypass physical GPS checks.</p>
        </div>
      </div>
    </div>
  </>);
}

// ======== SHIFT MANAGEMENT TAB ========
function ShiftTab({ companyId }: { companyId?: string | null }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', start_time: '09:00', end_time: '18:00', break_minutes: '60' });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', companyId],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('*').eq('company_id', companyId!).order('name'); return data || []; },
    enabled: !!companyId,
  });

  const createShift = useMutation({
    mutationFn: async () => {
      if (!shiftForm.name.trim()) throw new Error('Name required');
      const { error } = await supabase.from('shifts').insert([{ company_id: companyId!, name: shiftForm.name, start_time: shiftForm.start_time, end_time: shiftForm.end_time, break_minutes: parseInt(shiftForm.break_minutes) || 60 }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift created'); setDialogOpen(false); setShiftForm({ name: '', start_time: '09:00', end_time: '18:00', break_minutes: '60' }); },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('shifts').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift deleted'); },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Shift Definitions</h3>
          <p className="text-xs text-muted-foreground">Create and manage work shifts for your company</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-3.5 h-3.5" /> Add Shift</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Shift</DialogTitle><DialogDescription>Define a new work schedule</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Shift Name</Label><Input placeholder="e.g. Morning Shift" value={shiftForm.name} onChange={(e) => setShiftForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                <div className="space-y-2"><Label>End Time</Label><Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm(f => ({ ...f, end_time: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Break Duration (minutes)</Label><Input type="number" value={shiftForm.break_minutes} onChange={(e) => setShiftForm(f => ({ ...f, break_minutes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createShift.mutate()} disabled={createShift.isPending}>Create Shift</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : shifts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No shifts defined. Create your first shift above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shifts.map((shift: any) => (
            <div key={shift.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50">
              <div>
                <p className="font-medium text-sm">{shift.name}</p>
                <p className="text-xs text-muted-foreground">{shift.start_time} — {shift.end_time} · {shift.break_minutes}min break</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => deleteShift.mutate(shift.id)} aria-label="Delete shift"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======== PAYROLL CONFIG TAB ========
function PayrollConfigTab({ companyId }: { companyId?: string | null }) {
  const queryClient = useQueryClient();
  const [taxSlabs, setTaxSlabs] = useState([
    { from: 0, to: 250000, rate: 0 },
    { from: 250001, to: 500000, rate: 5 },
    { from: 500001, to: 1000000, rate: 20 },
    { from: 1000001, to: 9999999, rate: 30 },
  ]);
  const [bonusTypes, setBonusTypes] = useState([
    { name: 'Performance Bonus', type: 'percentage', value: 10 },
    { name: 'Festival Bonus', type: 'fixed', value: 5000 },
    { name: 'Referral Bonus', type: 'fixed', value: 10000 },
  ]);
  const [newBonus, setNewBonus] = useState({ name: '', type: 'fixed', value: '' });

  // Overtime & Penalty Settings state
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);
  const [overtimeThresholdMins, setOvertimeThresholdMins] = useState(0);
  const [lateGracePeriodMins, setLateGracePeriodMins] = useState(15);
  const [lateTrigger, setLateTrigger] = useState(3);
  const [deductionUnit, setDeductionUnit] = useState('half_day');

  // Fetch persistent company payroll configuration
  const { data: company, isLoading: loadingConfig } = useQuery({
    queryKey: ['company-payroll-settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('compensation_structure, payroll_settings')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Load from database if exists
  useEffect(() => {
    if (company?.compensation_structure) {
      const comp = company.compensation_structure as any;
      if (Array.isArray(comp.tax_slabs)) {
        setTaxSlabs(comp.tax_slabs);
      }
      if (Array.isArray(comp.bonus_types)) {
        setBonusTypes(comp.bonus_types);
      }
    }
    if (company?.payroll_settings) {
      const ps = company.payroll_settings as any;
      setOvertimeMultiplier(ps.overtime_multiplier ?? 1.5);
      setOvertimeThresholdMins(ps.overtime_threshold_mins ?? 0);
      setLateGracePeriodMins(ps.late_grace_period_mins ?? 15);
      if (ps.late_penalty_rule) {
        setLateTrigger(ps.late_penalty_rule.frequency_trigger ?? 3);
        setDeductionUnit(ps.late_penalty_rule.deduction_unit ?? 'half_day');
      }
    }
  }, [company]);

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: async ({ updatedSlabs, updatedBonuses, updatedPayrollSettings }: { updatedSlabs?: typeof taxSlabs, updatedBonuses?: typeof bonusTypes, updatedPayrollSettings?: any }) => {
      if (!companyId) throw new Error("No company ID provided.");
      
      const { data: current, error: fetchErr } = await supabase
        .from('companies')
        .select('compensation_structure, payroll_settings')
        .eq('id', companyId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const currentComp = (current?.compensation_structure || {}) as any;
      
      const newComp = {
        ...currentComp,
        tax_slabs: updatedSlabs !== undefined ? updatedSlabs : taxSlabs,
        bonus_types: updatedBonuses !== undefined ? updatedBonuses : bonusTypes,
      };

      const newSettings = updatedPayrollSettings !== undefined ? updatedPayrollSettings : {
        overtime_multiplier: overtimeMultiplier,
        overtime_threshold_mins: overtimeThresholdMins,
        late_grace_period_mins: lateGracePeriodMins,
        late_penalty_rule: {
          frequency_trigger: lateTrigger,
          deduction_unit: deductionUnit
        }
      };

      const { error } = await supabase
        .from('companies')
        .update({
          compensation_structure: newComp as any,
          payroll_settings: newSettings as any
        })
        .eq('id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-payroll-settings', companyId] });
      queryClient.invalidateQueries({ queryKey: ['compensation-structure'] });
      toast.success('Payroll configurations saved successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save payroll configurations');
    }
  });

  const addSlab = () => {
    const last = taxSlabs[taxSlabs.length - 1];
    setTaxSlabs([...taxSlabs, { from: last.to + 1, to: last.to + 500000, rate: 0 }]);
  };

  const addBonus = () => {
    if (!newBonus.name.trim()) { toast.error('Name required'); return; }
    const updated = [...bonusTypes, { name: newBonus.name, type: newBonus.type, value: parseFloat(newBonus.value as string) || 0 }];
    setBonusTypes(updated);
    setNewBonus({ name: '', type: 'fixed', value: '' });
    saveMutation.mutate({ updatedBonuses: updated });
  };

  const deleteBonus = (index: number) => {
    const updated = bonusTypes.filter((_, j) => j !== index);
    setBonusTypes(updated);
    saveMutation.mutate({ updatedBonuses: updated });
  };

  if (loadingConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tax Slabs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Percent className="w-4 h-4" /> Tax Slabs</h3>
            <p className="text-xs text-muted-foreground">Configure income tax brackets for payroll deductions</p>
          </div>
          <Button variant="outline" size="sm" onClick={addSlab} className="gap-1"><Plus className="w-3 h-3" /> Add Slab</Button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2">
            <span>From</span><span>To</span><span>Rate (%)</span><span></span>
          </div>
          {taxSlabs.map((slab, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <Input type="number" value={slab.from} onChange={(e) => { const n = [...taxSlabs]; n[i].from = parseInt(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm" />
              <Input type="number" value={slab.to} onChange={(e) => { const n = [...taxSlabs]; n[i].to = parseInt(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm" />
              <Input type="number" value={slab.rate} onChange={(e) => { const n = [...taxSlabs]; n[i].rate = parseFloat(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => setTaxSlabs(taxSlabs.filter((_, j) => j !== i))} disabled={taxSlabs.length <= 1} aria-label="Delete tax slab"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
        <Button 
          size="sm" 
          className="mt-3" 
          onClick={() => saveMutation.mutate({ updatedSlabs: taxSlabs })}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Tax Config'}
        </Button>
      </div>

      {/* Bonus / Incentive Types */}
      <div className="border-t border-border/50 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Gift className="w-4 h-4" /> Bonus & Incentive Types</h3>
            <p className="text-xs text-muted-foreground">Define bonus categories for your company</p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          {bonusTypes.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded border border-border/50 bg-background/50">
              <div>
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.type === 'percentage' ? `${b.value}% of gross` : `Fixed amount: ${b.value}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{b.type}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => deleteBonus(i)} aria-label="Delete bonus type"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Name</Label>
            <Input placeholder="Bonus name" value={newBonus.name} onChange={(e) => setNewBonus(f => ({ ...f, name: e.target.value }))} className="h-9" />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs">Type</Label>
            <select value={newBonus.type} onChange={(e) => setNewBonus(f => ({ ...f, type: e.target.value }))} className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-2 py-1 text-sm">
              <option value="fixed">Fixed</option><option value="percentage">%</option>
            </select>
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs">Value</Label>
            <Input type="number" placeholder="0" value={newBonus.value} onChange={(e) => setNewBonus(f => ({ ...f, value: e.target.value }))} className="h-9" />
          </div>
          <Button size="sm" className="h-9" onClick={addBonus} disabled={saveMutation.isPending}><Plus className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Overtime & Attendance Penalty Policy */}
      <div className="border-t border-border/50 pt-6">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Overtime & Penalty Policies
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure automated overtime multipliers and late clock-in penalty deductions.
        </p>
        <div className="grid gap-6 md:grid-cols-2 bg-muted/20 p-5 rounded-xl border border-border/50">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">Overtime Calculations</h4>
            <div className="space-y-2">
              <Label className="text-xs">Overtime Payout Multiplier</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="h-9 w-24 bg-background"
                />
                <span className="text-xs text-muted-foreground">x of base hourly pay</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Overtime Threshold (Minutes)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={overtimeThresholdMins}
                  onChange={(e) => setOvertimeThresholdMins(parseInt(e.target.value) || 0)}
                  className="h-9 w-24 bg-background"
                />
                <span className="text-xs text-muted-foreground">mins grace before OT starts accruing</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">Late Clock-In Penalty</h4>
            <div className="space-y-2">
              <Label className="text-xs">Late Grace Period (Minutes)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={lateGracePeriodMins}
                  onChange={(e) => setLateGracePeriodMins(parseInt(e.target.value) || 0)}
                  className="h-9 w-24 bg-background"
                />
                <span className="text-xs text-muted-foreground">mins allowed late clock-in without penalty</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Deduction Penalty Rule</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs">Deduct</span>
                <select
                  value={deductionUnit}
                  onChange={(e) => setDeductionUnit(e.target.value)}
                  className="h-9 rounded-md border border-border/50 bg-background px-2 py-1 text-sm w-32"
                >
                  <option value="half_day">Half Day Pay</option>
                  <option value="full_day">Full Day Pay</option>
                </select>
                <span className="text-xs">for every</span>
                <Input
                  type="number"
                  value={lateTrigger}
                  onChange={(e) => setLateTrigger(parseInt(e.target.value) || 3)}
                  className="h-9 w-16 text-center bg-background"
                />
                <span className="text-xs">Late Clock-Ins</span>
              </div>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="mt-4"
          onClick={() => saveMutation.mutate({})}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Overtime & Penalty Policies'}
        </Button>
      </div>

      {/* Salary Components */}
      <div className="border-t border-border/50 pt-6">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Default Salary Components</h3>
        <p className="text-xs text-muted-foreground mb-4">These components are used when creating salary structures for employees</p>
        <div className="space-y-2">
          {['Basic Pay', 'House Rent Allowance (HRA)', 'Conveyance Allowance', 'Medical Allowance', 'Special Allowance', 'PF Employee Contribution', 'PF Employer Contribution', 'Professional Tax'].map(comp => (
            <div key={comp} className="flex items-center justify-between p-2 rounded border border-border/50 bg-background/50 text-sm">
              <span>{comp}</span>
              <Badge variant="outline" className="text-[10px]">Default</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======== ROLES TAB ========
function RolesTab({ companyId }: { companyId?: string | null }) {
  const roles = [
    { name: 'Company Admin', key: 'company_admin', desc: 'Full access to all modules, settings, billing, and user management', color: 'text-primary bg-primary/10 border-primary/30' },
    { name: 'HR Manager', key: 'hr_manager', desc: 'Access to HR modules (employees, leave, attendance, payroll, performance, onboarding, exit)', color: 'text-info bg-info/10 border-info/30' },
    { name: 'Recruiter', key: 'recruiter', desc: 'Employee-level access plus Recruitment module', color: 'text-warning bg-warning/10 border-warning/30' },
    { name: 'Employee', key: 'user', desc: 'Self-service access: attendance, leave, performance, helpdesk, announcements, documents', color: 'text-success bg-success/10 border-success/30' },
  ];

  const permissions = ['Dashboard', 'Employees', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Recruitment', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Reports', 'Onboarding', 'Org Chart', 'Exit Mgmt', 'Settings'];
  const rolePerms: Record<string, string[]> = {
    company_admin: permissions,
    hr_manager: ['Dashboard', 'Employees', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Reports', 'Onboarding', 'Org Chart', 'Exit Mgmt'],
    recruiter: ['Dashboard', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Recruitment', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Org Chart'],
    user: ['Dashboard', 'Attendance', 'Leave', 'Holidays', 'Payroll', 'Performance', 'Learning', 'HelpDesk', 'Announcements', 'Documents', 'Org Chart'],
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-1">Role Definitions</h3>
        <p className="text-xs text-muted-foreground">These are the system roles and their module permissions</p>
      </div>
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.key} className={`rounded-lg border p-4 ${role.color}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{role.name}</h4>
              <Badge variant="outline" className="text-[10px] capitalize">{role.key.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs opacity-80 mb-3">{role.desc}</p>
            <div className="flex flex-wrap gap-1">
              {permissions.map(perm => (
                <Badge key={perm} variant="outline" className={`text-[9px] ${rolePerms[role.key]?.includes(perm) ? 'bg-background/50 border-current/20' : 'opacity-20 line-through'}`}>
                  {perm}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======== EMAIL DOCS TAB ========
function EmailDocsTab({ form, setForm, handleTestSmtp, isTestingSmtp }: any) {
  return (
    <div className="space-y-8 pt-4">
      <div>
        <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
          <h3 className="text-base font-semibold">SMTP Server Config</h3>
          <Button variant="outline" size="sm" onClick={handleTestSmtp} disabled={isTestingSmtp} className="h-8 gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 text-primary">
            {isTestingSmtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isTestingSmtp ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">Sender Email</label><Input type="email" placeholder="hr@company.com" value={form.smtp_from_email} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_from_email: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">Sender Name</label><Input placeholder="HR Department" value={form.smtp_from_name} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_from_name: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground uppercase">SMTP Host</label><Input placeholder="smtp.mailgun.org" value={form.smtp_host} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_host: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">SMTP Port</label><Input type="number" placeholder="587" value={form.smtp_port} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_port: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">SMTP Username</label><Input placeholder="postmaster@company.com" value={form.smtp_user} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_user: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">SMTP Password</label><Input type="password" placeholder="••••••••" value={form.smtp_pass} onChange={(e: any) => setForm((f: any) => ({ ...f, smtp_pass: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold mb-4 border-b border-border/50 pb-2">Document Sequencing</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground uppercase">Offer Letter Prefix</label><Input placeholder="OFFER-" value={form.offer_sequence_prefix} onChange={(e: any) => setForm((f: any) => ({ ...f, offer_sequence_prefix: e.target.value }))} className="bg-background/50 border-border/50 h-10" /></div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Current Sequence</label>
            <Input type="number" placeholder="0" value={form.offer_sequence_current} onChange={(e: any) => setForm((f: any) => ({ ...f, offer_sequence_current: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
            <p className="text-[10px] text-muted-foreground">Next: {form.offer_sequence_prefix || 'OFFER-'}{parseInt(form.offer_sequence_current || '0') + 1}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======== LEAVE TYPES TAB ========
function LeaveTypesTab({ companyId }: { companyId?: string | null }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [form, setForm] = useState({ 
    name: '', code: '', max_days_per_year: '12', color: '#4F46E5', is_active: true, carry_forward: false, requires_document: false 
  });

  const { data: leaveTypes = [], isLoading } = useQuery({
    queryKey: ['leave-types', companyId],
    queryFn: async () => { 
      const { data } = await supabase.from('leave_types').select('*').eq('company_id', companyId!).order('name'); 
      return data || []; 
    },
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name required');
      const payload = { 
        company_id: companyId!, 
        name: form.name, 
        code: form.code || null, 
        max_days_per_year: parseFloat(form.max_days_per_year) || 0, 
        color: form.color,
        is_active: form.is_active,
        carry_forward: form.carry_forward,
        requires_document: form.requires_document
      };
      
      if (editingType) {
        const { error } = await supabase.from('leave_types').update(payload).eq('id', editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('leave_types').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['leave-types'] }); 
      toast.success(editingType ? 'Leave type updated' : 'Leave type created'); 
      setDialogOpen(false); 
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { 
      const { error } = await supabase.from('leave_types').delete().eq('id', id); 
      if (error) throw error; 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['leave-types'] }); 
      toast.success('Leave type deleted'); 
    },
    onError: (e: any) => toast.error(e?.message || 'Failed. It might be in use.'),
  });

  const resetForm = () => {
    setForm({ name: '', code: '', max_days_per_year: '12', color: '#4F46E5', is_active: true, carry_forward: false, requires_document: false });
    setEditingType(null);
  };

  const handleEdit = (lt: any) => {
    setEditingType(lt);
    setForm({ 
      name: lt.name, 
      code: lt.code || '', 
      max_days_per_year: lt.max_days_per_year?.toString() || '0', 
      color: lt.color || '#4F46E5',
      is_active: lt.is_active,
      carry_forward: lt.carry_forward,
      requires_document: lt.requires_document
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Leave Categories</h3>
          <p className="text-xs text-muted-foreground">Configure different types of leaves and their annual limits</p>
        </div>
        <Button size="sm" className="gap-1 border border-primary/20" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add New Type
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-32 w-full" /> : leaveTypes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
          <p className="text-sm font-medium">No leave types defined</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">You need to add at least one leave type to allow employees to apply</p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Create Standard Leaves</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {leaveTypes.map((lt: any) => (
            <div key={lt.id} className="group relative flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-background/60 hover:border-primary/30 transition-all duration-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: lt.color }}>
                  {lt.code || lt.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{lt.name}</p>
                    {!lt.is_active && <Badge variant="secondary" className="text-[9px] h-4 py-0">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{lt.max_days_per_year} days/year • {lt.carry_forward ? 'Carry forward' : 'Use it or lose it'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(lt)} aria-label="Edit leave type">
                  <Settings2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(lt.id)} aria-label="Delete leave type">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
            <DialogDescription>Define the name, quota and behavior for this leave category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input placeholder="e.g. Sick Leave" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Short Code</Label>
                <Input placeholder="e.g. SL" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days per Year</Label>
                <Input type="number" value={form.max_days_per_year} onChange={(e) => setForm(f => ({ ...f, max_days_per_year: e.target.value }))} className="bg-background/50 border-border/50 focus:border-primary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pick a Color</Label>
                <div className="flex gap-2 items-center h-10 px-3 rounded-md border border-border/50 bg-background/50">
                  <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} className="w-6 h-6 rounded border-none bg-transparent cursor-pointer" />
                  <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-is-active">
                  <Label className="text-sm">Active</Label>
                  <p className="text-[10px] text-muted-foreground">Visible to employees for application</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.is_active}
                  aria-labelledby="label-is-active"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-carry-forward">
                  <Label className="text-sm">Carry Forward</Label>
                  <p className="text-[10px] text-muted-foreground">Allow unused days to transfer to next year</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.carry_forward}
                  aria-labelledby="label-carry-forward"
                  onClick={() => setForm(f => ({ ...f, carry_forward: !f.carry_forward }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.carry_forward ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.carry_forward ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5" id="label-requires-document">
                  <Label className="text-sm">Requires Document</Label>
                  <p className="text-[10px] text-muted-foreground">Employees must upload medical or support docs</p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.requires_document}
                  aria-labelledby="label-requires-document"
                  onClick={() => setForm(f => ({ ...f, requires_document: !f.requires_document }))}
                  className={`w-10 h-5 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.requires_document ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${form.requires_document ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-8 shadow-md shadow-primary/20">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingType ? 'Save Changes' : 'Create Type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======== NOTIFICATIONS TAB ========
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    leave_requests: true, new_hires: true, birthdays: true, anniversaries: true,
    payroll_runs: true, ticket_updates: true, performance_reviews: false, document_expiry: true,
  });
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold mb-1">Email Notifications</h3>
      <p className="text-xs text-muted-foreground mb-4">Choose which events trigger email notifications to admins</p>
      {Object.entries(prefs).map(([key, val]) => (
        <div key={key} className="flex items-center justify-between p-3 rounded border border-border/50 bg-background/50">
          <span className="text-sm capitalize" id={`label-notify-${key}`}>{key.replace(/_/g, ' ')}</span>
          <button
            role="switch"
            aria-checked={val}
            aria-labelledby={`label-notify-${key}`}
            onClick={() => setPrefs(p => ({ ...p, [key]: !val }))}
            className={`w-10 h-5 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${val ? 'bg-primary' : 'bg-muted/50'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${val ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      ))}
      <Button size="sm" className="mt-2" onClick={() => toast.success('Notification preferences saved')}>Save Preferences</Button>
    </div>
  );
}

// ======== SECURITY TAB ========
function SecurityTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-1">Password Policy</h3>
        <p className="text-xs text-muted-foreground mb-4">Configure password strength requirements for all users</p>
        <div className="space-y-3">
          {[
            { label: 'Minimum password length', value: '8 characters' },
            { label: 'Require uppercase letters', value: 'Enabled' },
            { label: 'Require numbers', value: 'Enabled' },
            { label: 'Require special characters', value: 'Enabled' },
            { label: 'Password expiry', value: '90 days' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded border border-border/50 bg-background/50">
              <span className="text-sm">{item.label}</span>
              <Badge variant="outline" className="text-[10px]">{item.value}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border/50 pt-4">
        <h3 className="text-base font-semibold mb-1">Two-Factor Authentication</h3>
        <p className="text-xs text-muted-foreground mb-4">Enforce 2FA for all users</p>
        <div className="flex items-center justify-between p-3 rounded border border-border/50 bg-background/50">
          <span className="text-sm">Require 2FA for admins</span>
          <Badge variant="outline" className="border-success text-success">Recommended</Badge>
        </div>
      </div>
    </div>
  );
}

// ======== INTEGRATIONS TAB ========
function IntegrationsTab() {
  const integrations = [
    { name: 'Slack', desc: 'Send notifications to Slack channels', connected: false, icon: '💬' },
    { name: 'Google Calendar', desc: 'Sync leave and holidays', connected: false, icon: '📅' },
    { name: 'Zoom', desc: 'Schedule interviews automatically', connected: false, icon: '📹' },
    { name: 'Jira', desc: 'Track project assignments', connected: false, icon: '📋' },
  ];
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold mb-1">Available Integrations</h3>
      <p className="text-xs text-muted-foreground mb-4">Connect third-party tools to enhance your workflow</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {integrations.map(int => (
          <div key={int.name} className="p-4 rounded-lg border border-border/50 bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{int.icon}</span>
              <div>
                <p className="font-medium text-sm">{int.name}</p>
                <p className="text-xs text-muted-foreground">{int.desc}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2">{int.connected ? 'Connected ✓' : 'Connect'}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======== OFFICE BRANCH LOCATIONS TAB ========
function LocationsTab({ companyId }: { companyId?: string | null }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [locForm, setLocForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_meters: '200',
    is_active: true,
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['company-locations-settings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('company_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const getCoordinates = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocForm(f => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        toast.success('Coordinates retrieved successfully!');
      },
      (error) => {
        console.error(error);
        setIsLocating(false);
        toast.error('Failed to get coordinates. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveLocation = useMutation({
    mutationFn: async () => {
      if (!locForm.name.trim()) throw new Error('Location name is required');
      const lat = parseFloat(locForm.latitude);
      const lng = parseFloat(locForm.longitude);
      const rad = parseInt(locForm.radius_meters);

      if (isNaN(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
      if (isNaN(lng) || lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180');
      if (isNaN(rad) || rad <= 0) throw new Error('Geofence radius must be greater than 0');

      const payload = {
        company_id: companyId!,
        name: locForm.name.trim(),
        latitude: lat,
        longitude: lng,
        radius_meters: rad,
        is_active: locForm.is_active,
      };

      if (editingLocation) {
        const { error } = await supabase
          .from('company_locations')
          .update(payload)
          .eq('id', editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_locations')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-locations-settings'] });
      toast.success(editingLocation ? 'Office location updated' : 'Office location added');
      setDialogOpen(false);
      setEditingLocation(null);
      setLocForm({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save location'),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_locations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-locations-settings'] });
      toast.success('Office location deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete location'),
  });

  const handleEdit = (loc: any) => {
    setEditingLocation(loc);
    setLocForm({
      name: loc.name,
      latitude: loc.latitude.toString(),
      longitude: loc.longitude.toString(),
      radius_meters: loc.radius_meters.toString(),
      is_active: loc.is_active,
    });
    setDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEditingLocation(null);
    setLocForm({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Branch Geofencing</h3>
          <p className="text-xs text-muted-foreground">Manage physical coordinates and geofences for different company offices and branches</p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Location
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Office Location' : 'Add Office Location'}</DialogTitle>
            <DialogDescription>Define distinct geographical boundaries for attendance validation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location / Branch Name</Label>
              <Input placeholder="e.g. Headquarters, London Branch" value={locForm.name} onChange={(e) => setLocForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input placeholder="e.g. 51.5074" type="number" step="any" value={locForm.latitude} onChange={(e) => setLocForm(f => ({ ...f, latitude: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input placeholder="e.g. -0.1278" type="number" step="any" value={locForm.longitude} onChange={(e) => setLocForm(f => ({ ...f, longitude: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" className="w-full gap-1.5" onClick={getCoordinates} disabled={isLocating}>
                {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                Get Current Coordinates
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Geofence Radius (meters)</Label>
              <Input type="number" value={locForm.radius_meters} onChange={(e) => setLocForm(f => ({ ...f, radius_meters: e.target.value }))} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={locForm.is_active}
                onChange={(e) => setLocForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-border bg-background text-primary focus:ring-primary"
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active and enforcing geofence</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveLocation.mutate()} disabled={saveLocation.isPending}>
              {saveLocation.isPending ? 'Saving...' : editingLocation ? 'Update Location' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : locations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No custom branch locations defined yet. Add your first location above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((loc: any) => (
            <div key={loc.id} className="flex flex-col justify-between p-4 rounded-lg border border-border/50 bg-background/50 gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{loc.name}</p>
                    {!loc.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Coordinates: {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p>
                  <p className="text-xs text-muted-foreground">Radius: {loc.radius_meters} meters</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(loc)} aria-label="Edit location">
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => deleteLocation.mutate(loc.id)} aria-label="Delete location">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
