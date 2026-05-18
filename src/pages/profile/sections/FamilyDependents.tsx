import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Users, Baby, UserCheck, Heart } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { RepeatableFieldGroup } from '../components/RepeatableFieldGroup';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FamilyDependentsProps {
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

function FI({ label, name, value, onChange, type = 'text' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(name, e.target.value)}
        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm" />
    </div>
  );
}

function SF({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <select value={value} onChange={(e) => onChange(name, e.target.value)}
        className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm">
        <option value="">— Select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

interface ChildEntry { name: string; dob: string; gender: string; school: string; dependent: string; birth_cert_doc: string; }
interface SiblingEntry { name: string; relationship: string; dob: string; dependent: string; }
interface NomineeEntry { name: string; relationship: string; percentage: string; contact: string; address: string; id_proof_doc: string; }

export default function FamilyDependents({ employee, refetch }: FamilyDependentsProps) {
  const cf = employee.custom_fields || {};
  const family = cf.family || {};
  const storagePath = `${employee.company_id}/${employee.id}/family`;

  const [spouse, setSpouse] = useState({
    name: family.spouse?.name || '',
    dob: family.spouse?.dob || '',
    occupation: family.spouse?.occupation || '',
    employer: family.spouse?.employer || '',
    phone: family.spouse?.phone || '',
    dependent: family.spouse?.dependent || '',
    marriage_cert_doc: family.spouse?.marriage_cert_doc || '',
  });

  const [children, setChildren] = useState<ChildEntry[]>(
    family.children?.length ? family.children : []
  );

  const [parents, setParents] = useState({
    father_name: family.parents?.father_name || '',
    father_dob: family.parents?.father_dob || '',
    father_occupation: family.parents?.father_occupation || '',
    father_dependent: family.parents?.father_dependent || '',
    mother_name: family.parents?.mother_name || '',
    mother_dob: family.parents?.mother_dob || '',
    mother_occupation: family.parents?.mother_occupation || '',
    mother_dependent: family.parents?.mother_dependent || '',
  });

  const [siblings, setSiblings] = useState<SiblingEntry[]>(family.siblings?.length ? family.siblings : []);

  const [nominees, setNominees] = useState<NomineeEntry[]>(
    family.nominees?.length ? family.nominees : []
  );

  const upS = (n: string, v: string) => setSpouse(p => ({ ...p, [n]: v }));
  const upP = (n: string, v: string) => setParents(p => ({ ...p, [n]: v }));

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        family: {
          spouse, children, parents, siblings, nominees,
        },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Family information saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Spouse */}
      <ProfileSectionCard title="Spouse Details" icon={<Heart className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Name" name="name" value={spouse.name} onChange={upS} />
                <FI label="Date of Birth" name="dob" value={spouse.dob} onChange={upS} type="date" />
                <FI label="Occupation" name="occupation" value={spouse.occupation} onChange={upS} />
                <FI label="Employer Name" name="employer" value={spouse.employer} onChange={upS} />
                <FI label="Phone Number" name="phone" value={spouse.phone} onChange={upS} />
                <SF label="Dependent for Benefits" name="dependent" value={spouse.dependent} onChange={upS} options={['Yes', 'No']} />
                <FileUploadField label="Upload Marriage Certificate" value={spouse.marriage_cert_doc} onChange={(url) => upS('marriage_cert_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Name" value={spouse.name} />
                <FieldView label="Date of Birth" value={spouse.dob} />
                <FieldView label="Occupation" value={spouse.occupation} />
                <FieldView label="Employer" value={spouse.employer} />
                <FieldView label="Phone" value={spouse.phone} />
                <FieldView label="Dependent" value={spouse.dependent} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Children */}
      <ProfileSectionCard title="Children Details" icon={<Baby className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<ChildEntry>
            items={children}
            onChange={setChildren}
            label="Child"
            createEmpty={() => ({ name: '', dob: '', gender: '', school: '', dependent: '', birth_cert_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Child's Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</label>
                  <Input type="date" value={item.dob} onChange={(e) => update('dob', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gender</label>
                  <select value={item.gender} onChange={(e) => update('gender', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">School/College</label>
                  <Input value={item.school} onChange={(e) => update('school', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dependent for Benefits</label>
                  <select value={item.dependent} onChange={(e) => update('dependent', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <FileUploadField label="Upload Birth Certificate" value={item.birth_cert_doc} onChange={(url) => update('birth_cert_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : (
          children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No children added</p>
          ) : (
            <div className="space-y-4">
              {children.map((c, i) => (
                <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <FieldView label="Name" value={c.name} />
                    <FieldView label="DOB" value={c.dob} />
                    <FieldView label="Gender" value={c.gender} />
                    <FieldView label="School/College" value={c.school} />
                    <FieldView label="Dependent" value={c.dependent} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </ProfileSectionCard>

      {/* Parents */}
      <ProfileSectionCard title="Parents Details" icon={<UserCheck className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="space-y-8">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Father</h4>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {editing ? (
                  <>
                    <FI label="Name" name="father_name" value={parents.father_name} onChange={upP} />
                    <FI label="Date of Birth" name="father_dob" value={parents.father_dob} onChange={upP} type="date" />
                    <FI label="Occupation" name="father_occupation" value={parents.father_occupation} onChange={upP} />
                    <SF label="Dependent" name="father_dependent" value={parents.father_dependent} onChange={upP} options={['Yes', 'No']} />
                  </>
                ) : (
                  <>
                    <FieldView label="Name" value={parents.father_name} />
                    <FieldView label="DOB" value={parents.father_dob} />
                    <FieldView label="Occupation" value={parents.father_occupation} />
                    <FieldView label="Dependent" value={parents.father_dependent} />
                  </>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Mother</h4>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {editing ? (
                  <>
                    <FI label="Name" name="mother_name" value={parents.mother_name} onChange={upP} />
                    <FI label="Date of Birth" name="mother_dob" value={parents.mother_dob} onChange={upP} type="date" />
                    <FI label="Occupation" name="mother_occupation" value={parents.mother_occupation} onChange={upP} />
                    <SF label="Dependent" name="mother_dependent" value={parents.mother_dependent} onChange={upP} options={['Yes', 'No']} />
                  </>
                ) : (
                  <>
                    <FieldView label="Name" value={parents.mother_name} />
                    <FieldView label="DOB" value={parents.mother_dob} />
                    <FieldView label="Occupation" value={parents.mother_occupation} />
                    <FieldView label="Dependent" value={parents.mother_dependent} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </ProfileSectionCard>

      {/* Siblings */}
      <ProfileSectionCard title="Siblings" icon={<Users className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<SiblingEntry>
            items={siblings}
            onChange={setSiblings}
            label="Sibling"
            createEmpty={() => ({ name: '', relationship: '', dob: '', dependent: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relationship</label>
                  <select value={item.relationship} onChange={(e) => update('relationship', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</label>
                  <Input type="date" value={item.dob} onChange={(e) => update('dob', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dependent</label>
                  <select value={item.dependent} onChange={(e) => update('dependent', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Select —</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            )}
          />
        ) : siblings.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No siblings added</p>
        ) : (
          <div className="space-y-3">
            {siblings.map((s, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-4 gap-4">
                <FieldView label="Name" value={s.name} />
                <FieldView label="Relationship" value={s.relationship} />
                <FieldView label="DOB" value={s.dob} />
                <FieldView label="Dependent" value={s.dependent} />
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>

      {/* Nominees */}
      <ProfileSectionCard title="Nominee Information" icon={<UserCheck className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => editing ? (
          <RepeatableFieldGroup<NomineeEntry>
            items={nominees}
            onChange={setNominees}
            label="Nominee"
            maxItems={3}
            createEmpty={() => ({ name: '', relationship: '', percentage: '', contact: '', address: '', id_proof_doc: '' })}
            renderItem={(item, idx, update) => (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nominee Name</label>
                  <Input value={item.name} onChange={(e) => update('name', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relationship</label>
                  <Input value={item.relationship} onChange={(e) => update('relationship', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">% Allocation</label>
                  <Input type="number" min="0" max="100" value={item.percentage} onChange={(e) => update('percentage', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Number</label>
                  <Input value={item.contact} onChange={(e) => update('contact', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</label>
                  <Input value={item.address} onChange={(e) => update('address', e.target.value)} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <FileUploadField label="Upload ID Proof of Nominee" value={item.id_proof_doc} onChange={(url) => update('id_proof_doc', url || '')} path={storagePath} />
              </div>
            )}
          />
        ) : nominees.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No nominees added</p>
        ) : (
          <div className="space-y-3">
            {nominees.map((n, i) => (
              <div key={i} className="rounded-lg border border-border/30 p-4 bg-muted/5 grid sm:grid-cols-3 gap-4">
                <FieldView label="Name" value={n.name} />
                <FieldView label="Relationship" value={n.relationship} />
                <FieldView label="Allocation" value={n.percentage ? `${n.percentage}%` : ''} />
                <FieldView label="Contact" value={n.contact} />
                <FieldView label="Address" value={n.address} />
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
