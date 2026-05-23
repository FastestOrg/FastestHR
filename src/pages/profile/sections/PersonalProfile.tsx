import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { User, IdCard, MapPin, CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { FileUploadField } from '../components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PersonalProfileProps {
  employee: {
    id: string;
    company_id: string;
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    blood_group?: string | null;
    nationality?: string | null;
    personal_email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      zip?: string | null;
      proof_doc?: string | null;
      proof_status?: string | null;
      proof_reason?: string | null;
    } | null;
    custom_fields?: {
      middle_name?: string | null;
      nickname?: string | null;
      marital_status?: string | null;
      alternate_phone?: string | null;
      perm_same_as_current?: boolean | null;
      identity_docs?: {
        aadhaar_number?: string | null;
        aadhaar_doc?: string | null;
        aadhaar_status?: string | null;
        aadhaar_reason?: string | null;
        pan_number?: string | null;
        pan_doc?: string | null;
        pan_status?: string | null;
        pan_reason?: string | null;
        passport_number?: string | null;
        passport_issue_date?: string | null;
        passport_expiry_date?: string | null;
        passport_doc?: string | null;
        passport_status?: string | null;
        passport_reason?: string | null;
        dl_number?: string | null;
        dl_expiry?: string | null;
        dl_doc?: string | null;
        dl_status?: string | null;
        dl_reason?: string | null;
        voter_id?: string | null;
        voter_doc?: string | null;
        voter_status?: string | null;
        voter_reason?: string | null;
      } | null;
      permanent_address?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        zip?: string | null;
        proof_doc?: string | null;
        proof_status?: string | null;
        proof_reason?: string | null;
      } | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  };
  refetch: () => void;
}

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <p className="text-sm font-semibold text-foreground py-0.5">
        {value || <span className="text-muted-foreground italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}

function FieldViewWithBadge({ 
  label, 
  value, 
  docUrl, 
  status, 
  reason 
}: { 
  label: string; 
  value?: string | null; 
  docUrl?: string | null; 
  status?: string; 
  reason?: string | null; 
}) {
  const computedStatus = docUrl 
    ? (status === 'Missing' || !status ? 'Pending Review' : status)
    : 'Missing';

  const getBadgeStyle = () => {
    switch (computedStatus) {
      case 'Verified':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
      case 'Pending Review':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400';
      case 'Rejected':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-muted/50 border-border/30 text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (computedStatus) {
      case 'Verified':
        return <CheckCircle2 className="h-3 w-3 mr-1 inline" />;
      case 'Pending Review':
        return <Clock className="h-3 w-3 mr-1 inline animate-pulse" />;
      case 'Rejected':
        return <AlertTriangle className="h-3 w-3 mr-1 inline" />;
      default:
        return <AlertCircle className="h-3 w-3 mr-1 inline" />;
    }
  };

  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-border/40 bg-muted/5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold flex items-center ${getBadgeStyle()}`}>
            {getStatusIcon()}
            {computedStatus}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          {value || <span className="text-muted-foreground italic font-normal">Not provided</span>}
        </p>
      </div>
      {docUrl && (
        <div className="pt-2 border-t border-border/20 mt-2 flex items-center justify-between text-xs">
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold flex items-center gap-1">
            View Document
          </a>
        </div>
      )}
      {computedStatus === 'Rejected' && reason && (
        <div className="mt-2 text-[10px] bg-rose-500/5 p-1.5 rounded text-rose-600 dark:text-rose-400 border border-rose-500/10">
          <span className="font-semibold">Reason:</span> {reason}
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, name, value, onChange, type = 'text', required = false }: {
  label: string; name: string; value: string; onChange: (name: string, value: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
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
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
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

  const up = (name: string, value: unknown) => setForm(prev => ({ ...prev, [name]: value }));
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
        line1: form.curr_line1, 
        line2: form.curr_line2, 
        city: form.curr_city,
        state: form.curr_state, 
        country: form.curr_country, 
        zip: form.curr_zip,
        proof_doc: form.curr_address_proof,
        proof_status: address.proof_status || (form.curr_address_proof ? 'Pending Review' : 'Missing'),
        proof_reason: address.proof_reason || null,
      },
      custom_fields: {
        ...cf,
        middle_name: form.middle_name,
        nickname: form.nickname,
        marital_status: form.marital_status,
        alternate_phone: form.alternate_phone,
        perm_same_as_current: form.perm_same,
        identity_docs: {
          aadhaar_number: form.aadhaar_number, 
          aadhaar_doc: form.aadhaar_doc,
          aadhaar_status: identityDocs.aadhaar_status || (form.aadhaar_doc ? 'Pending Review' : 'Missing'),
          aadhaar_reason: identityDocs.aadhaar_reason || null,
          
          pan_number: form.pan_number, 
          pan_doc: form.pan_doc,
          pan_status: identityDocs.pan_status || (form.pan_doc ? 'Pending Review' : 'Missing'),
          pan_reason: identityDocs.pan_reason || null,
          
          passport_number: form.passport_number, 
          passport_issue_date: form.passport_issue_date,
          passport_expiry_date: form.passport_expiry_date, 
          passport_doc: form.passport_doc,
          passport_status: identityDocs.passport_status || (form.passport_doc ? 'Pending Review' : 'Missing'),
          passport_reason: identityDocs.passport_reason || null,
          
          dl_number: form.dl_number, 
          dl_expiry: form.dl_expiry, 
          dl_doc: form.dl_doc,
          dl_status: identityDocs.dl_status || (form.dl_doc ? 'Pending Review' : 'Missing'),
          dl_reason: identityDocs.dl_reason || null,
          
          voter_id: form.voter_id, 
          voter_doc: form.voter_doc,
          voter_status: identityDocs.voter_status || (form.voter_doc ? 'Pending Review' : 'Missing'),
          voter_reason: identityDocs.voter_reason || null,
        },
        permanent_address: form.perm_same
          ? { 
              line1: form.curr_line1, 
              line2: form.curr_line2, 
              city: form.curr_city, 
              state: form.curr_state, 
              country: form.curr_country, 
              zip: form.curr_zip 
            }
          : { 
              line1: form.perm_line1, 
              line2: form.perm_line2, 
              city: form.perm_city, 
              state: form.perm_state, 
              country: form.perm_country, 
              zip: form.perm_zip, 
              proof_doc: form.perm_address_proof,
              proof_status: permAddress.proof_status || (form.perm_address_proof ? 'Pending Review' : 'Missing'),
              proof_reason: permAddress.proof_reason || null,
            },
      },
    };

    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Personal information saved successfully');
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Photo</label>
                    <FileUploadField 
                      label="" 
                      value={form.avatar_url} 
                      onChange={(url) => up('avatar_url', url || '')} 
                      path={storagePath} 
                      accept=".jpg,.jpeg,.png" 
                    />
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
          <div>
            {editing ? (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-4">
                  <FieldInput label="Aadhaar / National ID" name="aadhaar_number" value={form.aadhaar_number} onChange={up} />
                  <FileUploadField 
                    label="Upload Aadhaar Card" 
                    value={form.aadhaar_doc} 
                    onChange={(url) => up('aadhaar_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={identityDocs.aadhaar_status}
                    statusReason={identityDocs.aadhaar_reason}
                  />
                </div>
                <div className="space-y-4">
                  <FieldInput label="PAN Card Number" name="pan_number" value={form.pan_number} onChange={up} />
                  <FileUploadField 
                    label="Upload PAN Card" 
                    value={form.pan_doc} 
                    onChange={(url) => up('pan_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={identityDocs.pan_status}
                    statusReason={identityDocs.pan_reason}
                  />
                </div>
                <div className="space-y-4">
                  <FieldInput label="Passport Number" name="passport_number" value={form.passport_number} onChange={up} />
                  <div className="grid grid-cols-2 gap-4">
                    <FieldInput label="Issue Date" name="passport_issue_date" value={form.passport_issue_date} onChange={up} type="date" />
                    <FieldInput label="Expiry Date" name="passport_expiry_date" value={form.passport_expiry_date} onChange={up} type="date" />
                  </div>
                  <FileUploadField 
                    label="Upload Passport Copy" 
                    value={form.passport_doc} 
                    onChange={(url) => up('passport_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={identityDocs.passport_status}
                    statusReason={identityDocs.passport_reason}
                  />
                </div>
                <div className="space-y-4">
                  <FieldInput label="Driver's License Number" name="dl_number" value={form.dl_number} onChange={up} />
                  <FieldInput label="License Expiry Date" name="dl_expiry" value={form.dl_expiry} onChange={up} type="date" />
                  <FileUploadField 
                    label="Upload Driver's License" 
                    value={form.dl_doc} 
                    onChange={(url) => up('dl_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={identityDocs.dl_status}
                    statusReason={identityDocs.dl_reason}
                  />
                </div>
                <div className="space-y-4 col-span-1 sm:col-span-2">
                  <FieldInput label="Voter ID Number" name="voter_id" value={form.voter_id} onChange={up} />
                  <FileUploadField 
                    label="Upload Voter ID" 
                    value={form.voter_doc} 
                    onChange={(url) => up('voter_doc', url || '')} 
                    path={storagePath} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    status={identityDocs.voter_status}
                    statusReason={identityDocs.voter_reason}
                  />
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <FieldViewWithBadge 
                  label="Aadhaar / National ID" 
                  value={form.aadhaar_number} 
                  docUrl={form.aadhaar_doc}
                  status={identityDocs.aadhaar_status}
                  reason={identityDocs.aadhaar_reason}
                />
                <FieldViewWithBadge 
                  label="PAN Card Number" 
                  value={form.pan_number} 
                  docUrl={form.pan_doc}
                  status={identityDocs.pan_status}
                  reason={identityDocs.pan_reason}
                />
                <FieldViewWithBadge 
                  label="Passport Number" 
                  value={form.passport_number ? `${form.passport_number} (Exp: ${form.passport_expiry_date || 'N/A'})` : ''} 
                  docUrl={form.passport_doc}
                  status={identityDocs.passport_status}
                  reason={identityDocs.passport_reason}
                />
                <FieldViewWithBadge 
                  label="Driver's License" 
                  value={form.dl_number ? `${form.dl_number} (Exp: ${form.dl_expiry || 'N/A'})` : ''} 
                  docUrl={form.dl_doc}
                  status={identityDocs.dl_status}
                  reason={identityDocs.dl_reason}
                />
                <FieldViewWithBadge 
                  label="Voter ID" 
                  value={form.voter_id} 
                  docUrl={form.voter_doc}
                  status={identityDocs.voter_status}
                  reason={identityDocs.voter_reason}
                />
              </div>
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
              {editing ? (
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <FieldInput label="Address Line 1" name="curr_line1" value={form.curr_line1} onChange={up} />
                  <FieldInput label="Address Line 2" name="curr_line2" value={form.curr_line2} onChange={up} />
                  <FieldInput label="City" name="curr_city" value={form.curr_city} onChange={up} />
                  <FieldInput label="State / Province" name="curr_state" value={form.curr_state} onChange={up} />
                  <FieldInput label="Country" name="curr_country" value={form.curr_country} onChange={up} />
                  <FieldInput label="ZIP / Postal Code" name="curr_zip" value={form.curr_zip} onChange={up} />
                  <div className="col-span-1 sm:col-span-2">
                    <FileUploadField 
                      label="Upload Current Address Proof" 
                      value={form.curr_address_proof} 
                      onChange={(url) => up('curr_address_proof', url || '')} 
                      path={storagePath} 
                      accept=".pdf,.jpg,.jpeg,.png"
                      status={address.proof_status}
                      statusReason={address.proof_reason}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  <FieldView label="Address Detail" value={[form.curr_line1, form.curr_line2, form.curr_city, form.curr_state, form.curr_country, form.curr_zip].filter(Boolean).join(', ')} />
                  <FieldViewWithBadge 
                    label="Current Address Proof" 
                    value={form.curr_address_proof ? 'Address Proof Document' : ''} 
                    docUrl={form.curr_address_proof}
                    status={address.proof_status}
                    reason={address.proof_reason}
                  />
                </div>
              )}
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
                <div>
                  {editing ? (
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                      <FieldInput label="Address Line 1" name="perm_line1" value={form.perm_line1} onChange={up} />
                      <FieldInput label="Address Line 2" name="perm_line2" value={form.perm_line2} onChange={up} />
                      <FieldInput label="City" name="perm_city" value={form.perm_city} onChange={up} />
                      <FieldInput label="State / Province" name="perm_state" value={form.perm_state} onChange={up} />
                      <FieldInput label="Country" name="perm_country" value={form.perm_country} onChange={up} />
                      <FieldInput label="ZIP / Postal Code" name="perm_zip" value={form.perm_zip} onChange={up} />
                      <div className="col-span-1 sm:col-span-2">
                        <FileUploadField 
                          label="Upload Permanent Address Proof" 
                          value={form.perm_address_proof} 
                          onChange={(url) => up('perm_address_proof', url || '')} 
                          path={storagePath} 
                          accept=".pdf,.jpg,.jpeg,.png"
                          status={permAddress.proof_status}
                          statusReason={permAddress.proof_reason}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-6">
                      <FieldView label="Address Detail" value={[form.perm_line1, form.perm_line2, form.perm_city, form.perm_state, form.perm_country, form.perm_zip].filter(Boolean).join(', ')} />
                      <FieldViewWithBadge 
                        label="Permanent Address Proof" 
                        value={form.perm_address_proof ? 'Address Proof Document' : ''} 
                        docUrl={form.perm_address_proof}
                        status={permAddress.proof_status}
                        reason={permAddress.proof_reason}
                      />
                    </div>
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
