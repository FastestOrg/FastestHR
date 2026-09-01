import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, X, Plus, ShieldCheck, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Full Name is required'),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  phone: z.string().optional(),
  
  // National IDs (will be securely masked)
  aadhaar_last4: z.string().max(4, 'Enter only last 4 digits').optional(),
  pan_masked: z.string().optional(),
  driving_license: z.string().optional(),
  passport_masked: z.string().optional(),
  
  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  pincode: z.string().optional(),
  
  // Initial Tenure Record
  current_company: z.string().optional(),
  current_designation: z.string().optional(),
  start_date: z.string().optional(),
  rehire_eligibility: z.string().default('eligible'),
  
  // Profile
  profile_picture: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  linkedin_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  github_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  twitter_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
});

type FormData = z.infer<typeof schema>;

interface AddGlobalEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddGlobalEmployeeDialog({ open, onOpenChange, onSuccess }: AddGlobalEmployeeDialogProps) {
  const { profile } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: 'India',
      rehire_eligibility: 'eligible',
    },
  });

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      // Format masked IDs
      const maskedAadhaar = data.aadhaar_last4 ? `•••• •••• ${data.aadhaar_last4}` : null;
      const maskedPan = data.pan_masked ? `•••••${data.pan_masked.slice(-4)}` : null;
      const maskedPassport = data.passport_masked ? `••••${data.passport_masked.slice(-4)}` : null;

      // Construct initial tenure record if provided
      const tenureRecords = data.current_company && data.current_designation ? [{
        id: crypto.randomUUID(),
        company_name: data.current_company,
        official_designation: data.current_designation,
        employment_type: 'full_time',
        start_date: data.start_date || new Date().getFullYear().toString(),
        end_date: null,
        is_current: true,
        rehire_eligibility: data.rehire_eligibility,
        verification_source: 'hr_attestation',
        verified_at: new Date().toISOString(),
      }] : [];

      const { error } = await supabase.from('global_employee' as any).insert({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        
        // Masked IDs for privacy compliance
        masked_aadhaar: maskedAadhaar,
        masked_pan: maskedPan,
        masked_passport: maskedPassport,
        aadhaar: maskedAadhaar,
        pan: maskedPan,
        passport: maskedPassport,
        driving_license: data.driving_license || null,
        id_verification_status: 'pending',

        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || 'India',
        pincode: data.pincode || null,
        profile_picture: data.profile_picture || null,
        public: true,
        skills: skills,
        
        work_experience: data.current_company ? [{
          company_name: data.current_company,
          designation: data.current_designation || 'Staff',
          from_date: data.start_date || '2023',
          to_date: 'Present',
          description: 'Verified active tenure record',
        }] : [],
        verified_tenure_records: tenureRecords,

        linkedin_url: data.linkedin_url || null,
        github_url: data.github_url || null,
        twitter_url: data.twitter_url || null,
        added_by_user_id: profile?.id,
        added_by_company_id: profile?.company_id,
      } as any);

      if (error) throw error;

      toast.success('Candidate profile created in Global Verification Vault');
      reset();
      setSkills([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Add employee error:', err);
      toast.error(err.message || 'Failed to add employee record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Register Candidate in Global Verification Vault
          </DialogTitle>
          <DialogDescription>
            Add a new professional record with privacy-protected masked identity and verified tenure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Privacy Shield Notice */}
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Global Privacy & UIDAI Compliance:</span> All national identity credentials are automatically tokenized and masked. Plaintext identity numbers are never stored.
            </div>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Personal Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" {...register('name')} placeholder="Alexander Wright" className="mt-1" />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">Official / Contact Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="alex@example.com" className="mt-1" />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" {...register('phone')} placeholder="+1 (555) 019-2834" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="profile_picture">Profile Picture URL</Label>
                <Input id="profile_picture" {...register('profile_picture')} placeholder="https://images.unsplash.com/..." className="mt-1" />
              </div>
            </div>
          </div>

          {/* Initial Tenure Record */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Current or Most Recent Tenure</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current_company">Organization Name</Label>
                <Input id="current_company" {...register('current_company')} placeholder="TechCorp Global" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="current_designation">Verified Designation</Label>
                <Input id="current_designation" {...register('current_designation')} placeholder="Lead Product Architect" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="start_date">Start Year / Date</Label>
                <Input id="start_date" {...register('start_date')} placeholder="2022" className="mt-1" />
              </div>
              <div>
                <Label>Rehire Eligibility Flag</Label>
                <Select defaultValue="eligible" onValueChange={(val) => setValue('rehire_eligibility', val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligible">Eligible for Rehire (Good Standing)</SelectItem>
                    <SelectItem value="policy_neutral">Policy Neutral</SelectItem>
                    <SelectItem value="ineligible">Ineligible for Rehire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Identity Documents (Masked) */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Privacy-Masked Identity Tokens</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aadhaar_last4">Aadhaar (Last 4 digits only)</Label>
                <Input id="aadhaar_last4" maxLength={4} {...register('aadhaar_last4')} placeholder="e.g. 9812" className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="pan_masked">PAN (Last 4 characters)</Label>
                <Input id="pan_masked" maxLength={10} {...register('pan_masked')} placeholder="e.g. ABCDE1234F" className="mt-1 font-mono uppercase" />
              </div>
              <div>
                <Label htmlFor="driving_license">Driving License / State ID</Label>
                <Input id="driving_license" {...register('driving_license')} placeholder="DL-XXXXXXXXX" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="passport_masked">Passport (Last 4 characters)</Label>
                <Input id="passport_masked" maxLength={9} {...register('passport_masked')} placeholder="e.g. A1234567" className="mt-1 font-mono uppercase" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Location</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} placeholder="San Francisco / Mumbai" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} placeholder="United States / India" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Competencies & Skills</h4>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Type skill and press Enter (e.g., React, System Architecture)"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addSkill} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="ml-1 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Professional Profiles</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input id="linkedin_url" {...register('linkedin_url')} placeholder="https://linkedin.com/in/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="github_url">GitHub URL</Label>
                <Input id="github_url" {...register('github_url')} placeholder="https://github.com/..." className="mt-1" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2 bg-gradient-to-r from-primary to-purple-600">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <ShieldCheck className="h-4 w-4" />
              Register in Trust Vault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
