import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  ShieldCheck,
  Zap,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Server,
  Activity,
  ArrowRightLeft,
  KeyRound,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Unplug,
  Code2,
  Eye,
  EyeOff,
  Clock,
  Radio,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useOrgClient } from '@/hooks/useOrgClient';
import { supabase } from '@/integrations/supabase/client';
import { BYOS_MIGRATION_SQL, BYOS_SCHEMA_VERSION } from '@/lib/byos-migration-bundle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function BYOSSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const { orgClient, isBYOS, byosStatus, healthStatus, isBYOSLoading, byosUrl, refreshBYOS } = useOrgClient();

  // Form State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [managementToken, setManagementToken] = useState('');
  const [showServiceKey, setShowServiceKey] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'configure' | 'sql' | 'audit'>('configure');
  const [liveLatency, setLiveLatency] = useState<number | null>(null);

  // Fetch full status and audit log
  const { data: statusData, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['byos-full-status', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'status', company_id: companyId },
      });
      if (error) throw error;
      return data as {
        connection: any;
        byosEnabled: boolean;
        auditLogs: Array<{
          id: string;
          action: string;
          status: string;
          details: any;
          created_at: string;
          performed_by?: string;
        }>;
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 30,
  });

  // Validate Mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!supabaseUrl.trim() || !anonKey.trim() || !serviceRoleKey.trim()) {
        throw new Error('Please fill in Supabase URL, Anon Key, and Service Role Key.');
      }
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: {
          action: 'validate',
          company_id: companyId,
          supabase_url: supabaseUrl.trim(),
          supabase_anon_key: anonKey.trim(),
          supabase_service_role_key: serviceRoleKey.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setLiveLatency(data.latencyMs);
      toast.success(data.message || 'Connection validated successfully!');
      refetchStatus();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to validate connection.');
    },
  });

  // Connect & Activate Mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!supabaseUrl.trim() || !anonKey.trim() || !serviceRoleKey.trim()) {
        throw new Error('Please provide all credentials.');
      }
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: {
          action: 'connect',
          company_id: companyId,
          supabase_url: supabaseUrl.trim(),
          supabase_anon_key: anonKey.trim(),
          supabase_service_role_key: serviceRoleKey.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'BYOS Connected successfully!');
      refreshBYOS();
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['byos-connection', companyId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to connect BYOS.');
    },
  });

  // Migrate Mutation
  const migrateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: {
          action: 'migrate',
          company_id: companyId,
          management_token: managementToken.trim() || undefined,
          sql_override: BYOS_MIGRATION_SQL,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Schema migration completed and database activated!');
      refreshBYOS();
      refetchStatus();
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Migration failed.');
    },
  });

  // Differential Sync Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'sync-data', company_id: companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Data sync complete!');
      refetchStatus();
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Data sync failed.');
    },
  });

  // Health Check Mutation
  const healthMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'health', company_id: companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setLiveLatency(data.latencyMs);
      toast.success(data.message || `Health check OK (${data.latencyMs}ms)`);
      refetchStatus();
      refreshBYOS();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Health probe failed.');
    },
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'disconnect', company_id: companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'BYOS Disconnected. Data restored to Platform DB.');
      setShowDisconnectModal(false);
      refreshBYOS();
      refetchStatus();
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to disconnect BYOS.');
    },
  });

  const copySQLToClipboard = () => {
    navigator.clipboard.writeText(BYOS_MIGRATION_SQL);
    setCopiedSQL(true);
    toast.success('SQL migration script copied to clipboard!');
    setTimeout(() => setCopiedSQL(false), 3000);
  };

  const connectionActive = isBYOS && (statusData?.byosEnabled || byosStatus === 'active');
  const connectionPending = statusData?.connection && !connectionActive;

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                Bring Your Own Supabase (BYOS)
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 border-primary/30 text-primary">
                  Enterprise
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect your dedicated Supabase database to maintain complete data sovereignty and direct database control.
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Hero Pill */}
        <div className="flex items-center gap-2">
          {connectionActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>BYOS Active (Data Plane)</span>
              {liveLatency && <span className="opacity-70 font-mono text-[11px]">• {liveLatency}ms</span>}
            </div>
          ) : connectionPending ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Pending Migration</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
              <Server className="w-3.5 h-3.5" />
              <span>FastestHR Hosted Cloud DB</span>
            </div>
          )}
        </div>
      </div>

      {/* Architecture Visualizer Card */}
      <Card className="border-border/60 bg-gradient-to-br from-card via-card to-background shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/30 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold tracking-tight uppercase text-xs flex items-center gap-2 text-foreground">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Control Plane vs. Data Plane Architecture
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-mono">v{BYOS_SCHEMA_VERSION}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-5">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Control Plane Box */}
            <div className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span>Control Plane (Centralized)</span>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold">FastestHR Cloud</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Handles user authentication, platform memberships, subscriptions, license tracking, and encrypted connection secrets.
              </p>
              <div className="pt-1 flex flex-wrap gap-1.5">
                {['auth.users', 'companies', 'profiles', 'byos_connections', 'billing'].map(item => (
                  <span key={item} className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Data Plane Box */}
            <div className={`p-4 rounded-xl border space-y-2 transition-all ${
              connectionActive
                ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                : 'border-border/50 bg-background/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Database className={`w-4 h-4 ${connectionActive ? 'text-emerald-500' : 'text-primary'}`} />
                  <span>Data Plane ({connectionActive ? 'Your Supabase DB' : 'Platform DB'})</span>
                </div>
                <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${
                  connectionActive ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''
                }`}>
                  {connectionActive ? 'Customer Project' : 'Shared Multi-Tenant'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Stores all company employees, attendance, leaves, payroll runs, job candidates, chats, and confidential records.
              </p>
              <div className="pt-1 flex flex-wrap gap-1.5">
                {['employees', 'attendance', 'payroll', 'recruitment', 'chats', 'tasks', '40+ tables'].map(item => (
                  <span key={item} className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    connectionActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' : 'bg-muted/60 text-muted-foreground border-border/40'
                  }`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTab('configure')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'configure'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Configuration & Actions
        </button>
        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'sql'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Manual SQL Bundle
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Audit Log ({statusData?.auditLogs?.length || 0})
        </button>
      </div>

      {/* Tab 1: Configuration & Action Controls */}
      {activeTab === 'configure' && (
        <div className="space-y-6">
          {connectionActive ? (
            /* Active Connection Dashboard */
            <Card className="border-emerald-500/30 bg-emerald-500/[0.02] shadow-sm">
              <CardHeader className="pb-4 border-b border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      Active BYOS Connection
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Your organization is executing all business queries directly against your dedicated database.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => healthMutation.mutate()}
                      disabled={healthMutation.isPending}
                      className="gap-2 text-xs"
                    >
                      {healthMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      Test Health
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      className="gap-2 text-xs"
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-primary" />
                      )}
                      Differential Sync
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDisconnectModal(true)}
                      className="gap-2 text-xs"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl border border-border/50 bg-background/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Target Endpoint</span>
                    <span className="text-sm font-mono font-medium text-foreground truncate block" title={statusData?.connection?.supabase_url || byosUrl || ''}>
                      {statusData?.connection?.supabase_url || byosUrl || '—'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/50 bg-background/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Health State</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-sm font-semibold capitalize text-foreground">{healthStatus || statusData?.connection?.health_status || 'Healthy'}</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/50 bg-background/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Last Health Check</span>
                    <span className="text-sm text-foreground">
                      {statusData?.connection?.last_health_check
                        ? new Date(statusData.connection.last_health_check).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Connection Credentials Form */
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/30">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  Connect Your Supabase Project
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Provide your Supabase project API credentials. Your Secret Service Role Key is encrypted at rest using PostgreSQL <code className="text-foreground font-mono">pgcrypto</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                {/* Supabase URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Supabase Project URL *</label>
                  <Input
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Found in your Supabase Dashboard under <span className="font-semibold text-foreground">Project Settings → API → Project URL</span>.
                  </p>
                </div>

                {/* Anon / Public Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">Anon / Public API Key *</label>
                  <Input
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Public client key used for frontend browser queries.
                  </p>
                </div>

                {/* Service Role Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground">Service Role Secret Key *</label>
                    <button
                      type="button"
                      onClick={() => setShowServiceKey(!showServiceKey)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      {showServiceKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showServiceKey ? 'Hide Secret' : 'Show Secret'}
                    </button>
                  </div>
                  <Input
                    type={showServiceKey ? 'text' : 'password'}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={serviceRoleKey}
                    onChange={(e) => setServiceRoleKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for server-side edge functions and schema migrations. Encrypted immediately on save.
                  </p>
                </div>

                {/* Optional Management Token */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <span>Personal Access Token (PAT)</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">Optional for 1-Click Migration</Badge>
                  </label>
                  <Input
                    type="password"
                    placeholder="sbp_0123456789abcdef..."
                    value={managementToken}
                    onChange={(e) => setManagementToken(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Allows FastestHR to automatically apply the SQL schema to your project via the Supabase Management API without copy-pasting.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending || !supabaseUrl || !anonKey || !serviceRoleKey}
                    variant="outline"
                    className="gap-2 text-xs font-semibold"
                  >
                    {validateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                    1. Test & Validate
                  </Button>

                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending || !supabaseUrl || !anonKey || !serviceRoleKey}
                    className="gap-2 text-xs font-semibold"
                  >
                    {connectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    2. Save & Connect
                  </Button>

                  {statusData?.connection && (
                    <Button
                      onClick={() => migrateMutation.mutate()}
                      disabled={migrateMutation.isPending}
                      variant="secondary"
                      className="gap-2 text-xs font-semibold"
                    >
                      {migrateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                      3. Deploy Schema & Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Manual SQL Bundle */}
      {activeTab === 'sql' && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" />
                  BYOS Data Plane SQL Migration Bundle
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Copy and run this SQL script inside your dedicated Supabase project's SQL Editor (<span className="font-mono text-foreground">SQL Editor → New Query</span>).
                </CardDescription>
              </div>
              <Button
                onClick={copySQLToClipboard}
                size="sm"
                className="gap-2 text-xs font-semibold shrink-0"
              >
                {copiedSQL ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSQL ? 'Copied to Clipboard!' : 'Copy Entire SQL Bundle'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-2 text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                How to deploy manually:
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Log in to your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a>.</li>
                <li>Open your dedicated project and navigate to the <span className="font-semibold text-foreground">SQL Editor</span> tab.</li>
                <li>Click <span className="font-semibold text-foreground">New Query</span>, paste the script below, and click <span className="font-semibold text-foreground">Run</span>.</li>
                <li>Return here to the <span className="font-semibold text-foreground">Configuration</span> tab and click <span className="font-semibold text-foreground">Deploy Schema & Activate</span>.</li>
              </ol>
            </div>

            <div className="relative rounded-xl border border-border/60 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 overflow-x-auto max-h-[500px]">
              <pre>{BYOS_MIGRATION_SQL}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Real-Time Audit Trail */}
      {activeTab === 'audit' && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  BYOS Audit Log & History
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Complete chronological trail of all connection events, data migrations, health checks, and sync operations.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                disabled={isLoadingStatus}
                className="gap-2 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0">
            {statusData?.auditLogs && statusData.auditLogs.length > 0 ? (
              <div className="divide-y divide-border/40">
                {statusData.auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold ${
                            log.status === 'success'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : log.status === 'failed'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {log.status}
                        </Badge>
                        <span className="text-sm font-semibold uppercase text-xs text-foreground tracking-wide font-mono">
                          {log.action}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-xl">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No audit events recorded yet. Perform a validation or connection to generate log entries.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disconnect Safety Modal */}
      <AnimatePresence>
        {showDisconnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-card border border-destructive/30 rounded-2xl shadow-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-destructive">
                <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Disconnect BYOS Database?</h3>
                  <p className="text-xs text-muted-foreground">Automated safe rollback & restore procedure</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">
                  FastestHR will execute the following automated steps:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Pull 100% of current tenant data from your remote DB back to the FastestHR Platform Database.</li>
                  <li>Cleanly remove tenant records from your customer database in reverse topological order.</li>
                  <li>Restore tenant query routing to the centralized Platform Database.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectModal(false)}
                  disabled={disconnectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="gap-2"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unplug className="w-3.5 h-3.5" />
                  )}
                  Pull Data & Disconnect
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
