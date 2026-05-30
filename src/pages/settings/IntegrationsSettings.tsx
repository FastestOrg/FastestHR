import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function IntegrationsSettings() {
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
        <h2 className="text-xl font-bold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect corporate work management extensions to orchestrate employee workflows</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-xs">Available Extensions</h3>
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
