import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { GraduationCap, Award, FileCheck } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { RepeatableFieldGroup } from '../components/RepeatableFieldGroup';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EducationQualificationsProps {
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

const QUALIFICATION_LEVELS = ['High School', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other'];

interface EducationEntry {
  level: string; degree: string; institution: string; specialization: string;
  year: string; grade: string; degree_doc: string; transcript_doc: string;
}
interface CertificationEntry {
  name: string; organization: string; cert_number: string; issue_date: string;
  expiry_date: string; validity: string; cert_doc: string;
}
interface LicenseEntry {
  type: string; number: string; authority: string; issue_date: string;
  expiry_date: string; license_doc: string;
}

export default function EducationQualifications({ employee, refetch }: EducationQualificationsProps) {
  const cf = employee.custom_fields || {};
  const edu = cf.education || {};
  const storagePath = `${employee.company_id}/${employee.id}/education`;

  const [academics, setAcademics] = useState<EducationEntry[]>(
    edu.academics?.length ? edu.academics : []
  );
  const [certifications, setCertifications] = useState<CertificationEntry[]>(
    edu.certifications?.length ? edu.certifications : []
  );
  const [licenses, setLicenses] = useState<LicenseEntry[]>(
    edu.licenses?.length ? edu.licenses : []
  );

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        education: { academics, certifications, licenses },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Education information saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Academic Education */}
      <ProfileSectionCard title="Academic Education" icon={<GraduationCap className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<EducationEntry>
            items={academics}
            onChange={setAcademics}
            label="Education"
            createEmpty={() => ({ level: '', degree: '', institution: '', specialization: '', year: '', grade: '', degree_doc: '', transcript_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qualification Level</label>
                  <select value={item.level} onChange={(e) => update('level', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    {QUALIFICATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Degree Name</label>
                  <Input value={item.degree} onChange={(e) => update('degree', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Institution/University</label>
                  <Input value={item.institution} onChange={(e) => update('institution', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Specialization/Major</label>
                  <Input value={item.specialization} onChange={(e) => update('specialization', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Year of Completion</label>
                  <Input type="number" min="1950" max="2030" value={item.year} onChange={(e) => update('year', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Percentage/CGPA/Grade</label>
                  <Input value={item.grade} onChange={(e) => update('grade', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <FileUploadField label="Upload Degree Certificate" value={item.degree_doc} onChange={(url) => update('degree_doc', url || '')} path={storagePath} />
                <FileUploadField label="Upload Transcripts/Marksheets" value={item.transcript_doc} onChange={(url) => update('transcript_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : academics.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No education records added</p>
        ) : (
          <div className="space-y-4">
            {academics.map((a, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5">
                <div className="grid sm:grid-cols-3 gap-4">
                  <FieldView label="Level" value={a.level} />
                  <FieldView label="Degree" value={a.degree} />
                  <FieldView label="Institution" value={a.institution} />
                  <FieldView label="Specialization" value={a.specialization} />
                  <FieldView label="Year" value={a.year} />
                  <FieldView label="Grade/CGPA" value={a.grade} />
                </div>
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Professional Certifications */}
      <ProfileSectionCard title="Professional Certifications" icon={<Award className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<CertificationEntry>
            items={certifications}
            onChange={setCertifications}
            label="Certification"
            createEmpty={() => ({ name: '', organization: '', cert_number: '', issue_date: '', expiry_date: '', validity: '', cert_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Certification Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issuing Organization</label>
                  <Input value={item.organization} onChange={(e) => update('organization', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Certification Number</label>
                  <Input value={item.cert_number} onChange={(e) => update('cert_number', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue Date</label>
                  <Input type="date" value={item.issue_date} onChange={(e) => update('issue_date', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                  <Input type="date" value={item.expiry_date} onChange={(e) => update('expiry_date', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validity Status</label>
                  <select value={item.validity} onChange={(e) => update('validity', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    <option value="Valid">Valid</option>
                    <option value="Expired">Expired</option>
                    <option value="Renewal Pending">Renewal Pending</option>
                  </select>
                </div>
                <FileUploadField label="Upload Certificate" value={item.cert_doc} onChange={(url) => update('cert_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No certifications added</p>
        ) : (
          <div className="space-y-4">
            {certifications.map((c, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-3 gap-4">
                <FieldView label="Name" value={c.name} />
                <FieldView label="Organization" value={c.organization} />
                <FieldView label="Number" value={c.cert_number} />
                <FieldView label="Issued" value={c.issue_date} />
                <FieldView label="Expiry" value={c.expiry_date} />
                <FieldView label="Status" value={c.validity} />
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Professional Licenses */}
      <ProfileSectionCard title="Professional Licenses" icon={<FileCheck className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<LicenseEntry>
            items={licenses}
            onChange={setLicenses}
            label="License"
            createEmpty={() => ({ type: '', number: '', authority: '', issue_date: '', expiry_date: '', license_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">License Type</label>
                  <Input value={item.type} onChange={(e) => update('type', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">License Number</label>
                  <Input value={item.number} onChange={(e) => update('number', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issuing Authority</label>
                  <Input value={item.authority} onChange={(e) => update('authority', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue Date</label>
                  <Input type="date" value={item.issue_date} onChange={(e) => update('issue_date', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                  <Input type="date" value={item.expiry_date} onChange={(e) => update('expiry_date', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <FileUploadField label="Upload License Document" value={item.license_doc} onChange={(url) => update('license_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : licenses.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No licenses added</p>
        ) : (
          <div className="space-y-4">
            {licenses.map((l, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-3 gap-4">
                <FieldView label="Type" value={l.type} />
                <FieldView label="Number" value={l.number} />
                <FieldView label="Authority" value={l.authority} />
                <FieldView label="Issued" value={l.issue_date} />
                <FieldView label="Expiry" value={l.expiry_date} />
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
