import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, Save, Loader2, Sparkles, FileText, 
  HelpCircle, Lightbulb, Clock, ShieldCheck 
} from 'lucide-react';
import { motion } from 'framer-motion';

const TEMPLATES = {
  office: `# General Office & Work Policies
- Work Mode: Hybrid (3 days office, 2 days remote). Tuesdays and Thursdays are core in-office days.
- Core Working Hours: 10:00 AM - 4:00 PM local time. All meetings should be scheduled within this window.
- Dress Code: Smart casual.
- Travel Expense: Auto-approved up to $100 per month for official commutes.`,
  hiring: `# Hiring & Interview Directives
- Candidate Bar: We require strong hands-on experience in React/TypeScript for front-end roles.
- Values Fit: Look for candidates who show high curiosity, direct communication, and bias for action.
- Probation: Every new hire undergoes exactly a 3-month probation period before permanent status.
- Culture: Diversity and remote-first collaboration skills are heavily weighted.`,
  leaves: `# Leave & Attendance Policies
- Sick Leaves: Must be reported before 9:00 AM on the day of absence. A medical certificate is required for leaves exceeding 3 consecutive days.
- Compensation Off: Work on holidays can be claimed as Comp-Off within 30 days.
- Overtime Limit: Maximum allowed overtime is 20 hours per month, requiring manager pre-approval.`
};

export default function AiMemorySettings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [memoryText, setMemoryText] = useState('');

  // Fetch the company's AI memory
  const { data: company, isLoading } = useQuery({
    queryKey: ['company-ai-memory', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, ai_memory')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  useEffect(() => {
    if (company?.ai_memory) {
      setMemoryText(company.ai_memory);
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Company ID is missing.");
      const { error } = await supabase
        .from('companies')
        .update({ ai_memory: memoryText || null })
        .eq('id', profile.company_id)
        .select('id');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-ai-memory'] });
      toast.success('FastestAI memory updated successfully!');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save FastestAI memory')),
  });

  const injectTemplate = (key: keyof typeof TEMPLATES) => {
    const divider = memoryText.trim() ? '\n\n' : '';
    setMemoryText(prev => prev + divider + TEMPLATES[key]);
    toast.info(`Injected ${key.charAt(0).toUpperCase() + key.slice(1)} Template`);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-1/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Brain className="w-5 h-5" />
          <span className="text-xs uppercase font-black tracking-widest text-muted-foreground">AI Control Hub</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">FastestAI Memory</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Train FastestAI on company-specific values, work shifts, recruitment rules, or policy overrides.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Memory Text Area Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 bg-[#09090b]/40 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Directives Ledger
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                  Input rules in markdown or plain text. Keep them clear and specific.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 text-[10px] font-black uppercase">
                Active Memory
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Textarea
                placeholder={`# E.g., Work Shift Schedule
- Office Core Hours: 9 AM to 5 PM IST.
- Lunch Break: 1:00 PM - 2:00 PM.

# General Interview Rules
- Must ask frontend engineers for live code coding tests in React.`}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                className="min-h-[300px] font-mono text-xs bg-background/30 border-border/40 text-foreground focus-visible:ring-primary leading-relaxed resize-y"
              />

              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] text-muted-foreground">
                  Character count: {memoryText.length} | Recommended format: Markdown
                </span>
                <Button 
                  onClick={() => updateMutation.mutate()} 
                  disabled={updateMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-10 px-5 gap-2 uppercase text-xs tracking-wider"
                >
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Memory
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates & Guidelines Column */}
        <div className="space-y-6">
          {/* Quick Templates Card */}
          <Card className="border-border/50 bg-[#09090b]/40 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/10">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-warning" />
                Quick Templates
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                Inject standard rule structures to customize quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => injectTemplate('office')}
                className="w-full justify-start text-xs border-border/50 hover:bg-primary/10 hover:text-white rounded-lg h-9 gap-2"
              >
                <Clock className="w-3.5 h-3.5 text-primary" />
                Office Rules Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => injectTemplate('hiring')}
                className="w-full justify-start text-xs border-border/50 hover:bg-primary/10 hover:text-white rounded-lg h-9 gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Hiring Bar Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => injectTemplate('leaves')}
                className="w-full justify-start text-xs border-border/50 hover:bg-primary/10 hover:text-white rounded-lg h-9 gap-2"
              >
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                Leave Directives Template
              </Button>
            </CardContent>
          </Card>

          {/* Guide Card */}
          <Card className="border-border/50 bg-primary/5 border-primary/10 relative overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 animate-pulse" />
                How memory helps FastestAI
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When employees ask questions via the **FastestAI Assistant**, or when recruiting managers generate evaluation guidelines, the system reads this memory block first. 
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Any policy parameters entered here will overwrite default standard answers, aligning AI decisions precisely with your business context.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
