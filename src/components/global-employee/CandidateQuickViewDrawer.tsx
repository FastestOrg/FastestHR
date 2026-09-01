import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, ShieldCheck, MapPin, Briefcase, ExternalLink,
  MessageSquarePlus, Lock, FileDown, User, Star, ArrowRight,
  Sparkles, Building2, Calendar
} from 'lucide-react';
import { BGVScorecard } from './BGVScorecard';
import { EmployerDecisionPanel } from './EmployerDecisionPanel';
import { StarRating } from './GlobalEmployeeCard';
import type { GlobalEmployee } from '@/types/global-employee';

interface CandidateQuickViewDrawerProps {
  employee: GlobalEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuditApprove?: (employee: GlobalEmployee) => void;
  onRequestConsent?: (employee: GlobalEmployee) => void;
  onSubmitAttestation?: (employee: GlobalEmployee) => void;
}

export function CandidateQuickViewDrawer({
  employee,
  open,
  onOpenChange,
  onAuditApprove,
  onRequestConsent,
  onSubmitAttestation,
}: CandidateQuickViewDrawerProps) {
  const navigate = useNavigate();

  if (!employee) return null;

  const initials = employee.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const workExp = employee.work_experience || [];
  const structuredRefs = employee.structured_references || [];
  const feedbacks = employee.feedbacks_by_employer || [];
  const totalReviews = structuredRefs.length + feedbacks.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-background/95 backdrop-blur-2xl border-l border-border/50 p-6 space-y-6">
        <SheetHeader className="pb-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/20 shadow-md rounded-2xl">
                <AvatarImage src={employee.profile_picture || ''} className="rounded-2xl object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-purple-600/30 text-primary text-xl font-bold rounded-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-xl font-extrabold">{employee.name}</SheetTitle>
                  {employee.verified && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                </div>

                {workExp.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {workExp[0].designation} at <span className="font-semibold text-foreground">{workExp[0].company_name}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1.5">
                  <StarRating rating={Number(employee.rating) || 0} />
                  <span className="text-xs font-bold font-mono text-foreground">
                    {Number(employee.rating) > 0 ? Number(employee.rating).toFixed(1) : '0.0'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/employeebg/${employee.id}`);
              }}
              className="gap-1.5 text-xs shrink-0 rounded-xl"
            >
              Full Passport <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </SheetHeader>

        {/* BGV Assessment Scorecard */}
        <div>
          <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2.5 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Background Verification Scorecard
          </h4>
          <BGVScorecard employee={employee} compact={true} />
        </div>

        <Separator />

        {/* Employer Judgment & Decision Panel */}
        <div>
          <EmployerDecisionPanel employee={employee} />
        </div>

        <Separator />

        {/* Verified Work History Preview */}
        {workExp.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-primary" /> Employment Tenure History
            </h4>
            <div className="space-y-2.5">
              {workExp.map((exp, i) => (
                <div key={i} className="p-3 bg-muted/20 rounded-xl border border-border/30 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{exp.designation}</p>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      Verified
                    </Badge>
                  </div>
                  <p className="text-muted-foreground font-medium">{exp.company_name}</p>
                  <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {exp.from_date} — {exp.to_date || 'Present'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Reviews Preview */}
        {structuredRefs.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <MessageSquarePlus className="h-4 w-4 text-primary" /> Verified Employer References
            </h4>
            <div className="space-y-2.5">
              {structuredRefs.map((ref) => (
                <div key={ref.id} className="p-3.5 bg-muted/20 rounded-xl border border-border/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{ref.reviewer_name} <span className="font-normal text-muted-foreground">({ref.reviewer_role})</span></p>
                    {ref.verified_domain && (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Domain Verified
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{ref.strengths}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Action Footer */}
        <div className="pt-4 border-t border-border/40 flex flex-wrap gap-2 justify-end">
          {onSubmitAttestation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSubmitAttestation(employee)}
              className="gap-1.5 text-xs rounded-xl"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" /> Attest Candidate
            </Button>
          )}

          {onRequestConsent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestConsent(employee)}
              className="gap-1.5 text-xs rounded-xl"
            >
              <Lock className="h-3.5 w-3.5" /> Request Full Dossier
            </Button>
          )}

          {!employee.verified && onAuditApprove && (
            <Button
              size="sm"
              onClick={() => onAuditApprove(employee)}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Audit & Approve
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
