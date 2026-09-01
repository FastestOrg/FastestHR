import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Video,
  ExternalLink,
  ShieldCheck,
  Zap,
  Unlink,
  Radio,
} from 'lucide-react';
import {
  requestGoogleCalendarAuth,
  testGoogleCalendarSync,
} from '@/lib/google-calendar';
import { UserMeetingSettings } from '@/types/meeting';

interface GoogleCalendarCardProps {
  settings: UserMeetingSettings | null;
  onUpdateSettings: (updates: Partial<UserMeetingSettings>) => Promise<void>;
  isLoading: boolean;
}

export function GoogleCalendarCard({
  settings,
  onUpdateSettings,
  isLoading,
}: GoogleCalendarCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number } | null>(null);

  const isConnected = !!(settings?.google_calendar_connected && settings?.google_calendar_email);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      toast.loading('Opening Google authorization popup...', { id: 'gcal-auth' });

      const auth = await requestGoogleCalendarAuth();

      toast.loading('Connecting Google Calendar to your FastestHR account...', { id: 'gcal-auth' });

      await onUpdateSettings({
        google_calendar_connected: true,
        google_calendar_email: auth.email,
        google_access_token: auth.accessToken,
        google_token_expiry: new Date(Date.now() + auth.expiresIn * 1000).toISOString(),
        google_calendar_id: 'primary',
      });

      // Save token to localStorage for immediate client-side API requests
      localStorage.setItem('fastest_gcal_token', auth.accessToken);

      toast.success(`🎉 Google Calendar connected! (${auth.email})`, { id: 'gcal-auth' });
    } catch (err: any) {
      console.error('Google Calendar auth error:', err);
      toast.error(err?.message || 'Failed to connect Google Calendar', { id: 'gcal-auth' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings?.google_access_token) {
      // Re-prompt auth if token is missing
      handleConnect();
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testGoogleCalendarSync(settings.google_access_token);
      setTestResult(res);
      toast.success(`Google Calendar sync verified! Response time: ${res.latencyMs}ms`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync with Google Calendar. Re-connecting might be required.');
      setTestResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await onUpdateSettings({
        google_calendar_connected: false,
        google_calendar_email: null,
        google_access_token: null,
        google_token_expiry: null,
      });
      localStorage.removeItem('fastest_gcal_token');
      setTestResult(null);
      toast.info('Google Calendar disconnected.');
    } catch (err: any) {
      toast.error('Failed to disconnect Google Calendar: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Connection Status Card */}
      <Card className="border-border/60 bg-gradient-to-br from-card/90 via-card/60 to-muted/20 backdrop-blur shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  Google Calendar Integration
                  {isConnected ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Sync
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                      Not Connected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Synchronize your personal work schedule, avoid double-bookings, and auto-generate Google Meet video links.
                </CardDescription>
              </div>
            </div>

            {/* Top Action Button */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting || isLoading}
                    className="gap-1.5 h-9"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1.5 h-9"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm h-9"
                >
                  <Calendar className="w-4 h-4" />
                  {isConnecting ? 'Authorizing...' : 'Connect Google Calendar'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Account Details Box */}
          {isConnected ? (
            <div className="p-4 rounded-xl bg-card border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {settings?.google_calendar_email?.charAt(0).toUpperCase() || 'G'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {settings?.google_calendar_email}
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                    <span>Primary Calendar: <code className="text-foreground/80">primary</code></span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Radio className="w-3 h-3 animate-ping" /> Real-time bi-directional sync
                    </span>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Latency: {testResult.latencyMs}ms (API Healthy)
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">Google Calendar is not linked yet</p>
                <p className="text-muted-foreground">
                  Connecting your Google Calendar enables FastestHR to check your real-time busy slots and automatically push new guest bookings directly into your calendar.
                </p>
              </div>
            </div>
          )}

          {/* Preferences Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Auto Google Meet Video Links */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  Auto-Generate Google Meet Links
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically provision a dedicated Google Meet room for every confirmed booking.
                </p>
              </div>
              <Switch
                checked={settings?.auto_google_meet ?? true}
                onCheckedChange={(checked) => onUpdateSettings({ auto_google_meet: checked })}
                disabled={isLoading}
              />
            </div>

            {/* Active Scheduling Status */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Accept New Bookings
                </div>
                <p className="text-xs text-muted-foreground">
                  Turn off your public booking link temporarily when you are on vacation or unavailable.
                </p>
              </div>
              <Switch
                checked={settings?.is_active ?? true}
                onCheckedChange={(checked) => onUpdateSettings({ is_active: checked })}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Zero Double-Bookings</h4>
          <p className="text-xs text-muted-foreground">
            FastestHR cross-references your Google Calendar in real time before displaying slots to guests.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Video className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Instant Video Meetings</h4>
          <p className="text-xs text-muted-foreground">
            Both host and guest receive full calendar invites with instant Google Meet join links and email reminders.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <ExternalLink className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Universal Compatibility</h4>
          <p className="text-xs text-muted-foreground">
            Guests can sync bookings directly to Apple iCal, Outlook, or Google Calendar with 1-click downloads.
          </p>
        </div>
      </div>
    </div>
  );
}
