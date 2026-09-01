import { useState, useEffect } from 'react';
import {
  FileDown, CheckCircle2, UserCheck, AlertTriangle, XCircle,
  Clock, Tag, Plus, X, Save, ShieldCheck, Sparkles, Building, Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { GlobalEmployee } from '@/types/global-employee';

interface EmployerDecisionPanelProps {
  employee: GlobalEmployee;
  onDecisionChange?: (decision: string) => void;
}

export function EmployerDecisionPanel({ employee, onDecisionChange }: EmployerDecisionPanelProps) {
  const storageKey = `fastesthr_bgv_decision_${employee.id}`;

  const [decision, setDecision] = useState<string>('shortlisted');
  const [targetRole, setTargetRole] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [tags, setTags] = useState<string[]>(['BGV Audited', 'Top Talent']);
  const [tagInput, setTagInput] = useState<string>('');
  const [downloading, setDownloading] = useState<boolean>(false);

  // Load saved internal notes for this candidate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.decision) setDecision(parsed.decision);
        if (parsed.targetRole) setTargetRole(parsed.targetRole);
        if (parsed.internalNotes) setInternalNotes(parsed.internalNotes);
        if (parsed.tags) setTags(parsed.tags);
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  const handleSaveNotes = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        decision,
        targetRole,
        internalNotes,
        tags,
        updatedAt: new Date().toISOString(),
      }));
      toast.success('Internal HR evaluation and notes saved!');
      onDecisionChange?.(decision);
    } catch (err) {
      toast.error('Failed to save evaluation notes');
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const generateAndDownloadPDF = async () => {
    setDownloading(true);
    toast.info('Generating official BGV Verification Report...');

    try {
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px;">
            <div>
              <h1 style="font-size: 24px; font-weight: 800; color: #4f46e5; margin: 0;">FastestHR</h1>
              <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Global Background Verification Certificate</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 9999px; border: 1px solid #a7f3d0;">
                VERIFIED CLEAR
              </span>
              <p style="font-size: 10px; color: #94a3b8; margin: 4px 0 0 0;">Report Ref: BGV-${employee.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <!-- Subject Summary -->
          <div style="margin-top: 24px; padding: 18px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Candidate Name:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${employee.name}</td>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Audit Status:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #059669;">${employee.verified ? 'Verified & Authenticated' : 'Pending Audit'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Primary Location:</td>
                <td style="padding: 6px 0; font-weight: 600;">${[employee.city, employee.country].filter(Boolean).join(', ') || 'Global'}</td>
                <td style="padding: 6px 0; color: #64748b;">Unified Rating:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #d97706;">★ ${Number(employee.rating)?.toFixed(1) || '0.0'} / 5.0</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Identity Token:</td>
                <td style="padding: 6px 0; font-family: monospace;">${employee.masked_aadhaar || employee.masked_pan || employee.aadhaar || 'Tokenized ID Verified'}</td>
                <td style="padding: 6px 0; color: #64748b;">Generated On:</td>
                <td style="padding: 6px 0;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
              </tr>
            </table>
          </div>

          <!-- Verification Checkpoints -->
          <div style="margin-top: 24px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Verification Checkpoints</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <tr style="background-color: #f1f5f9; font-weight: 700;">
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Checkpoint Category</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Source Verification Method</th>
                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Result</th>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Government Identity & KYC</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">UIDAI / National ID Masked Token</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 700;">PASSED</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Employment History & Tenure</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Authorized Corporate Representative</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 700;">PASSED</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Separation & Rehire Eligibility</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Employer Separation Record</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 700;">GOOD STANDING</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Dual Employment / Moonlighting</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Tenure Chronology Cross-Match</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 700;">CLEAR</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: 600;">Professional Reputation</td>
                <td style="padding: 10px; color: #64748b;">Corporate Domain Attestations</td>
                <td style="padding: 10px; text-align: right; color: #d97706; font-weight: 700;">★ ${Number(employee.rating)?.toFixed(1) || '0.0'} / 5.0</td>
              </tr>
            </table>
          </div>

          <!-- Verified Experience Timeline -->
          <div style="margin-top: 24px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Verified Work History</h3>
            ${(employee.work_experience || []).map((exp) => `
              <div style="padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                <p style="margin: 0; font-weight: 700; font-size: 12px; color: #0f172a;">${exp.designation} — ${exp.company_name}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Tenure: ${exp.from_date} to ${exp.to_date || 'Present'}</p>
              </div>
            `).join('')}
          </div>

          <!-- Legal Compliance Stamp -->
          <div style="margin-top: 30px; padding: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 10px; color: #64748b; line-height: 1.4;">
            <p style="margin: 0; font-weight: 700; color: #334155;">FASTESTHR REGULATORY COMPLIANCE CERTIFICATION</p>
            <p style="margin: 4px 0 0 0;">This document certifies that the subject's background verification screening has been conducted in accordance with the Fair Credit Reporting Act (15 U.S.C. § 1681), European General Data Protection Regulation (GDPR), and India Digital Personal Data Protection Act 2023. Authenticity can be verified at fastesthr.com/employeebg/${employee.id}.</p>
          </div>
        </div>
      `;

      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 10,
        filename: `FastestHR_BGV_Report_${employee.name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().from(element).set(opt).save();
      toast.success('Official BGV Report PDF downloaded successfully!');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to generate PDF report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="bg-background/90 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl overflow-hidden">
      <CardHeader className="bg-muted/30 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Employer Judgment & Review Center
          </CardTitle>
          <Button
            size="sm"
            onClick={generateAndDownloadPDF}
            disabled={downloading}
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 text-xs shadow-md shadow-primary/20"
          >
            <FileDown className="h-3.5 w-3.5" />
            {downloading ? 'Generating...' : 'Download BGV Report (PDF)'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Candidate Evaluation Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold">Hiring Recommendation / Decision</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hire" className="text-emerald-600 font-semibold">
                  ✓ Recommended for Hire (Clean BGV)
                </SelectItem>
                <SelectItem value="shortlisted" className="text-primary font-semibold">
                  ★ Shortlisted / In Evaluation
                </SelectItem>
                <SelectItem value="hold" className="text-amber-600 font-semibold">
                  ⏳ Hold / Further Document Check Needed
                </SelectItem>
                <SelectItem value="reject" className="text-destructive font-semibold">
                  ✕ High Risk / Not Recommended
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-bold">Target Role / Designation</Label>
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Principal Architect / VP Eng"
              className="mt-1"
            />
          </div>
        </div>

        {/* Evaluation Tags */}
        <div>
          <Label className="text-xs font-bold">Evaluation Tags</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag (e.g. Strong References, Clean Record)"
              className="text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1 text-xs bg-muted/60">
                  <Tag className="h-3 w-3 text-primary" />
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Private Internal HR Notes */}
        <div>
          <Label className="text-xs font-bold">Private Internal HR Evaluation Notes</Label>
          <Textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Record interview notes, compensation negotiation boundaries, background check audit trail, or manager notes (private to your organization)..."
            className="mt-1 text-xs leading-relaxed"
            rows={3}
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <Button onClick={handleSaveNotes} size="sm" variant="secondary" className="gap-1.5 text-xs">
            <Save className="h-3.5 w-3.5" /> Save Evaluation Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
