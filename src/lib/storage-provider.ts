import { supabase } from '@/integrations/supabase/client';
import {
  uploadFileToGoogleDrive,
  downloadFileFromGoogleDrive,
  deleteFileFromGoogleDrive,
  GoogleDriveSubfolders
} from '@/lib/google-drive';

export interface CompanyStorageConfig {
  id: string;
  company_id: string;
  provider: 'google_drive' | 'supabase';
  is_active: boolean;
  connected_email: string | null;
  account_name: string | null;
  account_avatar: string | null;
  root_folder_id: string;
  root_folder_name: string;
  root_folder_url: string | null;
  subfolders: GoogleDriveSubfolders | Record<string, any>;
  access_token: string | null;
  token_expires_at: string | null;
  client_id: string | null;
  total_files_count: number;
  total_bytes_stored: number;
  last_synced_at: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
}

export interface UploadStorageOptions {
  companyId: string;
  file: Blob | File;
  fileName: string;
  contentType?: string;
  bucket?: string;
  category?: 'documents' | 'payslips' | 'offer_letters' | 'onboarding' | 'senddesk';
  customPath?: string;
}

export interface UploadStorageResult {
  provider: 'google_drive' | 'supabase';
  path: string;
  driveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  publicUrl?: string;
  size: number;
}

// In-memory cache for storage configs per company
const storageConfigCache = new Map<string, { config: CompanyStorageConfig | null; cachedAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 2; // 2 minutes

/**
 * Fetches the active storage integration for a company.
 */
export async function getCompanyStorageConfig(companyId: string, forceRefresh = false): Promise<CompanyStorageConfig | null> {
  if (!companyId) return null;

  const now = Date.now();
  const cached = storageConfigCache.get(companyId);
  if (!forceRefresh && cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
    return cached.config;
  }

  try {
    const { data, error } = await supabase.rpc('get_company_storage_integration', {
      p_company_id: companyId,
    });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      storageConfigCache.set(companyId, { config: null, cachedAt: now });
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const config = row as CompanyStorageConfig;
    storageConfigCache.set(companyId, { config, cachedAt: now });
    return config;
  } catch (err) {
    console.warn('[StorageProvider] Error fetching storage integration:', err);
    return null;
  }
}

/**
 * Clears cached config for a company.
 */
export function invalidateStorageConfigCache(companyId?: string) {
  if (companyId) {
    storageConfigCache.delete(companyId);
  } else {
    storageConfigCache.clear();
  }
}

/**
 * Ensures a valid Google Drive access token is available for the company.
 * If the token is expired or expiring within 5 minutes, silently refreshes it via the google-storage-auth edge function.
 */
export async function ensureValidGoogleDriveAccessToken(
  companyId: string,
  forceRefresh = false
): Promise<string | null> {
  const config = await getCompanyStorageConfig(companyId, forceRefresh);
  if (!config || config.provider !== 'google_drive' || !config.is_active) {
    return null;
  }

  const now = Date.now();
  const expiry = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
  const isExpiringSoon = !config.access_token || expiry <= (now + 5 * 60 * 1000);

  if (!forceRefresh && !isExpiringSoon && config.access_token) {
    return config.access_token;
  }

  // Token is expired or expiring within 5 minutes; invoke edge function to refresh
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-storage-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'refresh_token',
        company_id: companyId,
        force_refresh: forceRefresh,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.accessToken) {
        config.access_token = data.accessToken;
        if (data.tokenExpiresAt) {
          config.token_expires_at = data.tokenExpiresAt;
        }
        storageConfigCache.set(companyId, { config, cachedAt: Date.now() });
        return data.accessToken;
      }
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[StorageProvider] Token auto-refresh failed:', err?.error || res.statusText);
    }
  } catch (refreshErr) {
    console.warn('[StorageProvider] Exception during token refresh:', refreshErr);
  }

  return config.access_token || null;
}

/**
 * Checks if Google Drive is connected and actively enabled for the company.
 */
export async function isGoogleDriveActive(companyId: string): Promise<boolean> {
  const config = await getCompanyStorageConfig(companyId);
  return !!(
    config &&
    config.provider === 'google_drive' &&
    config.is_active &&
    config.root_folder_id
  );
}

/**
 * Checks if a given file path string belongs to Google Drive.
 */
export function isDrivePath(path?: string | null): boolean {
  if (!path) return false;
  return path.startsWith('gdrive:') || path.includes('drive.google.com');
}

/**
 * Extracts Google Drive file ID from a stored path string.
 */
export function extractDriveFileId(path: string): string {
  if (!path) return '';
  if (path.startsWith('gdrive:')) {
    return path.replace('gdrive:', '').trim();
  }
  // Try extracting from webViewLink or webContentLink: /file/d/{id} or id={id}
  const matchD = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD) return matchD[1];
  const matchId = path.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  return path;
}

/**
 * Unified File Upload: Automatically saves to Google Drive (FastestHR folder) if connected,
 * otherwise saves to default Supabase Storage bucket.
 */
