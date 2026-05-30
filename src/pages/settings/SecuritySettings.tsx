import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Security & SSO</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure company-wide password rules and access security profiles</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-xs">Password Strength Policy</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure complexity and lifespan specifications enforced for all accounts.</p>
            
            <div className="space-y-3">
              {[
                { label: 'Minimum password length', value: '8 characters' },
                { label: 'Require uppercase letters', value: 'Enabled' },
                { label: 'Require numbers', value: 'Enabled' },
                { label: 'Require special characters', value: 'Enabled' },
                { label: 'Password expiry', value: '90 days' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3.5 rounded-lg border border-border/50 bg-background/30">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold">{item.value}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-6">
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-xs">Two-Factor Authentication</h3>
            <p className="text-xs text-muted-foreground mb-4">Enforce multi-factor verification to secure admin logins.</p>
            
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/50 bg-background/30">
              <span className="text-sm font-semibold text-foreground">Require 2FA for all Administrators</span>
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px] uppercase font-bold">Recommended</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
