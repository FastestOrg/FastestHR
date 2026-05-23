import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Heart, Stethoscope } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmergencyContactProps {
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

export default function EmergencyContact({ employee, refetch }: EmergencyContactProps) {
  const ec = employee.emergency_contact || {};
  const cf = employee.custom_fields || {};
  const medEmergency = cf.medical_emergency || {};

  const [form, setForm] = useState({
    // Primary
    p_name: ec.primary_name || ec.name || '',
    p_relationship: ec.primary_relationship || ec.relationship || '',
    p_phone: ec.primary_phone || ec.phone || '',
    p_alt_phone: ec.primary_alt_phone || '',
    p_email: ec.primary_email || '',
    p_address: ec.primary_address || '',
    // Secondary
    s_name: ec.secondary_name || '',
    s_relationship: ec.secondary_relationship || '',
    s_phone: ec.secondary_phone || '',
    s_alt_phone: ec.secondary_alt_phone || '',
    s_email: ec.secondary_email || '',
    s_address: ec.secondary_address || '',
    // Medical Emergency
    blood_group: medEmergency.blood_group || employee.blood_group || '',
    allergies: medEmergency.allergies || '',
    chronic_conditions: medEmergency.chronic_conditions || '',
    medications: medEmergency.medications || '',
    doctor_name: medEmergency.doctor_name || '',
    doctor_contact: medEmergency.doctor_contact || '',
    preferred_hospital: medEmergency.preferred_hospital || '',
    insurance_policy: medEmergency.insurance_policy || '',
    insurance_card_doc: medEmergency.insurance_card_doc || '',
  });

  const up = (n: string, v: string) => setForm(p => ({ ...p, [n]: v }));
  const storagePath = `${employee.company_id}/${employee.id}/emergency`;

  const handleSave = async () => {
    const updateData = {
      emergency_contact: {
        primary_name: form.p_name, primary_relationship: form.p_relationship,
        primary_phone: form.p_phone, primary_alt_phone: form.p_alt_phone,
        primary_email: form.p_email, primary_address: form.p_address,
        secondary_name: form.s_name, secondary_relationship: form.s_relationship,
        secondary_phone: form.s_phone, secondary_alt_phone: form.s_alt_phone,
        secondary_email: form.s_email, secondary_address: form.s_address,
      },
      custom_fields: {
        ...cf,
        medical_emergency: {
          blood_group: form.blood_group, allergies: form.allergies,
          chronic_conditions: form.chronic_conditions, medications: form.medications,
          doctor_name: form.doctor_name, doctor_contact: form.doctor_contact,
          preferred_hospital: form.preferred_hospital, insurance_policy: form.insurance_policy,
          insurance_card_doc: form.insurance_card_doc,
        },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Emergency contact saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      <ProfileSectionCard title="Primary Emergency Contact" icon={<Phone className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Name" name="p_name" value={form.p_name} onChange={up} />
                <FI label="Relationship" name="p_relationship" value={form.p_relationship} onChange={up} />
                <FI label="Phone (Primary)" name="p_phone" value={form.p_phone} onChange={up} />
                <FI label="Alternate Phone" name="p_alt_phone" value={form.p_alt_phone} onChange={up} />
                <FI label="Email Address" name="p_email" value={form.p_email} onChange={up} type="email" />
                <FI label="Address" name="p_address" value={form.p_address} onChange={up} />
              </>
            ) : (
              <>
                <FieldView label="Name" value={form.p_name} />
                <FieldView label="Relationship" value={form.p_relationship} />
                <FieldView label="Phone" value={form.p_phone} />
                <FieldView label="Alt Phone" value={form.p_alt_phone} />
                <FieldView label="Email" value={form.p_email} />
                <FieldView label="Address" value={form.p_address} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard title="Secondary Emergency Contact" icon={<Heart className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Name" name="s_name" value={form.s_name} onChange={up} />
                <FI label="Relationship" name="s_relationship" value={form.s_relationship} onChange={up} />
                <FI label="Phone (Primary)" name="s_phone" value={form.s_phone} onChange={up} />
                <FI label="Alternate Phone" name="s_alt_phone" value={form.s_alt_phone} onChange={up} />
                <FI label="Email Address" name="s_email" value={form.s_email} onChange={up} type="email" />
                <FI label="Address" name="s_address" value={form.s_address} onChange={up} />
              </>
            ) : (
              <>
                <FieldView label="Name" value={form.s_name} />
                <FieldView label="Relationship" value={form.s_relationship} />
                <FieldView label="Phone" value={form.s_phone} />
                <FieldView label="Alt Phone" value={form.s_alt_phone} />
                <FieldView label="Email" value={form.s_email} />
                <FieldView label="Address" value={form.s_address} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard title="Medical Emergency Information" icon={<Stethoscope className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Blood Group" name="blood_group" value={form.blood_group} onChange={up} />
                <FI label="Known Allergies" name="allergies" value={form.allergies} onChange={up} />
                <FI label="Chronic Medical Conditions" name="chronic_conditions" value={form.chronic_conditions} onChange={up} />
                <FI label="Current Medications" name="medications" value={form.medications} onChange={up} />
                <FI label="Doctor's Name" name="doctor_name" value={form.doctor_name} onChange={up} />
                <FI label="Doctor's Contact" name="doctor_contact" value={form.doctor_contact} onChange={up} />
                <FI label="Preferred Hospital" name="preferred_hospital" value={form.preferred_hospital} onChange={up} />
                <FI label="Health Insurance Policy #" name="insurance_policy" value={form.insurance_policy} onChange={up} />
                <FileUploadField label="Upload Health Insurance Card" value={form.insurance_card_doc} onChange={(url) => up('insurance_card_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Blood Group" value={form.blood_group} />
                <FieldView label="Allergies" value={form.allergies} />
                <FieldView label="Chronic Conditions" value={form.chronic_conditions} />
                <FieldView label="Medications" value={form.medications} />
                <FieldView label="Doctor" value={form.doctor_name} />
                <FieldView label="Doctor Contact" value={form.doctor_contact} />
                <FieldView label="Preferred Hospital" value={form.preferred_hospital} />
                <FieldView label="Insurance Policy" value={form.insurance_policy} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
