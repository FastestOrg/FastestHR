import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Need one uppercase letter')
    .regex(/[a-z]/, 'Need one lowercase letter')
    .regex(/[0-9]/, 'Need one number')
    .regex(/[^A-Za-z0-9]/, 'Need one special character'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Company name is required'),
  companySize: z.string().min(1, 'Please select company size'),
  industry: z.string().optional(),
  country: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

const passwordRules = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { companySize: '', industry: '', country: '' },
  });

  const password = watch('password', '');
  const isPasswordValid = password ? passwordRules.every(r => r.test(password)) : false;
  const isPasswordIncomplete = password.length > 0 && !isPasswordValid;

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            platform_role: 'company_admin',
            company_name: data.companyName,
            company_size: data.companySize,
            company_industry: data.industry || null,
            company_country: data.country || null,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;

      toast.success('Account created! Please check your email to verify.');
      navigate('/login');
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start your 14-day free trial. No credit card required.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" placeholder="John Doe" {...register('fullName')} />
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create password"
                {...register('password')}
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm"
                {...register('confirmPassword')}
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        {password && (
          <div className="rounded-lg border bg-card/50 p-4 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2">
            <p className="mb-3 text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Password requirements
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {passwordRules.map((rule) => {
                const pass = rule.test(password);
                return (
                  <div key={rule.label} className={`flex items-center gap-2 text-sm transition-all duration-300 ${pass ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${pass ? 'border-emerald-500 bg-emerald-500/10' : 'border-muted-foreground/30 bg-muted/50'}`}>
                      {pass ? <Check className="h-2.5 w-2.5 font-bold" /> : <X className="h-2.5 w-2.5 opacity-50" />}
                    </div>
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input id="companyName" placeholder="Acme Corp" {...register('companyName')} />
          {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Company Size</Label>
            <Select value={watch('companySize')} onValueChange={(v) => setValue('companySize', v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="201-500">201-500</SelectItem>
                <SelectItem value="501+">501+</SelectItem>
              </SelectContent>
            </Select>
            {errors.companySize && <p className="text-sm text-destructive">{errors.companySize.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={watch('industry')} onValueChange={(v) => setValue('industry', v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div tabIndex={0} className="w-full relative group">
                <Button 
                  type="submit" 
                  className={`w-full transition-all duration-300 ${isPasswordIncomplete ? 'opacity-50 !cursor-not-allowed group-hover:scale-[1.01]' : 'hover:-translate-y-0.5'}`} 
                  disabled={loading || isPasswordIncomplete}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </div>
            </TooltipTrigger>
            {isPasswordIncomplete && (
              <TooltipContent side="top" className="bg-destructive text-destructive-foreground border-destructive px-3 py-1.5 font-medium animate-in slide-in-from-bottom-2">
                <p>Please meet all password requirements to create an account</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
