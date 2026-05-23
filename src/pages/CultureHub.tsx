import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { 
  Heart, Sparkles, Smile, Trophy, Award, Users, PlusCircle,
  MessageSquare, Star, HelpCircle, Loader2, PartyPopper, Zap, HeartHandshake
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const BADGE_CONFIGS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  excellence: { label: 'Pursuit of Excellence', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  integrity: { label: 'Uncompromising Integrity', icon: Award, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  collaboration: { label: 'High Collaboration', icon: HeartHandshake, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  leadership: { label: 'Inspiring Leadership', icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

const EMOJIS = [
  { val: 1, char: '😞', label: 'Struggling' },
  { val: 2, char: '😐', label: 'Neutral' },
  { val: 3, char: '🙂', label: 'Satisfied' },
  { val: 4, char: '😄', label: 'Fulfilling' },
  { val: 5, char: '🚀', label: 'Exceptional' },
];

export default function CultureHub() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [pulseScore, setPulseScore] = useState<number | null>(null);
  const [pulseFeedback, setPulseFeedback] = useState('');
  const [kudosDialogOpen, setKudosDialogOpen] = useState(false);
  
  // Kudos formulation states
  const [receiverId, setReceiverId] = useState('');
  const [badgeType, setBadgeType] = useState('collaboration');
  const [kudosMessage, setKudosMessage] = useState('');

  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');

  // Fetch employees to choose from for kudos
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-kudos', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, user_id')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Current employee's record
  const { data: currentEmployee } = useQuery({
    queryKey: ['current-employee-kudos', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', profile!.id)
        .is('deleted_at', null)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch kudos feed
  const { data: kudosFeed = [], isLoading: loadingKudos } = useQuery({
    queryKey: ['kudos-feed', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('kudos_board')
        .select('*, sender:employees!kudos_board_sender_id_fkey(first_name, last_name), receiver:employees!kudos_board_receiver_id_fkey(first_name, last_name)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch pulse metrics
  const { data: pulseMetrics } = useQuery({
    queryKey: ['pulse-metrics', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pulse_logs')
        .select('score')
        .eq('company_id', profile!.company_id!);
      
      const scores = data?.map(d => d.score) || [];
      const average = scores.length > 0 ? scores.reduce((s, c) => s + c, 0) / scores.length : 0;
      return {
        average: parseFloat(average.toFixed(2)),
        totalResponses: scores.length
      };
    },
    enabled: !!profile?.company_id,
  });

  // Submit anonymous Pulse
  const submitPulseMutation = useMutation({
    mutationFn: async () => {
      if (!pulseScore) throw new Error('Select a sentiment rating');
      const { error } = await supabase.from('pulse_logs').insert({
        company_id: profile!.company_id!,
        score: pulseScore,
        feedback_text: pulseFeedback,
        department_id: currentEmployee?.id ? (await supabase.from('employees').select('department_id').eq('id', currentEmployee.id).single()).data?.department_id : null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-metrics'] });
      toast.success('✦ Cultural Pulse recorded anonymously. Thank you!');
      setPulseScore(null);
      setPulseFeedback('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit Pulse');
    }
  });

  // Send Peer Kudos
  const sendKudosMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployee?.id) throw new Error('Employee profile not loaded');
      if (!receiverId) throw new Error('Select a peer to appreciate');
      if (!kudosMessage.trim()) throw new Error('Write a custom kudos message');
      if (receiverId === currentEmployee.id) throw new Error('You cannot award kudos to yourself');

      const { error } = await supabase.from('kudos_board').insert({
        company_id: profile!.company_id!,
        sender_id: currentEmployee.id,
        receiver_id: receiverId,
        badge_type: badgeType,
        message: kudosMessage
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kudos-feed'] });
      toast.success('✦ Appreciation badge published to the company board!');
      setKudosDialogOpen(false);
      setReceiverId('');
      setKudosMessage('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send kudos');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <PartyPopper className="w-5 h-5 text-amber-400" />
            <span className="text-xs uppercase font-black tracking-widest text-muted-foreground">Continuous Culture</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">Culture Hub</h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-medium">Celebrate successes and record cultural sentiments</p>
        </div>

        <Dialog open={kudosDialogOpen} onOpenChange={setKudosDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/95 text-white font-bold h-10 px-5 gap-2 shadow-lg shadow-primary/20 rounded-xl">
              <PlusCircle className="w-4 h-4" /> Share Peer Appreciation
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#09090b]/95 border border-border/40 text-foreground max-w-md rounded-2xl backdrop-blur-xl">
            <DialogHeader className="pb-4 border-b border-border/10">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Award Peer Kudos Card
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Praise your colleagues publicly to highlight performance and cultural alignment.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white">Select Recipient</Label>
                <select
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/50 bg-background/50 text-white text-xs focus-visible:ring-primary focus-visible:outline-none"
                >
                  <option value="" disabled className="bg-[#09090b]">-- Choose a Colleague --</option>
                  {employees
                    .filter(emp => emp.user_id !== profile?.id)
                    .map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-[#09090b]">
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white">Choose Cultural Value Badge</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BADGE_CONFIGS).map(([key, config]) => {
                    const BIcon = config.icon;
                    return (
                      <div
                        key={key}
                        onClick={() => setBadgeType(key)}
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col items-center gap-1.5 transition-all text-center ${
                          badgeType === key 
                            ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10' 
                            : 'border-border/50 hover:border-primary/20 bg-background/30'
                        }`}
                      >
                        <BIcon className={`w-5 h-5 ${config.color}`} />
                        <span className="text-[10px] font-bold text-white leading-tight">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white">Appreciation Message</Label>
                <Textarea
                  placeholder="Describe how they exemplified this cultural value..."
                  value={kudosMessage}
                  onChange={(e) => setKudosMessage(e.target.value)}
                  className="h-20 bg-background/50 border-border/50 text-white rounded-lg focus-visible:ring-primary text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/10">
              <Button variant="outline" onClick={() => setKudosDialogOpen(false)} className="h-9 px-4 rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button
                onClick={() => sendKudosMutation.mutate()}
                disabled={sendKudosMutation.isPending || !receiverId || !kudosMessage.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-xl text-xs font-black uppercase"
              >
                {sendKudosMutation.isPending ? 'Publishing...' : 'Award Badge'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Culture Sentiment Left Side Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="glass-card bg-[#09090b]/40 border-border/30 rounded-2xl overflow-hidden relative">
            <CardHeader className="pb-4 border-b border-border/10">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Smile className="w-4 h-4 text-primary" />
                How are you feeling today?
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                Anonymous check-ins. Your response will contribute to company eNPS metrics without revealing identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* sentiment emojis selector */}
              <div className="flex justify-between gap-1.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji.val}
                    type="button"
                    onClick={() => setPulseScore(emoji.val)}
                    className={`flex-1 aspect-square rounded-xl flex flex-col items-center justify-center border text-lg transition-all ${
                      pulseScore === emoji.val
                        ? 'border-primary bg-primary/10 scale-105 shadow-sm shadow-primary/10'
                        : 'border-border/30 hover:border-primary/20 bg-background/30 hover:scale-102'
                    }`}
                  >
                    <span>{emoji.char}</span>
                    <span className="text-[7px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter leading-none">{emoji.label}</span>
                  </button>
                ))}
              </div>

              {pulseScore !== null && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-white uppercase tracking-wider">Describe your sentiment (Optional)</Label>
                    <Textarea
                      placeholder="Share leaves workload, support quality, or cultural remarks..."
                      value={pulseFeedback}
                      onChange={(e) => setPulseFeedback(e.target.value)}
                      className="h-16 bg-background/50 border-border/50 text-white rounded-lg focus-visible:ring-primary text-xs"
                    />
                  </div>

                  <Button
                    onClick={() => submitPulseMutation.mutate()}
                    disabled={submitPulseMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-bold h-9 text-xs uppercase tracking-wider rounded-lg shadow-md shadow-primary/10"
                  >
                    Submit Pulse
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Org-wide sentiment metrics card (Visible to all, detailed to admins) */}
          <Card className="glass-card bg-[#09090b]/40 border-border/30 rounded-2xl overflow-hidden relative">
            <CardHeader className="pb-4 border-b border-border/10">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Cultural Happiness Metric
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">eNPS Index</span>
                <p className="text-3xl font-black text-white mt-1">
                  {pulseMetrics?.average ? `${pulseMetrics.average} / 5.0` : 'N/A'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Compiled from <strong className="text-foreground">{pulseMetrics?.totalResponses || 0}</strong> anonymous pulse logs.
                </p>
              </div>

              <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
                <Smile className="w-8 h-8 text-primary animate-bounce" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Peer Appreciation Wall Right Side Feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card bg-[#09090b]/40 border-border/30 rounded-2xl overflow-hidden relative h-full">
            <CardHeader className="pb-4 border-b border-border/10">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-destructive fill-destructive" />
                Cultural Appreciation Wall
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                Peer recognition cards celebrating collaborative company milestones.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 max-h-[640px] overflow-y-auto scrollbar-hide">
              {loadingKudos ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
              ) : kudosFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <Heart className="w-10 h-10 text-muted-foreground/20" />
                  <p className="text-xs font-semibold text-white">Appreciation Feed Empty</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-xs text-center">
                    Celebrate colleagues! Click "Share Peer Appreciation" to publish the first kudos card.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {kudosFeed.map((kudo: any) => {
                    const badgeConfig = BADGE_CONFIGS[kudo.badge_type] || BADGE_CONFIGS.collaboration;
                    const BIcon = badgeConfig.icon;

                    return (
                      <motion.div
                        key={kudo.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-background/50 border border-border/40 hover:border-primary/20 transition-all flex items-start gap-4 group"
                      >
                        <div className={`p-3 rounded-full shrink-0 border ${badgeConfig.bg} ${badgeConfig.border}`}>
                          <BIcon className={`w-6 h-6 ${badgeConfig.color}`} />
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-black text-white uppercase tracking-tight">
                              {kudo.sender?.first_name} {kudo.sender?.last_name}
                              <span className="text-muted-foreground font-medium lowercase px-1.5">sent kudos to</span>
                              {kudo.receiver?.first_name} {kudo.receiver?.last_name}
                            </h4>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {new Date(kudo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          <Badge variant="outline" className={`text-[8px] font-black uppercase border-none rounded-full px-2 py-0.5 ${badgeConfig.bg} ${badgeConfig.color}`}>
                            {badgeConfig.label}
                          </Badge>

                          <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/5 p-3 border border-border/10 rounded-xl">
                            "{kudo.message}"
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
