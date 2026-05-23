import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Briefcase, Clock } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { RepeatableFieldGroup } from '../components/RepeatableFieldGroup';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WorkExperienceProps {
  employee: any;
  refetch: () => void;
}

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <p className="text-sm font-medium text-foreground py-1">
        {value || <span className="text-muted-foreground italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

interface CompanyEntry {
  company_name: string; job_title: string; department: string; employment_type: string;
  start_date: string; end_date: string; currently_working: boolean; location: string;
  responsibilities: string; manager_name: string; manager_contact: string;
  reason_leaving: string; experience_cert_doc: string; relieving_doc: string;
  salary_slips_doc: string; offer_letter_doc: string;
}

interface GapEntry { from: string; to: string; reason: string; activities: string; }

function calcDuration(start: string, end: string, current: boolean): string {
  if (!start) return '';
  const s = new Date(start);
  const e = current ? new Date() : (end ? new Date(end) : new Date());
  const months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? 's' : ''}`;
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} yr${years !== 1 ? 's' : ''} ${rem} mo${rem !== 1 ? 's' : ''}`;
}

function calcTotalExp(companies: CompanyEntry[]): string {
  let totalMonths = 0;
  for (const c of companies) {
    if (!c.start_date) continue;
    const s = new Date(c.start_date);
    const e = c.currently_working ? new Date() : (c.end_date ? new Date(c.end_date) : new Date());
    totalMonths += (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
}

export default function WorkExperience({ employee, refetch }: WorkExperienceProps) {
  const cf = employee.custom_fields || {};
  const we = cf.work_experience || {};
  const storagePath = `${employee.company_id}/${employee.id}/work`;

  const [companies, setCompanies] = useState<CompanyEntry[]>(we.companies?.length ? we.companies : []);
  const [manualExp, setManualExp] = useState(we.manual_exp || '');
  const [gaps, setGaps] = useState<GapEntry[]>(we.gaps?.length ? we.gaps : []);

  const totalExp = useMemo(() => calcTotalExp(companies), [companies]);

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        work_experience: { companies, manual_exp: manualExp, gaps },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Work experience saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      <ProfileSectionCard title="Previous Employment History" icon={<Briefcase className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<CompanyEntry>
            items={companies}
            onChange={setCompanies}
            label="Company"
            createEmpty={() => ({
              company_name: '', job_title: '', department: '', employment_type: '',
              start_date: '', end_date: '', currently_working: false, location: '',
              responsibilities: '', manager_name: '', manager_contact: '',
              reason_leaving: '', experience_cert_doc: '', relieving_doc: '',
              salary_slips_doc: '', offer_letter_doc: '',
            })}
            renderItem={(item, idx, update) => (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Name</label>
                    <Input value={item.company_name} onChange={(e) => update('company_name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Title / Designation</label>
                    <Input value={item.job_title} onChange={(e) => update('job_title', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</label>
                    <Input value={item.department} onChange={(e) => update('department', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employment Type</label>
                    <select value={item.employment_type} onChange={(e) => update('employment_type', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                      <option value="">— Select —</option>
                      {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</label>
                    <Input type="date" value={item.start_date} onChange={(e) => update('start_date', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</label>
                    <div className="space-y-2">
                      <Input type="date" value={item.end_date} onChange={(e) => update('end_date', e.target.value)}
                        className="bg-background border-border/50 text-sm h-10 shadow-sm" disabled={item.currently_working} />
                      <div className="flex items-center gap-2">
                        <Checkbox id={`cw-${idx}`} checked={item.currently_working}
                          onCheckedChange={(c) => update('currently_working', !!c)} />
                        <label htmlFor={`cw-${idx}`} className="text-xs text-muted-foreground cursor-pointer">Currently Working</label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</label>
                    <p className="text-sm text-foreground py-2.5 px-3 bg-muted/20 rounded-md border border-border/30">
                      {calcDuration(item.start_date, item.end_date, item.currently_working) || '—'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location/City</label>
                    <Input value={item.location} onChange={(e) => update('location', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Responsibilities</label>
                  <Textarea value={item.responsibilities} onChange={(e) => update('responsibilities', e.target.value)}
                    rows={3} className="bg-background border-border/50 text-sm shadow-sm resize-none" />
                </div>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reporting Manager Name</label>
                    <Input value={item.manager_name} onChange={(e) => update('manager_name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manager Contact</label>
                    <Input value={item.manager_contact} onChange={(e) => update('manager_contact', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason for Leaving</label>
                    <Input value={item.reason_leaving} onChange={(e) => update('reason_leaving', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                  </div>
                  <FileUploadField label="Upload Experience Certificate" value={item.experience_cert_doc} onChange={(url) => update('experience_cert_doc', url || '')} path={storagePath} />
                  <FileUploadField label="Upload Relieving Letter" value={item.relieving_doc} onChange={(url) => update('relieving_doc', url || '')} path={storagePath} />
                  <FileUploadField label="Upload Last 3 Months Salary Slips" value={item.salary_slips_doc} onChange={(url) => update('salary_slips_doc', url || '')} path={storagePath} />
                  <FileUploadField label="Upload Offer Letter" value={item.offer_letter_doc} onChange={(url) => update('offer_letter_doc', url || '')} path={storagePath} />
                </div>
              </div>
            )}
          />
        ) : companies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No work experience added</p>
        ) : (
          <div className="space-y-4">
            {companies.map((c, i) => (
              <div key={i} className="rounded-xl border border-border/30 p-5 bg-muted/5 hover:border-border/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{c.job_title || 'Untitled Role'}</h4>
                    <p className="text-xs text-primary font-medium">{c.company_name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full">
                    {calcDuration(c.start_date, c.end_date, c.currently_working)}
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <span className="text-muted-foreground">{c.start_date} → {c.currently_working ? 'Present' : c.end_date}</span>
                  <span className="text-muted-foreground">{c.employment_type}</span>
                  <span className="text-muted-foreground">{c.location}</span>
                </div>
                {c.responsibilities && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{c.responsibilities}</p>}
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Total Experience */}
      <ProfileSectionCard title="Total Experience" icon={<Clock className="h-4 w-4 text-primary/70" />} onSave={handleSave} readOnly={!companies.length}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Auto-calculated</label>
              <p className="text-sm font-semibold text-primary py-2">{totalExp || 'No experience data'}</p>
            </div>
            {editing ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Entry (Override)</label>
                <Input value={manualExp} onChange={(e) => setManualExp(e.target.value)}
                  placeholder="e.g. 5 years 3 months" className="bg-background border-border/50 text-sm h-10 shadow-sm" />
              </div>
            ) : manualExp ? (
              <FieldView label="Manual Entry" value={manualExp} />
            ) : null}
          </div>
        )}
      </ProfileSectionCard>

      {/* Employment Gaps */}
      <ProfileSectionCard title="Employment Gap Explanation" icon={<Clock className="h-4 w-4 text-amber-500/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<GapEntry>
            items={gaps}
            onChange={setGaps}
            label="Gap Period"
            createEmpty={() => ({ from: '', to: '', reason: '', activities: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</label>
                  <Input type="date" value={item.from} onChange={(e) => update('from', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</label>
                  <Input type="date" value={item.to} onChange={(e) => update('to', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</label>
                  <Input value={item.reason} onChange={(e) => update('reason', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activities During Gap</label>
                  <Textarea value={item.activities} onChange={(e) => update('activities', e.target.value)} rows={2} className="bg-background border-border/50 text-sm shadow-sm resize-none" />
                </div>
              </div>
            )}
          />
        ) : gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No employment gaps reported</p>
        ) : (
          <div className="space-y-3">
            {gaps.map((g, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-2 gap-4">
                <FieldView label="Period" value={`${g.from} → ${g.to}`} />
                <FieldView label="Reason" value={g.reason} />
                {g.activities && <div className="sm:col-span-2"><FieldView label="Activities" value={g.activities} /></div>}
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
