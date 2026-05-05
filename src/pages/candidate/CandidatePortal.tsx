import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Clock, MapPin, Calendar, Video, Users, LogOut, Loader2, ArrowRight, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { isSafeUrl } from '@/lib/utils';
import { toast } from 'sonner';

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  applied: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  screening: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  interview: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  assessment: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  offer: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  hired: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};
const DEFAULT_PIPELINE = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired'];

export default function CandidatePortal() {
  const navigate = useNavigate();

  // Check auth
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['candidate-session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  // Fetch candidate's applications
  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ['candidate-apps', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*, jobs(title, job_slug, company_id, pipeline_stages, location, employment_type, companies(name, slug, logo_url))')
        .eq('candidate_user_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  // Fetch interviews for all candidate IDs
  const candidateIds = applications.map((a: any) => a.id);
  const { data: interviews = [] } = useQuery({
    queryKey: ['candidate-interviews', candidateIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .in('candidate_id', candidateIds)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: candidateIds.length > 0,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/candidate/login');
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!loadingSession && !session) {
      navigate('/candidate/login');
    }
  }, [loadingSession, session, navigate]);

  if (loadingSession || loadingApps) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-black">
              F
            </div>
            <span className="font-semibold text-white text-sm">My Applications</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-white mb-2">Application Status</h1>
        <p className="text-white/40 text-sm mb-10">Track all your job applications in one place.</p>

        {applications.length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <Briefcase className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 font-medium mb-2">No applications yet</p>
            <p className="text-white/20 text-sm">Once you apply for a job, you'll see the status here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map((app: any) => {
              const job = app.jobs;
              const company = job?.companies;
              const pipeline = job?.pipeline_stages || DEFAULT_PIPELINE;
              const currentStageIndex = pipeline.indexOf(app.stage);
              const appInterviews = interviews.filter((i: any) => i.candidate_id === app.id);
              const stageStyle = STAGE_COLORS[app.stage] || STAGE_COLORS.applied;

              return (
                <div key={app.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-white/[0.06]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {company?.logo_url ? (
                          <img src={company.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10 shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/60 to-purple-600/60 flex items-center justify-center text-white font-bold shrink-0">
                            {company?.name?.[0] || '?'}
                          </div>
                        )}
                        <div>
                          <h2 className="text-lg font-bold text-white">{job?.title || 'Unknown Position'}</h2>
                          <p className="text-white/40 text-sm mt-0.5 flex items-center gap-2">
                            {company?.name}
                            {job?.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {job.location}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}>
                        {app.stage?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Pipeline progress */}
                  <div className="px-6 py-5 bg-white/[0.01]">
                    <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-3">Pipeline Progress</p>
                    <div className="flex items-center gap-1">
                      {pipeline.map((stage: string, i: number) => {
                        const isCompleted = i < currentStageIndex;
                        const isCurrent = i === currentStageIndex;
                        const isRejected = app.stage === 'rejected';

                        return (
                          <div key={stage} className="flex-1 flex flex-col items-center gap-1.5">
                            {/* Bar */}
                            <div className={`h-1.5 w-full rounded-full transition-all ${
                              isRejected
                                ? (i <= currentStageIndex ? 'bg-red-500/40' : 'bg-white/5')
                                : isCompleted ? 'bg-emerald-500/60' : isCurrent ? 'bg-blue-500' : 'bg-white/5'
                            }`} />
                            {/* Label */}
                            <span className={`text-[9px] font-medium uppercase tracking-wider ${
                              isCurrent ? 'text-white/70' : 'text-white/20'
                            }`}>
                              {stage.replace(/_/g, ' ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interviews */}
                  {appInterviews.length > 0 && (
                    <div className="px-6 py-5 border-t border-white/[0.06]">
                      <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> Scheduled Interviews
                      </p>
                      <div className="space-y-3">
                        {appInterviews.map((interview: any) => (
                          <div key={interview.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                                interview.status === 'completed' ? 'bg-emerald-500/10' : interview.status === 'cancelled' ? 'bg-red-500/10' : 'bg-blue-500/10'
                              }`}>
                                {interview.type === 'video' ? <Video className="h-4 w-4 text-blue-400" /> : <Users className="h-4 w-4 text-blue-400" />}
                              </div>
                              <div>
                                <p className="text-white/70 text-sm font-medium capitalize">{interview.type || 'Interview'}</p>
                                <p className="text-white/30 text-xs flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  {interview.scheduled_at
                                    ? new Date(interview.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                                    : 'TBD'
                                  }
                                  {interview.duration_minutes && ` · ${interview.duration_minutes} min`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {interview.meeting_link && isSafeUrl(interview.meeting_link) && interview.status === 'scheduled' && (
                                <a
                                  href={interview.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  Join <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                                interview.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                interview.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {interview.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Applied date */}
                  <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
                    <p className="text-white/15 text-xs">
                      Applied {new Date(app.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </p>
                    {company?.slug && (
                      <Link
                        to={`/company/${company.slug}`}
                        className="text-blue-400/60 hover:text-blue-400 text-xs flex items-center gap-1 transition-colors"
                      >
                        View company <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeSlideIn { animation: fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
    </div>
  );
}
