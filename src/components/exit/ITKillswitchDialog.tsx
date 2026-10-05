import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Download,
  AlertTriangle,
  Lock,
  Mail,
  MessageSquare,
  GitBranch,
  Laptop,
  FileCheck,
} from 'lucide-react';
import {
  executeITDeprovisioningKillswitch,
  ITKillswitchResult,
} from '@/lib/integrations/itDeprovisioningService';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface ITKillswitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    work_email?: string;
    employee_code?: string;
    departments?: { name: string };
  } | null;
  onSuccess?: () => void;
}

export function ITKillswitchDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: ITKillswitchDialogProps) {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ITKillswitchResult | null>(null);

  const [services, setServices] = useState({
    fastestHrPortal: true,
    googleWorkspace: true,
    slack: true,
    github: true,
    hardwareAssets: true,
  });

  if (!employee) return null;

  const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee';

  const handleExecute = async () => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Unauthorized execution: missing admin credentials');
      return;
    }

    setLoading(true);
    try {
      const res = await executeITDeprovisioningKillswitch({
        employeeId: employee.id,
        companyId: profile.company_id,
        executedByUserId: profile.id,
        executedByName: profile.full_name || 'Admin',
        servicesToRevoke: services,
      });

      setResult(res);
      toast.success(`IT Deprovisioning Killswitch executed for ${fullName}`);
      onSuccess?.();
    } catch (err: any) {
      console.error('Killswitch error:', err);
      toast.error(err?.message || 'Failed to execute IT killswitch');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!result) return;
    const certText = `
========================================================================
             FASTESTHR — CRYPTOGRAPHIC IT CLEARANCE CERTIFICATE
========================================================================

EMPLOYEE NAME:    ${result.employeeName}
EMPLOYEE CODE:    ${employee.employee_code || 'N/A'}
WORK EMAIL:       ${result.workEmail || 'N/A'}
SEPARATION DATE:  ${new Date(result.executedAt).toLocaleDateString()}
EXECUTION TIME:   ${result.executedAt}
EXECUTED BY:      ${result.executedBy}

------------------------------------------------------------------------
REVOKED SERVICES & ACCESS CLEARANCE:
------------------------------------------------------------------------
${result.results
  .map(
    (r) =>
      `[${r.status.toUpperCase()}] ${r.service}\n  Status: ${r.message}\n  Timestamp: ${r.timestamp}`
  )
  .join('\n\n')}

------------------------------------------------------------------------
SHA-256 CRYPTOGRAPHIC CLEARANCE HASH:
${result.clearanceHash}
------------------------------------------------------------------------
This document confirms that all organizational credentials, mailboxes, 
cloud repositories, chat spaces, and confidential tokens have been 
permanently revoked in accordance with ISO 27001 & SOC2 Trust Principles.
========================================================================
    `.trim();

    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IT_Clearance_Certificate_${employee.employee_code || employee.first_name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Clearance certificate downloaded');
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-rose-500">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              IT Deprovisioning & Killswitch
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Instantly revoke SaaS logins, email accounts, and repository access for departing personnel.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5 pt-3">
            {/* Employee Preview Header */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-foreground">{fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {employee.work_email} • {employee.departments?.name || 'Staff'}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-[11px] border-rose-500/30 text-rose-500 bg-rose-500/10">
                Action Pending
              </Badge>
            </div>

            {/* Checklist of systems to kill */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Revocation Scope & Systems
              </p>
              <div className="grid gap-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/30 bg-card/60">
                  <Checkbox
                    id="portal"
                    checked={services.fastestHrPortal}
                    onCheckedChange={(c) => setServices((s) => ({ ...s, fastestHrPortal: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="portal" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                      <Lock className="w-3.5 h-3.5 text-primary" /> FastestHR Portal Account
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Terminates employee status and invalidates active JWT sessions immediately.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/30 bg-card/60">
                  <Checkbox
                    id="google"
                    checked={services.googleWorkspace}
                    onCheckedChange={(c) => setServices((s) => ({ ...s, googleWorkspace: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="google" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                      <Mail className="w-3.5 h-3.5 text-blue-500" /> Google Workspace / M365
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Suspends mailbox, resets password, and revokes mobile OAuth tokens.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/30 bg-card/60">
                  <Checkbox
                    id="slack"
                    checked={services.slack}
                    onCheckedChange={(c) => setServices((s) => ({ ...s, slack: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="slack" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-500" /> Slack / Teams Workspace
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Deactivates user profile and terminates all active channel sessions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/30 bg-card/60">
                  <Checkbox
                    id="github"
                    checked={services.github}
                    onCheckedChange={(c) => setServices((s) => ({ ...s, github: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="github" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                      <GitBranch className="w-3.5 h-3.5 text-amber-500" /> GitHub / GitLab / Linear
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Removes organization memberships, SSH keys, and personal access tokens.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/30 bg-card/60">
                  <Checkbox
                    id="hardware"
                    checked={services.hardwareAssets}
                    onCheckedChange={(c) => setServices((s) => ({ ...s, hardwareAssets: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="hardware" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                      <Laptop className="w-3.5 h-3.5 text-emerald-500" /> Hardware Asset Verification
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Logs return of physical laptops, security keys, and building badges.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning callout */}
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Executing the killswitch permanently severs external SSO connections and generates an immutable tamper-evident audit record.
              </span>
            </div>
          </div>
        ) : (
          /* Execution Result State */
          <div className="space-y-4 pt-3">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1.5">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-emerald-500">
                IT Deprovisioning Successfully Finalized
              </h3>
              <p className="text-xs text-muted-foreground">
                All selected SaaS and platform credentials have been revoked.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">SHA-256 Clearance Hash:</span>
                <span className="font-mono text-[11px] text-primary truncate max-w-[200px]" title={result.clearanceHash}>
                  {result.clearanceHash.slice(0, 16)}...{result.clearanceHash.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Executed At:</span>
                <span className="font-mono text-[11px] text-foreground">
                  {new Date(result.executedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Authorized By:</span>
                <span className="font-medium text-foreground">{result.executedBy}</span>
              </div>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {result.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20">
                  <span className="text-foreground/90">{r.service}</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                    Revoked
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleExecute}
                disabled={loading}
                className="w-full sm:flex-1 gap-1.5 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Execute Killswitch
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleDownloadCertificate} className="w-full sm:flex-1 gap-1.5">
                <Download className="w-4 h-4" /> Download Certificate
              </Button>
              <Button onClick={handleClose} className="w-full sm:flex-1">
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
