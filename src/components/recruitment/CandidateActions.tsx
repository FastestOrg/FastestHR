import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ArrowRight, XCircle, Trash2, Loader2, Send, Star, Sparkles, Bot, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { OfferDetailsDialog } from './OfferDetailsDialog';
import { generateAndUploadOfferPDF, replaceHtmlVariables } from '@/lib/pdf-generator';
import { EditScoreDialog } from './EditScoreDialog';
import { SendAIInterviewDialog } from './SendAIInterviewDialog';


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

interface CandidateActionsProps {
  candidateId: string;
  jobId: string;
  currentStage: string;
  pipelineStages?: string[];
  candidateName: string;
  score: number | null;
}

export function CandidateActions({ 
  candidateId, 
  jobId, 
  currentStage, 
  pipelineStages = [],
  candidateName,
  score 
}: CandidateActionsProps) {
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isAIInterviewDialogOpen, setIsAIInterviewDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [candidate, setCandidate] = useState<{ full_name: string } | null>(null);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [existingOffer, setExistingOffer] = useState<{ joining_date: string, payout: number, custom_variable_values?: Record<string, string> } | null>(null);
  const [templateCustomVariables, setTemplateCustomVariables] = useState<any[]>([]);
  const [jobEmploymentType, setJobEmploymentType] = useState<string | undefined>();
  
  const { data: latestOffer } = useQuery({
    queryKey: ['candidate-offer', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_offers')
        .select('token, status')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: currentStage === 'offer' || currentStage === 'hired',
  });

  const executeAutomations = async (newStage: string, offerData?: { joiningDate: string; payout: number; customVariableValues?: Record<string, string>; totalDuration?: number }) => {
    try {
      // Fetch job settings to get automations
      const { data: job, error } = await supabase
        .from('jobs')
        .select('stage_automations, company_id')
        .eq('id', jobId)
        .single();

      if (error || !job) return;

      // Handle Automated Onboarding (Candidate -> Employee)
      if (newStage === 'hired') {
        toast.info('Transitioning candidate to employee profile...');
        
        // 1. Fetch candidate information
        const { data: cand } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single();
          
        if (cand) {
          // 2. Fetch the latest offer details
          const { data: offer } = await supabase
            .from('candidate_offers')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // 3. Fetch job details (to get designation/employment_type)
          const { data: jobDetails } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .maybeSingle();

          // 4. Check if employee already exists with personal_email
          const { data: existingEmp } = await supabase
            .from('employees')
            .select('id')
            .eq('personal_email', cand.email)
            .is('deleted_at', null)
            .maybeSingle();

          let employeeId = existingEmp?.id;

          if (!employeeId) {
            // Split candidate full name into first and last name
            const names = (cand.full_name || '').trim().split(/\s+/);
            const firstName = names[0] || 'First';
            const lastName = names.slice(1).join(' ') || 'Last';

            // Generate employee code
            const empCode = `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

            // Insert employee
            const { data: newEmp, error: empErr } = await supabase
              .from('employees')
              .insert({
                company_id: cand.company_id,
                first_name: firstName,
                last_name: lastName,
                personal_email: cand.email,
                phone: cand.phone,
                date_of_joining: offer?.joining_date || new Date().toISOString().split('T')[0],
                status: 'probation',
                employee_code: empCode,
                employment_type: (jobDetails?.employment_type as any) || 'full_time'
              })
              .select('id')
              .single();

            if (empErr) {
              console.error('Error inserting employee:', empErr);
              toast.error(`Employee profile creation failed: ${empErr.message}`);
            } else {
              employeeId = newEmp.id;
              toast.success(`Created Employee profile for ${cand.full_name}`);
            }
          } else {
            toast.info(`Employee profile already exists for ${cand.full_name}`);
          }

          // 5. If we have employeeId, ensure salary structure is created
          if (employeeId) {
            const { data: existingStructure } = await supabase
              .from('salary_structures')
              .select('id')
              .eq('employee_id', employeeId)
              .maybeSingle();

            if (!existingStructure) {
              // Fetch company details to get compensation_structure
              const { data: comp } = await supabase
                .from('companies')
                .select('compensation_structure')
                .eq('id', cand.company_id)
                .single();

              const compStructure = (comp?.compensation_structure as any) || {
                basic_pay: 50,
                dearness_allowance: 10,
                house_rental: 20,
                conveyance_allowance: 5,
                special_allowance: 10,
                medical_insurance: 5
              };

              const annualGross = offer?.payout || 500000; // default to a standard 5 LPA or offer payout

              // Calculate individual component amounts based on percentage splits
              const components = [
                { name: 'Basic Pay', amount: Math.round((annualGross * (Number(compStructure.basic_pay) || 0)) / 100) },
                { name: 'Dearness Allowance', amount: Math.round((annualGross * (Number(compStructure.dearness_allowance) || 0)) / 100) },
                { name: 'House Rental Allowance', amount: Math.round((annualGross * (Number(compStructure.house_rental) || 0)) / 100) },
                { name: 'Conveyance Allowance', amount: Math.round((annualGross * (Number(compStructure.conveyance_allowance) || 0)) / 100) },
                { name: 'Special Allowance', amount: Math.round((annualGross * (Number(compStructure.special_allowance) || 0)) / 100) },
                { name: 'Medical Insurance', amount: Math.round((annualGross * (Number(compStructure.medical_insurance) || 0)) / 100) }
              ];

              const { error: salErr } = await supabase
                .from('salary_structures')
                .insert({
                  company_id: cand.company_id,
                  employee_id: employeeId,
                  gross_salary: annualGross,
                  effective_from: offer?.joining_date || new Date().toISOString().split('T')[0],
                  components: components as any
                });

              if (salErr) {
                console.error('Error inserting salary structure:', salErr);
                toast.error(`Salary structure creation failed: ${salErr.message}`);
              } else {
                toast.success('Generated salary structure matching negotiated CTC.');
              }
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ['new-hires'] });
        queryClient.invalidateQueries({ queryKey: ['employees'] });
      }

      let automations = (job as any).stage_automations?.[newStage];
      
      // If moving to offer, we inherently need to send the offer
      if (newStage === 'offer' && offerData) {
        automations = automations || {};
        automations.send_email = true;
      }

      if (!automations) return;

      if (automations.send_email && newStage === 'offer' && offerData) {
        // Resolve offer_template_id from automation config
        const templateId = automations.offer_template_id;
        if (!templateId) {
          toast.error('No offer template configured! Go to Job Settings → Stage Automation → Offer to set one.');
          return;
        }

        toast.info('Automation: Generating offer letter PDF...');
        
        // 1. Fetch required data for PDF (including email_subject and email_body from template)
        // Execute independent queries in parallel
        const [
          { data: template },
          { data: candidateInfo },
          { data: jobInfo },
          { data: companyInfo }
        ] = await Promise.all([
          supabase.from('offer_templates').select('*').eq('id', templateId).single(),
          supabase.from('candidates').select('full_name, email').eq('id', candidateId).single(),
          supabase.from('jobs').select('title').eq('id', jobId).single(),
          supabase.from('companies').select('offer_sequence_prefix, timezone, currency, compensation_structure').eq('id', (job as any).company_id).single()
        ]);
        
        if (!template) {
          toast.error('Offer template not found. Please check your template configuration.');
          return;
        }

        // 2. Fetch Offer Sequence
        const { data: offerSequence } = await supabase.rpc('increment_offer_sequence', { p_company_id: (job as any).company_id });
        const offerNumberStr = `${companyInfo?.offer_sequence_prefix || 'OFFER-'}${offerSequence?.toString().padStart(4, '0')}`;
        
        const rawHtml = template.html_content;
        
        // Evaluate current_date variables
        const timezone = companyInfo?.timezone || 'UTC';
        const currentDateStr = new Date().toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric' });
        
        const finalCustomValues = { ...(offerData.customVariableValues || {}) };
        templateCustomVariables.forEach(cv => {
          if (cv.type === 'current_date') {
            finalCustomValues[cv.key] = currentDateStr;
          }
        });

        // Add Total Duration and calculate Last Date if applicable
        if (offerData.totalDuration) {
          finalCustomValues['Total Duration'] = offerData.totalDuration.toString();
          const parts = offerData.joiningDate.split('-');
          if (parts.length === 3) {
            const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            startDate.setDate(startDate.getDate() + offerData.totalDuration);
            finalCustomValues['Last Date'] = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          } else {
            const fallbackDate = new Date(offerData.joiningDate);
            fallbackDate.setDate(fallbackDate.getDate() + offerData.totalDuration);
            finalCustomValues['Last Date'] = isNaN(fallbackDate.getTime()) ? '' : fallbackDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          }
        }
        
        // 3. Generate and Upload PDF (which also runs embedded scripts)
        const { pdfPath, manipulatedHtml: finalHtml } = await generateAndUploadOfferPDF({
          htmlContent: rawHtml,
          letterheadUrl: template.letterhead_url,
          candidateName: candidateInfo!.full_name,
          jobTitle: jobInfo!.title,
          joiningDate: offerData.joiningDate,
          payout: offerData.payout,
          offerNumber: offerNumberStr,
          companyId: (job as any).company_id,
          candidateId: candidateId,
          isPredefinedHtml: template.is_predefined_html,
          customVariableValues: finalCustomValues,
          currency: companyInfo?.currency || 'USD',
          today: currentDateStr,
          compensationStructure: (companyInfo as any)?.compensation_structure || null
        });

        toast.info('Sending offer letter email with attachment...');
        
        const { data, error: fnError } = await supabase.functions.invoke('send-offer-letter', {
          body: { 
            candidate_id: candidateId, 
            job_id: jobId, 
            company_id: (job as any).company_id,
            offer_data: {
              ...offerData,
              custom_variable_values: finalCustomValues
            },
            html_content: finalHtml,
            pdf_path: pdfPath,
            offer_number: offerNumberStr,
            template_id: templateId,
            is_predefined_html: template.is_predefined_html
          }
        });
        
        if (fnError || data?.error) {
          console.error('Edge function error:', fnError || data?.error);
          toast.error(`Failed to send offer letter: ${data?.error || fnError?.message}`);
        } else {
          toast.success('Offer letter sent successfully!');
        }
      } else if (automations.send_email) {
        toast.info(`Automation: Sending ${(automations.email_template || 'notification').replace(/_/g, ' ')} email...`);
        // generic email automation logic (mocked for now as per existing)
      }

      if (automations.notify_team) {
        toast.info(`Automation: Notifying hiring team...`);
      }
    } catch (err) {
      console.error('Automation error:', err);
    }
  };

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from('candidates')
        .update({ stage: newStage as any })
        .eq('id', candidateId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      toast.success(variables === 'hired' 
        ? 'This user has been hired successfully and joined in the company'
        : `Candidate moved to ${variables}`);
      if (variables !== 'offer') {
        executeAutomations(variables);
      }
    },
    onError: (error) => {
      console.error('Error updating stage:', error);
      toast.error('Failed to update candidate stage');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', candidateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      toast.success('Candidate deleted successfully');
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error deleting candidate:', error);
      toast.error('Failed to delete candidate');
    }
  });

  const handleMoveNext = async () => {
    if (currentStage === 'hired' || currentStage === 'rejected') return;
    const currentIndex = pipelineStages.indexOf(currentStage);
    const nextStage = pipelineStages[currentIndex + 1];
    
    if (nextStage === 'offer') {
      // Fetch job settings and candidate info in parallel
      const [
        { data: job },
        { data }
      ] = await Promise.all([
        supabase.from('jobs').select('stage_automations, employment_type').eq('id', jobId).single(),
        supabase.from('candidates').select('full_name').eq('id', candidateId).single()
      ]);

      setJobEmploymentType((job as any)?.employment_type);
      setCandidate(data);

      const templateId = (job as any)?.stage_automations?.['offer']?.offer_template_id;
      if (templateId) {
        const { data: template } = await supabase.from('offer_templates').select('custom_variables').eq('id', templateId).single();
        if (template?.custom_variables) {
          setTemplateCustomVariables(template.custom_variables as any[]);
        } else {
          setTemplateCustomVariables([]);
        }
      } else {
        setTemplateCustomVariables([]);
      }

      setPendingStage(nextStage);
      setIsOfferDialogOpen(true);
    } else if (nextStage && nextStage !== 'rejected') {
      updateStageMutation.mutate(nextStage);
    }
  };

  const handleOfferConfirm = async (offerData: { joiningDate: string; payout: number; customVariableValues: Record<string, string>; totalDuration?: number }) => {
    setIsSubmittingOffer(true);
    try {
      await executeAutomations(pendingStage || currentStage, offerData);
      
      // Update the stage if we are moving forward, not if we are just resending
      if (pendingStage && pendingStage !== currentStage) {
        await updateStageMutation.mutateAsync(pendingStage!);
      } else {
        queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      }
      
      setIsOfferDialogOpen(false);
      setExistingOffer(null);
      setPendingStage(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process offer letter.');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleResendOffer = async () => {
    try {
      // Execute independent queries in parallel
      const [
        { data: candData },
        { data: job },
        { data: offerData }
      ] = await Promise.all([
        supabase.from('candidates').select('full_name').eq('id', candidateId).single(),
        supabase.from('jobs').select('stage_automations, employment_type').eq('id', jobId).single(),
        supabase
          .from('candidate_offers')
          .select('joining_date, payout, custom_variable_values')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      setCandidate(candData);
      setJobEmploymentType((job as any)?.employment_type);

      const templateId = (job as any)?.stage_automations?.['offer']?.offer_template_id;
      if (templateId) {
        const { data: template } = await supabase.from('offer_templates').select('custom_variables').eq('id', templateId).single();
        setTemplateCustomVariables(template?.custom_variables as any[] || []);
      } else {
        setTemplateCustomVariables([]);
      }

      if (offerData) {
        setExistingOffer({
          joining_date: offerData.joining_date || '',
          payout: offerData.payout || 0,
          custom_variable_values: (offerData.custom_variable_values as Record<string, string>) || {}
        });
      }
      
      setPendingStage(null);
      setIsOfferDialogOpen(true);
    } catch (err) {
      console.error('Error fetching existing offer:', err);
      toast.error('Failed to prepare offer resend.');
    }
  };

  const isNextDisabled = currentStage === 'hired' || currentStage === 'rejected' || updateStageMutation.isPending;

  const handleAnalyzeResume = async () => {
    setIsAnalyzing(true);
    toast.info('🔍 AI is analyzing the resume…');
    try {
      const { data, error } = await supabase.functions.invoke('ai-resume-ranker', {
        body: { candidateId, jobId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data?.results?.[0];
      if (result) {
        toast.success(`✦ AI Analysis complete — Score: ${result.score}/10`);
      } else {
        toast.success('AI Analysis complete!');
      }
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
    } catch (err: any) {
      toast.error(err?.message || 'AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
    <div className="flex items-center gap-1">
      {latestOffer?.token && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 text-primary hover:bg-primary/10 hover:text-primary transition-all font-bold uppercase tracking-tighter"
          onClick={() => window.open(`${window.location.origin}/offer/${latestOffer.token}`, '_blank')}
        >
          <ExternalLink className="h-3 w-3" />
          View Offer
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Candidate actions" className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleMoveNext} disabled={isNextDisabled}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Move to Next Step
          </DropdownMenuItem>
          {currentStage === 'offer' && (
            <DropdownMenuItem onClick={handleResendOffer} disabled={updateStageMutation.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Resend Offer Letter
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={handleAnalyzeResume}
            disabled={isAnalyzing}
            className="text-primary focus:text-primary"
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isAnalyzing ? 'Analyzing…' : 'Analyze with AI'}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => updateStageMutation.mutate('rejected' as any)}
            disabled={currentStage === 'rejected' || updateStageMutation.isPending}
            className="text-warning focus:text-warning"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsAIInterviewDialogOpen(true)} className="text-primary focus:text-primary">
            <Bot className="mr-2 h-4 w-4" />
            Send AI Interview Invite
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsScoreDialogOpen(true)}>
            <Star className="mr-2 h-4 w-4" />
            Edit Score
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Candidate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              candidate's profile and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OfferDetailsDialog 
        isOpen={isOfferDialogOpen}
        onClose={() => {
          setIsOfferDialogOpen(false);
          setExistingOffer(null);
        }}
        candidateName={candidate?.full_name || 'Candidate'}
        onConfirm={handleOfferConfirm}
        isSubmitting={isSubmittingOffer}
        defaultJoiningDate={existingOffer?.joining_date}
        defaultPayout={existingOffer?.payout}
        defaultCustomVariableValues={existingOffer?.custom_variable_values}
        customVariables={templateCustomVariables}
        jobEmploymentType={jobEmploymentType}
      />
      <EditScoreDialog
        isOpen={isScoreDialogOpen}
        onOpenChange={setIsScoreDialogOpen}
        candidateId={candidateId}
        candidateName={candidateName}
        currentScore={score}
        jobId={jobId}
      />
      <SendAIInterviewDialog
        isOpen={isAIInterviewDialogOpen}
        onOpenChange={setIsAIInterviewDialogOpen}
        candidateId={candidateId}
        candidateName={candidateName}
        jobId={jobId}
        stageName={currentStage}
      />
    </>
  );
}
