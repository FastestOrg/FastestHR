import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCompanySlugFromHost } from '@/utils/tenantUtils';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, Briefcase, MapPin, Users, DollarSign, Building2, Clock, Send, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/seo/SEO';

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Internship',
};
const WORK_TYPE_LABELS: Record<string, string> = {
  on_site: 'On-site', remote: 'Remote', hybrid: 'Hybrid',
};
const formatSalary = (min?: number | null, max?: number | null) => {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 100000 ? `${(n/1000).toFixed(0)}K` : n.toLocaleString();
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
};

/* ═══════════════════════════════════════════════════════════
   STEP COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function WelcomeStep({ job, company, onNext }: { job: any; company: any; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center animate-fadeSlideIn">
      {/* Company logo */}
      <div className="mb-6">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-black ring-1 ring-white/10">
            {company?.name?.[0]}
          </div>
        )}
      </div>

      <p className="text-white/40 text-sm font-medium mb-2 tracking-wide uppercase">{company?.name}</p>

      <h1 className="text-3xl sm:text-5xl font-black text-white mb-6 tracking-tight leading-tight max-w-2xl">
        {job.title}
      </h1>

      {/* Meta row */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {job.departments?.name && (
          <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
            {job.departments.name}
          </span>
        )}
        {job.location && (
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {job.location}
          </span>
        )}
        {EMPLOYMENT_LABELS[job.employment_type] && (
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs">
            {EMPLOYMENT_LABELS[job.employment_type]}
          </span>
        )}
        {WORK_TYPE_LABELS[job.work_type] && (
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs">
            {WORK_TYPE_LABELS[job.work_type]}
          </span>
        )}
        {formatSalary(job.min_salary, job.max_salary) && (
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
            <DollarSign className="h-3 w-3" /> {formatSalary(job.min_salary, job.max_salary)}
          </span>
        )}
        {job.openings > 1 && (
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs flex items-center gap-1.5">
            <Users className="h-3 w-3" /> {job.openings} openings
          </span>
        )}
      </div>

      <button
        onClick={onNext}
        className="group relative px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all duration-300 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5"
      >
        Start Application
        <ArrowRight className="inline-block ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
      </button>

      <p className="mt-6 text-white/20 text-xs">Takes about 2 minutes</p>
    </div>
  );
}

function AboutStep({ job, company, onNext, onPrev }: { job: any; company: any; onNext: () => void; onPrev: () => void }) {
  return (
    <div className="max-w-2xl mx-auto w-full animate-fadeSlideIn">
      <p className="text-blue-400 text-sm font-semibold mb-2 tracking-wide uppercase">About the Role</p>

      {(company as any)?.about_company && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-3">About {company?.name}</h2>
          <p className="text-white/50 text-sm leading-relaxed whitespace-pre-line">
            {(company as any).about_company}
          </p>
        </div>
      )}

      {job.description && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-3">Description</h3>
          <div className="text-white/50 text-sm leading-relaxed whitespace-pre-line bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
            {job.description}
          </div>
        </div>
      )}

      {job.requirements && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-3">Requirements</h3>
          <div className="text-white/50 text-sm leading-relaxed whitespace-pre-line bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
            {job.requirements}
          </div>
        </div>
      )}

      <StepFooter onPrev={onPrev} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

function DetailsStep({ form, setForm, onNext, onPrev }: {
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>;
  onNext: () => void; onPrev: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="max-w-lg mx-auto w-full animate-fadeSlideIn">
      <p className="text-blue-400 text-sm font-semibold mb-2 tracking-wide uppercase">Your Details</p>
      <h2 className="text-3xl font-black text-white mb-8">Tell us about yourself</h2>

      <div className="space-y-5">
        <TypeformInput
          label="Full Name"
          placeholder="John Doe"
          value={form.full_name}
          onChange={v => setForm(f => ({ ...f, full_name: v }))}
          error={errors.full_name}
          autoFocus
        />
        <TypeformInput
          label="Email Address"
          placeholder="john@example.com"
          type="email"
          value={form.email}
          onChange={v => setForm(f => ({ ...f, email: v }))}
          error={errors.email}
        />
        <TypeformInput
          label="Phone Number"
          placeholder="+91 98765 43210"
          type="tel"
          value={form.phone}
          onChange={v => setForm(f => ({ ...f, phone: v }))}
          hint="Optional"
        />
      </div>

      <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-white/30 text-xs">
          🔑 Already applied before?{' '}
          <Link to="/candidate/login" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            Login to autofill &amp; track status
          </Link>
        </p>
      </div>

      <StepFooter onPrev={onPrev} onNext={() => { if (validate()) onNext(); }} nextLabel="Continue" />
    </div>
  );
}

