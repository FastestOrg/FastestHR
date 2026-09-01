import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Lock, ShieldCheck, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface RequestConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
}

export function RequestConsentDialog({
  open, onOpenChange, employeeId, employeeName, onSuccess,
}: RequestConsentDialogProps) {
  const { profile } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState(profile?.company_id ? 'Current Enterprise' : '');
  const [requesterEmail, setRequesterEmail] = useState(profile?.email || '');
  const [purpose, setPurpose] = useState('Pre-employment background verification and credential audit for candidate recruitment.');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!companyName.trim() || !requesterEmail.trim() || !purpose.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('request_global_employee_consent', {
        p_employee_id: employeeId,
        p_requester_company_name: companyName.trim(),
        p_requester_email: requesterEmail.trim(),
        p_purpose: purpose.trim(),
        p_requester_id: profile?.id || 'anonymous_recruiter',
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        setSubmitted(true);
        toast.success('Consent request dispatched to candidate!');
        onSuccess?.();
      } else {
        throw new Error('Failed to dispatch consent request');
      }
    } catch (err: any) {
      console.error('Consent request error:', err);
      toast.error(err.message || 'Failed to submit consent request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setCompanyName(profile?.company_id ? 'Current Enterprise' : '');
    setRequesterEmail(profile?.email || '');
    setPurpose('Pre-employment background verification and credential audit for candidate recruitment.');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Request Candidate Authorization
          </DialogTitle>
          <DialogDescription>
            Request explicit, auditable permission from <span className="font-semibold text-foreground">{employeeName}</span> to inspect their verified employment dossier.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold">Authorization Request Dispatched</h4>
              <p className="text-sm text-muted-foreground mt-1">
                An authorization token has been generated and queued for <span className="font-semibold text-foreground">{employeeName}</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
                Once the candidate approves the request from their Career Passport dashboard, you will receive real-time access to the full unredacted dossier.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">FCRA & GDPR Standalone Disclosure:</span> Access requests require legitimate hiring interest and explicit candidate consent. All lookups are permanently audit-logged.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="req_company">Hiring Organization *</Label>
                <Input
                  id="req_company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="req_email">Authorized Recruiter Email *</Label>
                <Input
                  id="req_email"
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  placeholder="recruiter@acme.com"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="req_purpose">Permissible Purpose / Hiring Reason *</Label>
              <Textarea
                id="req_purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="State the role, department, or evaluation criteria..."
                className="mt-1"
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-gradient-to-r from-primary to-purple-600">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4" />
                Dispatch Consent Request
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