export async function uploadDocumentToStorage(options: UploadStorageOptions): Promise<UploadStorageResult> {
  const {
    companyId,
    file,
    fileName,
    contentType = 'application/pdf',
    bucket = 'documents',
    category = 'documents',
    customPath,
  } = options;

  if (!companyId) {
    throw new Error('companyId is required to upload files to storage');
  }

  const config = await getCompanyStorageConfig(companyId);
  const isDrive = !!(
    config &&
    config.provider === 'google_drive' &&
    config.is_active &&
    config.root_folder_id
  );

  // ─── 1. ROUTE TO GOOGLE DRIVE ─────────────────────────────────────────────
  if (isDrive && config) {
    try {
      // Auto-refresh token if expired or expiring within 5 minutes
      const validAccessToken = await ensureValidGoogleDriveAccessToken(companyId);
      if (!validAccessToken) {
        throw new Error('Google Drive access token could not be obtained or refreshed');
      }

      // Determine destination folder inside FastestHR
      let targetFolderId = config.root_folder_id;
      const subfolders = config.subfolders as Record<string, any>;
      if (category && subfolders && subfolders[category]?.id) {
        targetFolderId = subfolders[category].id;
      }

      let driveResult;
      try {
        driveResult = await uploadFileToGoogleDrive(
          validAccessToken,
          file,
          fileName,
          contentType,
          targetFolderId
        );
      } catch (firstTryErr: any) {
        // If 401 unauthorized or expired token, attempt immediate forced refresh and retry once
        if (
          firstTryErr?.message?.includes('401') ||
          firstTryErr?.message?.includes('Invalid Credentials') ||
          firstTryErr?.message?.includes('auth') ||
          firstTryErr?.message?.includes('token')
        ) {
          console.warn('[StorageProvider] Drive returned 401/token error, performing forced refresh and retrying upload...');
          const freshToken = await ensureValidGoogleDriveAccessToken(companyId, true);
          if (freshToken) {
            driveResult = await uploadFileToGoogleDrive(
              freshToken,
              file,
              fileName,
              contentType,
              targetFolderId
            );
          } else {
            throw firstTryErr;
          }
        } else {
          throw firstTryErr;
        }
      }

      const fileSize = driveResult.size || (file instanceof Blob ? file.size : 0);

      // Asynchronously update file metrics in background
      supabase
        .from('company_storage_integrations')
        .update({
          total_files_count: (config.total_files_count || 0) + 1,
          total_bytes_stored: (config.total_bytes_stored || 0) + fileSize,
          last_synced_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .then(() => { })
        .catch((e) => console.warn('Failed to update storage metrics:', e));

      return {
        provider: 'google_drive',
        path: `gdrive:${driveResult.id}`,
        driveFileId: driveResult.id,
        webViewLink: driveResult.webViewLink,
        webContentLink: driveResult.webContentLink,
        size: fileSize,
      };
    } catch (driveErr) {
      console.warn('[StorageProvider] Google Drive upload failed, falling back to Supabase Storage:', driveErr);
      // Seamless fallback to Supabase if Drive temporary network error or token expiration occurs
    }
  }

  // ─── 2. ROUTE TO SUPABASE STORAGE ─────────────────────────────────────────
  const targetPath = customPath || `${companyId}/${category}/${Date.now()}_${fileName}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(targetPath, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload file to Supabase storage: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  const fileSize = file instanceof Blob ? file.size : 0;

  return {
    provider: 'supabase',
    path: data.path,
    publicUrl,
    size: fileSize,
  };
}

/**
 * Generates a Preview URL for a document:
 * Returns Google Drive interactive web view URL or Supabase signed URL.
 */
export async function getDocumentPreviewUrl(
  path: string,
  bucket: string = 'documents',
  companyId?: string
): Promise<string> {
  if (!path) return '';

  if (isDrivePath(path)) {
    const fileId = extractDriveFileId(path);
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  // Supabase Storage path
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 600); // 10 minutes

  if (error || !data?.signedUrl) {
    // Try public URL
    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
    return pubData.publicUrl || '';
  }

  return data.signedUrl;
}

/**
 * Downloads a file as a Blob or triggers direct download in browser.
 */
export async function downloadDocument(
  path: string,
  fileName: string,
  bucket: string = 'documents',
  companyId?: string
): Promise<void> {
  if (!path) throw new Error('File path is required');

  if (isDrivePath(path)) {
    const fileId = extractDriveFileId(path);
    let accessToken: string | null = null;
    if (companyId) {
      accessToken = await ensureValidGoogleDriveAccessToken(companyId);
    } else {
      const config = await getCompanyStorageConfig(companyId || '');
      accessToken = config?.access_token || null;
    }

    if (accessToken) {
      try {
        const blob = await downloadFileFromGoogleDrive(accessToken, fileId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (err: any) {
        if (companyId && (err?.message?.includes('401') || err?.message?.includes('auth') || err?.message?.includes('token'))) {
          const freshToken = await ensureValidGoogleDriveAccessToken(companyId, true);
          if (freshToken) {
            try {
              const blob = await downloadFileFromGoogleDrive(freshToken, fileId);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              return;
            } catch (retryErr) {
              console.warn('Retry download failed after refresh:', retryErr);
            }
          }
        }
        console.warn('Failed to download blob directly from Drive, falling back to direct download link:', err);
      }
    }

    // Direct Google Drive download link fallback
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const a = document.createElement('a');
    a.href = directUrl;
    a.target = '_blank';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Supabase Storage download
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw new Error(`Failed to download file from Supabase: ${error?.message || 'Unknown error'}`);
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Deletes a file from either Google Drive or Supabase Storage.
 */
export async function deleteDocumentFromStorage(
  path: string,
  bucket: string = 'documents',
  companyId?: string
): Promise<void> {
  if (!path) return;

  if (isDrivePath(path)) {
    const fileId = extractDriveFileId(path);
    if (companyId) {
      const config = await getCompanyStorageConfig(companyId);
      if (config?.access_token) {
        await deleteFileFromGoogleDrive(config.access_token, fileId);
      }
    }
    return;
  }

  // Supabase Storage
  await supabase.storage.from(bucket).remove([path]);
}
