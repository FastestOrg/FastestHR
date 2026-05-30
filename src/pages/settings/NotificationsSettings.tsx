import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState({
    leave_requests: true, 
    new_hires: true, 
    birthdays: true, 
    anniversaries: true,
    payroll_runs: true, 
    ticket_updates: true, 
    performance_reviews: false, 
    document_expiry: true,
  });

  const handleSave = () => {
    toast.success('Notification preferences saved');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Notifications Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure email alerts and system notifications for your administration team</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-xs">Email Notifications</h3>
          <p className="text-xs text-muted-foreground mb-4">Choose which workplace events trigger email notifications to administrators.</p>
          
          <div className="space-y-3">
            {Object.entries(prefs).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-3.5 rounded-lg border border-border/50 bg-background/30">
                <span className="text-sm font-semibold text-foreground capitalize" id={`label-notify-${key}`}>
                  {key.replace(/_/g, ' ')}
                </span>
                <button
                  role="switch"
                  aria-checked={val}
                  aria-labelledby={`label-notify-${key}`}
                  onClick={() => setPrefs(p => ({ ...p, [key]: !val }))}
                  className={`w-10 h-5 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${val ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all shadow-sm ${val ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button onClick={handleSave} className="font-semibold px-6">
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
