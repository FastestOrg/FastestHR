import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Loader2, Send } from 'lucide-react';

export default function EmailDocsSettings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data } = await supabase.from('companies')
        .select('id, name, offer_sequence_prefix, offer_sequence_current')
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
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from_email: '', smtp_from_name: '',
    offer_sequence_prefix: '', offer_sequence_current: '0'
  });

  useEffect(() => {
    if (company) {
      const c = company as any;
      setForm({
        smtp_host: c.smtp_host || '', 
        smtp_port: c.smtp_port?.toString() || '', 
        smtp_user: c.smtp_user || '', 
        smtp_pass: c.smtp_pass || '',
        smtp_from_email: c.smtp_from_email || '', 
        smtp_from_name: c.smtp_from_name || '',
        offer_sequence_prefix: c.offer_sequence_prefix || 'OFFER-', 
        offer_sequence_current: c.offer_sequence_current?.toString() || '0'
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Company ID is missing.");
      const { error } = await supabase.from('companies').update({
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port ? parseInt(form.smtp_port) : null,
        smtp_user: form.smtp_user || null,
        smtp_pass: form.smtp_pass || null,
        smtp_from_email: form.smtp_from_email || null,
        smtp_from_name: form.smtp_from_name || null,
        offer_sequence_prefix: form.offer_sequence_prefix || null,
        offer_sequence_current: form.offer_sequence_current ? parseInt(form.offer_sequence_current) : 0,
      }).eq('id', profile.company_id).select('id');
      if (error) throw error;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['my-company'] }); 
      toast.success('SMTP and sequencing settings saved successfully'); 
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save settings')),
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
      addLog('⚠️ Warning: Port 25 detected. Most cloud hosting providers block Port 25 by default.');
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
    } catch (error) {
      let msg = getErrorMessage(error, 'Unknown connection error');
      if (error && typeof error === 'object' && 'context' in error && (error as any).context && typeof (error as any).context.json === 'function') {
        try {
          const b = await (error as any).context.json();
          if (b.error) msg = b.error;
        } catch {}
      }

      addLog('❌ Failed: Connection could not be completed.');
      setSmtpDiagError(msg);

      let advice = 'Check that your SMTP server host is accessible from external networks and that the port is correct.';
      if (msg.includes('Authentication failed') || msg.includes('535') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('credentials')) {
        advice = 'Authentication failed. Please verify that your SMTP Username and Password are correct. Note: If using Gmail/Google Workspace, you must enable 2-Step Verification and generate a custom 16-character App Password rather than your default password.';
      } else if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        advice = `Connection timeout or refusal. The target host "${form.smtp_host}" is not responding on Port ${port}. ${port === 25 ? 'We highly recommend switching from Port 25 to Port 587 (with STARTTLS) or Port 465 (with SSL), as Port 25 is actively blocked on cloud provider firewalls.' : 'Ensure your SMTP server host allows outbound access, and check that the server is currently online.'}`;
      } else if (port === 25) {
        advice = 'Port 25 is active but failed. This is typical for cloud edge environments where Port 25 outbound sockets are blocked. Upgrade your SMTP port configuration to 587 (STARTTLS) or 465 (SSL/TLS) for compatibility.';
      }
      
      setSmtpDiagAdvice(advice);
      toast.error('SMTP Diagnostic Test Failed.');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Email & Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure SMTP settings for system notifications and manage document prefix sequences.</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card overflow-hidden">
        <CardContent className="space-y-8 pt-6">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-xs flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> SMTP Server Config</h3>
              <Button variant="outline" size="sm" onClick={handleTestSmtp} disabled={isTestingSmtp} className="h-8 gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 text-primary">
                {isTestingSmtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isTestingSmtp ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Sender Email</label>
                <Input type="email" placeholder="hr@company.com" value={form.smtp_from_email} onChange={(e) => setForm(f => ({ ...f, smtp_from_email: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Sender Name</label>
                <Input placeholder="HR Department" value={form.smtp_from_name} onChange={(e) => setForm(f => ({ ...f, smtp_from_name: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">SMTP Host</label>
                <Input placeholder="smtp.mailgun.org" value={form.smtp_host} onChange={(e) => setForm(f => ({ ...f, smtp_host: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">SMTP Port</label>
                <Input type="number" placeholder="587" value={form.smtp_port} onChange={(e) => setForm(f => ({ ...f, smtp_port: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">SMTP Username</label>
                <Input placeholder="postmaster@company.com" value={form.smtp_user} onChange={(e) => setForm(f => ({ ...f, smtp_user: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">SMTP Password</label>
                <Input type="password" placeholder="••••••••" value={form.smtp_pass} onChange={(e) => setForm(f => ({ ...f, smtp_pass: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4 border-b border-border/50 pb-2 uppercase tracking-wider text-xs">Document Sequencing</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Offer Letter Prefix</label>
                <Input placeholder="OFFER-" value={form.offer_sequence_prefix} onChange={(e) => setForm(f => ({ ...f, offer_sequence_prefix: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Current Sequence</label>
                <Input type="number" placeholder="0" value={form.offer_sequence_current} onChange={(e) => setForm(f => ({ ...f, offer_sequence_current: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
                <p className="text-[10px] text-muted-foreground">Next Reference: {form.offer_sequence_prefix || 'OFFER-'}{parseInt(form.offer_sequence_current || '0') + 1}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="font-semibold px-6">
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
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
  );
}