function ResumeStep({ form, setForm, onNext, onPrev }: {
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>;
  onNext: () => void; onPrev: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5MB)');
      return;
    }
    setUploading(true);
    try {
      const path = `resumes/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      setForm(f => ({ ...f, resume_url: publicUrl, resume_name: file.name }));
      toast.success('Resume uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full animate-fadeSlideIn">
      <p className="text-blue-400 text-sm font-semibold mb-2 tracking-wide uppercase">Resume &amp; Cover Letter</p>
      <h2 className="text-3xl font-black text-white mb-8">Share your experience</h2>

      <div className="space-y-6">
        {/* Resume upload */}
        <div>
          <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
            Resume <span className="text-white/20 normal-case">(Optional)</span>
          </label>
          <label className={`flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
            form.resume_url
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
          }`}>
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} disabled={uploading} />
            {uploading ? (
              <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
            ) : form.resume_url ? (
              <>
                <Check className="h-8 w-8 text-emerald-400 mb-2" />
                <span className="text-emerald-400 text-sm font-medium">{form.resume_name}</span>
                <span className="text-white/20 text-xs mt-1">Click to replace</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-white/20 mb-2" />
                <span className="text-white/40 text-sm">Drop your resume or click to upload</span>
                <span className="text-white/20 text-xs mt-1">PDF, DOC, DOCX — max 5MB</span>
              </>
            )}
          </label>
        </div>

        {/* Cover letter */}
        <div>
          <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
            Cover Letter <span className="text-white/20 normal-case">(Optional)</span>
          </label>
          <textarea
            value={form.cover_letter}
            onChange={e => setForm(f => ({ ...f, cover_letter: e.target.value }))}
            rows={5}
            placeholder="Tell us why you'd be great for this role…"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
          />
        </div>
      </div>

      <StepFooter onPrev={onPrev} onNext={onNext} nextLabel="Review Application" />
    </div>
  );
}

function ReviewStep({ form, job, company, onPrev, onSubmit, submitting }: {
  form: AppForm; job: any; company: any;
  onPrev: () => void; onSubmit: () => void; submitting: boolean;
}) {
  return (
    <div className="max-w-lg mx-auto w-full animate-fadeSlideIn">
      <p className="text-blue-400 text-sm font-semibold mb-2 tracking-wide uppercase">Review</p>
      <h2 className="text-3xl font-black text-white mb-8">Almost there!</h2>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
        <ReviewRow label="Position" value={job.title} />
        <ReviewRow label="Company" value={company?.name} />
        <ReviewRow label="Name" value={form.full_name} />
        <ReviewRow label="Email" value={form.email} />
        {form.phone && <ReviewRow label="Phone" value={form.phone} />}
        {form.resume_name && <ReviewRow label="Resume" value={form.resume_name} />}
        {form.cover_letter && <ReviewRow label="Cover Letter" value={form.cover_letter.length > 80 ? form.cover_letter.slice(0, 80) + '…' : form.cover_letter} />}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button onClick={onPrev} className="px-5 py-3 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors">
          <ArrowLeft className="inline h-4 w-4 mr-1" /> Back
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold text-base transition-all duration-300 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}

function SuccessStep({ company, companySlug }: { company: any; companySlug: string }) {
  return (
    <div className="flex flex-col items-center text-center animate-fadeSlideIn">
      {/* Animated checkmark */}
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center animate-bounce-slow">
          <Check className="h-12 w-12 text-emerald-400" strokeWidth={3} />
        </div>
        <div className="absolute inset-0 h-24 w-24 rounded-full bg-emerald-500/20 animate-ping" />
      </div>

      <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Application Sent! 🎉</h2>
      <p className="text-white/50 text-base max-w-md mb-10">
        Thank you for applying! {company?.name} will review your application and get back to you soon.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/candidate/login"
          className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          Track Your Application <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to={`/company/${companySlug}`}
          className="px-8 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-medium text-sm transition-all border border-white/10"
        >
          View More Jobs
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TypeformInput({ label, placeholder, value, onChange, type = 'text', error, hint, autoFocus = false }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
  error?: string; hint?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
        {label}
        {hint && <span className="text-white/20 normal-case ml-1">({hint})</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-white/[0.03] border rounded-xl px-4 py-3.5 text-white text-base placeholder:text-white/20 focus:outline-none transition-all ${
          error
            ? 'border-red-500/50 focus:ring-2 focus:ring-red-500/20'
            : 'border-white/[0.08] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10'
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between px-5 py-3.5">
      <span className="text-white/30 text-xs font-medium uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-white/70 text-sm text-right ml-4">{value}</span>
    </div>
  );
}

function StepFooter({ onPrev, onNext, nextLabel }: { onPrev: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="mt-10 flex items-center gap-3">
      <button onClick={onPrev} className="px-5 py-3 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors">
        <ArrowLeft className="inline h-4 w-4 mr-1" /> Back
      </button>
      <button
        onClick={onNext}
        className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
      >
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === current ? 'w-8 bg-blue-500' : i < current ? 'w-1.5 bg-blue-500/40' : 'w-1.5 bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

interface AppForm {
  full_name: string;
  email: string;
  phone: string;
  resume_url: string;
  resume_name: string;
  cover_letter: string;
}

const TOTAL_STEPS = 6;

export default function JobApply() {
  const { companySlug: paramSlug, jobSlug } = useParams<{ companySlug: string; jobSlug: string }>();
  const hostSlug = getCompanySlugFromHost();
  const companySlug = paramSlug || hostSlug;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AppForm>({
    full_name: '', email: '', phone: '', resume_url: '', resume_name: '', cover_letter: '',
  });

  // Fetch company
  const { data: company } = useQuery({
    queryKey: ['public-company', companySlug],
    queryFn: async () => {
      const isCustomDomain = hostSlug && hostSlug.includes('.');
      let query = supabase
        .from('public_companies')
        .select('id, name, slug, logo_url, about_company, industry, size, country, website, linkedin_url, custom_domain');
      if (isCustomDomain) {
        query = query.eq('custom_domain', hostSlug!);
      } else {
        query = query.eq('slug', companySlug!);
      }
      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: !!companySlug,
  });

  // Fetch job
  const { data: job, isLoading } = useQuery({
    queryKey: ['public-job', company?.id, jobSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, departments(name)')
        .eq('company_id', company!.id)
        .eq('job_slug', jobSlug!)
        .eq('status', 'open')
        .maybeSingle();
      return data;
    },
    enabled: !!company?.id && !!jobSlug,
  });

  // Keyboard: Enter to advance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && step >= 1 && step <= 3) {
        setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  const handleSubmit = async () => {
    if (!job || !company) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('candidates').insert({
        company_id: company.id,
        job_id: job.id,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        resume_url: form.resume_url || null,
        cover_letter: form.cover_letter.trim() || null,
        source: 'careers_page',
        stage: 'applied',
      }).select('id').single();
      if (error) throw error;

      if ((job as any).ai_interview_enabled) {
        navigate(`/company/${companySlug}/jobs/${jobSlug}/interview/${data.id}`);
      } else {
        setStep(5); // success
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#09090b' }}>
        <Briefcase className="h-16 w-16 text-white/10" />
        <h1 className="text-2xl font-bold text-white">Job Not Found</h1>
        <p className="text-white/40 text-sm">This position may have been filled or the link is incorrect.</p>
        {companySlug && (
          <Link to={`/company/${companySlug}`} className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4">
            ← View all open positions
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#09090b' }}>
      <SEO 
        title={`${job.title} at ${company?.name}`}
        description={job.description ? job.description.slice(0, 160) : `Apply for the ${job.title} position at ${company?.name}. Join our growing team!`}
        image={company?.logo_url || undefined}
        type="job"
        jobPosting={{
          title: job.title,
          description: job.description || '',
          datePosted: job.created_at,
          employmentType: job.employment_type || 'FULL_TIME',
          hiringOrganization: {
            name: company?.name || 'FastestHR Client',
            logo: company?.logo_url || undefined
          },
          jobLocation: {
            addressLocality: job.location || 'Remote',
            addressCountry: company?.country || 'US'
          },
          baseSalary: (job.min_salary || job.max_salary) ? {
            currency: 'USD',
            value: job.min_salary && job.max_salary ? { min: job.min_salary, max: job.max_salary } : (job.min_salary || job.max_salary),
            unitText: 'YEAR'
          } : undefined
        }}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: company?.name || 'Company', path: `/company/${companySlug}` },
          { name: job.title, path: `/company/${companySlug}/jobs/${jobSlug}` }
        ]}
      />

      {/* Top bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to={`/company/${companySlug}`} className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> All Jobs
          </Link>
          {step < 5 && <ProgressDots current={step} total={5} />}
          <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest hidden sm:inline">
            FastestHR
          </span>
        </div>
      </nav>

      {/* Step content — vertically centered */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* CSS classes handle the slide animation */}
          <style>{`
            @keyframes fadeSlideIn {
              from { opacity: 0; transform: translateY(24px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeSlideIn { animation: fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
            @keyframes bounce-slow {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
            .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
          `}</style>

          {step === 0 && <WelcomeStep job={job} company={company} onNext={() => setStep(1)} />}
          {step === 1 && <AboutStep job={job} company={company} onNext={() => setStep(2)} onPrev={() => setStep(0)} />}
          {step === 2 && <DetailsStep form={form} setForm={setForm} onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
          {step === 3 && <ResumeStep form={form} setForm={setForm} onNext={() => setStep(4)} onPrev={() => setStep(2)} />}
          {step === 4 && <ReviewStep form={form} job={job} company={company} onPrev={() => setStep(3)} onSubmit={handleSubmit} submitting={submitting} />}
          {step === 5 && <SuccessStep company={company} companySlug={companySlug!} />}
        </div>
      </div>
    </div>
  );
}
