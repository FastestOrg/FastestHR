import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Link2, Copy, Check, ExternalLink, ShieldCheck, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface VerificationLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  existingLink?: string | null;
}

export function VerificationLinkDialog({
  open, onOpenChange, employeeId, employeeName, existingLink,
}: VerificationLinkDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [candidateLink, setCandidateLink] = useState(
    existingLink ? `${window.location.origin}/employeebg/verify/${existingLink}` : ''
  );
  const [copiedCandidate, setCopiedCandidate] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);

  const passportUrl = `${window.location.origin}/employeebg/${employeeId}`;

  const generateCandidateLink = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_global_employee_verification_link', {
        p_employee_id: employeeId,
      });

      if (error) throw error;

      const token = data as string;
      const fullUrl = `${window.location.origin}/employeebg/verify/${token}`;
      setCandidateLink(fullUrl);
      toast.success('Candidate self-verification token generated!');
    } catch (err: any) {
      console.error('Generate link error:', err);
      toast.error(err.message || 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'candidate' | 'public') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (type === 'candidate') {
      setCopiedCandidate(true);
      toast.success('Candidate invitation link copied!');
      setTimeout(() => setCopiedCandidate(false), 2000);
    } else {
      setCopiedPublic(true);
      toast.success('Public Career Passport URL copied!');
      setTimeout(() => setCopiedPublic(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Verification & Passport Link Suite
          </DialogTitle>
          <DialogDescription>
            Generate scoped access tokens for <span className="font-semibold text-foreground">{employeeName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="candidate" className="w-full mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="candidate" className="text-xs">Candidate Self-Verify</TabsTrigger>
            <TabsTrigger value="public" className="text-xs">Career Passport Link</TabsTrigger>
          </TabsList>

          {/* Tab 1: Candidate Self Verification */}
          <TabsContent value="candidate" className="space-y-4 py-3">
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary inline mr-1.5" />
              <span className="font-semibold text-foreground">Candidate Onboarding:</span> Send this one-time link to the candidate so they can submit their work history, skills, and masked identity tokens.
            </div>

            {candidateLink ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Active Candidate Link</Label>
                <div className="flex gap-2">
                  <Input value={candidateLink} readOnly className="font-mono text-xs bg-muted/30" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(candidateLink, 'candidate')}>
                    {copiedCandidate ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed rounded-xl space-y-2">
                <p className="text-xs text-muted-foreground">No active self-verification link generated yet.</p>
                <Button onClick={generateCandidateLink} disabled={generating} size="sm" className="gap-2">
                  {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Generate Token
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Public Career Passport */}
          <TabsContent value="public" className="space-y-4 py-3">
            <div className="p-3 bg-muted/30 border border-border/30 rounded-xl text-xs text-muted-foreground">
              <Share2 className="h-4 w-4 text-primary inline mr-1.5" />
              <span className="font-semibold text-foreground">Career Passport:</span> Shareable dossier URL for recruiters and prospective employers. Sensitive data is protected by consent gateways.
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Passport URL</Label>
              <div className="flex gap-2">
                <Input value={passportUrl} readOnly className="font-mono text-xs bg-muted/30" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(passportUrl, 'public')}>
                  {copiedPublic ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {candidateLink && (
            <Button onClick={generateCandidateLink} disabled={generating} variant="secondary" className="gap-2 text-xs">
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Regenerate Token
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
