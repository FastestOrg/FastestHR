import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Plus, Bot, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';

interface Expectation {
  point: string;
  optimal_answer: string;
  is_mandatory: boolean;
}

interface SendAIInterviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  jobId: string;
  stageName: string;
}

export function SendAIInterviewDialog({
  isOpen,
  onOpenChange,
  candidateId,
  candidateName,
  jobId,
  stageName,
}: SendAIInterviewDialogProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch stage-specific settings from the job
  const { data: job, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['job-ai-settings', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!jobId && isOpen,
  });

  const expectations: Expectation[] = (job?.stage_ai_settings?.[stageName] || []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error('Company ID missing');
      if (expectations.length === 0) throw new Error('No AI criteria defined for this stage');
      
      const { data, error } = await supabase.functions.invoke('send-ai-interview-invite', {
        body: {
          candidate_id: candidateId,
          job_id: jobId,
          company_id: profile.company_id,
          expectations: expectations, // Now sending the stage-specific expectations
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`AI Interview invite sent to ${candidateName}`);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      queryClient.invalidateQueries({ queryKey: ['ai_interviews'] });
    },
    onError: (error: any) => {
      console.error('Error sending invite:', error);
      toast.error(error.message || 'Failed to send AI Interview invite');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expectations.length === 0) {
      toast.error(`Please configure AI criteria for the "${stageName}" stage first.`);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] border-none bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            AI Interview Invite
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send an autonomous voice interview invite to <span className="font-semibold text-foreground">{candidateName}</span>.
          </DialogDescription>
        </DialogHeader>

        {isLoadingSettings ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <Label className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Interview Criteria for {stageName}
                </Label>
              </div>

              {expectations.length > 0 ? (
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {expectations.map((exp, index) => (
                    <div key={index} className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-3 group">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${exp.is_mandatory ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-primary'}`} />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold leading-none">{exp.point}</p>
                        {exp.optimal_answer && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{exp.optimal_answer}"</p>
                        )}
                        {exp.is_mandatory && (
                          <Badge variant="outline" className="h-4 text-[9px] uppercase px-1 border-destructive/30 text-destructive bg-destructive/5 font-bold">Mandatory</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border-2 border-dashed border-destructive/20 bg-destructive/5 text-center space-y-3">
                  <Bot className="h-8 w-8 text-destructive/40 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-destructive">No AI settings found for this stage!</p>
                    <p className="text-xs text-muted-foreground">Close this and click the AI icon next to "{stageName}" in the pipeline to set the criteria.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex gap-4">
              <div className="mt-1 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Candidate Experience</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The candidate will receive an email with a secure link valid for 48 hours. After completion, the AI result will appear on their card.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-medium">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending || expectations.length === 0} 
                className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {mutation.isPending ? 'Sending...' : 'Send AI Invitation'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
