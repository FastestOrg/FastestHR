import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Code, Heart, Languages, Wrench, Globe } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { RepeatableFieldGroup } from '../components/RepeatableFieldGroup';
import { StarRating } from '../components/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SkillsCompetenciesProps {
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

const PROFICIENCY = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const LANG_LEVELS = ['None', 'Basic', 'Intermediate', 'Fluent', 'Native'];
const TOOL_CATEGORIES = ['Design', 'Development', 'Analytics', 'Office', 'Other'];

interface TechSkillEntry { name: string; proficiency: string; years: string; last_used: string; cert_doc: string; }
interface LanguageEntry { language: string; read: string; write: string; speak: string; cert_doc: string; }
interface ToolEntry { name: string; category: string; proficiency: string; years: string; cert_doc: string; }

const SOFT_SKILLS = ['Communication', 'Leadership', 'Team Management', 'Problem Solving', 'Time Management', 'Adaptability'];

export default function SkillsCompetencies({ employee, refetch }: SkillsCompetenciesProps) {
  const cf = employee.custom_fields || {};
  const sk = cf.skills || {};
  const storagePath = `${employee.company_id}/${employee.id}/skills`;

  const [techSkills, setTechSkills] = useState<TechSkillEntry[]>(sk.technical?.length ? sk.technical : []);
  const [softSkills, setSoftSkills] = useState<Record<string, number>>(sk.soft_skills || {});
  const [languages, setLanguages] = useState<LanguageEntry[]>(sk.languages?.length ? sk.languages : []);
  const [tools, setTools] = useState<ToolEntry[]>(sk.tools?.length ? sk.tools : []);
  const [domain, setDomain] = useState({
    industry: sk.domain?.industry || '',
    years: sk.domain?.years || '',
    achievements: sk.domain?.achievements || '',
  });

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        skills: {
          technical: techSkills,
          soft_skills: softSkills,
          languages,
          tools,
          domain,
        },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Skills information saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Technical Skills */}
      <ProfileSectionCard title="Technical Skills" icon={<Code className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<TechSkillEntry>
            items={techSkills}
            onChange={setTechSkills}
            label="Skill"
            createEmpty={() => ({ name: '', proficiency: '', years: '', last_used: '', cert_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skill Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proficiency</label>
                  <select value={item.proficiency} onChange={(e) => update('proficiency', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    {PROFICIENCY.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Years of Experience</label>
                  <Input type="number" min="0" value={item.years} onChange={(e) => update('years', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Used (Month/Year)</label>
                  <Input type="month" value={item.last_used} onChange={(e) => update('last_used', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <FileUploadField label="Upload Skill Certificate" value={item.cert_doc} onChange={(url) => update('cert_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : techSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No technical skills added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {techSkills.map((s, i) => (
              <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30 bg-muted/10 text-sm">
                <span className="font-medium text-foreground">{s.name}</span>
                {s.proficiency && <span className="text-[10px] text-primary uppercase font-semibold">{s.proficiency}</span>}
                {s.years && <span className="text-xs text-muted-foreground">{s.years}y</span>}
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Soft Skills */}
      <ProfileSectionCard title="Soft Skills" icon={<Heart className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {SOFT_SKILLS.map(skill => (
              <StarRating
                key={skill}
                label={skill}
                value={softSkills[skill] || 0}
                onChange={editing ? (v) => setSoftSkills(prev => ({ ...prev, [skill]: v })) : undefined}
                disabled={!editing}
              />
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Language Proficiency */}
      <ProfileSectionCard title="Language Proficiency" icon={<Languages className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<LanguageEntry>
            items={languages}
            onChange={setLanguages}
            label="Language"
            createEmpty={() => ({ language: '', read: '', write: '', speak: '', cert_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Language Name</label>
                  <Input value={item.language} onChange={(e) => update('language', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                {['read', 'write', 'speak'].map(ability => (
                  <div key={ability} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{ability.charAt(0).toUpperCase() + ability.slice(1)}</label>
                    <select value={(item as any)[ability]} onChange={(e) => update(ability as keyof LanguageEntry, e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                      <option value="">— Select —</option>
                      {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                ))}
                <FileUploadField label="Upload Proficiency Certificate" value={item.cert_doc} onChange={(url) => update('cert_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : languages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No languages added</p>
        ) : (
          <div className="space-y-3">
            {languages.map((l, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-4 gap-4">
                <FieldView label="Language" value={l.language} />
                <FieldView label="Read" value={l.read} />
                <FieldView label="Write" value={l.write} />
                <FieldView label="Speak" value={l.speak} />
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Tools & Software */}
      <ProfileSectionCard title="Tools & Software" icon={<Wrench className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<ToolEntry>
            items={tools}
            onChange={setTools}
            label="Tool"
            createEmpty={() => ({ name: '', category: '', proficiency: '', years: '', cert_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Software/Tool Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
                  <select value={item.category} onChange={(e) => update('category', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    {TOOL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proficiency</label>
                  <select value={item.proficiency} onChange={(e) => update('proficiency', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    {PROFICIENCY.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Years of Experience</label>
                  <Input type="number" min="0" value={item.years} onChange={(e) => update('years', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <FileUploadField label="Upload Certification" value={item.cert_doc} onChange={(url) => update('cert_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : tools.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No tools added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tools.map((t, i) => (
              <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30 bg-muted/10 text-sm">
                <span className="font-medium text-foreground">{t.name}</span>
                {t.category && <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{t.category}</span>}
                {t.proficiency && <span className="text-[10px] text-primary uppercase font-semibold">{t.proficiency}</span>}
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Domain Expertise */}
      <ProfileSectionCard title="Domain Expertise" icon={<Globe className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry/Domain</label>
                  <Input value={domain.industry} onChange={(e) => setDomain(p => ({ ...p, industry: e.target.value }))}
                    placeholder="e.g. Healthcare, Finance, E-commerce" className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Years in Domain</label>
                  <Input type="number" min="0" value={domain.years} onChange={(e) => setDomain(p => ({ ...p, years: e.target.value }))}
                    className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Projects / Achievements</label>
                  <Textarea value={domain.achievements} onChange={(e) => setDomain(p => ({ ...p, achievements: e.target.value }))}
                    rows={3} className="bg-background border-border/50 text-sm shadow-sm resize-none" />
                </div>
              </>
            ) : (
              <>
                <FieldView label="Industry/Domain" value={domain.industry} />
                <FieldView label="Years" value={domain.years} />
                {domain.achievements && <div className="sm:col-span-2"><FieldView label="Achievements" value={domain.achievements} /></div>}
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
