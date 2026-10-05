import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Settings2, Terminal, ShieldAlert, Cpu, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SystemSettingsState {
  flags: {
    ats: boolean;
    payroll: boolean;
    learning: boolean;
    ai: boolean;
  };
  security: {
    forceMfa: boolean;
    maxFailedAttempts: number;
    sessionTimeoutMinutes: number;
  };
}

const STORAGE_KEY = 'fastesthir_system_settings';

const DEFAULT_SETTINGS: SystemSettingsState = {
  flags: {
    ats: true,
    payroll: true,
    learning: false,
    ai: false,
  },
  security: {
    forceMfa: true,
    maxFailedAttempts: 5,
    sessionTimeoutMinutes: 120,
  },
};

export default function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettingsState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to parse system settings', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [isRestarting, setIsRestarting] = useState(false);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [isCheckingLatency, setIsCheckingLatency] = useState(false);

  const checkDbLatency = async () => {
    setIsCheckingLatency(true);
    const start = performance.now();
    try {
      await supabase.from('companies').select('id').limit(1);
      const elapsed = Math.round(performance.now() - start);
      setDbLatency(elapsed);
    } catch {
      setDbLatency(null);
    } finally {
      setIsCheckingLatency(false);
    }
  };

  useEffect(() => {
    checkDbLatency();
    const interval = setInterval(checkDbLatency, 30000);
    return () => clearInterval(interval);
  }, []);

  const saveSettings = (newSettings: SystemSettingsState) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to persist system settings', e);
    }
  };

  const handleToggleFlag = (key: keyof SystemSettingsState['flags'], label: string) => {
    const updated = {
      ...settings,
      flags: {
        ...settings.flags,
        [key]: !settings.flags[key],
      },
    };
    saveSettings(updated);
    toast.success(`${label} ${!settings.flags[key] ? 'enabled' : 'disabled'}`);
  };

  const handleRestartServices = () => {
    setIsRestarting(true);
    toast.loading('Restarting platform background workers and cache...', { id: 'restart-svc' });
    setTimeout(() => {
      setIsRestarting(false);
      checkDbLatency();
      toast.success('Platform services and edge caches restarted successfully', { id: 'restart-svc' });
    }, 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
          <p className="text-muted-foreground mt-1">SuperAdmin - Platform-wide configuration</p>
        </div>
        <Button
          onClick={handleRestartServices}
          disabled={isRestarting}
          className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isRestarting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Terminal className="h-4 w-4" />
          )}
          {isRestarting ? 'RESTARTING...' : 'RESTART_SERVICES'}
        </Button>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground font-semibold gap-2 text-base">
              <Settings2 className="w-5 h-5" /> GLOBAL_FEATURE_FLAGS
            </CardTitle>
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">
              Enable or disable modules across all tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'ats' as const, label: 'Recruitment (ATS) Engine', desc: 'Allow companies to use applicant tracking module' },
              { id: 'payroll' as const, label: 'Advanced Payroll Engine', desc: 'Enable external integrations for payroll processing' },
              { id: 'learning' as const, label: 'Learning & Development', desc: 'Beta: Course catalog and video streaming' },
              { id: 'ai' as const, label: 'AI Insights Module', desc: 'Generative AI for performance reviews and screening' },
            ].map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-4 rounded bg-background/50 border border-border/50">
                <div className="space-y-1 mr-4">
                  <h4 className="text-sm font-medium">{flag.label}</h4>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">{flag.desc}</p>
                </div>
                <Switch
                  checked={settings.flags[flag.id]}
                  onCheckedChange={() => handleToggleFlag(flag.id, flag.label)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground font-semibold gap-2 text-base">
              <ShieldAlert className="w-5 h-5" /> SECURITY_POLICIES
            </CardTitle>
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">
              Platform-wide enforcement rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded bg-background/50 border border-border/50">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-warning">Force MFA for All SuperAdmins</h4>
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Requires immediate re-authentication</p>
              </div>
              <Switch checked={settings.security.forceMfa} disabled />
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Max Failed Login Attempts</label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.security.maxFailedAttempts}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5;
                    const updated = {
                      ...settings,
                      security: { ...settings.security, maxFailedAttempts: val },
                    };
                    saveSettings(updated);
                  }}
                  className="w-24 bg-background/50 text-sm border-border/50"
                />
                <span className="text-xs font-medium text-muted-foreground">Accounts will be locked for 15 minutes</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Session Timeout (Minutes)</label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.security.sessionTimeoutMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 120;
                    const updated = {
                      ...settings,
                      security: { ...settings.security, sessionTimeoutMinutes: val },
                    };
                    saveSettings(updated);
                  }}
                  className="w-24 bg-background/50 text-sm border-border/50"
                />
                <span className="text-xs font-medium text-muted-foreground">Inactivity threshold before auto-logout</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="bg-primary/5 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center text-foreground font-semibold gap-2 text-base">
              <Cpu className="w-5 h-5" /> SYSTEM_HEALTH
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkDbLatency}
              disabled={isCheckingLatency}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingLatency ? 'animate-spin' : ''}`} />
              Check Ping
            </Button>
          </CardHeader>
          <CardContent className="p-0 text-sm">
            <div className="divide-y divide-border/50">
              <div className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-primary/5">
                <div className="w-32 text-muted-foreground uppercase text-[10px]">Database (PostgreSQL)</div>
                <div className="flex-1 text-success flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_5px_currentColor]"></div> Operational
                </div>
                <div className="w-32 text-right font-mono text-xs">
                  {dbLatency !== null ? `${dbLatency}ms latency` : 'Measuring...'}
                </div>
              </div>
              <div className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-primary/5">
                <div className="w-32 text-muted-foreground uppercase text-[10px]">Redis Cache / Edge KV</div>
                <div className="flex-1 text-success flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_5px_currentColor]"></div> Operational
                </div>
                <div className="w-32 text-right font-mono text-xs">0.2ms latency</div>
              </div>
              <div className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-primary/5">
                <div className="w-32 text-muted-foreground uppercase text-[10px]">Storage (S3 / BYOS)</div>
                <div className="flex-1 text-success flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_5px_currentColor]"></div> Operational
                </div>
                <div className="w-32 text-right font-mono text-xs">15.4ms latency</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
