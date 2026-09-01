import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2, ShieldCheck, Globe, MapPin, Mail, Phone,
  Briefcase, Calendar, Star, ExternalLink, ArrowLeft,
  Linkedin, Github, Twitter, Facebook, Instagram,
  MessageSquarePlus, User, Award, Lock, ShieldAlert,
  FileCheck, Sparkles, Building2, Check, FileDown
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { StarRating } from '@/components/global-employee/GlobalEmployeeCard';
import { EmployerFeedbackDialog } from '@/components/global-employee/EmployerFeedbackDialog';
import { DisputeResolutionDialog } from '@/components/global-employee/DisputeResolutionDialog';
import { RequestConsentDialog } from '@/components/global-employee/RequestConsentDialog';
import { BGVScorecard } from '@/components/global-employee/BGVScorecard';
import { EmployerDecisionPanel } from '@/components/global-employee/EmployerDecisionPanel';
import type { GlobalEmployee, EmployerFeedback, WorkExperience, StructuredReference } from '@/types/global-employee';

export default function GlobalEmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const isVerifiedUser = !!profile && ['super_admin', 'company_admin', 'hr_manager'].includes(profile.platform_role || '');

  const { data: employee, isLoading, error, refetch } = useQuery({
    queryKey: ['global-employee-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_employee' as any)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as GlobalEmployee;
    },
    enabled: !!id,
  });

  const initials = employee?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const feedbacks: EmployerFeedback[] = (employee?.feedbacks_by_employer as EmployerFeedback[]) || [];
  const structuredRefs: StructuredReference[] = (employee?.structured_references as StructuredReference[]) || [];
  const workExp: WorkExperience[] = (employee?.work_experience as WorkExperience[]) || [];
  const skills: string[] = employee?.skills || [];

  const totalReviews = feedbacks.length + structuredRefs.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center p-6">
        <div className="w-full max-w-4xl space-y-6 mt-20">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-6">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          {error ? `Error: ${(error as any).message}` : 'The employee career passport you are looking for does not exist or is currently private.'}
        </p>
        <Link to="/" className="mt-8 text-primary font-semibold hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Return to FastestHR.com
        </Link>
      </div>
    );
  }

  const socialLinks = [
    { url: employee.linkedin_url, icon: Linkedin, label: 'LinkedIn', color: 'hover:text-blue-600' },
    { url: employee.github_url, icon: Github, label: 'GitHub', color: 'hover:text-gray-900 dark:hover:text-white' },
    { url: employee.twitter_url, icon: Twitter, label: 'Twitter', color: 'hover:text-sky-500' },
    { url: employee.facebook_url, icon: Facebook, label: 'Facebook', color: 'hover:text-blue-700' },
    { url: employee.instagram_url, icon: Instagram, label: 'Instagram', color: 'hover:text-pink-500' },
  ].filter((s) => s.url);

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202]">
      {/* Hero Header */}
      <div className="relative h-56 sm:h-64 bg-gradient-to-br from-primary/90 via-purple-700/90 to-pink-600/90 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,rgba(0,0,0,0.4))]" />
        
        {/* Navigation Bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <Link
            to="/global-verification"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-black/30 backdrop-blur-md text-white/90 rounded-xl text-xs font-semibold hover:bg-black/40 transition-all border border-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Verification Suite
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisputeDialogOpen(true)}
              className="h-8 text-xs bg-black/30 backdrop-blur-md text-white/90 border-white/10 hover:bg-black/40 gap-1.5"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Dispute Record
            </Button>
          </div>
        </div>

        {/* Verified Badge */}
        {employee.verified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="absolute bottom-6 right-6 hidden sm:block"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 backdrop-blur-md text-emerald-100 border border-emerald-400/30 text-xs font-bold shadow-xl">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Verified Career Passport
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-24 relative z-10 pb-20 space-y-6">
        {/* Profile Master Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-background/90 backdrop-blur-2xl border-border/50 shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <Avatar className="h-28 w-28 shrink-0 ring-4 ring-background shadow-2xl rounded-2xl">
                  <AvatarImage src={employee.profile_picture || ''} className="rounded-2xl object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/40 to-purple-600/40 text-primary text-3xl font-extrabold rounded-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{employee.name}</h1>
                      {employee.verified && (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                      )}
                    </div>

                    {workExp.length > 0 && (
                      <p className="text-base text-muted-foreground font-medium mt-1">
                        {workExp[0].designation} at <span className="text-foreground font-semibold">{workExp[0].company_name}</span>
                      </p>
                    )}
                  </div>

                  {/* Badges & Meta */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                    {(employee.city || employee.country) && (
                      <span className="inline-flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {[employee.city, employee.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">
                      <Lock className="h-3.5 w-3.5" /> Masked ID Tokenized
                    </span>
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" /> FCRA/GDPR Aligned
                    </span>
                  </div>

                  {/* Unified Overall Rating */}
                  <div className="flex items-center gap-3 pt-1">
                    <StarRating rating={Number(employee.rating) || 0} size="md" />
                    <span className="text-lg font-extrabold text-foreground">{Number(employee.rating)?.toFixed(1) || '0.0'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({totalReviews} verified review{totalReviews !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {/* Social Links */}
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-2 pt-2">
                      {socialLinks.map((social, i) => (
                        <a
                          key={i}
                          href={social.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-xl bg-muted/40 text-muted-foreground ${social.color} transition-all hover:scale-110 border border-border/30`}
                          title={social.label}
                        >
                          <social.icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap gap-3">
                <Button
                  onClick={() => setConsentDialogOpen(true)}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 rounded-xl"
                >
                  <Lock className="h-4 w-4" /> Request Full Verification Dossier
                </Button>

                {isVerifiedUser && (
                  <Button
                    variant="outline"
                    onClick={() => setFeedbackDialogOpen(true)}
                    className="gap-2 rounded-xl"
                  >
                    <MessageSquarePlus className="h-4 w-4 text-primary" /> Submit Attestation
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* BGV Assessment Scorecard */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <BGVScorecard employee={employee} />
        </motion.div>

        {/* Employer Judgment & Assessment Panel */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <EmployerDecisionPanel employee={employee} />
        </motion.div>

        {/* Skills */}
        {skills.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Verified Skills & Competencies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-primary/5 text-primary border border-primary/10 text-xs font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Work Experience Timeline */}
        {workExp.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Verified Employment History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {workExp.map((exp, i) => (
                  <div key={i} className="relative pl-6 pb-6 last:pb-0">
                    {i < workExp.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                    )}
                    <div className="absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{exp.designation}</h4>
                        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/5 font-semibold">
                          <Check className="h-2.5 w-2.5 mr-0.5" /> Tenured
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">{exp.company_name}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {exp.from_date} — {exp.to_date || 'Present'}
                        {exp.duration && <span className="text-primary/60">• {exp.duration}</span>}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/30">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Structured Attestations & Corporate Endorsements */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Verified Corporate Attestations & Reviews
                </span>
                {totalReviews > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{totalReviews}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalReviews === 0 ? (
                <div className="text-center py-10 space-y-3 border border-dashed rounded-xl">
                  <User className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No corporate attestations submitted yet.</p>
                  {isVerifiedUser && (
                    <Button variant="outline" size="sm" onClick={() => setFeedbackDialogOpen(true)} className="gap-2">
                      <MessageSquarePlus className="h-3.5 w-3.5 text-primary" /> Submit First Attestation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Modern Structured References */}
                  {structuredRefs.map((ref) => (
                    <div key={ref.id} className="p-5 bg-muted/20 rounded-2xl border border-border/30 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{ref.reviewer_name}</p>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                              {ref.reviewer_role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" /> {ref.company_name}
                            {ref.verified_domain && (
                              <span className="text-emerald-500 font-semibold">• Domain Verified</span>
                            )}
                          </p>
                        </div>
                        {ref.rehire_eligibility && (
                          <Badge className={ref.rehire_eligibility === 'eligible' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]' : 'bg-muted text-muted-foreground text-[10px]'}>
                            {ref.rehire_eligibility === 'eligible' ? '✓ Rehire Eligible' : 'Policy Neutral'}
                          </Badge>
                        )}
                      </div>

                      {/* Observations */}
                      <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed pt-1">
                        <div>
                          <span className="font-semibold text-foreground">Feedback & Strengths: </span>
                          {ref.strengths}
                        </div>
                        {ref.growth_areas && (
                          <div>
                            <span className="font-semibold text-foreground">Growth Areas: </span>
                            {ref.growth_areas}
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Attested on {ref.date ? new Date(ref.date).toLocaleDateString() : 'N/A'} • Cryptographically Logged
                      </p>
                    </div>
                  ))}

                  {/* Legacy Feedbacks if any */}
                  {feedbacks.map((fb, i) => (
                    <div key={i} className="p-4 bg-muted/20 rounded-xl border border-border/30 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-sm">{fb.employer_name}</p>
                          <p className="text-xs text-muted-foreground">{fb.company_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={fb.rating} />
                          <span className="text-xs font-mono text-muted-foreground">{fb.rating?.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{fb.feedback_by_employer}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Regulatory & Compliance Guarantee Footer */}
        <div className="pt-8 border-t border-border/40 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold tracking-widest uppercase text-foreground">FastestHR Global Trust Guarantee</span>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-lg leading-relaxed">
            All records on FastestHR are strictly governed under the Fair Credit Reporting Act (15 U.S.C. § 1681), European General Data Protection Regulation (GDPR), and India DPDP Act 2023. Candidates hold absolute statutory rights to access, inspect, and dispute records.
          </p>
        </div>
      </div>

      {/* Dialogs */}
      {employee && (
        <>
          <EmployerFeedbackDialog
            open={feedbackDialogOpen}
            onOpenChange={setFeedbackDialogOpen}
            employeeId={employee.id}
            employeeName={employee.name}
            onSuccess={() => refetch()}
          />

          <DisputeResolutionDialog
            open={disputeDialogOpen}
            onOpenChange={setDisputeDialogOpen}
            employeeId={employee.id}
            employeeName={employee.name}
            onSuccess={() => refetch()}
          />

          <RequestConsentDialog
            open={consentDialogOpen}
            onOpenChange={setConsentDialogOpen}
            employeeId={employee.id}
            employeeName={employee.name}
            onSuccess={() => refetch()}
          />
        </>
      )}
    </div>
  );
}
