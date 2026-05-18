import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { User, IdCard, MapPin } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PersonalProfileProps {
  employee: any;
  refetch: () => void;
}

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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

function FieldInput({ label, name, value, onChange, type = 'text', required = false }: {
  label: string; name: string; value: string; onChange: (name: string, value: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {label}{required && <span className="text-destructive">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm"
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (name: string, value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm"
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function calcAge(dob: string): string {
  if (!dob) return '';
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age} years`;
}

export default function PersonalProfile({ employee, refetch }: PersonalProfileProps) {
  const cf = employee.custom_fields || {};
  const identityDocs = cf.identity_docs || {};
  const address = employee.address || {};
  const permAddress = cf.permanent_address || {};

  const [form, setForm] = useState({
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    middle_name: cf.middle_name || '',
    nickname: cf.nickname || '',
    date_of_birth: employee.date_of_birth || '',
    gender: employee.gender || '',
    marital_status: cf.marital_status || '',
    blood_group: employee.blood_group || '',
    nationality: employee.nationality || '',
    personal_email: employee.personal_email || '',
    phone: employee.phone || '',
    alternate_phone: cf.alternate_phone || '',
    avatar_url: employee.avatar_url || '',
    // Identity docs
    aadhaar_number: identityDocs.aadhaar_number || '',
    aadhaar_doc: identityDocs.aadhaar_doc || '',
    pan_number: identityDocs.pan_number || '',
    pan_doc: identityDocs.pan_doc || '',
    passport_number: identityDocs.passport_number || '',
    passport_issue_date: identityDocs.passport_issue_date || '',
    passport_expiry_date: identityDocs.passport_expiry_date || '',
    passport_doc: identityDocs.passport_doc || '',
    dl_number: identityDocs.dl_number || '',
    dl_expiry: identityDocs.dl_expiry || '',
    dl_doc: identityDocs.dl_doc || '',
    voter_id: identityDocs.voter_id || '',
    voter_doc: identityDocs.voter_doc || '',
    // Current address
    curr_line1: address.line1 || '',
    curr_line2: address.line2 || '',
    curr_city: address.city || '',
    curr_state: address.state || '',
    curr_country: address.country || '',
    curr_zip: address.zip || '',
    curr_address_proof: address.proof_doc || '',
    // Permanent address
    perm_same: cf.perm_same_as_current || false,
    perm_line1: permAddress.line1 || '',
    perm_line2: permAddress.line2 || '',
    perm_city: permAddress.city || '',
    perm_state: permAddress.state || '',
    perm_country: permAddress.country || '',
    perm_zip: permAddress.zip || '',
    perm_address_proof: permAddress.proof_doc || '',
  });

  const up = (name: string, value: any) => setForm(prev => ({ ...prev, [name]: value }));
  const storagePath = `${employee.company_id}/${employee.id}/personal`;

  const handleSave = async () => {
    const updateData = {
      first_name: form.first_name,
      last_name: form.last_name,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      nationality: form.nationality || null,
      personal_email: form.personal_email || null,
      phone: form.phone || null,
      avatar_url: form.avatar_url || null,
      address: {
        line1: form.curr_line1, line2: form.curr_line2, city: form.curr_city,
        state: form.curr_state, country: form.curr_country, zip: form.curr_zip,
        proof_doc: form.curr_address_proof,
      },
      custom_fields: {
        ...cf,
        middle_name: form.middle_name,
        nickname: form.nickname,
        marital_status: form.marital_status,
        alternate_phone: form.alternate_phone,
        perm_same_as_current: form.perm_same,
        identity_docs: {
          aadhaar_number: form.aadhaar_number, aadhaar_doc: form.aadhaar_doc,
          pan_number: form.pan_number, pan_doc: form.pan_doc,
          passport_number: form.passport_number, passport_issue_date: form.passport_issue_date,
          passport_expiry_date: form.passport_expiry_date, passport_doc: form.passport_doc,
          dl_number: form.dl_number, dl_expiry: form.dl_expiry, dl_doc: form.dl_doc,
          voter_id: form.voter_id, voter_doc: form.voter_doc,
        },
        permanent_address: form.perm_same
          ? { line1: form.curr_line1, line2: form.curr_line2, city: form.curr_city, state: form.curr_state, country: form.curr_country, zip: form.curr_zip }
          : { line1: form.perm_line1, line2: form.perm_line2, city: form.perm_city, state: form.perm_state, country: form.perm_country, zip: form.perm_zip, proof_doc: form.perm_address_proof },
      },
    } as any;

    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Personal information saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <ProfileSectionCard title="Basic Information" icon={<User className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
              {editing ? (
                <>
                  <FieldInput label="First Name" name="first_name" value={form.first_name} onChange={up} required />
                  <FieldInput label="Middle Name" name="middle_name" value={form.middle_name} onChange={up} />
                  <FieldInput label="Last Name" name="last_name" value={form.last_name} onChange={up} required />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile Photo</label>
                    <FileUploadField label="" value={form.avatar_url} onChange={(url) => up('avatar_url', url || '')} path={storagePath} accept=".jpg,.jpeg,.png,.webp" />
                  </div>
                  <FieldInput label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={up} type="date" />
                  <FieldView label="Age" value={calcAge(form.date_of_birth)} />
                  <SelectField label="Gender" name="gender" value={form.gender} onChange={up} options={GENDERS} />
                  <SelectField label="Marital Status" name="marital_status" value={form.marital_status} onChange={up} options={MARITAL_STATUSES} />
                  <SelectField label="Blood Group" name="blood_group" value={form.blood_group} onChange={up} options={BLOOD_GROUPS} />
                  <FieldInput label="Nationality" name="nationality" value={form.nationality} onChange={up} />
                  <FieldInput label="Personal Email" name="personal_email" value={form.personal_email} onChange={up} type="email" />
                  <FieldInput label="Personal Phone" name="phone" value={form.phone} onChange={up} />
                  <FieldInput label="Alternate Phone" name="alternate_phone" value={form.alternate_phone} onChange={up} />
                  <FieldInput label="Preferred Name / Nickname" name="nickname" value={form.nickname} onChange={up} />
                </>
              ) : (
                <>
                  <FieldView label="Full Name" value={`${form.first_name} ${form.middle_name} ${form.last_name}`.replace(/\s+/g, ' ').trim()} />
                  <FieldView label="Date of Birth" value={form.date_of_birth} />
                  <FieldView label="Age" value={calcAge(form.date_of_birth)} />
                  <FieldView label="Gender" value={form.gender} />
                  <FieldView label="Marital Status" value={form.marital_status} />
                  <FieldView label="Blood Group" value={form.blood_group} />
                  <FieldView label="Nationality" value={form.nationality} />
                  <FieldView label="Personal Email" value={form.personal_email} />
                  <FieldView label="Phone" value={form.phone} />
                  <FieldView label="Alternate Phone" value={form.alternate_phone} />
                  <FieldView label="Nickname" value={form.nickname} />
                </>
              )}
            </div>
          </div>
        )}
      </ProfileSectionCard>

      {/* Identity Documents */}
      <ProfileSectionCard title="Identity Documents" icon={<IdCard className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <FieldInput label="Aadhaar / National ID" name="aadhaar_number" value={form.aadhaar_number} onChange={up} />
                <FileUploadField label="Upload Aadhaar Card" value={form.aadhaar_doc} onChange={(url) => up('aadhaar_doc', url || '')} path={storagePath} disabled={!editing} />
                <FieldInput label="PAN Card Number" name="pan_number" value={form.pan_number} onChange={up} />
                <FileUploadField label="Upload PAN Card" value={form.pan_doc} onChange={(url) => up('pan_doc', url || '')} path={storagePath} disabled={!editing} />
                <FieldInput label="Passport Number" name="passport_number" value={form.passport_number} onChange={up} />
                <FieldInput label="Passport Issue Date" name="passport_issue_date" value={form.passport_issue_date} onChange={up} type="date" />
                <FieldInput label="Passport Expiry Date" name="passport_expiry_date" value={form.passport_expiry_date} onChange={up} type="date" />
                <FileUploadField label="Upload Passport Copy" value={form.passport_doc} onChange={(url) => up('passport_doc', url || '')} path={storagePath} disabled={!editing} />
                <FieldInput label="Driver's License Number" name="dl_number" value={form.dl_number} onChange={up} />
                <FieldInput label="License Expiry Date" name="dl_expiry" value={form.dl_expiry} onChange={up} type="date" />
                <FileUploadField label="Upload Driver's License" value={form.dl_doc} onChange={(url) => up('dl_doc', url || '')} path={storagePath} disabled={!editing} />
                <FieldInput label="Voter ID Number" name="voter_id" value={form.voter_id} onChange={up} />
                <FileUploadField label="Upload Voter ID" value={form.voter_doc} onChange={(url) => up('voter_doc', url || '')} path={storagePath} disabled={!editing} />
              </>
            ) : (
              <>
                <FieldView label="Aadhaar / National ID" value={form.aadhaar_number} />
                <FieldView label="PAN Card Number" value={form.pan_number} />
                <FieldView label="Passport Number" value={form.passport_number} />
                <FieldView label="Passport Expiry" value={form.passport_expiry_date} />
                <FieldView label="Driver's License" value={form.dl_number} />
                <FieldView label="License Expiry" value={form.dl_expiry} />
                <FieldView label="Voter ID" value={form.voter_id} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Address Information */}
      <ProfileSectionCard title="Address Information" icon={<MapPin className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="space-y-8">
            {/* Current Address */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Current / Residential Address</h4>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {editing ? (
                  <>
                    <FieldInput label="Address Line 1" name="curr_line1" value={form.curr_line1} onChange={up} />
                    <FieldInput label="Address Line 2" name="curr_line2" value={form.curr_line2} onChange={up} />
                    <FieldInput label="City" name="curr_city" value={form.curr_city} onChange={up} />
                    <FieldInput label="State / Province" name="curr_state" value={form.curr_state} onChange={up} />
                    <FieldInput label="Country" name="curr_country" value={form.curr_country} onChange={up} />
                    <FieldInput label="ZIP / Postal Code" name="curr_zip" value={form.curr_zip} onChange={up} />
                    <FileUploadField label="Upload Address Proof" value={form.curr_address_proof} onChange={(url) => up('curr_address_proof', url || '')} path={storagePath} disabled={!editing} />
                  </>
                ) : (
                  <>
                    <FieldView label="Address" value={[form.curr_line1, form.curr_line2].filter(Boolean).join(', ')} />
                    <FieldView label="City, State" value={[form.curr_city, form.curr_state].filter(Boolean).join(', ')} />
                    <FieldView label="Country" value={form.curr_country} />
                    <FieldView label="ZIP Code" value={form.curr_zip} />
                  </>
                )}
              </div>
            </div>

            {/* Permanent Address */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Permanent Address</h4>
              {editing && (
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    id="perm_same"
                    checked={form.perm_same}
                    onCheckedChange={(checked) => up('perm_same', !!checked)}
                  />
                  <label htmlFor="perm_same" className="text-sm text-muted-foreground cursor-pointer">
                    Same as current address
                  </label>
                </div>
              )}
              {!form.perm_same && (
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  {editing ? (
                    <>
                      <FieldInput label="Address Line 1" name="perm_line1" value={form.perm_line1} onChange={up} />
                      <FieldInput label="Address Line 2" name="perm_line2" value={form.perm_line2} onChange={up} />
                      <FieldInput label="City" name="perm_city" value={form.perm_city} onChange={up} />
                      <FieldInput label="State / Province" name="perm_state" value={form.perm_state} onChange={up} />
                      <FieldInput label="Country" name="perm_country" value={form.perm_country} onChange={up} />
                      <FieldInput label="ZIP / Postal Code" name="perm_zip" value={form.perm_zip} onChange={up} />
                      <FileUploadField label="Upload Permanent Address Proof" value={form.perm_address_proof} onChange={(url) => up('perm_address_proof', url || '')} path={storagePath} disabled={!editing} />
                    </>
                  ) : (
                    <>
                      <FieldView label="Address" value={[form.perm_line1, form.perm_line2].filter(Boolean).join(', ')} />
                      <FieldView label="City, State" value={[form.perm_city, form.perm_state].filter(Boolean).join(', ')} />
                      <FieldView label="Country" value={form.perm_country} />
                      <FieldView label="ZIP Code" value={form.perm_zip} />
                    </>
                  )}
                </div>
              )}
              {form.perm_same && !editing && (
                <p className="text-sm text-muted-foreground italic">Same as current address</p>
              )}
            </div>
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
