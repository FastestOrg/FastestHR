import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ShieldAlert, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DisputeResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
}

export function DisputeResolutionDialog({
  open, onOpenChange, employeeId, employeeName, onSuccess,
}: DisputeResolutionDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [disputeType, setDisputeType] = useState<string>('inaccurate_dates');
  const [claimDetails, setClaimDetails] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !claimDetails.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('file_global_employee_dispute', {
        p_employee_id: employeeId,
        p_complainant_name: name.trim(),
        p_complainant_email: email.trim(),
        p_dispute_type: disputeType,
        p_claim_details: claimDetails.trim(),
        p_evidence_url: evidenceUrl.trim() || null,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        setSubmittedId(result.dispute_id);
        toast.success(`Dispute registered! Reference: ${result.dispute_id}`);
        onSuccess?.();
      } else {
        throw new Error('Failed to register dispute');
      }
    } catch (err: any) {
      console.error('Dispute error:', err);
      toast.error(err.message || 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setDisputeType('inaccurate_dates');
    setClaimDetails('');
    setEvidenceUrl('');
    setSubmittedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            File a Dispute / Rectification Request
          </DialogTitle>
          <DialogDescription>
            Submit a formal accuracy dispute for <span className="font-semibold text-foreground">{employeeName}</span> under FCRA (§ 1681i) and GDPR (Art. 16) standards.
          </DialogDescription>
        </DialogHeader>

        {submittedId ? (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold">Dispute Ticket Logged</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Your dispute reference number is <span className="font-mono font-bold text-primary">{submittedId}</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
                Our Trust & Compliance team will review and complete reinvestigation within statutory 30-day guidelines. A confirmation email has been dispatched.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Regulatory Notice Banner */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Candidate Protection Notice:</span> FastestHR treats all claims with strict confidentiality. Disputed records are flagged for review and investigated with originating sources.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="disp_name">Your Full Name *</Label>
                <Input
                  id="disp_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="disp_email">Official Email *</Label>
                <Input
                  id="disp_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Dispute Category *</Label>
              <Select value={disputeType} onValueChange={setDisputeType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inaccurate_dates">Inaccurate Employment Dates / Tenure</SelectItem>
                  <SelectItem value="incorrect_title">Incorrect Job Designation / Role</SelectItem>
                  <SelectItem value="defamatory_feedback">Defamatory or Malicious Statement</SelectItem>
                  <SelectItem value="identity_error">Identity Misattribution / Wrong Person</SelectItem>
                  <SelectItem value="other">Other Credential Inaccuracy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="disp_details">Dispute Details & Context *</Label>
              <Textarea
                id="disp_details"
                value={claimDetails}
                onChange={(e) => setClaimDetails(e.target.value)}
                placeholder="Explain in detail what specific information is incorrect, factual reality, and any supporting context..."
                className="mt-1"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="disp_evidence">Supporting Evidence Link (Optional)</Label>
              <Input
                id="disp_evidence"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="Google Drive, Dropbox, or Document URL (Service letter, payslip, etc.)"
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} variant="destructive" className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <FileText className="h-4 w-4" />
                Submit Formal Dispute
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
