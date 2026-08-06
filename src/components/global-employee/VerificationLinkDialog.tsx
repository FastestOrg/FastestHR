import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Copy, Check, ExternalLink } from 'lucide-react';
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
  const [link, setLink] = useState(existingLink || '');
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_global_employee_verification_link', {
        p_employee_id: employeeId,
      });

      if (error) throw error;

      const token = data as string;
      const fullUrl = `${window.location.origin}/employeebg/verify/${token}`;
      setLink(fullUrl);
      toast.success('Verification link generated!');
    } catch (err: any) {
      console.error('Generate link error:', err);
      toast.error(err.message || 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fullExistingUrl = existingLink
    ? `${window.location.origin}/employeebg/verify/${existingLink}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Verification Link
          </DialogTitle>
          <DialogDescription>
            Generate a link for <span className="font-semibold text-foreground">{employeeName}</span> to self-verify their details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Box */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">
              The employee/candidate can use this link to fill in their details like Aadhaar, PAN, 
              Driving License, work experience, and skills. Their submission will need your approval 
              before being marked as verified.
            </p>
          </div>

          {/* Existing link */}
          {fullExistingUrl && !link && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Existing Link</Label>
              <div className="flex gap-2">
                <Input value={fullExistingUrl} readOnly className="font-mono text-xs bg-muted/30" />
                <Button variant="outline" size="icon" onClick={() => { setLink(fullExistingUrl); copyLink(); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Generated link */}
          <AnimatePresence>
            {link && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  {fullExistingUrl ? 'New Link' : 'Generated Link'}
                </Label>
                <div className="flex gap-2">
                  <Input value={link} readOnly className="font-mono text-xs bg-muted/30" />
                  <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={generateLink} disabled={generating} className="gap-2">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {link ? 'Regenerate Link' : 'Generate Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
