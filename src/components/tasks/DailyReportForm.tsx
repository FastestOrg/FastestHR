import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle2, Loader2, Send, Sun, Moon, Sparkles, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface TimeSlot {
  time: string;
  focus: string;
}

export function DailyReportForm() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const [mood, setMood] = useState('😊');

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', profile?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const mutation = useMutation({
    mutationFn: async (payload: { summary: string, mood: string }) => {
      const { data, error } = await supabase
        .from('daily_reports')
        .upsert({
          user_id: profile!.id,
          company_id: profile!.company_id!,
          date: today,
          evening_summary: payload.summary,
          mood: payload.mood,
        }, { onConflict: 'user_id,date' });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report', profile?.id, today] });
      toast({
        title: "Daily Summary Locked",
        description: "Your achievements have been recorded. Sleep well!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit report: " + error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  const morningSlots = (report?.morning_plan as unknown as TimeSlot[]) || [];
  const isFinished = !!report?.evening_summary;

  return (
    <div className="grid gap-8 max-w-4xl mx-auto">
      {/* Morning Plan Recap */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-orange-500/5 to-orange-500/10 overflow-hidden relative border border-orange-500/10">
        <Sun className="absolute -top-6 -right-6 h-32 w-32 text-orange-500/5 rotate-12" />
        <CardHeader className="pb-4 border-b border-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Sun className="h-5 w-5 text-orange-600" />
            </div>
            <CardTitle className="text-lg font-bold uppercase tracking-widest text-orange-700">Planned Trajectory</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {morningSlots.length > 0 ? (
            <div className="grid gap-3">
              {morningSlots.map((slot, i) => (
                <div key={i} className="flex items-center gap-4 bg-background/40 p-3 rounded-lg border border-orange-500/5">
                  <span className="text-xs font-bold text-orange-600 w-16 whitespace-nowrap">{slot.time}</span>
                  <span className="text-sm font-medium text-orange-900/70 italic">{slot.focus}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground italic text-center py-4">No morning plan record found for today.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl bg-gradient-to-br from-card via-card to-secondary/10 overflow-hidden border border-border/50">
        <Moon className="absolute -top-6 -right-6 h-32 w-32 text-primary/5 -rotate-12" />
        
        <CardHeader className="border-b border-border/50 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-display font-bold">Execution Review</CardTitle>
              <CardDescription className="text-base italic">"The ending of one thing is the beginning of the next."</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-8 space-y-8">
          {isFinished ? (
            <div className="space-y-8 bg-primary/5 p-8 rounded-3xl border border-primary/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                 <CheckCircle2 className="h-32 w-32 text-primary" />
               </div>
               
               <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                      <Sparkles className="h-5 w-5" />
                      Daily Wins
                    </h4>
                    <span className="text-5xl drop-shadow-lg">{report.mood}</span>
                  </div>
                  <div className="text-xl leading-relaxed text-foreground/80 font-medium italic border-l-4 border-primary/30 pl-6">
                    "{report.evening_summary}"
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setSummary(report.evening_summary!);
                      setMood(report.mood!);
                    }}
                    className="mt-4 hover:bg-primary/5"
                  >
                    Edit Summary
                  </Button>
               </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  What did you actually crush today?
                </label>
                <Textarea 
                  placeholder="Summarize your impact... e.g. Finalized the API integration and unblocked the frontend team."
                  className="min-h-[200px] text-lg bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-2xl p-6"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>

              <div className="space-y-4 bg-secondary/20 p-4 sm:p-6 rounded-2xl border border-border/50">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Your energy level
                </label>
                <div className="flex justify-between sm:justify-start gap-2 sm:gap-6 -mx-2 px-2 overflow-x-auto scrollbar-hide">
                  {['😊', '🚀', '🔥', '😅', '😴'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      className={`text-3xl sm:text-4xl p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all hover:scale-125 border-2 shrink-0 ${mood === m ? 'bg-primary/10 border-primary shadow-lg scale-110' : 'border-transparent grayscale hover:grayscale-0'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95 group"
                onClick={() => mutation.mutate({ summary, mood })}
                disabled={!summary || mutation.isPending}
              >
                {mutation.isPending ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Send className="h-6 w-6 mr-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                Archive Daily Summary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
