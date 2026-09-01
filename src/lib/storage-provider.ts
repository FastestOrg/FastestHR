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
 * Checks if Google Drive is connected and actively enabled for the company.
 */
export async function isGoogleDriveActive(companyId: string): Promise<boolean> {
  const config = await getCompanyStorageConfig(companyId);
  return !!(
    config &&
    config.provider === 'google_drive' &&
    config.is_active &&
    config.root_folder_id &&
    config.access_token
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
    config.access_token &&
    config.root_folder_id
  );

  // ─── 1. ROUTE TO GOOGLE DRIVE ─────────────────────────────────────────────
  if (isDrive && config && config.access_token) {
    try {
      // Determine destination folder inside FastestHR
      let targetFolderId = config.root_folder_id;
      const subfolders = config.subfolders as Record<string, any>;
      if (category && subfolders && subfolders[category]?.id) {
        targetFolderId = subfolders[category].id;
      }

      const driveResult = await uploadFileToGoogleDrive(
        config.access_token,
        file,
        fileName,
        contentType,
        targetFolderId
      );

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
        .then(() => {})
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
      console.error('[StorageProvider] Google Drive upload failed, falling back to Supabase Storage:', driveErr);
      // Seamless fallback to Supabase if Drive temporary network error occurs
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
    const config = companyId ? await getCompanyStorageConfig(companyId) : null;

    if (config?.access_token) {
      try {
        const blob = await downloadFileFromGoogleDrive(config.access_token, fileId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
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
