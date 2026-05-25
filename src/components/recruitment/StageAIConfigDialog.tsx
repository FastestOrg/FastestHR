import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Plus, Bot, Sparkles, X } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';

interface Expectation {
  point: string;
  optimal_answer: string;
  is_mandatory: boolean;
}

interface StageAIConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  stageName: string;
}

export function StageAIConfigDialog({
  isOpen,
  onOpenChange,
  jobId,
  stageName,
}: StageAIConfigDialogProps) {
  const queryClient = useQueryClient();
  const [expectations, setExpectations] = useState<Expectation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch current settings for this job
  const { data: job, isLoading } = useQuery({
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

  useEffect(() => {
    if (job?.stage_ai_settings && typeof job.stage_ai_settings === 'object') {
      const settings = (job.stage_ai_settings as any)[stageName] || [];
      // Ensure it's an array and matches our structure
      if (Array.isArray(settings)) {
        setExpectations(settings.length > 0 ? settings : [{ point: '', optimal_answer: '', is_mandatory: false }]);
      } else {
        setExpectations([{ point: '', optimal_answer: '', is_mandatory: false }]);
      }
    } else if (!isLoading) {
      setExpectations([{ point: '', optimal_answer: '', is_mandatory: false }]);
    }
  }, [job, stageName, isLoading]);

  const addExpectation = () => {
    setExpectations([...expectations, { point: '', optimal_answer: '', is_mandatory: false }]);
  };

  const removeExpectation = (index: number) => {
    setExpectations(expectations.filter((_, i) => i !== index));
  };

  const updateExpectation = (index: number, field: keyof Expectation, value: any) => {
    const newExpectations = [...expectations];
    newExpectations[index] = { ...newExpectations[index], [field]: value };
    setExpectations(newExpectations);
  };

  const generateWithAI = async () => {
    if (!jobId || !stageName || !job?.company_id) {
      toast.error('Missing required info for AI generation');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('AI is crafting evaluation criteria...');

    try {
      const { data, error } = await supabase.functions.invoke('generate-stage-criteria', {
        body: { jobId, stageName, companyId: job.company_id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.criteria && Array.isArray(data.criteria)) {
        // Append or replace? Let's append but filter out the initial empty point if it exists
        const filteredCurrent = expectations.filter(e => e.point.trim() !== '');
        setExpectations([...filteredCurrent, ...data.criteria]);
        toast.success('AI generation complete!', { id: toastId });
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      toast.error(`AI Generation Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const validExpectations = expectations.filter(e => e.point.trim() !== '');
      
      // Get current settings first to preserve other stages
      const { data: currentJob } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      const jobData = currentJob as any;

      const newSettings = {
        ...(jobData?.stage_ai_settings || {}),
        [stageName]: validExpectations,
      };

      const { error } = await supabase
        .from('jobs')
        .update({ stage_ai_settings: newSettings } as any)
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`AI configuration saved for ${stageName} stage`);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['job-ai-settings', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      console.error('Error saving AI settings:', error);
      toast.error('Failed to save AI configuration');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border-none bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            AI Criteria: {stageName.charAt(0).toUpperCase() + stageName.slice(1)}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure what the AI should evaluate during interviews in the <span className="font-semibold text-foreground">"{stageName}"</span> stage. These points will be used as the ultimate truth for scoring.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Evaluation Points
                </Label>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={generateWithAI}
                    disabled={isGenerating}
                    className="h-8 gap-1.5 text-xs border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate with AI
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addExpectation}
                    className="h-8 gap-1 text-xs border-dashed hover:border-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Point
                  </Button>
                </div>
              </div>

              {expectations.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed rounded-xl bg-muted/20">
                  <p className="text-sm text-muted-foreground">No evaluation criteria defined for this stage.</p>
                  <Button 
                    type="button" 
                    variant="link" 
                    onClick={addExpectation}
                    className="text-primary mt-2"
                  >
                    Click here to add your first point
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {expectations.map((exp, index) => (
                  <div key={index} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4 relative group transition-all hover:bg-muted/50 hover:border-primary/20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExpectation(index)}
                      className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Requirement / Concept</Label>
                        <Input
                          required
                          placeholder="e.g. Deep understanding of Microservices architecture"
                          value={exp.point}
                          onChange={(e) => updateExpectation(index, 'point', e.target.value)}
                          className="bg-background border-none shadow-sm focus-visible:ring-1"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Optimal Answer / Keywords (Internal Reference)</Label>
                        <Textarea
                          placeholder="Candidate should describe Saga patterns, Circuit breakers, and Event-driven communication..."
                          value={exp.optimal_answer}
                          onChange={(e) => updateExpectation(index, 'optimal_answer', e.target.value)}
                          className="min-h-[80px] bg-background border-none shadow-sm focus-visible:ring-1 text-sm resize-none"
                        />
                      </div>

                      <div className="flex items-center space-x-3 p-2 rounded-lg bg-background/50 border border-border/30">
                        <Checkbox 
                          id={`mandatory-${index}`}
                          checked={exp.is_mandatory}
                          onCheckedChange={(checked) => updateExpectation(index, 'is_mandatory', checked)}
                          className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                        />
                        <div className="grid gap-0.5 leading-none">
                          <Label 
                            htmlFor={`mandatory-${index}`}
                            className="text-sm font-semibold cursor-pointer"
                          >
                            Mandatory Condition
                          </Label>
                          <p className="text-[10px] text-muted-foreground">AI will fail the candidate if this isn't satisfactorily met.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex gap-4">
              <div className="mt-1 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-primary uppercase tracking-wider">AI Integration Hub</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  These criteria are automatically injected into the Gemini model when high-level interviews are initiated for this stage. No need to redefine them for every candidate.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-muted font-medium">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending} 
                className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {mutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
