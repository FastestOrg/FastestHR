import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Activity, Syringe, ShieldCheck, HeartPulse } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthMedicalProps {
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

export default function HealthMedical({ employee, refetch }: HealthMedicalProps) {
  const cf = employee.custom_fields || {};
  const health = cf.health || {};
  const storagePath = `${employee.company_id}/${employee.id}/health`;

  const [general, setGeneral] = useState({
    blood_group: health.blood_group || employee.blood_group || '',
    height: health.height || '', weight: health.weight || '',
    disability: health.disability || '', accommodation_needed: health.accommodation_needed || '',
    accommodation_details: health.accommodation_details || '',
  });

  const [medical, setMedical] = useState({
    chronic_illnesses: health.chronic_illnesses || '',
    food_allergies: health.food_allergies || '', drug_allergies: health.drug_allergies || '',
    env_allergies: health.env_allergies || '', medications: health.medications || '',
    surgeries: health.surgeries || '', physical_limitations: health.physical_limitations || '',
    fitness_cert_doc: health.fitness_cert_doc || '', prescription_doc: health.prescription_doc || '',
  });

  const [vaccination, setVaccination] = useState({
    covid_status: health.covid_status || '', covid_cert_doc: health.covid_cert_doc || '',
    other_vaccinations: health.other_vaccinations || '', other_vax_doc: health.other_vax_doc || '',
  });

  const [insurance, setInsurance] = useState({
    provider: health.insurance_provider || '', policy_number: health.insurance_policy_number || '',
    coverage: health.insurance_coverage || '', validity: health.insurance_validity || '',
    policy_doc: health.insurance_policy_doc || '', card_doc: health.insurance_card_doc || '',
  });

  const upG = (n: string, v: string) => setGeneral(p => ({ ...p, [n]: v }));
  const upM = (n: string, v: string) => setMedical(p => ({ ...p, [n]: v }));
  const upV = (n: string, v: string) => setVaccination(p => ({ ...p, [n]: v }));
  const upI = (n: string, v: string) => setInsurance(p => ({ ...p, [n]: v }));

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        health: {
          ...general, ...medical, ...vaccination,
          insurance_provider: insurance.provider, insurance_policy_number: insurance.policy_number,
          insurance_coverage: insurance.coverage, insurance_validity: insurance.validity,
          insurance_policy_doc: insurance.policy_doc, insurance_card_doc: insurance.card_doc,
        },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Health information saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* General Health */}
      <ProfileSectionCard title="General Health" icon={<HeartPulse className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Blood Group" name="blood_group" value={general.blood_group} onChange={upG} />
                <FI label="Height (cm or feet)" name="height" value={general.height} onChange={upG} />
                <FI label="Weight (kg or lbs)" name="weight" value={general.weight} onChange={upG} />
                <FI label="Physical Disabilities" name="disability" value={general.disability} onChange={upG} />
                <SF label="Accommodation Required" name="accommodation_needed" value={general.accommodation_needed} onChange={upG} options={['Yes', 'No']} />
                {general.accommodation_needed === 'Yes' && (
                  <FI label="Accommodation Details" name="accommodation_details" value={general.accommodation_details} onChange={upG} />
                )}
              </>
            ) : (
              <>
                <FieldView label="Blood Group" value={general.blood_group} />
                <FieldView label="Height" value={general.height} />
                <FieldView label="Weight" value={general.weight} />
                <FieldView label="Disabilities" value={general.disability} />
                <FieldView label="Accommodation" value={general.accommodation_needed} />
                {general.accommodation_needed === 'Yes' && <FieldView label="Details" value={general.accommodation_details} />}
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Medical Conditions */}
      <ProfileSectionCard title="Medical Conditions" icon={<Activity className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Chronic Illnesses" name="chronic_illnesses" value={medical.chronic_illnesses} onChange={upM} />
                <FI label="Food Allergies" name="food_allergies" value={medical.food_allergies} onChange={upM} />
                <FI label="Drug Allergies" name="drug_allergies" value={medical.drug_allergies} onChange={upM} />
                <FI label="Environmental Allergies" name="env_allergies" value={medical.env_allergies} onChange={upM} />
                <FI label="Current Medications" name="medications" value={medical.medications} onChange={upM} />
                <FI label="Previous Major Surgeries" name="surgeries" value={medical.surgeries} onChange={upM} />
                <FI label="Physical Limitations" name="physical_limitations" value={medical.physical_limitations} onChange={upM} />
                <FileUploadField label="Upload Medical Fitness Certificate" value={medical.fitness_cert_doc} onChange={(url) => upM('fitness_cert_doc', url || '')} path={storagePath} disabled={!editing} />
                <FileUploadField label="Upload Doctor's Prescription" value={medical.prescription_doc} onChange={(url) => upM('prescription_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Chronic Illnesses" value={medical.chronic_illnesses} />
                <FieldView label="Food Allergies" value={medical.food_allergies} />
                <FieldView label="Drug Allergies" value={medical.drug_allergies} />
                <FieldView label="Environmental Allergies" value={medical.env_allergies} />
                <FieldView label="Medications" value={medical.medications} />
                <FieldView label="Surgeries" value={medical.surgeries} />
                <FieldView label="Physical Limitations" value={medical.physical_limitations} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Vaccination Records */}
      <ProfileSectionCard title="Vaccination Records" icon={<Syringe className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <SF label="COVID-19 Status" name="covid_status" value={vaccination.covid_status} onChange={upV}
                  options={['Not Vaccinated', 'Partially Vaccinated', 'Fully Vaccinated', 'Booster']} />
                <FileUploadField label="Upload COVID Certificate" value={vaccination.covid_cert_doc} onChange={(url) => upV('covid_cert_doc', url || '')} path={storagePath} disabled={!editing} />
                <FI label="Other Vaccinations" name="other_vaccinations" value={vaccination.other_vaccinations} onChange={upV} />
                <FileUploadField label="Upload Other Vaccination Certificates" value={vaccination.other_vax_doc} onChange={(url) => upV('other_vax_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="COVID-19 Status" value={vaccination.covid_status} />
                <FieldView label="Other Vaccinations" value={vaccination.other_vaccinations} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Personal Health Insurance */}
      <ProfileSectionCard title="Personal Health Insurance" icon={<ShieldCheck className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FI label="Insurance Provider" name="provider" value={insurance.provider} onChange={upI} />
                <FI label="Policy Number" name="policy_number" value={insurance.policy_number} onChange={upI} />
                <FI label="Coverage Amount" name="coverage" value={insurance.coverage} onChange={upI} />
                <FI label="Validity Period" name="validity" value={insurance.validity} onChange={upI} />
                <FileUploadField label="Upload Insurance Policy" value={insurance.policy_doc} onChange={(url) => upI('policy_doc', url || '')} path={storagePath} disabled={!editing} />
                <FileUploadField label="Upload Insurance Card" value={insurance.card_doc} onChange={(url) => upI('card_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Provider" value={insurance.provider} />
                <FieldView label="Policy Number" value={insurance.policy_number} />
                <FieldView label="Coverage" value={insurance.coverage} />
                <FieldView label="Validity" value={insurance.validity} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
