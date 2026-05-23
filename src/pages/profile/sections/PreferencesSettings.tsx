import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Briefcase, Eye } from 'lucide-react';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PreferencesSettingsProps {
  employee: any;
  refetch: () => void;
}

function FieldView({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <p className="text-sm font-medium text-foreground py-1">
        {value || <span className="text-muted-foreground italic font-normal">Not set</span>}
      </p>
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

function FI({ label, name, value, onChange }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input value={value} onChange={(e) => onChange(name, e.target.value)}
        className="bg-background border-border/50 text-sm h-10 transition-colors focus:border-primary shadow-sm" />
    </div>
  );
}

function ToggleField({ label, description, value, onChange, disabled }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

const CONTACT_METHODS = ['Email', 'Phone', 'SMS'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const DIETARY_PREFS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Other'];

export default function PreferencesSettings({ employee, refetch }: PreferencesSettingsProps) {
  const cf = employee.custom_fields || {};
  const prefs = cf.preferences || {};

  const [comm, setComm] = useState({
    contact_method: prefs.contact_method || '',
    preferred_language: prefs.preferred_language || '',
    timezone: prefs.timezone || '',
  });

  const [work, setWork] = useState({
    shirt_size: prefs.shirt_size || '',
    dietary: prefs.dietary || '',
    food_allergies: prefs.food_allergies || '',
    accessibility: prefs.accessibility || '',
    workstation: prefs.workstation || '',
    parking: prefs.parking || '',
    vehicle_details: prefs.vehicle_details || '',
  });

  const [privacy, setPrivacy] = useState({
    show_in_directory: prefs.show_in_directory !== false,
    show_contact: prefs.show_contact !== false,
    show_birthday: prefs.show_birthday !== false,
    allow_view_profile: prefs.allow_view_profile !== false,
  });

  const upC = (n: string, v: string) => setComm(p => ({ ...p, [n]: v }));
  const upW = (n: string, v: string) => setWork(p => ({ ...p, [n]: v }));

  const handleSave = async () => {
    const updateData = {
      custom_fields: {
        ...cf,
        preferences: {
          ...comm, ...work, ...privacy,
        },
      },
    } as any;
    const { error } = await supabase.from('employees').update(updateData).eq('id', employee.id);
    if (error) { toast.error(error.message); throw error; }
    toast.success('Preferences saved');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Communication */}
      <ProfileSectionCard title="Communication Preferences" icon={<MessageSquare className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <SF label="Preferred Contact Method" name="contact_method" value={comm.contact_method} onChange={upC} options={CONTACT_METHODS} />
                <FI label="Preferred Language" name="preferred_language" value={comm.preferred_language} onChange={upC} />
                <FI label="Time Zone" name="timezone" value={comm.timezone} onChange={upC} />
              </>
            ) : (
              <>
                <FieldView label="Contact Method" value={comm.contact_method} />
                <FieldView label="Language" value={comm.preferred_language} />
                <FieldView label="Time Zone" value={comm.timezone} />
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Work Preferences */}
      <ProfileSectionCard title="Work Preferences" icon={<Briefcase className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {editing ? (
              <>
                <SF label="T-shirt / Uniform Size" name="shirt_size" value={work.shirt_size} onChange={upW} options={SHIRT_SIZES} />
                <SF label="Dietary Preferences" name="dietary" value={work.dietary} onChange={upW} options={DIETARY_PREFS} />
                <FI label="Food Allergies / Restrictions" name="food_allergies" value={work.food_allergies} onChange={upW} />
                <FI label="Accessibility Requirements" name="accessibility" value={work.accessibility} onChange={upW} />
                <SF label="Workstation Preferences" name="workstation" value={work.workstation} onChange={upW} options={['Standing Desk', 'Ergonomic Chair', 'Dual Monitor', 'Other']} />
                <SF label="Parking Required" name="parking" value={work.parking} onChange={upW} options={['Yes', 'No']} />
                {work.parking === 'Yes' && (
                  <FI label="Vehicle Details" name="vehicle_details" value={work.vehicle_details} onChange={upW} />
                )}
              </>
            ) : (
              <>
                <FieldView label="Shirt/Uniform Size" value={work.shirt_size} />
                <FieldView label="Dietary" value={work.dietary} />
                <FieldView label="Food Allergies" value={work.food_allergies} />
                <FieldView label="Accessibility" value={work.accessibility} />
                <FieldView label="Workstation" value={work.workstation} />
                <FieldView label="Parking" value={work.parking} />
                {work.parking === 'Yes' && <FieldView label="Vehicle" value={work.vehicle_details} />}
              </>
            )}
          </div>
        )}
      </ProfileSectionCard>

      {/* Privacy Settings */}
      <ProfileSectionCard title="Privacy Settings" icon={<Eye className="h-4 w-4 text-primary/70" />} onSave={handleSave}>
        {(editing) => (
          <div className="divide-y divide-border/20">
            <ToggleField label="Show in employee directory" description="Your name and photo will appear in the company directory"
              value={privacy.show_in_directory} onChange={(v) => setPrivacy(p => ({ ...p, show_in_directory: v }))} disabled={!editing} />
            <ToggleField label="Show contact number in directory" description="Colleagues can see your phone number"
              value={privacy.show_contact} onChange={(v) => setPrivacy(p => ({ ...p, show_contact: v }))} disabled={!editing} />
            <ToggleField label="Show birthday in directory" description="Your birthday will be visible to colleagues"
              value={privacy.show_birthday} onChange={(v) => setPrivacy(p => ({ ...p, show_birthday: v }))} disabled={!editing} />
            <ToggleField label="Allow colleagues to view profile" description="Other employees can access your full profile"
              value={privacy.allow_view_profile} onChange={(v) => setPrivacy(p => ({ ...p, allow_view_profile: v }))} disabled={!editing} />
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
}
