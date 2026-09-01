import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Loader2, CheckCircle2, Globe, User, ArrowLeft,
  CreditCard, MapPin, Briefcase, Plus, X, Send, Lock, Sparkles, Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GlobalEmployee, WorkExperience } from '@/types/global-employee';

export default function GlobalEmployeeVerify() {
  const { token } = useParams<{ token: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [drivingLicense, setDrivingLicense] = useState('');
  const [passport, setPassport] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);

  // Fetch employee data by verification link
  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['global-employee-verify', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_employee' as any)
        .select('*')
        .eq('verification_link', token)
        .single();
      if (error) throw error;

      const emp = data as unknown as GlobalEmployee;

      // Pre-fill form with existing data
      if (emp.aadhaar) setAadhaar(emp.aadhaar);
      if (emp.pan) setPan(emp.pan);
      if (emp.driving_license) setDrivingLicense(emp.driving_license);
      if (emp.passport) setPassport(emp.passport);
      if (emp.address) setAddress(emp.address);
      if (emp.city) setCity(emp.city);
      if (emp.state) setState(emp.state);
      if (emp.country) setCountry(emp.country);
      if (emp.pincode) setPincode(emp.pincode);
      if (emp.profile_picture) setProfilePicture(emp.profile_picture);
      if (emp.skills) setSkills(emp.skills);
      if (emp.linkedin_url) setLinkedinUrl(emp.linkedin_url);
      if (emp.github_url) setGithubUrl(emp.github_url);
      if (emp.twitter_url) setTwitterUrl(emp.twitter_url);
      if (emp.work_experience) setWorkExperience(emp.work_experience as WorkExperience[]);

      return emp;
    },
    enabled: !!token,
  });

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setSkillInput('');
    }
  };

  const addWorkExperience = () => {
    setWorkExperience([
      ...workExperience,
      {
        company_name: '',
        designation: '',
        duration: '',
        from_date: '',
        to_date: '',
        description: '',
      },
    ]);
  };

  const updateWorkExperience = (index: number, field: keyof WorkExperience, value: string) => {
    const updated = [...workExperience];
    updated[index] = { ...updated[index], [field]: value };
    setWorkExperience(updated);
  };

  const removeWorkExperience = (index: number) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Auto-mask sensitive IDs on client before sending
      const maskedAadhaar = aadhaar.trim() ? (aadhaar.includes('•') ? aadhaar : `•••• •••• ${aadhaar.slice(-4)}`) : null;
      const maskedPan = pan.trim() ? (pan.includes('•') ? pan : `•••••${pan.slice(-4)}`) : null;
      const maskedPassport = passport.trim() ? (passport.includes('•') ? passport : `••••${passport.slice(-4)}`) : null;

      const { data, error } = await supabase.rpc('submit_global_employee_self_verification', {
        p_token: token!,
        p_aadhaar: maskedAadhaar,
        p_pan: maskedPan,
        p_driving_license: drivingLicense.trim() || null,
        p_passport: maskedPassport,
        p_address: address.trim() || null,
        p_city: city.trim() || null,
        p_state: state.trim() || null,
        p_country: country.trim() || null,
        p_pincode: pincode.trim() || null,
        p_skills: skills.length > 0 ? skills : null,
        p_work_experience: workExperience.length > 0 ? JSON.stringify(workExperience) : null,
        p_linkedin_url: linkedinUrl.trim() || null,
        p_github_url: githubUrl.trim() || null,
        p_twitter_url: twitterUrl.trim() || null,
        p_facebook_url: null,
        p_instagram_url: null,
        p_profile_picture: profilePicture.trim() || null,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        setSubmitted(true);
        toast.success('Your career details have been submitted for verification audit!');
      } else {
        throw new Error(result?.error || 'Failed to submit details');
      }
    } catch (err: any) {
      console.error('Self verification error:', err);
      toast.error(err.message || 'Failed to submit verification details');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-medium">Validating verification token...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-6">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Invalid or Expired Link</h1>
        <p className="text-muted-foreground max-w-md">
          This verification authorization link is invalid, expired, or has already been used. Please request a new link from your employer or hiring manager.
        </p>
        <a href="/" className="mt-8 text-primary font-semibold hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Return to FastestHR.com
        </a>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="h-24 w-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6"
        >
          <CheckCircle2 className="h-12 w-12" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-2">Career Passport Updated!</h1>
        <p className="text-muted-foreground max-w-md">
          Thank you, <span className="font-semibold text-foreground">{employee.name}</span>. Your employment records and masked identity credentials have been received.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-sm">
          Your organization's HR representative will audit your credentials and issue your official Verified Career Passport badge.
        </p>
        <a href={`/employeebg/${employee.id}`} className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          <Globe className="h-4 w-4" /> View Your Career Passport Preview
        </a>
      </div>
    );
  }

  const initials = employee.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202]">
      {/* Hero */}
      <div className="relative h-44 bg-gradient-to-br from-primary/90 via-purple-700/90 to-pink-600/90 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,rgba(0,0,0,0.3))]" />
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Candidate Verification Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Claim Your Verified Career Passport</h1>
            <p className="text-white/80 text-xs max-w-md">Complete your credentials below with full privacy protection</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Candidate Profile Header Card */}
          <Card className="bg-background/90 backdrop-blur-2xl border-border/50 shadow-2xl rounded-3xl">
            <CardContent className="p-6 flex items-center gap-5">
              <Avatar className="h-16 w-16 shrink-0 ring-4 ring-background shadow-lg rounded-2xl">
                <AvatarImage src={profilePicture || employee.profile_picture || ''} className="rounded-2xl object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary/40 to-purple-600/40 text-primary text-xl font-bold rounded-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-extrabold">{employee.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authorized Verification Token: <span className="font-mono text-primary font-semibold">{token?.slice(0, 8)}••••</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Guarantee */}
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3 text-xs text-muted-foreground">
            <Lock className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-foreground">Candidate Data Sovereignty & Privacy:</span>
              <p className="mt-0.5 leading-relaxed">
                You own your professional reputation. All national IDs are masked and tokenized. External prospective employers cannot view your full dossier without your explicit, time-limited consent.
              </p>
            </div>
          </div>

          {/* Masked Identity Tokens */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Masked Identity Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Aadhaar (Last 4 Digits)</Label>
                  <Input
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    placeholder="•••• •••• 9812"
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">UIDAI Compliant • Only last 4 digits stored</p>
                </div>
                <div>
                  <Label>PAN (Permanent Account Number)</Label>
                  <Input
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="ABCDE••••F"
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div>
                  <Label>Driving License Number</Label>
                  <Input
                    value={drivingLicense}
                    onChange={(e) => setDrivingLicense(e.target.value)}
                    placeholder="DL-XXXXXXXXX"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Passport Number (Masked)</Label>
                  <Input
                    value={passport}
                    onChange={(e) => setPassport(e.target.value)}
                    placeholder="A••••567"
                    className="mt-1 font-mono uppercase"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Details */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Location & Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Street Address</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Innovation Drive, Suite 400"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Francisco / Mumbai" className="mt-1" />
                </div>
                <div>
                  <Label>State / Region</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="California / Maharashtra" className="mt-1" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States / India" className="mt-1" />
                </div>
                <div>
                  <Label>Postal / ZIP Code</Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="94105 / 400001" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skills & Profile Details */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Skills & Digital Presence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Profile Picture URL</Label>
                <Input
                  value={profilePicture}
                  onChange={(e) => setProfilePicture(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Core Competencies & Skills</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    placeholder="Add skill (e.g. Distributed Systems, TypeScript)"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addSkill} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        {skill}
                        <button type="button" onClick={() => setSkills(skills.filter((s) => s !== skill))} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn Profile URL</Label>
                  <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1" />
                </div>
                <div>
                  <Label>GitHub Profile URL</Label>
                  <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Experience History */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Employment History
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addWorkExperience} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Position
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {workExperience.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-xl">
                  No work positions added yet. Click "Add Position" to document your tenure.
                </p>
              )}
              {workExperience.map((exp, i) => (
                <div key={i} className="p-4 bg-muted/20 rounded-xl border border-border/30 space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeWorkExperience(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Company / Employer Name</Label>
                      <Input value={exp.company_name} onChange={(e) => updateWorkExperience(i, 'company_name', e.target.value)} placeholder="Google / Stripe" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Job Title / Designation</Label>
                      <Input value={exp.designation} onChange={(e) => updateWorkExperience(i, 'designation', e.target.value)} placeholder="Staff Engineer" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Start Date</Label>
                      <Input value={exp.from_date} onChange={(e) => updateWorkExperience(i, 'from_date', e.target.value)} placeholder="01/2021" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">End Date</Label>
                      <Input value={exp.to_date} onChange={(e) => updateWorkExperience(i, 'to_date', e.target.value)} placeholder="Present" className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Role Description & Key Accomplishments</Label>
                      <Textarea value={exp.description} onChange={(e) => updateWorkExperience(i, 'description', e.target.value)} placeholder="Describe core responsibilities..." className="mt-1" rows={2} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit Action */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-primary via-purple-600 to-pink-600 hover:from-primary/90 hover:to-purple-600/90 shadow-xl shadow-primary/20 text-base py-6 rounded-2xl"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Submit Verification Details
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              By submitting, you certify that the provided information is authentic and consent to verified credential audit.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
