import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, MapPin, Users, Globe, Linkedin, Building2, DollarSign, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { isSafeUrl } from '@/lib/utils';
import { getCompanySlugFromHost } from '@/utils/tenantUtils';
import { SEO } from '@/components/seo/SEO';

const HERO_GRADIENT = 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #334155 100%)';

const formatSalary = (min?: number | null, max?: number | null) => {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 100000 ? `${(n/1000).toFixed(0)}K` : n.toLocaleString();
  if (min && max) return `${fmt(min)} — ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Internship',
};

const WORK_TYPE_LABELS: Record<string, string> = {
  on_site: 'On-site', remote: 'Remote', hybrid: 'Hybrid',
};

export default function CompanyPage() {
  const { companySlug: paramSlug } = useParams<{ companySlug: string }>();
  const hostSlug = getCompanySlugFromHost();
  // Use subdomain slug if present, otherwise use URL param
  const companySlug = paramSlug || hostSlug;
  const isSubdomain = !!hostSlug && !paramSlug;

  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ['public-company', companySlug],
    queryFn: async () => {
      // If accessed via custom domain (not a slug pattern), look up by custom_domain
      const isCustomDomain = hostSlug && hostSlug.includes('.');
      
      let query = supabase
        .from('public_companies')
        .select('id, name, slug, logo_url, about_company, industry, size, country, website, linkedin_url, custom_domain');
      
      if (isCustomDomain) {
        query = query.eq('custom_domain', hostSlug!);
      } else {
        query = query.eq('slug', companySlug!);
      }
      
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companySlug,
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['public-jobs', company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, job_slug, location, employment_type, work_type, min_salary, max_salary, openings, department_id, departments(name)')
        .eq('company_id', company!.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!company?.id,
  });

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: HERO_GRADIENT }}>
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: HERO_GRADIENT }}>
        <Building2 className="h-16 w-16 text-white/20" />
        <h1 className="text-2xl font-bold text-white">Company Not Found</h1>
        <p className="text-white/50 text-sm">This company page doesn't exist or is inactive.</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4">← Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      <SEO 
        title={`Careers at ${company.name}`}
        description={company.about_company ? company.about_company.slice(0, 160) : `Join the team at ${company.name}. Explore open positions and career opportunities.`}
        image={company.logo_url || undefined}
        type="website"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: company.name, path: `/company/${company.slug}` }
        ]}
      />

      {/* ════════ Navigation ════════ */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                {company.name?.[0]}
              </div>
            )}
            <span className="font-semibold text-white text-sm tracking-tight">{company.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest hidden sm:inline">
              Powered by FastestHR
            </span>
          </div>
        </div>
      </nav>

      {/* ════════ Hero ════════ */}
      <header
        className="relative overflow-hidden"
        style={{ background: HERO_GRADIENT }}
      >
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Logo */}
          <div className="mx-auto mb-8">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-24 w-24 rounded-2xl object-cover mx-auto ring-2 ring-white/10 shadow-2xl shadow-blue-500/20" />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center text-white text-3xl font-black mx-auto ring-2 ring-white/10 shadow-2xl shadow-blue-500/20">
                {company.name?.[0]}
              </div>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            {company.name}
          </h1>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {company.industry && (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium">
                {company.industry}
              </span>
            )}
            {company.size && (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium flex items-center gap-1.5">
                <Users className="h-3 w-3" /> {company.size} employees
              </span>
            )}
            {company.country && (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {company.country}
              </span>
            )}
          </div>

          {/* Links */}
          <div className="flex items-center justify-center gap-4">
            {(company as any).website && isSafeUrl((company as any).website) && (
              <a href={(company as any).website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
            {(company as any).linkedin_url && isSafeUrl((company as any).linkedin_url) && (
              <a href={(company as any).linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ════════ About ════════ */}
      {(company as any).about_company && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="h-1 w-8 bg-blue-500 rounded-full" />
            About {company.name}
          </h2>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <p className="text-white/60 leading-relaxed whitespace-pre-line text-[15px]">
              {(company as any).about_company}
            </p>
          </div>
        </section>
      )}

      {/* ════════ Open Roles ════════ */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="h-1 w-8 bg-emerald-500 rounded-full" />
            Open Positions
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
              {jobs.length}
            </span>
          </h2>
        </div>

        {loadingJobs ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <Briefcase className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 font-medium">No open positions right now</p>
            <p className="text-white/20 text-sm mt-1">Check back later for new opportunities</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((job: any) => (
              <Link
                key={job.id}
                to={isSubdomain ? `/jobs/${job.job_slug || job.id}` : `/company/${companySlug}/jobs/${job.job_slug || job.id}`}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
              >
                {/* Arrow */}
                <div className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-blue-400 transition-colors" />
                </div>

                <h3 className="text-lg font-bold text-white pr-12 mb-3 group-hover:text-blue-400 transition-colors">
                  {job.title}
                </h3>

                <div className="flex flex-wrap gap-2 mb-4">
                  {job.departments?.name && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-semibold uppercase tracking-wider">
                      {job.departments.name}
                    </span>
                  )}
                  {job.employment_type && (
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium">
                      {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
                    </span>
                  )}
                  {job.work_type && (
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium">
                      {WORK_TYPE_LABELS[job.work_type] || job.work_type}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {job.location}
                    </span>
                  )}
                  {formatSalary(job.min_salary, job.max_salary) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> {formatSalary(job.min_salary, job.max_salary)}
                    </span>
                  )}
                  {job.openings > 1 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {job.openings} openings
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ════════ Footer ════════ */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/20 text-xs font-mono">
            © {new Date().getFullYear()} {company.name}. All rights reserved.
          </p>
          <a href="https://fastesthr.com" target="_blank" rel="noopener noreferrer"
            className="text-white/20 hover:text-white/40 text-xs font-mono transition-colors">
            Powered by FastestHR
          </a>
        </div>
      </footer>
    </div>
  );
}
