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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  aadhaar: z.string().optional(),
  pan: z.string().optional(),
  driving_license: z.string().optional(),
  passport: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  profile_picture: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  isPublic: z.boolean().default(true),
  linkedin_url: z.string().url().or(z.literal('')).optional(),
  github_url: z.string().url().or(z.literal('')).optional(),
  twitter_url: z.string().url().or(z.literal('')).optional(),
  facebook_url: z.string().url().or(z.literal('')).optional(),
  instagram_url: z.string().url().or(z.literal('')).optional(),
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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: 'India',
      isPublic: true,
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
      const { error } = await supabase.from('global_employee' as any).insert({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        aadhaar: data.aadhaar || null,
        pan: data.pan || null,
        driving_license: data.driving_license || null,
        passport: data.passport || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || 'India',
        pincode: data.pincode || null,
        profile_picture: data.profile_picture || null,
        public: true,
        skills: skills,
        linkedin_url: data.linkedin_url || null,
        github_url: data.github_url || null,
        twitter_url: data.twitter_url || null,
        facebook_url: data.facebook_url || null,
        instagram_url: data.instagram_url || null,
        added_by_user_id: profile?.id,
        added_by_company_id: profile?.company_id,
      } as any);

      if (error) throw error;

      toast.success('Employee added to Global Verification Portal');
      reset();
      setSkills([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Add employee error:', err);
      toast.error(err.message || 'Failed to add employee');
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
            Add Employee / Candidate
          </DialogTitle>
          <DialogDescription>
            Add a new employee or candidate to the Global Verification Portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Info */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Personal Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" {...register('name')} placeholder="John Doe" className="mt-1" />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="john@example.com" className="mt-1" />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} placeholder="+91 9876543210" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="profile_picture">Profile Picture URL</Label>
                <Input id="profile_picture" {...register('profile_picture')} placeholder="https://..." className="mt-1" />
              </div>
            </div>
          </div>

          {/* Identity Documents */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Identity Documents</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input id="aadhaar" {...register('aadhaar')} placeholder="XXXX XXXX XXXX" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pan">PAN Number</Label>
                <Input id="pan" {...register('pan')} placeholder="ABCDE1234F" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="driving_license">Driving License</Label>
                <Input id="driving_license" {...register('driving_license')} placeholder="DL-XXXXXXXXX" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="passport">Passport Number</Label>
                <Input id="passport" {...register('passport')} placeholder="A1234567" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Address</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Textarea id="address" {...register('address')} placeholder="123 Main Street" className="mt-1" rows={2} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} placeholder="Mumbai" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register('state')} placeholder="Maharashtra" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} placeholder="India" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" {...register('pincode')} placeholder="400001" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Skills</h4>
            <div className="flex gap-2">
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
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Social Links</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="linkedin_url">LinkedIn</Label>
                <Input id="linkedin_url" {...register('linkedin_url')} placeholder="https://linkedin.com/in/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="github_url">GitHub</Label>
                <Input id="github_url" {...register('github_url')} placeholder="https://github.com/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="twitter_url">Twitter / X</Label>
                <Input id="twitter_url" {...register('twitter_url')} placeholder="https://x.com/..." className="mt-1" />
              </div>
              <div>
                <Label htmlFor="instagram_url">Instagram</Label>
                <Input id="instagram_url" {...register('instagram_url')} placeholder="https://instagram.com/..." className="mt-1" />
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
            <div>
              <p className="text-sm font-semibold text-foreground">Public Profile</p>
              <p className="text-xs text-muted-foreground">Anyone can search and view this employee's details. The profile will always be public.</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-blue-400 border-blue-400/20 bg-blue-500/10 shrink-0">
              Always Public
            </Badge>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
