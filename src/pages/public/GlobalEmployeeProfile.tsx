import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2, ShieldCheck, Globe, MapPin, Mail, Phone,
  Briefcase, Calendar, Star, ExternalLink, ArrowLeft,
  Linkedin, Github, Twitter, Facebook, Instagram,
  MessageSquarePlus, User, Award
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
import type { GlobalEmployee, EmployerFeedback, WorkExperience } from '@/types/global-employee';

export default function GlobalEmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

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
  const workExp: WorkExperience[] = (employee?.work_experience as WorkExperience[]) || [];
  const skills: string[] = employee?.skills || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center p-6">
        <div className="w-full max-w-3xl space-y-6 mt-20">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full rounded-2xl" />
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
          {error ? `Error: ${(error as any).message}` : 'The employee profile you are looking for does not exist or is not publicly available.'}
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
      {/* Hero Gradient */}
      <div className="relative h-48 sm:h-56 bg-gradient-to-br from-primary/80 via-purple-600/80 to-pink-600/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_50%,rgba(0,0,0,0.3))]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'30\' height=\'30\' viewBox=\'0 0 30 30\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1.22676 0C1.91374 0 2.45351 0.539773 2.45351 1.22676C2.45351 1.91374 1.91374 2.45351 1.22676 2.45351C0.539773 2.45351 0 1.91374 0 1.22676C0 0.539773 0.539773 0 1.22676 0Z\' fill=\'rgba(255,255,255,0.07)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link to="/" className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/20 backdrop-blur-sm text-white/80 rounded-lg text-sm font-medium hover:bg-black/30 transition-all">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        {/* Verified badge */}
        {employee.verified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="absolute top-4 right-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm text-emerald-100 border border-emerald-400/30 text-sm font-semibold shadow-lg">
              <CheckCircle2 className="h-4 w-4" /> Verified by FastestHR
            </div>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-20 relative z-10 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Profile Card */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-2xl shadow-black/10 rounded-3xl overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <Avatar className="h-24 w-24 shrink-0 ring-4 ring-background shadow-xl">
                  <AvatarImage src={employee.profile_picture || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/40 to-purple-500/40 text-primary text-3xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{employee.name}</h1>
                      {employee.verified && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, delay: 0.4 }}
                        >
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        </motion.div>
                      )}
                    </div>

                    {workExp.length > 0 && (
                      <p className="text-muted-foreground mt-1">
                        {workExp[0].designation} at {workExp[0].company_name}
                      </p>
                    )}
                  </div>

                  {/* Quick Info */}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {(employee.city || employee.state || employee.country) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {[employee.city, employee.state, employee.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {employee.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {employee.email}
                      </span>
                    )}
                    {employee.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {employee.phone}
                      </span>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-3">
                    <StarRating rating={Number(employee.rating) || 0} size="md" />
                    <span className="text-lg font-bold">{Number(employee.rating)?.toFixed(1) || '0.0'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({feedbacks.length} review{feedbacks.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {/* Social Links */}
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      {socialLinks.map((social, i) => (
                        <a
                          key={i}
                          href={social.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-lg bg-muted/50 text-muted-foreground ${social.color} transition-all hover:scale-110`}
                          title={social.label}
                        >
                          <social.icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {isVerifiedUser && (
                <div className="mt-6 pt-6 border-t border-border/50 flex gap-2">
                  <Button
                    onClick={() => setFeedbackDialogOpen(true)}
                    className="gap-2 bg-gradient-to-r from-primary to-purple-600"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Leave Feedback
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          {skills.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 * i }}
                        className="px-3 py-1.5 rounded-full bg-primary/5 text-primary border border-primary/10 text-sm font-medium hover:bg-primary/10 transition-colors cursor-default"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Work Experience */}
          {workExp.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" /> Work Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workExp.map((exp, i) => (
                    <div key={i} className="relative pl-6 pb-4 last:pb-0">
                      {/* Timeline line */}
                      {i < workExp.length - 1 && (
                        <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                      )}
                      {/* Dot */}
                      <div className="absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>

                      <div>
                        <h4 className="font-bold text-sm">{exp.designation}</h4>
                        <p className="text-sm text-muted-foreground">{exp.company_name}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {exp.from_date} — {exp.to_date || 'Present'}
                          {exp.duration && <span className="text-primary/60">• {exp.duration}</span>}
                        </p>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Employer Reviews */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-primary" /> Employer Reviews
                  {feedbacks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-2">{feedbacks.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedbacks.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <User className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">No employer reviews yet.</p>
                    {isVerifiedUser && (
                      <Button variant="outline" size="sm" onClick={() => setFeedbackDialogOpen(true)} className="mt-2 gap-2">
                        <MessageSquarePlus className="h-3.5 w-3.5" /> Be the first to review
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((fb, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="p-4 bg-muted/30 rounded-xl border border-border/30"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-sm">{fb.employer_name}</p>
                            <p className="text-xs text-muted-foreground">{fb.company_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StarRating rating={fb.rating} />
                            <span className="text-xs font-mono text-muted-foreground">{fb.rating?.toFixed(1)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{fb.feedback_by_employer}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-2 uppercase tracking-wider">
                          {fb.date ? new Date(fb.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <div className="pt-8 border-t border-border/40 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-muted-foreground grayscale hover:grayscale-0 transition-all duration-300 opacity-60">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium tracking-widest uppercase">FastestHR Global Verification</span>
            </div>
            <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
              This profile is part of the FastestHR Global Employee Verification Portal — a centralized repository for employer feedback on candidates' integrity, commitment, and professionalism.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Feedback Dialog */}
      {employee && (
        <EmployerFeedbackDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          employeeId={employee.id}
          employeeName={employee.name}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
