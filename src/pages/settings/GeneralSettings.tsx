import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Loader2, MapPin } from 'lucide-react';

export default function GeneralSettings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase.from('companies')
        .select('id, name, timezone, currency, country, about_company, company_culture, website, linkedin_url, logo_url, geofence_latitude, geofence_longitude, geofence_radius, ip_whitelist')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const [form, setForm] = useState({
    name: '', timezone: '', currency: '', country: '',
    about_company: '', company_culture: '', website: '', linkedin_url: '',
    geofence_latitude: '', geofence_longitude: '', geofence_radius: '200', ip_whitelist: ''
  });

  useEffect(() => {
    if (company) {
      const c = company as any;
      setForm({
        name: c.name || '', timezone: c.timezone || 'UTC', currency: c.currency || 'USD', country: c.country || '',
        about_company: c.about_company || '', company_culture: c.company_culture || '', website: c.website || '', linkedin_url: c.linkedin_url || '',
        geofence_latitude: c.geofence_latitude?.toString() || '',
        geofence_longitude: c.geofence_longitude?.toString() || '',
        geofence_radius: c.geofence_radius?.toString() || '200',
        ip_whitelist: c.ip_whitelist || '',
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Company ID is missing.");
      const { error } = await supabase.from('companies').update({
        name: form.name, timezone: form.timezone, currency: form.currency, country: form.country,
        about_company: form.about_company || null, company_culture: form.company_culture || null,
        website: form.website || null, linkedin_url: form.linkedin_url || null,
        geofence_latitude: form.geofence_latitude ? parseFloat(form.geofence_latitude) : null,
        geofence_longitude: form.geofence_longitude ? parseFloat(form.geofence_longitude) : null,
        geofence_radius: form.geofence_radius ? parseInt(form.geofence_radius) : null,
        ip_whitelist: form.ip_whitelist || null,
      }).eq('id', profile.company_id).select('id');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      toast.success('General settings saved');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save')),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File must be under 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${profile?.company_id}/logo.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoUrl })
        .eq('id', profile?.company_id)
        .select('id');
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      queryClient.invalidateQueries({ queryKey: ['company-branding'] });
      toast.success('Logo updated!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload logo'));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-1/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">General Info</h2>
        <p className="text-sm text-muted-foreground mt-1">Update your company details and global settings.</p>
      </div>

      <Card className="border-border/50 bg-card overflow-hidden">
        <CardContent className="space-y-6 pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Company Name</label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Country</label>
              <Input value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} className="bg-background/50 border-border/50 h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Default Timezone</label>
              <select value={form.timezone} onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Primary Currency</label>
              <select value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-border/50">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">About Company (Public Career Page)</label>
              <Textarea 
                placeholder="Describe your company for potential candidates..."
                value={form.about_company} 
                onChange={(e) => setForm(f => ({ ...f, about_company: e.target.value }))} 
                className="bg-background/50 border-border/50 min-h-[80px]" 
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Company Culture (Internal - Guides AI)</label>
              <Textarea 
                placeholder="Describe your company culture, values, and what you look for in candidates..."
                value={form.company_culture} 
                onChange={(e) => setForm(f => ({ ...f, company_culture: e.target.value }))} 
                className="bg-background/50 border-border/50 min-h-[80px]" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Website URL</label>
              <Input 
                type="url"
                placeholder="https://example.com"
                value={form.website} 
                onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} 
                className="bg-background/50 border-border/50 h-10" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">LinkedIn URL</label>
              <Input 
                type="url"
                placeholder="https://linkedin.com/company/example"
                value={form.linkedin_url} 
                onChange={(e) => setForm(f => ({ ...f, linkedin_url: e.target.value }))} 
                className="bg-background/50 border-border/50 h-10" 
              />
            </div>
          </div>

          <div className="pt-6 border-t border-border/50">
            <h3 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wider text-xs">Company Logo</h3>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-lg bg-background border-2 border-dashed border-primary/40 flex items-center justify-center text-primary/40 hover:text-primary hover:border-primary transition-colors cursor-pointer overflow-hidden">
                {company?.logo_url ? <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" /> : <Building className="w-8 h-8" />}
              </div>
              <div>
                <p className="text-sm mb-1 font-medium">Upload a new logo</p>
                <p className="text-xs text-muted-foreground mb-3">Max 2MB. Recommended 256×256px.</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                  <Button variant="outline" size="sm" className="text-xs h-8 pointer-events-none" disabled={uploading}>
                    <span>{uploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</> : 'Choose File'}</span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border/50 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">📍 Geofencing & Network Restrictions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Restrict office clock-ins by physical coordinates or IP networks. Leave coordinates empty to disable geofence checks.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Office Latitude</label>
                <Input 
                  type="number"
                  step="any"
                  placeholder="e.g. 37.7749"
                  value={form.geofence_latitude} 
                  onChange={(e) => setForm(f => ({ ...f, geofence_latitude: e.target.value }))} 
                  className="bg-background/50 border-border/50 h-10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Office Longitude</label>
                <Input 
                  type="number"
                  step="any"
                  placeholder="e.g. -122.4194"
                  value={form.geofence_longitude} 
                  onChange={(e) => setForm(f => ({ ...f, geofence_longitude: e.target.value }))} 
                  className="bg-background/50 border-border/50 h-10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Allowed Radius (Meters)</label>
                <Input 
                  type="number"
                  placeholder="e.g. 200"
                  value={form.geofence_radius} 
                  onChange={(e) => setForm(f => ({ ...f, geofence_radius: e.target.value }))} 
                  className="bg-background/50 border-border/50 h-10" 
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <label className="text-xs font-medium text-muted-foreground uppercase">IP Whitelist (Comma Separated)</label>
                <Input 
                  placeholder="e.g. 192.168.1.1, 203.0.113.50 (Leave empty to allow all IPs)"
                  value={form.ip_whitelist} 
                  onChange={(e) => setForm(f => ({ ...f, ip_whitelist: e.target.value }))} 
                  className="bg-background/50 border-border/50 h-10" 
                />
                <p className="text-[10px] text-muted-foreground">If configured, employees checking in from these public IPs will bypass physical GPS checks.</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="px-6 font-semibold">
              {updateMutation.isPending ? 'Saving...' : 'Save General Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
