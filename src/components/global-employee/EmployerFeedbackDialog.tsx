import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Star, MessageSquarePlus } from 'lucide-react';
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
  const [hoveredStar, setHoveredStar] = useState(0);
  const [rating, setRating] = useState(0);
  const [employerName, setEmployerName] = useState(profile?.full_name || '');
  const [companyName, setCompanyName] = useState('');
  const [feedback, setFeedback] = useState('');

  const onSubmit = async () => {
    if (!rating) {
      toast.error('Please select a rating');
      return;
    }
    if (!employerName.trim()) {
      toast.error('Employer name is required');
      return;
    }
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!feedback.trim()) {
      toast.error('Please provide your feedback');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('add_global_employee_feedback', {
        p_employee_id: employeeId,
        p_employer_name: employerName.trim(),
        p_company_name: companyName.trim(),
        p_feedback: feedback.trim(),
        p_rating: rating,
        p_added_by_id: profile?.id || 'anonymous',
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(`Feedback submitted! New rating: ${result.new_rating}`);
        onOpenChange(false);
        setRating(0);
        setFeedback('');
        setCompanyName('');
        onSuccess?.();
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (err: any) {
      console.error('Feedback error:', err);
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const starLabels = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Rate & Review
          </DialogTitle>
          <DialogDescription>
            Submit your employer feedback for <span className="font-semibold text-foreground">{employeeName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-colors"
                  >
                    <Star
                      className={`h-8 w-8 transition-all duration-200 ${
                        star <= (hoveredStar || rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    />
                  </motion.button>
                ))}
              </div>
              {(hoveredStar || rating) > 0 && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm font-medium text-amber-400"
                >
                  {starLabels[(hoveredStar || rating) - 1]}
                </motion.span>
              )}
            </div>
          </div>

          {/* Employer Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employer_name">Your Name *</Label>
              <Input
                id="employer_name"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                placeholder="Your full name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company"
                className="mt-1"
              />
            </div>
          </div>

          {/* Feedback */}
          <div>
            <Label htmlFor="feedback">Feedback *</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your experience working with this employee/candidate. Comment on their professionalism, commitment, integrity, and work ethic..."
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your feedback helps build a trusted employer community.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
