import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Link2, Linkedin, Github, Globe, FileText } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SocialLinksProps {
  employee: any;
  refetch: () => void;
}

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline truncate block py-1">
          {value}
        </a>
      ) : (
        <p className="text-sm py-1"><span className="text-muted-foreground italic font-normal">Not provided</span></p>
      )}
    </div>
  );
}

function FI({ label, name, value, onChange, placeholder = '' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder}
        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm" />
    </div>
  );
}

export default function SocialLinks({ employee, refetch }: SocialLinksProps) {
  const cf = employee.custom_fields || {};
  const links = cf.social_links || {};
  const storagePath = `${employee.company_id}/${employee.id}/social`;

  const [form, setForm] = useState({
    linkedin: links.linkedin || '',
    github: links.github || '',
    portfolio: links.portfolio || '',
    blog: links.blog || '',
    behance: links.behance || '',
    stackoverflow: links.stackoverflow || '',
    other: links.other || '',
    portfolio_pdf_doc: links.portfolio_pdf_doc || '',
    resume_doc: links.resume_doc || '',
  });

  const up = (n: string, v: string) => setForm(p => ({ ...p, [n]: v }));

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        social_links: form,
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Social links saved');
    refetch();
  };

  return (
    <ProfileSectionCard title="Social & Professional Links" icon={<Link2 className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
      {(editing) => (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="LinkedIn Profile URL" name="linkedin" value={form.linkedin} onChange={up} placeholder="https://linkedin.com/in/..." />
                <FI label="GitHub Profile" name="github" value={form.github} onChange={up} placeholder="https://github.com/..." />
                <FI label="Portfolio Website URL" name="portfolio" value={form.portfolio} onChange={up} placeholder="https://..." />
                <FI label="Professional Blog URL" name="blog" value={form.blog} onChange={up} placeholder="https://..." />
                <FI label="Behance / Dribbble" name="behance" value={form.behance} onChange={up} placeholder="https://..." />
                <FI label="Stack Overflow" name="stackoverflow" value={form.stackoverflow} onChange={up} placeholder="https://stackoverflow.com/users/..." />
                <FI label="Other Professional Social Media" name="other" value={form.other} onChange={up} placeholder="URL" />
              </>
            ) : (
              <>
                <FieldView label="LinkedIn" value={form.linkedin} />
                <FieldView label="GitHub" value={form.github} />
                <FieldView label="Portfolio" value={form.portfolio} />
                <FieldView label="Blog" value={form.blog} />
                <FieldView label="Behance/Dribbble" value={form.behance} />
                <FieldView label="Stack Overflow" value={form.stackoverflow} />
                <FieldView label="Other" value={form.other} />
              </>
            )}
          </div>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 pt-2">
              <FileUploadField label="Upload Portfolio PDF" value={form.portfolio_pdf_doc} onChange={(url) => up('portfolio_pdf_doc', url || '')} path={storagePath} accept=".pdf" />
              <FileUploadField label="Upload Latest Resume/CV" value={form.resume_doc} onChange={(url) => up('resume_doc', url || '')} path={storagePath} accept=".pdf,.doc,.docx" />
            </div>
          )}
        </div>
      )}
    </ProfileSectionCard>
  );
}
