import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function CandidateLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  let returnTo = searchParams.get('returnTo') || '/candidate/portal';

  // Prevent open redirect: ensure it's a relative path and not a protocol-relative absolute URL
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    returnTo = '/candidate/portal';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${returnTo}`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#09090b' }}>
      {/* Nav */}
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {!sent ? (
            <div className="animate-fadeSlideIn">
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
                  <Mail className="h-8 w-8 text-blue-400" />
                </div>
                <h1 className="text-3xl font-black text-white mb-3">Candidate Login</h1>
                <p className="text-white/40 text-sm">
                  Enter the email you used for your application. We'll send you a magic link — no password needed.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-base placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold text-base transition-all duration-300 shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  {loading ? 'Sending…' : 'Send Magic Link'}
                </button>
              </form>

              <p className="text-center text-white/20 text-xs mt-6">
                If you don't have an application, <Link to="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">visit our careers page</Link> first.
              </p>
            </div>
          ) : (
            <div className="animate-fadeSlideIn text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">Check Your Inbox ✉️</h2>
              <p className="text-white/40 text-sm mb-8">
                We just sent a magic link to <span className="text-white/70 font-medium">{email}</span>.
                Click the link in the email to sign in.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
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
