import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Star, ShieldCheck, CheckCircle2, Award, Briefcase, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface EmployerFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
}

export function EmployerFeedbackDialog({
  open, onOpenChange, employeeId, employeeName, onSuccess,
}: EmployerFeedbackDialogProps) {
  const { profile } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Reviewer credentials
  const [reviewerName, setReviewerName] = useState(profile?.full_name || '');
  const [reviewerEmail, setReviewerEmail] = useState(profile?.email || '');
  const [reviewerRole, setReviewerRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [relationship, setRelationship] = useState<string>('manager');

  // Objective tenure
  const [employmentStart, setEmploymentStart] = useState('');
  const [employmentEnd, setEmploymentEnd] = useState('');
  const [officialDesignation, setOfficialDesignation] = useState('');
  const [rehireEligibility, setRehireEligibility] = useState<string>('eligible');

  // Unified Overall Rating (1 to 5)
  const [rating, setRating] = useState<number>(5);
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  // Qualitative notes
  const [strengths, setStrengths] = useState('');
  const [growthAreas, setGrowthAreas] = useState('');
  const [complianceCertified, setComplianceCertified] = useState(false);

  const extractDomain = (email: string) => {
    const parts = email.split('@');
    if (parts.length === 2 && parts[1].includes('.')) {
      setCompanyDomain(parts[1].toLowerCase());
    }
  };

  const ratingLabels = [
    'Unsatisfactory (1.0)',
    'Needs Improvement (2.0)',
    'Meets Expectations / Competent (3.0)',
    'Exceeds Expectations / Strong (4.0)',
    'Exceptional / Outstanding (5.0)',
  ];

  const onSubmit = async () => {
    if (!reviewerName.trim() || !reviewerEmail.trim() || !companyName.trim()) {
      toast.error('Reviewer name, email, and company are required');
      setStep(1);
      return;
    }
    if (!officialDesignation.trim()) {
      toast.error('Official designation is required');
      setStep(2);
      return;
    }
    if (!rating) {
      toast.error('Please select an overall rating');
      setStep(3);
      return;
    }
    if (!strengths.trim()) {
      toast.error('Please provide notable strengths or performance feedback');
      setStep(3);
      return;
    }
    if (!complianceCertified) {
      toast.error('Please certify compliance and accuracy to proceed');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('add_global_employee_structured_attestation', {
        p_employee_id: employeeId,
        p_reviewer_name: reviewerName.trim(),
        p_reviewer_email: reviewerEmail.trim(),
        p_reviewer_role: reviewerRole.trim() || 'Verified Official',
        p_company_name: companyName.trim(),
        p_company_domain: companyDomain.trim() || reviewerEmail.split('@')[1] || '',
        p_relationship: relationship,
        p_employment_start: employmentStart.trim() || 'N/A',
        p_employment_end: employmentEnd.trim() || 'Present',
        p_official_designation: officialDesignation.trim(),
        p_rehire_eligibility: rehireEligibility,
        p_technical_score: rating,
        p_teamwork_score: rating,
        p_problem_solving_score: rating,
        p_integrity_score: rating,
        p_strengths: strengths.trim(),
        p_growth_areas: growthAreas.trim(),
        p_added_by_id: profile?.id || 'anonymous_hr',
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(`Attestation recorded! Unified overall rating: ${result.overall_rating}`);
        onOpenChange(false);
        setStep(1);
        onSuccess?.();
      } else {
        throw new Error('Failed to record attestation');
      }
    } catch (err: any) {
      console.error('Attestation submission error:', err);
      toast.error(err.message || 'Failed to submit attestation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verified Professional Attestation & Rating
          </DialogTitle>
          <DialogDescription>
            Submit an objective, unified rating and verified employment record for <span className="font-semibold text-foreground">{employeeName}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between py-2 border-b border-border/40 text-xs">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 font-medium ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-primary text-white' : 'bg-muted'}`}>1</div>
            Reviewer Identity
          </button>
          <div className="h-px w-8 bg-border" />
          <button
            onClick={() => setStep(2)}
            className={`flex items-center gap-1.5 font-medium ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-primary text-white' : 'bg-muted'}`}>2</div>
            Tenure & Role
          </button>
          <div className="h-px w-8 bg-border" />
          <button
            onClick={() => setStep(3)}
            className={`flex items-center gap-1.5 font-medium ${step === 3 ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-primary text-white' : 'bg-muted'}`}>3</div>
            Rating & Feedback
          </button>
        </div>

        <div className="py-3">
          {/* STEP 1: REVIEWER IDENTITY */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Anti-Fraud & Domain Verification:</span> Attestations submitted via authorized corporate domains receive high-trust verification badges.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rev_name">Your Full Name *</Label>
                  <Input
                    id="rev_name"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Jane Smith"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rev_email">Official Corporate Email *</Label>
                  <Input
                    id="rev_email"
                    type="email"
                    value={reviewerEmail}
                    onChange={(e) => {
                      setReviewerEmail(e.target.value);
                      extractDomain(e.target.value);
                    }}
                    placeholder="jane@company.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="comp_name">Company / Organization *</Label>
                  <Input
                    id="comp_name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Technologies"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="comp_domain">Company Domain</Label>
                  <Input
                    id="comp_domain"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="acmetech.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rev_role">Your Designation / Title</Label>
                  <Input
                    id="rev_role"
                    value={reviewerRole}
                    onChange={(e) => setReviewerRole(e.target.value)}
                    placeholder="VP of Engineering / HR Director"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Working Relationship to Candidate *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Direct Manager / Supervisor</SelectItem>
                      <SelectItem value="peer">Colleague / Team Peer</SelectItem>
                      <SelectItem value="hr_officer">HR Manager / People Operations</SelectItem>
                      <SelectItem value="skip_level">Department Head / Skip-Level</SelectItem>
                      <SelectItem value="client">Client / External Stakeholder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: OBJECTIVE TENURE & ROLE */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/30 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Objective Fact-Based Confirmation:</span> Confirm official tenure dates and verified designation per corporate records.
              </div>

              <div>
                <Label htmlFor="cand_role">Candidate's Official Title / Designation *</Label>
                <Input
                  id="cand_role"
                  value={officialDesignation}
                  onChange={(e) => setOfficialDesignation(e.target.value)}
                  placeholder="Senior Software Engineer"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp_start">Start Date (MM/YYYY or YYYY)</Label>
                  <Input
                    id="emp_start"
                    value={employmentStart}
                    onChange={(e) => setEmploymentStart(e.target.value)}
                    placeholder="01/2022"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emp_end">End Date (or 'Present')</Label>
                  <Input
                    id="emp_end"
                    value={employmentEnd}
                    onChange={(e) => setEmploymentEnd(e.target.value)}
                    placeholder="Present"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Rehire Eligibility (per Company Policy) *</Label>
                <Select value={rehireEligibility} onValueChange={setRehireEligibility}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select eligibility status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligible">Eligible for Rehire (In Good Standing)</SelectItem>
                    <SelectItem value="policy_neutral">Policy Neutral (Company does not disclose)</SelectItem>
                    <SelectItem value="ineligible">Ineligible for Rehire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}

          {/* STEP 3: UNIFIED OVERALL RATING & QUALITATIVE OBSERVATIONS */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              {/* Unified Star Rating */}
              <div className="p-4 bg-muted/20 rounded-2xl border border-border/40 space-y-2.5">
                <Label className="text-sm font-bold flex items-center justify-between">
                  <span>Overall Unified Rating *</span>
                  <span className="text-xs font-mono font-bold text-amber-500">
                    {ratingLabels[(hoveredStar || rating) - 1]}
                  </span>
                </Label>
                
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform"
                    >
                      <Star
                        className={`h-9 w-9 transition-all duration-200 ${
                          star <= (hoveredStar || rating)
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Rate candidate's holistic professional performance, domain competence, and reliability.
                </p>
              </div>

              <div>
                <Label htmlFor="strengths">Notable Strengths & Performance Feedback *</Label>
                <Textarea
                  id="strengths"
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="Comment on their technical execution, teamwork, integrity, and core accomplishments..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="growth">Growth & Development Areas (Optional)</Label>
                <Textarea
                  id="growth"
                  value={growthAreas}
                  onChange={(e) => setGrowthAreas(e.target.value)}
                  placeholder="Constructive areas where the professional can further advance..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Compliance Acknowledgment */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 flex items-start gap-3">
                <Switch
                  checked={complianceCertified}
                  onCheckedChange={setComplianceCertified}
                  className="mt-0.5"
                />
                <div className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Compliance & Legal Attestation:</span> I certify that this reference is truthful, fact-based, and submitted in good faith without malice or discriminatory intent, in accordance with applicable labor standards and privacy regulations.
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between items-center pt-2">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as any)}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step < 3 ? (
            <Button type="button" onClick={() => setStep((s) => (s + 1) as any)}>
              Next Step
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={submitting} className="gap-2 bg-gradient-to-r from-primary to-purple-600">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              Submit Verified Attestation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
