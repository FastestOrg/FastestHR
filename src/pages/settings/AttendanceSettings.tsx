import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, MapPin, Loader2, AlertTriangle, 
  Settings, Mail, Calendar, Shield
} from 'lucide-react';

export default function AttendanceSettings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);

  const { data: company, isLoading, error: queryError } = useQuery({
    queryKey: ['my-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase.from('companies')
        .select('id, name, geofence_latitude, geofence_longitude, geofence_radius, attendance_settings')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const [form, setForm] = useState({
    location_required: true,
    geofence_latitude: '',
    geofence_longitude: '',
    geofence_radius: '200',
    auto_logout_hours: '24',
    max_regularizations_per_month: '3',
    non_logged_out_action: 'absent',
    non_logged_out_min_hours: '4',
    late_login_action: 'late',
    late_login_min_hours: '4',
    absconding_consecutive_leaves: '5',
    absconding_email_template: '',
    late_grace_period_mins: '15',
    allow_late_login: true,
    absent_limit_hours: '4',
    half_day_limit_hours: '7',
    full_day_limit_hours: '15',
  });

  useEffect(() => {
    if (company) {
      console.log('AttendanceSettings: fetched company data:', company);
      const c = company as any;
      let settings = c.attendance_settings;
      if (typeof settings === 'string') {
        try {
          settings = JSON.parse(settings);
        } catch (e) {
          console.error('Failed to parse attendance_settings JSON string:', e);
          settings = {};
        }
      }
      if (!settings || typeof settings !== 'object') {
        settings = {};
      }
      
      console.log('AttendanceSettings: parsed settings:', settings);

      setForm({
        location_required: settings.location_required !== false,
        geofence_latitude: c.geofence_latitude?.toString() || '',
        geofence_longitude: c.geofence_longitude?.toString() || '',
        geofence_radius: c.geofence_radius?.toString() || '200',
        auto_logout_hours: settings.auto_logout_hours?.toString() || '24',
        max_regularizations_per_month: settings.max_regularizations_per_month?.toString() || '3',
        non_logged_out_action: settings.non_logged_out_handling?.action || 'absent',
        non_logged_out_min_hours: settings.non_logged_out_handling?.min_working_hours?.toString() || '4',
        late_login_action: settings.late_login_handling?.action || 'late',
        late_login_min_hours: settings.late_login_handling?.min_working_hours?.toString() || '4',
        absconding_consecutive_leaves: settings.absconding_consecutive_leaves?.toString() || '5',
        absconding_email_template: settings.absconding_email_template || '',
        late_grace_period_mins: settings.late_grace_period_mins?.toString() || '15',
        allow_late_login: settings.allow_late_login !== false,
        absent_limit_hours: settings.brackets?.absent_limit_hours?.toString() || '4',
        half_day_limit_hours: settings.brackets?.half_day_limit_hours?.toString() || '7',
        full_day_limit_hours: settings.brackets?.full_day_limit_hours?.toString() || '15',
      });
    }
  }, [company]);

  const getCoordinates = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(f => ({
          ...f,
          geofence_latitude: position.coords.latitude.toFixed(6),
          geofence_longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        toast.success('Coordinates retrieved successfully!');
      },
      (error) => {
        console.error(error);
        setIsLocating(false);
        toast.error('Failed to get coordinates. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Company ID is missing.");
      
      const payload = {
        geofence_latitude: form.geofence_latitude ? parseFloat(form.geofence_latitude) : null,
        geofence_longitude: form.geofence_longitude ? parseFloat(form.geofence_longitude) : null,
        geofence_radius: form.geofence_radius ? parseInt(form.geofence_radius) : null,
        attendance_settings: {
          location_required: form.location_required,
          auto_logout_hours: parseFloat(form.auto_logout_hours) || 24,
          max_regularizations_per_month: parseInt(form.max_regularizations_per_month) || 3,
          non_logged_out_handling: {
            action: form.non_logged_out_action,
            min_working_hours: parseFloat(form.non_logged_out_min_hours) || 4
          },
          late_login_handling: {
            action: form.late_login_action,
            min_working_hours: parseFloat(form.late_login_min_hours) || 4
          },
          absconding_consecutive_leaves: parseInt(form.absconding_consecutive_leaves) || 5,
          absconding_email_template: form.absconding_email_template,
          late_grace_period_mins: parseInt(form.late_grace_period_mins) || 15,
          allow_late_login: form.allow_late_login,
          brackets: {
            absent_limit_hours: parseFloat(form.absent_limit_hours) || 4.0,
            half_day_limit_hours: parseFloat(form.half_day_limit_hours) || 7.0,
            full_day_limit_hours: parseFloat(form.full_day_limit_hours) || 15.0
          }
        }
      };

      const { error } = await supabase.from('companies')
        .update(payload)
        .eq('id', profile.company_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      toast.success('Attendance configurations saved successfully');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save configurations')),
  });

  try {
    if (queryError) {
      throw queryError;
    }

    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Attendance Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure geofencing, shift timeout policies, regularization thresholds, and absconding rules.</p>
        </div>

        <Card className="border-border/50 bg-card">
          <CardContent className="space-y-8 pt-6">
            {/* Location & Geofencing Policies */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs">
                    <MapPin className="w-4 h-4 text-primary" /> Location & Geofencing
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Control whether physical GPS checks are enforced on clock-in and clock-out</p>
                </div>
              </div>

              <div className="space-y-4 bg-background/20 p-5 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="location_required"
                    checked={form.location_required}
                    onChange={(e) => setForm(f => ({ ...f, location_required: e.target.checked }))}
                    className="rounded border-border bg-background text-primary focus:ring-primary h-4.5 w-4.5"
                  />
                  <div>
                    <Label htmlFor="location_required" className="cursor-pointer text-sm font-bold text-foreground">Enforce Geofencing Verification</Label>
                    <p className="text-xs text-muted-foreground">If disabled, users can clock in and clock out from the office location without GPS validation.</p>
                  </div>
                </div>

                {form.location_required && (
                  <div className="grid gap-4 pt-2 md:grid-cols-3 border-t border-border/30 mt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Office Latitude</Label>
                      <Input 
                        type="number" 
                        step="any"
                        placeholder="e.g. 51.5074"
                        value={form.geofence_latitude} 
                        onChange={(e) => setForm(f => ({ ...f, geofence_latitude: e.target.value }))}
                        className="bg-background/50 border-border/50 h-9" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Office Longitude</Label>
                      <Input 
                        type="number" 
                        step="any"
                        placeholder="e.g. -0.1278"
                        value={form.geofence_longitude} 
                        onChange={(e) => setForm(f => ({ ...f, geofence_longitude: e.target.value }))}
                        className="bg-background/50 border-border/50 h-9" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Geofence Radius (meters)</Label>
                      <Input 
                        type="number"
                        placeholder="e.g. 200"
                        value={form.geofence_radius} 
                        onChange={(e) => setForm(f => ({ ...f, geofence_radius: e.target.value }))}
                        className="bg-background/50 border-border/50 h-9" 
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={getCoordinates} disabled={isLocating}>
                        {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                        Get Current Office Coordinates
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Clock-In Policies */}
            <div className="border-t border-border/50 pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Clock className="w-4 h-4 text-primary" /> Shift Timeout & Correction Limits
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define constraints on shift durations and corrections</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 bg-background/20 p-5 rounded-xl border border-border/50">
                <div className="space-y-2">
                  <Label className="text-xs">Auto-Logout Limit (Hours)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      placeholder="24"
                      value={form.auto_logout_hours}
                      onChange={(e) => setForm(f => ({ ...f, auto_logout_hours: e.target.value }))}
                      className="w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">hours after clock-in before closing session</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Stale shifts with no logout will be closed after this duration.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Max Regularization Requests per Month</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      placeholder="3"
                      value={form.max_regularizations_per_month}
                      onChange={(e) => setForm(f => ({ ...f, max_regularizations_per_month: e.target.value }))}
                      className="w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">allowed requests/month</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Prevents employees from requesting more corrections than configured.</p>
                </div>
              </div>
            </div>

            {/* Exceptions Handling Rules */}
            <div className="border-t border-border/50 pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Shield className="w-4 h-4 text-primary" /> Exception & Lateness Policies
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Determine how to classify missing clock-outs, late logins, and working hours brackets</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 bg-background/20 p-5 rounded-xl border border-border/50">
                {/* Non-Logged Out Days */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1.5 uppercase tracking-wider">Non-Logged Out Days</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Mark attendance as</Label>
                      <select
                        value={form.non_logged_out_action}
                        onChange={(e) => setForm(f => ({ ...f, non_logged_out_action: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="present">Full Day Present</option>
                      </select>
                    </div>

                    {form.non_logged_out_action === 'half_day' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Minimum Working Hours</Label>
                        <Input
                          type="number"
                          placeholder="4"
                          value={form.non_logged_out_min_hours}
                          onChange={(e) => setForm(f => ({ ...f, non_logged_out_min_hours: e.target.value }))}
                          className="bg-background/50 border-border/50 h-9"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Late Logins Policy */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1.5 uppercase tracking-wider">Late Login Policy</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Late Grace Period / Buffer (Minutes)</Label>
                      <Input
                        type="number"
                        placeholder="15"
                        value={form.late_grace_period_mins}
                        onChange={(e) => setForm(f => ({ ...f, late_grace_period_mins: e.target.value }))}
                        className="bg-background border-border/50 h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Allowed minutes after shift start before marked as late.</p>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="allow_late_login"
                        checked={form.allow_late_login}
                        onChange={(e) => setForm(f => ({ ...f, allow_late_login: e.target.checked }))}
                        className="rounded border-border bg-background text-primary focus:ring-primary h-4.5 w-4.5"
                      />
                      <div>
                        <Label htmlFor="allow_late_login" className="cursor-pointer text-xs font-bold text-foreground">Allow Late Logins</Label>
                        <p className="text-[10px] text-muted-foreground">If disabled, clock-in is blocked past the buffer time.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Status Brackets */}
                <div className="space-y-4 col-span-2 border-t border-border/30 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1.5 uppercase tracking-wider">Attendance Status Brackets (Hours Worked)</h4>
                  <p className="text-[11px] text-muted-foreground">Determine dynamic attendance status based on actual shift hours worked.</p>
                  
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Absent Max Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="4"
                        value={form.absent_limit_hours}
                        onChange={(e) => setForm(f => ({ ...f, absent_limit_hours: e.target.value }))}
                        className="bg-background border-border/50 h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Hours between 0 and this are marked as <strong>Absent</strong>.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Half Day Max Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="7"
                        value={form.half_day_limit_hours}
                        onChange={(e) => setForm(f => ({ ...f, half_day_limit_hours: e.target.value }))}
                        className="bg-background border-border/50 h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Hours between absent limit and this are marked as <strong>Half Day</strong>.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Full Day Max Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="15"
                        value={form.full_day_limit_hours}
                        onChange={(e) => setForm(f => ({ ...f, full_day_limit_hours: e.target.value }))}
                        className="bg-background border-border/50 h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Hours between half day limit and this are marked as <strong>Full Day</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Absconding Rules */}
            <div className="border-t border-border/50 pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Calendar className="w-4 h-4 text-primary" /> Absconding Policy
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define absconding rules and customize employee warning email templates</p>
              </div>

              <div className="space-y-4 bg-background/20 p-5 rounded-xl border border-border/50">
                <div className="space-y-2">
                  <Label className="text-xs">Mark Absconded after consecutive leaves/absences</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      placeholder="5"
                      value={form.absconding_consecutive_leaves}
                      onChange={(e) => setForm(f => ({ ...f, absconding_consecutive_leaves: e.target.value }))}
                      className="w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">days of continuous absences</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/30">
                  <Label className="text-xs font-bold text-foreground">Absconding Notification Email Template</Label>
                  <Textarea
                    placeholder="Dear {{employee_name}}, ..."
                    value={form.absconding_email_template}
                    onChange={(e) => setForm(f => ({ ...f, absconding_email_template: e.target.value }))}
                    className="bg-background border-border/50 min-h-[120px]"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supported variables: <code className="bg-background px-1 rounded">{"{{employee_name}}"}</code>, <code className="bg-background px-1 rounded">{"{{consecutive_days}}"}</code>, <code className="bg-background px-1 rounded">{"{{company_name}}"}</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="px-6 font-semibold">
                {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (err: any) {
    console.error("AttendanceSettings Render Error:", err);
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl space-y-4">
        <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Component Render Error
        </h3>
        <p className="text-sm text-foreground">An error occurred while rendering the Attendance Settings. Please share this error message with support:</p>
        <pre className="p-4 bg-background/50 border border-border/50 rounded-lg text-xs font-mono overflow-auto max-w-full text-destructive-foreground">
          {err.message || String(err)}
          {"\n\nStack:\n"}{err.stack}
        </pre>
      </div>
    );
  }
}
