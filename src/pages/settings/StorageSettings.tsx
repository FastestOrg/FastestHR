import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Folder,
  FolderCheck,
  ShieldCheck,
  Zap,
  ArrowRight,
  Unplug,
  Database,
  FileText,
  FileSpreadsheet,
  FileCheck,
  Sparkles,
  Info,
  Loader2,
  Trash2,
  Check,
  Copy,
  FolderOpen,
  ArrowUpRight,
  KeyRound,
  FileUp
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import { 
  getCompanyStorageConfig, 
  invalidateStorageConfigCache,
  CompanyStorageConfig 
} from '@/lib/storage-provider';
import { 
  requestGoogleDriveAuthorization, 
  ensureFastestHRFolderStructure,
  testGoogleDriveConnection,
  DEFAULT_GOOGLE_CLIENT_ID,
  GoogleDriveSubfolders
} from '@/lib/google-drive';
import { 
  scanSupabaseDocumentsForMigration, 
  migrateDocumentsToGoogleDrive, 
  MigrationItem, 
  MigrationProgress, 
  MigrationResult 
} from '@/lib/storage-migration';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function StorageSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();

  const [customClientId, setCustomClientId] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // Migration states
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<MigrationItem[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [deleteFromSupabase, setDeleteFromSupabase] = useState(true);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showFirstTimeMigrationDialog, setShowFirstTimeMigrationDialog] = useState(false);

  // Fetch company storage integration
  const { data: storageConfig, isLoading, refetch } = useQuery({
    queryKey: ['company-storage-config', companyId],
    queryFn: async (): Promise<CompanyStorageConfig | null> => {
      if (!companyId) return null;
      invalidateStorageConfigCache(companyId);
      return await getCompanyStorageConfig(companyId, true);
    },
    enabled: !!companyId,
    staleTime: 1000 * 30,
  });

  const isConnected = !!(storageConfig && storageConfig.provider === 'google_drive' && storageConfig.is_active && storageConfig.root_folder_id);
  const subfolders = (storageConfig?.subfolders || {}) as GoogleDriveSubfolders;

  useEffect(() => {
    if (storageConfig?.client_id) {
      setCustomClientId(storageConfig.client_id);
    }
  }, [storageConfig]);

  // Background check for unconverted files if Drive is connected
  useEffect(() => {
    if (isConnected && companyId && scannedFiles.length === 0 && !isScanning && !isMigrating) {
      scanSupabaseDocumentsForMigration(companyId)
        .then((files) => {
          if (files && files.length > 0) {
            setScannedFiles(files);
          }
        })
        .catch((e) => console.warn('Background migration scan error:', e));
    }
  }, [isConnected, companyId]);

  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(null);

  // Connect Google Drive Handler (with Automatic First-Time Data Migration Prompt)
  const handleConnectGoogleDrive = async () => {
    if (!companyId) {
      toast.error('Company profile not found.');
      return;
    }

    setIsAuthorizing(true);
    try {
      toast.loading('Opening Google Authorization popup...', { id: 'gdrive-auth' });

      // 1. Authorize via Google Identity Services
      const auth = await requestGoogleDriveAuthorization(customClientId);
      setActiveAccessToken(auth.accessToken);
      toast.loading('Google account authorized! Provisioning FastestHR folders in your Drive...', { id: 'gdrive-auth' });

      // 2. Ensure "FastestHR" Folder & Subfolders
      const folderSetup = await ensureFastestHRFolderStructure(auth.accessToken);

      // 3. Save connection into database
      const tokenExpiresAt = new Date(Date.now() + auth.expiresIn * 1000).toISOString();
      const rootFolderUrl = folderSetup.rootFolder.webViewLink || `https://drive.google.com/drive/folders/${folderSetup.rootFolder.id}`;

      const { data, error } = await supabase.rpc('save_company_storage_integration', {
        p_company_id: companyId,
        p_provider: 'google_drive',
        p_connected_email: auth.user.email,
        p_account_name: auth.user.name,
        p_account_avatar: auth.user.picture || null,
        p_root_folder_id: folderSetup.rootFolder.id,
        p_root_folder_name: 'FastestHR',
        p_root_folder_url: rootFolderUrl,
        p_subfolders: folderSetup.subfolders as any,
        p_access_token: auth.accessToken,
        p_token_expires_at: tokenExpiresAt,
        p_client_id: customClientId.trim() || null,
      });

      if (error) throw error;

      invalidateStorageConfigCache(companyId);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['company-storage-config'] });

      // 4. SCAN FOR EXISTING COMPANY DATA TO MIGRATE
      toast.loading('Checking for existing company files to migrate...', { id: 'gdrive-auth' });
      try {
        const filesToMigrate = await scanSupabaseDocumentsForMigration(companyId);
        if (filesToMigrate.length > 0) {
          setScannedFiles(filesToMigrate);
          setDeleteFromSupabase(true);
          setMigrationResult(null);
          setMigrationProgress(null);
          setShowFirstTimeMigrationDialog(true);
          toast.success(`🎉 Google Drive connected! Found ${filesToMigrate.length} file(s) available to transfer.`, { id: 'gdrive-auth' });
        } else {
          toast.success('🎉 Google Drive connected successfully! Folder "FastestHR" is ready.', { id: 'gdrive-auth' });
        }
      } catch (scanErr) {
        console.warn('Post-connection scan error:', scanErr);
        toast.success('🎉 Google Drive connected successfully! Folder "FastestHR" is ready.', { id: 'gdrive-auth' });
      }
    } catch (err: any) {
      console.error('Google Drive connection error:', err);
      toast.error(err?.message || 'Failed to connect Google Drive.', { id: 'gdrive-auth' });
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Test Connection Handler
  const handleTestConnection = async () => {
    let token = activeAccessToken || storageConfig?.access_token;
    if (!token || !storageConfig?.root_folder_id) {
      // Prompt quick re-auth
      try {
        toast.loading('Authorizing Google Drive...', { id: 'gdrive-test-auth' });
        const auth = await requestGoogleDriveAuthorization(customClientId);
        token = auth.accessToken;
        setActiveAccessToken(token);
        toast.dismiss('gdrive-test-auth');
      } catch (e: any) {
        toast.error('Google Drive authorization required to run connection test.', { id: 'gdrive-test-auth' });
        return;
      }
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGoogleDriveConnection(token, storageConfig.root_folder_id);
      setTestResult(res);
      if (res.success) {
        toast.success(`Google Drive write & read verified (${res.latencyMs}ms)`);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  // Re-sync & Provision Folders
  const handleResyncFolders = async () => {
    let token = activeAccessToken || storageConfig?.access_token;
    if (!companyId || !token) {
      try {
        const auth = await requestGoogleDriveAuthorization(customClientId);
        token = auth.accessToken;
        setActiveAccessToken(token);
      } catch (e) {
        toast.error('Google authorization required.');
        return;
      }
    }

    try {
      toast.loading('Synchronizing folder hierarchy in Google Drive...', { id: 'resync' });
      const folderSetup = await ensureFastestHRFolderStructure(token);

      const { error } = await supabase.rpc('save_company_storage_integration', {
        p_company_id: companyId,
        p_provider: 'google_drive',
        p_connected_email: storageConfig?.connected_email,
        p_account_name: storageConfig?.account_name,
        p_account_avatar: storageConfig?.account_avatar,
        p_root_folder_id: folderSetup.rootFolder.id,
        p_root_folder_name: 'FastestHR',
        p_root_folder_url: folderSetup.rootFolder.webViewLink,
        p_subfolders: folderSetup.subfolders as any,
        p_access_token: token,
        p_token_expires_at: storageConfig?.token_expires_at,
        p_client_id: storageConfig?.client_id,
      });

      if (error) throw error;
      await refetch();
      toast.success('Folders synchronized successfully!', { id: 'resync' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync folders', { id: 'resync' });
    }
  };

  // Disconnect Handler
  const handleDisconnect = async () => {
    if (!companyId || !confirm('Are you sure you want to disconnect Google Drive? Subsequent file uploads will use default Supabase storage.')) return;

    try {
      toast.loading('Disconnecting Google Drive...', { id: 'disconnect' });
      const { error } = await supabase.rpc('disconnect_company_storage', {
        p_company_id: companyId,
      });

      if (error) throw error;

      setActiveAccessToken(null);
      invalidateStorageConfigCache(companyId);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['company-storage-config'] });
      toast.success('Google Drive disconnected. Reverted to default Supabase storage.', { id: 'disconnect' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect storage', { id: 'disconnect' });
    }
  };

  // Scan Supabase Files for Migration
  const handleScanFiles = async () => {
    if (!companyId) return;
    setIsScanning(true);
    setScannedFiles([]);
    setMigrationResult(null);

    try {
      const files = await scanSupabaseDocumentsForMigration(companyId);
      setScannedFiles(files);
      if (files.length === 0) {
        toast.info('No unconverted files found on Supabase. Everything is already stored in Google Drive!');
      } else {
        toast.success(`Found ${files.length} document(s) available for migration.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to scan files.');
    } finally {
      setIsScanning(false);
    }
  };

  // Execute Migration (with Fresh Token Verification)
  const handleExecuteMigration = async () => {
    if (!companyId || scannedFiles.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress(null);
    setMigrationResult(null);

    let token = activeAccessToken || storageConfig?.access_token;
    const isTokenExpired = storageConfig?.token_expires_at 
      ? new Date(storageConfig.token_expires_at).getTime() < Date.now() 
      : false;

    if (!token || isTokenExpired) {
      try {
        toast.loading('Refreshing Google authorization for transfer...', { id: 'gdrive-migrate-auth' });
        const auth = await requestGoogleDriveAuthorization(customClientId);
        token = auth.accessToken;
        setActiveAccessToken(token);

        const tokenExpiresAt = new Date(Date.now() + auth.expiresIn * 1000).toISOString();
        await supabase
          .from('company_storage_integrations')
          .update({
            access_token: token,
            token_expires_at: tokenExpiresAt,
          })
          .eq('company_id', companyId);

        toast.success('Google authorization active! Starting transfer...', { id: 'gdrive-migrate-auth' });
      } catch (authErr: any) {
        toast.error('Google authorization required to transfer files.', { id: 'gdrive-migrate-auth' });
        setIsMigrating(false);
        return;
      }
    }

    try {
      const result = await migrateDocumentsToGoogleDrive(companyId, scannedFiles, {
        accessToken: token,
        deleteFromSupabaseAfterMigration: deleteFromSupabase,
        onProgress: (prog) => setMigrationProgress(prog),
        onAuthRequired: async () => {
          const auth = await requestGoogleDriveAuthorization(customClientId);
          setActiveAccessToken(auth.accessToken);
          return auth.accessToken;
        },
      });

      setMigrationResult(result);
      if (result.succeeded > 0) {
        toast.success(`Migrated ${result.succeeded} file(s) to Google Drive!`);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ['company-storage-config'] });
        setScannedFiles([]);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card/80 to-primary/5 p-6 sm:p-8 border border-border/60 shadow-sm backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                <HardDrive className="w-3.5 h-3.5" />
                BYOS — Bring Your Own Storage
              </Badge>
              {isConnected ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 gap-1 text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  Google Drive Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
                  <Database className="w-3 h-3" />
                  Default Supabase Storage
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Storage & Google Drive Integration
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Connect your company's Google Drive. FastestHR will store all PDFs, payslips, offer letters, and employee documents inside your dedicated <span className="font-semibold text-foreground">"FastestHR"</span> folder, keeping full data ownership in your hands while freeing up Supabase storage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs font-semibold gap-1.5"
              >
                <Unplug className="w-3.5 h-3.5" />
                Disconnect Drive
              </Button>
            ) : (
              <Button
                onClick={handleConnectGoogleDrive}
                disabled={isAuthorizing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2"
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    Connect Google Drive
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status & Stats Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Storage Engine</p>
              <p className="text-lg font-bold text-foreground">
                {isConnected ? 'Google Drive' : 'Supabase Storage'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isConnected ? 'Client owned & zero quota limit' : 'Platform shared bucket'}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
              {isConnected ? <Cloud className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Drive Folder</p>
              <p className="text-lg font-bold text-foreground">
                {isConnected ? storageConfig?.root_folder_name || 'FastestHR' : 'None'}
              </p>
              {isConnected && storageConfig?.root_folder_url ? (
                <a
                  href={storageConfig.root_folder_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  Open in Drive <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <p className="text-[11px] text-muted-foreground">Not provisioned</p>
              )}
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <Folder className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Files in Google Drive</p>
              <p className="text-lg font-bold text-foreground">
                {storageConfig?.total_files_count || 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Saved from Supabase
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Supabase Space Saved</p>
              <p className="text-lg font-bold text-emerald-500 font-mono">
                {formatBytes(storageConfig?.total_bytes_stored || 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Total data transferred
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Zap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      {isConnected ? (
        /* CONNECTED STATE: FOLDER EXPLORER & ACTIONS */
        <div className="space-y-6">
          {/* Pending Migration Banner if unconverted files exist */}
          {scannedFiles.length > 0 && !isMigrating && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>{scannedFiles.length} past document(s) detected in Supabase Storage</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      Pending Migration
                    </Badge>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Transfer existing payslips, offers, and company files to your Google Drive to free up database quota.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setDeleteFromSupabase(true);
                  setShowFirstTimeMigrationDialog(true);
                }}
                className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shrink-0 gap-1.5 shadow-sm"
              >
                <FileUp className="w-3.5 h-3.5" /> Move to Drive Now
              </Button>
            </div>
          )}

          <Card className="border-border/60 bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {storageConfig?.account_avatar ? (
                    <img
                      src={storageConfig.account_avatar}
                      alt="Google Account"
                      className="w-10 h-10 rounded-full border border-border/60 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      G
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground text-sm">
                        {storageConfig?.account_name || 'Google Drive Connected'}
                      </h3>
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                        Connected
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {storageConfig?.connected_email || 'No email recorded'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                    Test Connection
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResyncFolders}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                    Verify Folders
                  </Button>

                  {storageConfig?.root_folder_url && (
                    <Button
                      size="sm"
                      asChild
                      className="text-xs font-semibold gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                    >
                      <a href={storageConfig.root_folder_url} target="_blank" rel="noreferrer">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open "FastestHR" Folder <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-xs flex items-center justify-between ${
                  testResult.success ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {testResult.message}
                  </span>
                  {testResult.success && <span className="font-mono">{testResult.latencyMs}ms</span>}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Google Drive Folder Hierarchy ("FastestHR")
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  These subfolders were automatically created in your Google Drive root. All files generated in FastestHR are organized into their respective folders.
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      name: 'Company Documents',
                      key: 'documents',
                      desc: 'HR policies, company guidelines & handbook',
                      icon: FileText,
                      color: 'text-blue-500 bg-blue-500/10',
                      sub: subfolders.documents,
                    },
                    {
                      name: 'Payslips',
                      key: 'payslips',
                      desc: 'Official monthly payroll salary slips',
                      icon: FileSpreadsheet,
                      color: 'text-emerald-500 bg-emerald-500/10',
                      sub: subfolders.payslips,
                    },
                    {
                      name: 'Offer Letters',
                      key: 'offer_letters',
                      desc: 'Candidate offers & employment contracts',
                      icon: FileCheck,
                      color: 'text-amber-500 bg-amber-500/10',
                      sub: subfolders.offer_letters,
                    },
                    {
                      name: 'Onboarding & Resumes',
                      key: 'onboarding',
                      desc: 'Employee verification & candidate resumes',
                      icon: ShieldCheck,
                      color: 'text-purple-500 bg-purple-500/10',
                      sub: subfolders.onboarding,
                    },
                    {
                      name: 'SendDesk Documents',
                      key: 'senddesk',
                      desc: 'SendDesk shared documents & certificates',
                      icon: Sparkles,
                      color: 'text-pink-500 bg-pink-500/10',
                      sub: subfolders.senddesk,
                    },
                  ].map((folder) => (
                    <div
                      key={folder.key}
                      className="p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all flex flex-col justify-between group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg ${folder.color}`}>
                          <folder.icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            {folder.name}
                            {folder.sub?.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {folder.desc}
                          </p>
                        </div>
                      </div>

                      {folder.sub?.webViewLink ? (
                        <a
                          href={folder.sub.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 text-[11px] text-primary hover:underline flex items-center gap-1 font-medium self-end opacity-80 group-hover:opacity-100 transition-opacity"
                        >
                          View in Drive <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="mt-3 text-[10px] text-muted-foreground self-end font-mono">
                          Provisioned in root
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Migration & Transfer Wizard */}
          <Card className="border-border/60 bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold">
                  Migration Tool
                </Badge>
                <CardTitle className="text-base font-bold">
                  Transfer Existing Supabase Files to Google Drive
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Scan your existing documents, past payslips, candidate resumes, and offer letters currently sitting on default Supabase storage, and seamlessly copy them over to your Google Drive.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    1. Scan Storage for Unconverted Documents
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Checks company documents, generated payslips, offer letters, job application resumes, and SendDesk files.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleScanFiles}
                  disabled={isScanning || isMigrating}
                  className="font-semibold text-xs gap-1.5"
                >
                  {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                  {isScanning ? 'Scanning...' : 'Scan Storage'}
                </Button>
              </div>

              {scannedFiles.length > 0 && (
                <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Ready to Migrate: {scannedFiles.length} file(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Files will be placed into their respective subfolders in <span className="font-semibold text-foreground">"FastestHR"</span>.
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          checked={deleteFromSupabase}
                          onChange={(e) => setDeleteFromSupabase(e.target.checked)}
                          className="rounded border-border"
                        />
                        Delete from Supabase after transfer (Free up quota)
                      </label>

                      <Button
                        size="sm"
                        onClick={handleExecuteMigration}
                        disabled={isMigrating}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm"
                      >
                        {isMigrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        {isMigrating ? 'Transferring...' : 'Start Migration'}
                      </Button>
                    </div>
                  </div>

                  {isMigrating && migrationProgress && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-foreground truncate max-w-xs">{migrationProgress.currentFileName}</span>
                        <span className="text-primary font-mono">{migrationProgress.percent}% ({migrationProgress.completed}/{migrationProgress.total})</span>
                      </div>
                      <Progress value={migrationProgress.percent} className="h-2" />
                    </div>
                  )}

                  {/* Scanned Files Preview list */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 pt-2">
                    {scannedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-card border border-border/40">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground truncate">{file.fileName}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                          {file.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {migrationResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  migrationResult.succeeded > 0 && migrationResult.failed === 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : migrationResult.succeeded > 0
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {migrationResult.succeeded > 0 && migrationResult.failed === 0 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span>Migration Complete!</span>
                        </>
                      ) : migrationResult.succeeded > 0 ? (
                        <>
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                          <span>Partial Migration Completed</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          <span>Transfer Could Not Complete</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-xs font-semibold">
                      {migrationResult.succeeded} / {migrationResult.total} Copied
                    </span>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {migrationResult.succeeded > 0
                      ? `Successfully transferred ${migrationResult.succeeded} file(s) (${formatBytes(migrationResult.totalBytes)}) directly into your Google Drive.`
                      : `None of the ${migrationResult.failed} file(s) could be transferred. They may be placeholder/missing objects in Supabase storage.`}
                  </p>

                  {migrationResult.errors.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {migrationResult.errors.length} Issue(s) Detected:
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {migrationResult.errors.slice(0, 10).map((err, i) => (
                          <div key={i} className="p-2 rounded bg-background/80 border border-border/40 text-[11px] font-mono flex flex-col gap-0.5">
                            <span className="font-bold text-foreground truncate">{err.fileName}</span>
                            <span className="text-destructive truncate text-[10px]">{err.error}</span>
                          </div>
                        ))}
                        {migrationResult.errors.length > 10 && (
                          <p className="text-[10px] text-muted-foreground text-center py-1">
                            + {migrationResult.errors.length - 10} more files failed (check Supabase storage bucket)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* DISCONNECTED STATE: STEP-BY-STEP CONNECT HERO */
        <div className="space-y-6">
          <Card className="border-border/60 bg-card shadow-sm overflow-hidden">
            <CardHeader className="text-center pb-2 pt-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                <Cloud className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-extrabold text-foreground">
                Connect Google Drive for Enterprise Storage
              </CardTitle>
              <CardDescription className="max-w-md mx-auto text-xs mt-1">
                Link your Google Drive account with 1-click. FastestHR automatically provisions a dedicated <span className="font-semibold text-foreground">"FastestHR"</span> folder to hold all your documents.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
              <Button
                size="lg"
                onClick={handleConnectGoogleDrive}
                disabled={isAuthorizing}
                className="w-full max-w-sm h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2.5 text-sm transition-all"
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Authorizing with Google...
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5" />
                    Sign in with Google to Connect Drive
                  </>
                )}
              </Button>

              <div className="grid gap-4 sm:grid-cols-3 max-w-3xl w-full text-center pt-4">
                <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-xs text-foreground">Full Privacy & Control</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Uses official <code className="text-[10px] text-primary">drive.file</code> scope. FastestHR can only access files it creates.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-2">
                    <FolderCheck className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-xs text-foreground">Auto-Folder Organization</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Generates a root <span className="font-semibold text-foreground">FastestHR</span> folder with subfolders for Payslips, Docs & Offers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-xs text-foreground">Free Supabase Quota</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Eliminate platform storage costs and host unlimited company files directly on your own Google Cloud Drive.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-2xl pt-2">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-sm font-bold">Google Cloud OAuth 2.0 Client ID</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Enter your Google OAuth 2.0 Web Client ID from Google Cloud Console to enable Google Sign-In and Google Drive syncing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                          Google OAuth Web Client ID
                        </Label>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Format: xxxxxxxxx.apps.googleusercontent.com
                        </span>
                      </div>
                      <Input
                        type="text"
                        placeholder="e.g. 1234567890-abcdefg123456.apps.googleusercontent.com"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        className="font-mono text-xs h-10 bg-background"
                      />
                    </div>

                    {/* Step-by-Step Google Cloud Setup Guide */}
                    <div className="p-3.5 rounded-xl bg-card border border-border/60 text-xs space-y-2.5">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-primary" />
                        Quick 2-Minute Google Cloud Setup Guide:
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
                        <li>
                          Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-primary underline font-medium inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a> and create/select a project.
                        </li>
                        <li>
                          Under <strong>APIs & Services &gt; Library</strong>, search and enable <strong>Google Drive API</strong>.
                        </li>
                        <li>
                          Under <strong>OAuth consent screen</strong>, set User Type to <strong>External</strong> and add scope <code className="text-primary bg-muted px-1 py-0.5 rounded">drive.file</code>. Add your email as a <strong>Test user</strong>.
                        </li>
                        <li>
                          Under <strong>Credentials &gt; Create Credentials &gt; OAuth client ID</strong>, choose <strong>Web application</strong>.
                        </li>
                        <li className="flex flex-wrap items-center gap-2">
                          <span>Add to <strong>Authorized JavaScript origins</strong>:</span>
                          <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono text-[11px] select-all">
                            {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                          </code>
                        </li>
                        <li>Copy the generated <strong>Client ID</strong> and paste it into the box above!</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* First-Time Data Migration Modal */}
      <Dialog
        open={showFirstTimeMigrationDialog}
        onOpenChange={(open) => {
          if (!isMigrating) setShowFirstTimeMigrationDialog(open);
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden border-border/60 bg-card shadow-2xl">
          <div className="relative p-6 sm:p-7 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-inner">
                <HardDrive className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-inner">
                <Cloud className="w-5 h-5" />
              </div>
              <Badge className="ml-auto bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[11px] font-semibold gap-1">
                <CheckCircle2 className="w-3 h-3" /> Drive Connected
              </Badge>
            </div>

            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Move Existing Company Files to Google Drive?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              We detected <span className="font-bold text-foreground">{scannedFiles.length} existing document(s)</span> currently stored in Supabase. Would you like to seamlessly copy them into your newly created <span className="font-semibold text-foreground">"FastestHR"</span> Drive subfolders now?
            </DialogDescription>
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            {/* Category breakdown badges */}
            {!migrationResult && scannedFiles.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Files Detected For Transfer
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(
                    scannedFiles.reduce((acc, file) => {
                      acc[file.category] = (acc[file.category] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([cat, count]) => {
                    const labelMap: Record<string, string> = {
                      documents: 'Company Docs',
                      payslips: 'Payslips',
                      offer_letters: 'Offer Letters',
                      onboarding: 'Onboarding & Resumes',
                      senddesk: 'SendDesk Docs',
                    };
                    return (
                      <div key={cat} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate">{labelMap[cat] || cat}</span>
                        <Badge variant="secondary" className="text-xs font-bold font-mono ml-1.5">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Progress Bar during active migration */}
            {isMigrating && migrationProgress && (
              <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground truncate max-w-[280px] flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    {migrationProgress.currentFileName}
                  </span>
                  <span className="text-primary font-mono font-bold">
                    {migrationProgress.percent}% ({migrationProgress.completed}/{migrationProgress.total})
                  </span>
                </div>
                <Progress value={migrationProgress.percent} className="h-2.5" />
                <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Transferring to Google Drive subfolders...</span>
                  <span className="font-mono">{formatBytes(migrationProgress.migratedBytes)}</span>
                </p>
              </div>
            )}

            {/* Migration Result Box */}
            {migrationResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                migrationResult.succeeded > 0 && migrationResult.failed === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : migrationResult.succeeded > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {migrationResult.succeeded > 0 && migrationResult.failed === 0 ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>All Files Transferred Successfully!</span>
                      </>
                    ) : migrationResult.succeeded > 0 ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span>Partial Transfer Completed</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        <span>Transfer Could Not Complete</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold">
                    {migrationResult.succeeded} / {migrationResult.total}
                  </span>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {migrationResult.succeeded > 0
                    ? `Successfully copied ${migrationResult.succeeded} file(s) (${formatBytes(migrationResult.totalBytes)}) directly into your company's Google Drive folders.`
                    : `Could not transfer ${migrationResult.failed} file(s). Files may be missing or empty in Supabase storage buckets.`}
                </p>

                {migrationResult.errors.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {migrationResult.errors.length} Issue(s) Details:
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {migrationResult.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="p-2 rounded bg-background/80 border border-border/40 text-[11px] font-mono flex flex-col gap-0.5">
                          <span className="font-bold text-foreground truncate">{err.fileName}</span>
                          <span className="text-destructive truncate text-[10px]">{err.error}</span>
                        </div>
                      ))}
                      {migrationResult.errors.length > 10 && (
                        <p className="text-[10px] text-muted-foreground text-center py-1">
                          + {migrationResult.errors.length - 10} more files failed
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Options Checkbox when not migrating */}
            {!isMigrating && !migrationResult && (
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={deleteFromSupabase}
                  onChange={(e) => setDeleteFromSupabase(e.target.checked)}
                  className="rounded border-border mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">
                    Delete original copies from Supabase Storage
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Frees up your database & storage quota while ensuring everything is safely preserved in your own Google Drive.
                  </p>
                </div>
              </label>
            )}
          </div>

          <DialogFooter className="p-6 sm:p-7 pt-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/40 mt-2 bg-muted/10">
            {migrationResult ? (
              <div className="flex items-center justify-between w-full gap-2">
                {migrationResult.failed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExecuteMigration}
                    disabled={isMigrating}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Transfer
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setShowFirstTimeMigrationDialog(false);
                    setMigrationResult(null);
                    refetch();
                  }}
                  className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5"
                >
                  <Check className="w-4 h-4" /> Done
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMigrating}
                  onClick={() => setShowFirstTimeMigrationDialog(false)}
                  className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
                >
                  I'll Do This Later
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteMigration}
                  disabled={isMigrating || scannedFiles.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-md w-full sm:w-auto"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Transferring Files...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" /> Move {scannedFiles.length} File(s) to Drive
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
