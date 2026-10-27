import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Edit2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';

const COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const urlEmail = searchParams.get('email') || '';
  const isJustRegistered = searchParams.get('registered') === 'true';

  const [email, setEmail] = useState<string>(() => {
    if (urlEmail) return urlEmail;
    try {
      return localStorage.getItem('pending_verification_email') || '';
    } catch {
      return '';
    }
  });

  const [inputEmail, setInputEmail] = useState(email);
  const [isEditing, setIsEditing] = useState(!email);
  const [loading, setLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [invalidError, setInvalidError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // If user becomes verified in another tab or clicks link in the same browser, redirect to dashboard
  useEffect(() => {
    if (user) {
      toast.success('Email verified successfully! Welcome to FastestHR.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Check persistent cooldown for this email
  const checkCooldown = useCallback((targetEmail: string) => {
    if (!targetEmail) return 0;
    try {
      const stored = sessionStorage.getItem(`resend_cooldown_${targetEmail.toLowerCase()}`);
      if (stored) {
        const elapsed = Math.floor((Date.now() - Number(stored)) / 1000);
        const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
        return remaining;
      }
    } catch {
      // Fallback if sessionStorage is disabled
    }
    return 0;
  }, []);

  // Initialize cooldown
  useEffect(() => {
    if (!email) return;
    const remaining = checkCooldown(email);
    if (remaining > 0) {
      setCooldown(remaining);
    } else if (isJustRegistered) {
      // Start initial cooldown to give the first email time to arrive and avoid hitting 429
      const now = Date.now();
      try {
        sessionStorage.setItem(`resend_cooldown_${email.toLowerCase()}`, String(now));
      } catch {}
      setCooldown(COOLDOWN_SECONDS);
    }
  }, [email, isJustRegistered, checkCooldown]);

  // Countdown timer ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async (targetEmail = email) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setResendSuccess(false);
    setInvalidError(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        // Handle rate limit gracefully
        if (error.message.includes('60 seconds') || error.status === 429) {
          const now = Date.now();
          try {
            sessionStorage.setItem(`resend_cooldown_${cleanEmail.toLowerCase()}`, String(now));
          } catch {}
          setCooldown(COOLDOWN_SECONDS);
          toast.warning('A verification email was requested recently. Please check your inbox or wait a moment.');
          return;
        }

        // Handle invalid / undeliverable email address
        if (error.message.toLowerCase().includes('invalid') || (error as any).code === 'email_address_invalid') {
          setIsEditing(true);
          setInputEmail(cleanEmail);
          setInvalidError(`The mail delivery service flagged "${cleanEmail}" as invalid or undeliverable. This happens when the domain has strict MX/SPF policies, the mailbox does not exist in Microsoft 365/Google Workspace, or there was a typo.`);
          toast.error(`"${cleanEmail}" could not receive verification emails. Please enter an active, deliverable email address.`);
          return;
        }

        throw error;
      }

      // Mark cooldown
      const now = Date.now();
      try {
        sessionStorage.setItem(`resend_cooldown_${cleanEmail.toLowerCase()}`, String(now));
        localStorage.setItem('pending_verification_email', cleanEmail);
      } catch {}

      setCooldown(COOLDOWN_SECONDS);
      setResendSuccess(true);
      toast.success('Verification link sent! Check your inbox.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }
    const clean = inputEmail.trim();
    setEmail(clean);
    setIsEditing(false);
    setSearchParams({ email: clean });
    handleResend(clean);
  };

  // Helper to get webmail shortcut
  const getEmailProviderUrl = (emailStr: string) => {
    const domain = emailStr.split('@')[1]?.toLowerCase();
    if (!domain) return null;
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return { name: 'Open Gmail', url: 'https://mail.google.com' };
    }
    if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
      return { name: 'Open Outlook', url: 'https://outlook.live.com' };
    }
    if (['yahoo.com', 'ymail.com'].includes(domain)) {
      return { name: 'Open Yahoo Mail', url: 'https://mail.yahoo.com' };
    }
    return null;
  };

  const provider = email ? getEmailProviderUrl(email) : null;

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={email ? "We've sent a verification link to activate your company account." : "Enter your email to receive a verification link."}
    >
      <div className="space-y-6">
        {/* Animated Icon Card */}
        <div className="relative flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl shadow-lg">
          <div className="relative mb-4 flex items-center justify-center">
            {/* Ambient Pulse Ring */}
            <div className="absolute -inset-2 rounded-full bg-primary/20 blur-md animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <Mail className="h-8 w-8 animate-in zoom-in-50 duration-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>

          {email && !isEditing ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Sent to
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 max-w-full">
                <span className="font-mono text-sm font-semibold text-foreground truncate max-w-[240px] sm:max-w-[320px]">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                  title="Change email"
                  aria-label="Change email"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Please enter the email address used during company registration.
            </p>
          )}

          {isJustRegistered && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Company account created successfully</span>
            </div>
          )}
        </div>

        {/* Resend success notice */}
        {resendSuccess && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <p className="leading-relaxed">
              A fresh verification email has been dispatched. Please allow up to 1 minute for delivery.
            </p>
          </div>
        )}

        {/* Invalid / Undeliverable email notice */}
        {invalidError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <p className="font-semibold text-sm">Email Delivery Notice</p>
              <p className="text-foreground/90 leading-relaxed font-normal">
                {invalidError}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Tip: Enter your real active mailbox below (e.g. Gmail, Outlook, or Google Workspace) to receive your link, or configure custom SMTP in Supabase settings.
              </p>
            </div>
          </div>
        )}

        {/* Edit Email Form or Main Action Buttons */}
        {isEditing ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationEmail">Email Address</Label>
              <Input
                id="verificationEmail"
                type="email"
                placeholder="you@company.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Link
              </Button>
              {email && (
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {/* Primary Resend Button */}
            <Button
              type="button"
              className="w-full h-11 text-sm font-semibold transition-all duration-300 shadow-sm"
              disabled={loading || cooldown > 0}
              onClick={() => handleResend()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : cooldown > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin opacity-70" />
                  Resend available in {cooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>

            {/* Quick Webmail Provider Link */}
            {provider && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 text-xs font-medium border-border/80 hover:bg-accent gap-2"
                onClick={() => window.open(provider.url, '_blank', 'noopener,noreferrer')}
              >
                <span>{provider.name}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Button>
            )}
          </div>
        )}

        {/* Helpful Tips Card */}
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-xs space-y-2 text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            Didn't receive the email?
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Check your spam, junk, or promotions folder.</li>
            <li>Verify you spelled the address correctly (<button type="button" onClick={() => setIsEditing(true)} className="text-primary hover:underline font-medium">edit email</button>).</li>
            <li>Corporate firewalls may delay external automated emails by 1-2 minutes.</li>
          </ul>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col items-center gap-2.5 pt-2 text-sm text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
          <p className="text-xs text-muted-foreground">
            Entered the wrong company details?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Create another account
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
