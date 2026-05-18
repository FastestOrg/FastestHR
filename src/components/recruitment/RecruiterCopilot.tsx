import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ChevronRight, 
  Clock, 
  Target, 
  Mail, 
  FileText, 
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  full_name: string;
  stage: string;
  score?: number;
  updated_at: string;
  ai_analysis?: any;
}

interface Job {
  id: string;
  title: string;
  description?: string;
}

interface RecruiterCopilotProps {
  candidates: Candidate[];
  activeJob: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RecruiterCopilot({ candidates, activeJob, isOpen, onClose }: RecruiterCopilotProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const insights = useMemo(() => {
    if (!candidates.length || !activeJob) return [];

    const now = new Date();
    const threeDaysAgo = new Date(now.setDate(now.getDate() - 3));
    
    const results = [];

    // 1. Stuck Candidates Insight
    // Performance optimization: Extracted array into a Set outside of filter to achieve O(1) lookups inside the loop
    const excludedStages = new Set(['hired', 'rejected']);
    const stuckCandidates = candidates.filter(c => {
      const updatedAt = new Date(c.updated_at);
      return updatedAt < threeDaysAgo && !excludedStages.has(c.stage.toLowerCase());
    });

    if (stuckCandidates.length > 0) {
      results.push({
        id: 'stuck',
        type: 'warning',
        icon: Clock,
        title: 'Action Required: Pipeline Stagnation',
        description: `${stuckCandidates.length} candidate${stuckCandidates.length > 1 ? 's are' : ' is'} stuck in the same stage for over 3 days.`,
        actionLabel: 'Draft Follow-ups',
        onAction: () => {
          setIsGenerating(true);
          setTimeout(() => {
            setIsGenerating(false);
            toast.success(`AI drafted follow-up emails for ${stuckCandidates.length} candidates. Sent to your Drafts.`);
          }, 1500);
        }
      });
    }

    // 2. Match Quality Insight
    const highMatchCandidates = candidates.filter(c => (c.score || 0) >= 8);
    const matchPercentage = (highMatchCandidates.length / candidates.length) * 100;

    if (matchPercentage < 30 && candidates.length > 5) {
      results.push({
        id: 'match-quality',
        type: 'info',
        icon: Target,
        title: 'Low Match Rate Detected',
        description: `Only ${Math.round(matchPercentage)}% of your applicants are a high match for this role. Consider refining the requirements.`,
        actionLabel: 'Refine JD with AI',
        onAction: () => {
          toast.info("Opening AI Job Description Refiner...");
        }
      });
    }

    // 3. Positive Momentum Insight
    const recentHighMatch = highMatchCandidates.filter(c => new Date(c.updated_at) > threeDaysAgo);
    if (recentHighMatch.length > 0) {
      results.push({
        id: 'momentum',
        type: 'success',
        icon: TrendingUp,
        title: 'Positive Sourcing Momentum',
        description: `You've found ${recentHighMatch.length} high-quality candidate${recentHighMatch.length > 1 ? 's' : ''} in the last 72 hours. Your current sourcing strategy is working!`,
      });
    }

    return results;
  }, [candidates, activeJob]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 w-80 lg:w-96 z-50 p-4 pt-20"
        >
          <Card className="h-full glass-card border-l border-white/20 shadow-2xl relative overflow-hidden flex flex-col">
            {/* AI Glow Effect */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            <CardHeader className="relative pb-4 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight">AI Copilot</CardTitle>
                </div>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                  Real-time Strategy & Insights
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 pb-6">
                {insights.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Gathering data...</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Check back once you have more applicants or pipeline activity.</p>
                  </div>
                ) : (
                  insights.map((insight) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors group overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <div className={`p-2 rounded-lg h-fit ${
                              insight.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                              insight.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                              'bg-blue-500/20 text-blue-500'
                            }`}>
                              <insight.icon className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-foreground leading-tight">{insight.title}</h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {insight.description}
                              </p>
                            </div>
                          </div>
                          
                          {insight.onAction && (
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary border-none text-xs font-bold"
                              onClick={insight.onAction}
                              disabled={isGenerating}
                            >
                              {isGenerating ? (
                                <Sparkles className="h-3 w-3 mr-2 animate-pulse" />
                              ) : (
                                <Mail className="h-3 w-3 mr-2" />
                              )}
                              {insight.actionLabel}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}

                {/* Strategy Section */}
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Quick Actions</p>
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="ghost" size="sm" className="justify-start h-9 text-xs hover:bg-white/5 group">
                      <FileText className="h-3 w-3 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      Generate Stage Scorecard
                      <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start h-9 text-xs hover:bg-white/5 group">
                      <AlertCircle className="h-3 w-3 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      Simulate Hire Impact
                      <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-4 bg-primary/5 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">FastU AI is active</p>
                  <p className="text-[10px] text-muted-foreground truncate">Monitoring {candidates.length} candidates...</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
