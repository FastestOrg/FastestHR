import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Loader2, CheckCircle2, Globe, User, ArrowLeft,
  CreditCard, MapPin, Briefcase, Plus, X, Send
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
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
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
      if (emp.facebook_url) setFacebookUrl(emp.facebook_url);
      if (emp.instagram_url) setInstagramUrl(emp.instagram_url);
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
    setWorkExperience([...workExperience, {
      company_name: '', designation: '', duration: '', from_date: '', to_date: '', description: '',
    }]);
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
      const { data, error } = await supabase.rpc('submit_global_employee_self_verification', {
        p_token: token!,
        p_aadhaar: aadhaar || null,
        p_pan: pan || null,
        p_driving_license: drivingLicense || null,
        p_passport: passport || null,
        p_address: address || null,
        p_city: city || null,
        p_state: state || null,
        p_country: country || null,
        p_pincode: pincode || null,
        p_skills: skills.length > 0 ? skills : null,
        p_work_experience: workExperience.length > 0 ? JSON.stringify(workExperience) : null,
        p_linkedin_url: linkedinUrl || null,
        p_github_url: githubUrl || null,
        p_twitter_url: twitterUrl || null,
        p_facebook_url: facebookUrl || null,
        p_instagram_url: instagramUrl || null,
        p_profile_picture: profilePicture || null,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        setSubmitted(true);
        toast.success('Your details have been submitted successfully!');
      } else {
        throw new Error(result?.error || 'Failed to submit');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-medium">Verifying your link...</p>
      </div>
    );
  }

  // Invalid link
  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-6">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Invalid Verification Link</h1>
        <p className="text-muted-foreground max-w-md">
          This verification link is invalid, expired, or has already been used. Please contact your employer for a new link.
        </p>
        <a href="/" className="mt-8 text-primary font-semibold hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Return to FastestHR.com
        </a>
      </div>
    );
  }

  // Success state
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
        <h1 className="text-2xl font-bold mb-2">Details Submitted Successfully!</h1>
        <p className="text-muted-foreground max-w-md">
          Thank you, <span className="font-semibold text-foreground">{employee.name}</span>. Your details have been submitted for verification. 
          The employer will review and verify your information shortly.
        </p>
        <a href="/" className="mt-8 text-primary font-semibold hover:underline flex items-center gap-2">
          <Globe className="h-4 w-4" /> Visit FastestHR.com
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
      <div className="relative h-40 bg-gradient-to-br from-primary/80 via-purple-600/80 to-pink-600/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_50%,rgba(0,0,0,0.3))]" />
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" /> Self-Verification Portal
            </div>
            <p className="text-white/70 text-sm">Complete your details below to verify your profile</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-10 relative z-10 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Employee Info Card */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl">
            <CardContent className="p-6 flex items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 ring-4 ring-background shadow-lg">
                <AvatarImage src={employee.profile_picture || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary/40 to-purple-500/40 text-primary text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-extrabold">{employee.name}</h2>
                <p className="text-sm text-muted-foreground">Please fill in your details below to complete verification</p>
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Identity Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Aadhaar Number</Label>
                  <Input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="XXXX XXXX XXXX" className="mt-1" />
                </div>
                <div>
                  <Label>PAN Number</Label>
                  <Input value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" className="mt-1" />
                </div>
                <div>
                  <Label>Driving License</Label>
                  <Input value={drivingLicense} onChange={(e) => setDrivingLicense(e.target.value)} placeholder="DL-XXXXXXXXX" className="mt-1" />
                </div>
                <div>
                  <Label>Passport Number</Label>
                  <Input value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="A1234567" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Street Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" className="mt-1" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="mt-1" />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" className="mt-1" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India" className="mt-1" />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="400001" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Profile & Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Profile Picture URL</Label>
                <Input value={profilePicture} onChange={(e) => setProfilePicture(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>

              <div>
                <Label>Skills</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    placeholder="Type a skill and press Add"
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
                        <button type="button" onClick={() => setSkills(skills.filter(s => s !== skill))} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Social Links */}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn</Label>
                  <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1" />
                </div>
                <div>
                  <Label>GitHub</Label>
                  <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="mt-1" />
                </div>
                <div>
                  <Label>Twitter / X</Label>
                  <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/..." className="mt-1" />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Experience */}
          <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Work Experience
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addWorkExperience} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {workExperience.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No work experience added yet. Click "Add" to add your experience.
                </p>
              )}
              {workExperience.map((exp, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-xl border border-border/30 space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => removeWorkExperience(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Company Name</Label>
                      <Input value={exp.company_name} onChange={(e) => updateWorkExperience(i, 'company_name', e.target.value)} placeholder="Company" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Designation</Label>
                      <Input value={exp.designation} onChange={(e) => updateWorkExperience(i, 'designation', e.target.value)} placeholder="Role" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">From Date</Label>
                      <Input value={exp.from_date} onChange={(e) => updateWorkExperience(i, 'from_date', e.target.value)} placeholder="Jan 2023" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">To Date</Label>
                      <Input value={exp.to_date} onChange={(e) => updateWorkExperience(i, 'to_date', e.target.value)} placeholder="Present" className="mt-1" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Description</Label>
                      <Textarea value={exp.description} onChange={(e) => updateWorkExperience(i, 'description', e.target.value)} placeholder="Brief description..." className="mt-1" rows={2} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 text-base py-6 rounded-xl"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Submit Verification Details
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Your details will be reviewed by the employer before being verified.
            </p>
          </motion.div>

          {/* Footer */}
          <div className="pt-8 border-t border-border/40 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-muted-foreground opacity-60">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium tracking-widest uppercase">Powered by FastestHR</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
