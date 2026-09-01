import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Cloud, HardDrive, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery } from '@tanstack/react-query';
import { getCompanyStorageConfig } from '@/lib/storage-provider';

export default function IntegrationsSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;

  const { data: storageConfig } = useQuery({
    queryKey: ['company-storage-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return await getCompanyStorageConfig(companyId);
    },
    enabled: !!companyId,
  });

  const isDriveConnected = !!(
    storageConfig &&
    storageConfig.provider === 'google_drive' &&
    storageConfig.is_active &&
    storageConfig.root_folder_id
  );

  const [connections, setConnections] = useState<Record<string, boolean>>({
    Slack: false,
    'Google Calendar': false,
    Zoom: false,
    Jira: false,
  });

  const integrations = [
    { name: 'Slack', desc: 'Send notifications to Slack channels', icon: '💬' },
    { name: 'Google Calendar', desc: 'Sync leave requests and holiday timelines', icon: '📅' },
    { name: 'Zoom', desc: 'Schedule applicant meetings automatically', icon: '📹' },
    { name: 'Jira', desc: 'Track project assignments and board sprint times', icon: '📋' },
  ];

  const toggleConnection = (name: string) => {
    setConnections(prev => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Integrations & Connected Apps</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services and cloud storage providers to power your workspace
        </p>
      </div>

      {/* Featured: Google Drive BYOS Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-md overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">Google Drive Storage (BYOS)</h3>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20">
                  Featured
                </Badge>
                {isDriveConnected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                    Supabase Default
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                Store all employee documents, payslips, and offer letters inside your company's own Google Drive in the <strong className="text-foreground">"FastestHR"</strong> folder. Reclaim platform quota and maintain full data ownership.
              </p>
              {isDriveConnected && storageConfig?.connected_email && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  Connected as: <span className="text-foreground font-medium">{storageConfig.connected_email}</span>
                </p>
              )}
            </div>
          </div>

          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm shrink-0">
            <Link to="/settings/storage">
              <HardDrive className="w-3.5 h-3.5" />
              {isDriveConnected ? 'Manage Drive Storage' : 'Connect Google Drive'}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-xs">Productivity Extensions</h3>
          <p className="text-xs text-muted-foreground mb-4">Connect external tools to enable automated communications and calendar synchronization.</p>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map(int => {
              const isConnected = connections[int.name];
              return (
                <Card key={int.name} className="border-border/50 bg-card/60 shadow-none overflow-hidden hover:bg-card/90 transition-all duration-200">
                  <div className="p-4 flex flex-col justify-between h-full gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" role="img" aria-label={int.name}>{int.icon}</span>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{int.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
                      </div>
                    </div>
                    <Button 
                      variant={isConnected ? 'secondary' : 'outline'} 
                      size="sm" 
                      onClick={() => toggleConnection(int.name)}
                      className="w-full font-semibold text-xs mt-2"
                    >
                      {isConnected ? 'Connected ✓' : 'Connect'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
