import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Loader2, Send, Search, FileText, Clock, CheckCircle2, XCircle,
  CalendarClock, Eye, Mail, Filter, ArrowUpDown, MailOpen, Ban,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentRenderer } from './DocumentRenderer';
import { EMPLOYEE_VARIABLES } from './SendDeskTemplates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Document {
  id: string;
  name: string;
  document_number: string;
  category: string;
  sub_category: string | null;
  html_content: string;
  is_predefined_html: boolean;
  letterhead_url: string | null;
  variable_values: Record<string, string>;
  status: string;
  pdf_url: string | null;
  employee_id: string | null;
  created_at: string;
  employees?: { first_name: string; last_name: string; work_email: string | null; personal_email: string | null } | null;
}

interface EmailRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  employees?: { first_name: string; last_name: string } | null;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  sent: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Sent' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  scheduled: { icon: CalendarClock, color: 'text-amber-400', label: 'Scheduled' },
  cancelled: { icon: Ban, color: 'text-muted-foreground', label: 'Cancelled' },
};

export function SendDeskSendShare() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [resendDoc, setResendDoc] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ── Queries ──
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['senddesk-documents', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('senddesk_documents')
        .select('*, employees(first_name, last_name, work_email, personal_email)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Document[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: emails = [], isLoading: loadingEmails } = useQuery({
    queryKey: ['senddesk-emails', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('senddesk_emails')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as EmailRecord[];
    },
    enabled: !!profile?.company_id,
  });

  const filteredEmails = useMemo(() => {
    let filtered = emails;
    if (statusFilter) filtered = filtered.filter(e => e.status === statusFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.recipient_email.toLowerCase().includes(s) ||
        e.recipient_name?.toLowerCase().includes(s) ||
        e.subject.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [emails, searchTerm, statusFilter]);

  const generatedDocs = useMemo(() => {
    return documents.filter(d => d.status === 'generated' || d.status === 'sent');
  }, [documents]);

  const stats = useMemo(() => {
    let sent = 0;
    let failed = 0;
    let scheduled = 0;
    let pending = 0;

    for (const email of emails) {
      if (email.status === 'sent') sent++;
      else if (email.status === 'failed') failed++;
      else if (email.status === 'scheduled') scheduled++;
    }

    for (const doc of generatedDocs) {
      if (doc.status === 'generated') pending++;
    }

    return {
      total: emails.length,
      sent,
      failed,
      scheduled,
      pending,
    };
  }, [emails, generatedDocs]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending Docs', value: stats.pending, icon: FileText, color: 'text-blue-400' },
          { label: 'Total Sent', value: stats.sent, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Scheduled', value: stats.scheduled, icon: CalendarClock, color: 'text-amber-400' },
          { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-red-400' },
          { label: 'Total Comms', value: stats.total, icon: MailOpen, color: 'text-violet-400' },
        ].map(s => (
          <Card key={s.label} className="bg-background/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('send')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'send' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <Send className="h-4 w-4" /> Send Documents ({stats.pending})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'history' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <Clock className="h-4 w-4" /> Communication History ({emails.length})
        </button>
      </div>

      {/* Send Tab */}
      {tab === 'send' && (
        <div className="space-y-4">
          {loadingDocs ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : generatedDocs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No generated documents. Go to the Generator tab to create documents first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {generatedDocs.map(doc => (
                <Card key={doc.id} className="bg-background/50 border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{doc.name}</p>
                          <Badge variant="outline" className="text-[10px] capitalize shrink-0">{doc.category}</Badge>
                          <Badge variant={doc.status === 'sent' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{doc.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {doc.document_number} • {doc.employees ? `${doc.employees.first_name} ${doc.employees.last_name}` : 'No employee'} • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === 'sent' && (
                        <Button variant="ghost" size="icon" aria-label="Resend document" className="h-8 w-8 text-amber-400 hover:text-amber-500 hover:bg-amber-400/10"
                          title="Resend Document"
                          onClick={() => setResendDoc(doc)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Preview document" className="h-8 w-8"
                        onClick={() => { setPreviewDoc(doc); setIsPreviewOpen(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {doc.status === 'generated' && (
                        <Button size="sm" className="gap-1.5"
                          onClick={() => { setSelectedDoc(doc); setIsComposeOpen(true); }}
                        >
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by email, name, or subject..." className="pl-10"
              />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setStatusFilter(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!statusFilter ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              >
                All
              </button>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                    statusFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <cfg.icon className="h-3 w-3" /> {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {loadingEmails ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredEmails.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg text-muted-foreground">
              <Mail className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No communications found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-1">Status</div>
                <div className="col-span-3">Recipient</div>
                <div className="col-span-4">Subject</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Time</div>
              </div>
              {filteredEmails.map(email => {
                const cfg = STATUS_CONFIG[email.status] || STATUS_CONFIG.sent;
                const StatusIcon = cfg.icon;
                return (
                  <div key={email.id} className="grid grid-cols-12 gap-2 px-4 py-3 rounded-lg bg-background/50 border border-border/30 hover:border-border/50 transition-colors items-center group">
                    <div className="col-span-1">
                      <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-medium truncate">{email.recipient_name || email.recipient_email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{email.recipient_email}</p>
                    </div>
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm truncate">{email.subject}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(email.sent_at || email.scheduled_at || email.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {new Date(email.sent_at || email.scheduled_at || email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {email.error_message && (
                        <span className="text-[10px] text-red-400 truncate max-w-[100px]" title={email.error_message}>
                          {email.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Compose Dialog */}
      <ComposeEmailDialog
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        document={selectedDoc}
      />

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>{previewDoc?.name}</DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="bg-muted/10 rounded-xl p-6 border border-border/50 max-h-[65vh] overflow-auto flex justify-center">
              <div className="scale-[0.65] origin-top">
                <DocumentRenderer
                  htmlContent={previewDoc.html_content}
                  letterheadUrl={previewDoc.letterhead_url}
                  variables={{}}
                  isPredefinedHtml={previewDoc.is_predefined_html}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resend Confirmation */}
      <AlertDialog open={!!resendDoc} onOpenChange={(open) => !open && setResendDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resend this document? This will allow you to compose and send it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setSelectedDoc(resendDoc);
              setIsComposeOpen(true);
              setResendDoc(null);
            }}>
              Confirm Resend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Compose Email Dialog ──
function ComposeEmailDialog({ isOpen, onClose, document }: { isOpen: boolean; onClose: () => void; document: Document | null }) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reset/Pre-fill when doc changes
  useEffect(() => {
    if (isOpen && document?.employees) {
      setRecipientEmail(document.employees.work_email || document.employees.personal_email || '');
      setRecipientName(`${document.employees.first_name} ${document.employees.last_name}`);
      setSubject(document.name);
      setBodyHtml(`Dear ${document.employees.first_name},\n\nPlease find the attached document for your reference.\n\nBest regards,\nHR Team`);
      setScheduledAt('');
    } else if (!isOpen) {
      setRecipientEmail('');
      setRecipientName('');
      setSubject('');
      setBodyHtml('');
      setScheduledAt('');
    }
  }, [isOpen, document]);

  const handleSend = async () => {
    if (!recipientEmail || !subject || !bodyHtml) {
      toast.error('Please fill in recipient email, subject, and body');
      return;
    }
    setIsSending(true);
    try {
      const bodyAsHtml = bodyHtml.split('\n')
        .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${line}</p>`)
        .join('\n');

      const { data, error } = await supabase.functions.invoke('send-document', {
        body: {
          company_id: profile!.company_id,
          recipients: [{
            email: recipientEmail,
            name: recipientName,
            employee_id: document?.employee_id || null,
            document_id: document?.id || null,
            pdf_path: document?.pdf_url || (document?.id ? `${profile!.company_id}/${document.id}.pdf` : undefined),
          }],
          subject,
          body_html: `<div style="font-family: sans-serif; line-height: 1.6;">${bodyAsHtml}</div>`,
          scheduled_at: scheduledAt || undefined,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update document status
      if (document) {
        await supabase
          .from('senddesk_documents')
          .update({ status: 'sent' } as any)
          .eq('id', document.id);
      }

      toast.success(scheduledAt ? 'Email scheduled!' : 'Email sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['senddesk-emails'] });
      queryClient.invalidateQueries({ queryKey: ['senddesk-documents'] });
      onClose();
      
      // Reset fields
      setRecipientEmail('');
      setRecipientName('');
      setSubject('');
      setBodyHtml('');
      setScheduledAt('');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {scheduledAt ? 'Schedule Email' : 'Send Email'}
          </DialogTitle>
          <DialogDescription>
            {document ? `Sending: ${document.name}` : 'Compose and send email'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recipient Email *</label>
              <Input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="employee@company.com" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recipient Name</label>
              <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="John Doe" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject *</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Document subject" className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email Body *</label>
            <textarea
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              rows={8}
              placeholder="Dear Employee,&#10;&#10;Please find attached..."
              className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-y leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-3 w-3 inline mr-1" />
              Schedule for Later (Optional)
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="h-9 text-sm"
            />
            {scheduledAt && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Will be sent automatically at {new Date(scheduledAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button onClick={handleSend} disabled={isSending} className="gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : scheduledAt ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {scheduledAt ? 'Schedule' : 'Send Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
