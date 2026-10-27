import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, AlertCircle, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().default(true),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: true,
    },
  });

  const rememberValue = watch('remember');
  const emailValue = watch('email');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResendVerification = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) {
      toast.error('Email address is missing');
      return;
    }

    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        if (error.message.includes('60 seconds') || error.status === 429) {
          setCooldown(60);
          toast.warning('A verification email was requested recently. Please check your inbox or wait 60 seconds.');
          return;
        }
        throw error;
      }

      setCooldown(60);
      try {
        sessionStorage.setItem(`resend_cooldown_${cleanEmail.toLowerCase()}`, String(Date.now()));
        localStorage.setItem('pending_verification_email', cleanEmail);
      } catch {}
      toast.success('Verification email resent! Please check your inbox.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const cleanEmail = data.email.trim();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password,
      });

      if (error) {
        const isUnverified = error.message.toLowerCase().includes('email not confirmed');
        if (isUnverified) {
          setUnverifiedEmail(cleanEmail);
          toast.error('Email not verified. Please check your inbox or resend the verification link.');
        } else if (error.message.includes('Invalid login')) {
          toast.error('Invalid email or password');
        } else {
          toast.error(error.message);
        }
        return;
      }

      setUnverifiedEmail(null);
      toast.success('Welcome back!');

      // Record login event asynchronously
      import('@/utils/loginLogger').then(({ recordUserLogin }) => {
        recordUserLogin('success', 'password');
      }).catch(() => {});

      if (authData?.session?.user) {
        // Immediately synchronize auth store so ProtectedRoute/PublicRoute do not bounce back to login
        const { setSession, setUser, fetchProfile } = useAuthStore.getState();
        setSession(authData.session);
        setUser(authData.session.user);

        const profileData = await fetchProfile(authData.session.user.id);
        if (profileData?.platform_role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your FastestHR account">
      {unverifiedEmail && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-sm">Email verification required</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your email <strong className="text-foreground">{unverifiedEmail}</strong> has not been verified yet. Check your inbox for the link, or click below to resend.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 hover:bg-amber-500/20 text-xs font-medium h-8"
                  disabled={resendLoading || cooldown > 0}
                  onClick={() => handleResendVerification(unverifiedEmail)}
                >
                  {resendLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : cooldown > 0 ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin opacity-70" />
                  ) : (
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
                </Button>
                <Link
                  to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  Verify screen <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            {...register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox 
            id="remember" 
            checked={rememberValue}
            onCheckedChange={(checked) => setValue('remember', checked as boolean)}
          />
          <Label htmlFor="remember" className="text-sm font-normal">Remember me for 30 days</Label>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
        <p className="text-xs">
          Didn't receive your verification email?{' '}
          <Link
            to={emailValue ? `/verify-email?email=${encodeURIComponent(emailValue)}` : '/verify-email'}
            className="font-medium text-primary hover:underline"
          >
            Resend email
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
