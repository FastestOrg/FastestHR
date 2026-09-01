import { supabase } from '@/integrations/supabase/client';
import { 
  getCompanyStorageConfig, 
  isDrivePath 
} from '@/lib/storage-provider';
import { 
  uploadFileToGoogleDrive, 
  deleteFileFromDrive 
} from '@/lib/google-drive';

export interface MigrationItem {
  id: string;
  tableName: string;
  columnName: string;
  category: 'documents' | 'payslips' | 'offer_letters' | 'onboarding' | 'senddesk';
  bucket: string;
  filePath: string;
  rawUrlOrPath: string;
  fileName: string;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  currentFileName: string;
  currentStatus: string;
  percent: number;
  migratedBytes: number;
}

export interface MigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalBytes: number;
  errors: Array<{ fileName: string; error: string }>;
}

/**
 * Normalizes raw URLs or storage paths into bucket + relative object path.
 */
export function extractBucketAndPath(rawUrlOrPath: string, fallbackBucket: string): { bucket: string; path: string } {
  if (!rawUrlOrPath) return { bucket: fallbackBucket, path: '' };

  let clean = rawUrlOrPath.trim();
  // Strip URL query parameters (?token=..., etc.)
  if (clean.includes('?')) {
    clean = clean.split('?')[0];
  }

  // Handle full Supabase Storage URLs:
  // e.g. https://xyz.supabase.co/storage/v1/object/public/documents/company_id/file.pdf
  const pattern = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;
  const match = clean.match(pattern);
  if (match) {
    return {
      bucket: match[1],
      path: decodeURIComponent(match[2]),
    };
  }

  // Handle paths that might start with bucket name prefix
  if (clean.startsWith(`${fallbackBucket}/`)) {
    return {
      bucket: fallbackBucket,
      path: clean.substring(fallbackBucket.length + 1),
    };
  }

  return {
    bucket: fallbackBucket,
    path: clean,
  };
}

/**
 * Downloads a file from any source: Base64 data URI, direct HTTP/HTTPS URL,
 * or Supabase Storage with bucket fallbacks and path normalization.
 */
export async function downloadFileBlobFromAnySource(
  rawPath: string,
  preferredBucket: string,
  companyId?: string
): Promise<{ blob: Blob; mimeType: string }> {
  if (!rawPath || !rawPath.trim()) {
    throw new Error('Empty file path');
  }

  const cleanRaw = rawPath.trim();

  // 1. Handle Base64 Data URI
  if (cleanRaw.startsWith('data:')) {
    try {
      const parts = cleanRaw.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return { blob: new Blob([u8arr], { type: mimeType }), mimeType };
    } catch (b64Err) {
      throw new Error(`Invalid Base64 Data URI: ${(b64Err as Error).message}`);
    }
  }

  // 2. Handle Direct Public HTTP/HTTPS URL
  if (cleanRaw.startsWith('http://') || cleanRaw.startsWith('https://')) {
    try {
      const res = await fetch(cleanRaw);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          return { blob, mimeType: blob.type || 'application/pdf' };
        }
      }
    } catch (httpErr) {
      console.warn(`Direct HTTP fetch for ${cleanRaw} failed, checking Supabase storage:`, httpErr);
    }
  }

  // 3. Extract path and bucket variations for Supabase Storage
  const { bucket, path } = extractBucketAndPath(cleanRaw, preferredBucket);
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes

  const bucketsToTry = Array.from(new Set([
    bucket,
    preferredBucket,
    'documents',
    'offer_letters',
    'payslips',
    'senddesk-documents',
    'resumes',
    'attachments',
    'public',
  ])).filter(Boolean);

  const baseFileName = cleanPath.split('/').pop() || cleanPath;
  const pathsToTry = Array.from(new Set([
    cleanPath,
    baseFileName,
    companyId ? `${companyId}/${baseFileName}` : null,
    companyId ? `${companyId}/${preferredBucket}/${baseFileName}` : null,
  ])).filter(Boolean) as string[];

  // Try Supabase Storage download across candidate buckets and paths
  for (const b of bucketsToTry) {
    for (const p of pathsToTry) {
      // 3a. Direct download
      try {
        const { data, error } = await supabase.storage.from(b).download(p);
        if (!error && data && data.size > 0) {
          return { blob: data, mimeType: data.type || 'application/pdf' };
        }
      } catch (e) {
        // Continue
      }

      // 3b. Try public URL fetch
      try {
        const { data: pubData } = supabase.storage.from(b).getPublicUrl(p);
        if (pubData?.publicUrl) {
          const res = await fetch(pubData.publicUrl);
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 0) {
              return { blob, mimeType: blob.type || 'application/pdf' };
            }
          }
        }
      } catch (e) {
        // Continue
      }

      // 3c. Try signed URL fetch
      try {
        const { data: signedData } = await supabase.storage.from(b).createSignedUrl(p, 120);
        if (signedData?.signedUrl) {
          const res = await fetch(signedData.signedUrl);
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 0) {
              return { blob, mimeType: blob.type || 'application/pdf' };
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  throw new Error(`File "${cleanPath}" was not found in Supabase storage buckets [${bucketsToTry.join(', ')}]`);
}

/**
 * Scans all database tables for files stored on Supabase Storage that belong to this company.
 */
export async function scanSupabaseDocumentsForMigration(companyId: string): Promise<MigrationItem[]> {
  const items: MigrationItem[] = [];

  // 1. Company Documents
  try {
    const { data: docs } = await supabase
      .from('company_documents')
      .select('id, name, file_path, category')
      .eq('company_id', companyId);

    if (docs) {
      for (const d of docs) {
        if (d.file_path && !isDrivePath(d.file_path)) {
          const { bucket, path } = extractBucketAndPath(d.file_path, 'documents');
          items.push({
            id: d.id,
            tableName: 'company_documents',
            columnName: 'file_path',
            category: 'documents',
            bucket,
            filePath: path,
            rawUrlOrPath: d.file_path,
            fileName: d.name || path.split('/').pop() || 'company_document.pdf',
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan company_documents error:', e);
  }

  // 2. Payslips
  try {
    const { data: slips } = await supabase
      .from('payslips')
      .select('id, pdf_url, employee_id')
      .eq('company_id', companyId);

    if (slips) {
      for (const s of slips) {
        if (s.pdf_url && !isDrivePath(s.pdf_url)) {
          const { bucket, path } = extractBucketAndPath(s.pdf_url, 'payslips');
          items.push({
            id: s.id,
            tableName: 'payslips',
            columnName: 'pdf_url',
            category: 'payslips',
            bucket,
            filePath: path,
            rawUrlOrPath: s.pdf_url,
            fileName: `Payslip_${s.id.slice(0, 8)}.pdf`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan payslips error:', e);
  }

  // 3. Candidate Offers
  try {
    const { data: offers } = await supabase
      .from('candidate_offers')
      .select('id, pdf_url, signed_pdf_url, company_id')
      .eq('company_id', companyId);

    if (offers) {
      for (const o of offers) {
        if (o.pdf_url && !isDrivePath(o.pdf_url)) {
          const { bucket, path } = extractBucketAndPath(o.pdf_url, 'offer_letters');
          items.push({
            id: o.id,
            tableName: 'candidate_offers',
            columnName: 'pdf_url',
            category: 'offer_letters',
            bucket,
            filePath: path,
            rawUrlOrPath: o.pdf_url,
            fileName: `Offer_Letter_${o.id.slice(0, 8)}.pdf`,
          });
        }
        if (o.signed_pdf_url && !isDrivePath(o.signed_pdf_url)) {
          const { bucket, path } = extractBucketAndPath(o.signed_pdf_url, 'offer_letters');
          items.push({
            id: o.id,
            tableName: 'candidate_offers',
            columnName: 'signed_pdf_url',
            category: 'offer_letters',
            bucket,
            filePath: path,
            rawUrlOrPath: o.signed_pdf_url,
            fileName: `Signed_Offer_${o.id.slice(0, 8)}.pdf`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan candidate_offers error:', e);
  }

  // 4. SendDesk Documents
  try {
    const { data: sendDocs } = await supabase
      .from('senddesk_documents')
      .select('id, pdf_url, name')
      .eq('company_id', companyId);

    if (sendDocs) {
      for (const sd of sendDocs) {
        if (sd.pdf_url && !isDrivePath(sd.pdf_url)) {
          const { bucket, path } = extractBucketAndPath(sd.pdf_url, 'senddesk-documents');
          items.push({
            id: sd.id,
            tableName: 'senddesk_documents',
            columnName: 'pdf_url',
            category: 'senddesk',
            bucket,
            filePath: path,
            rawUrlOrPath: sd.pdf_url,
            fileName: sd.name ? `${sd.name.replace(/[/\\?%*:|"<>]/g, '_')}.pdf` : `SendDesk_${sd.id.slice(0, 8)}.pdf`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan senddesk_documents error:', e);
  }

  // 5. Candidates (Resumes)
  try {
    const { data: cands } = await supabase
      .from('candidates')
      .select('id, resume_url, full_name')
      .eq('company_id', companyId);

    if (cands) {
      for (const c of cands) {
        if (c.resume_url && !isDrivePath(c.resume_url)) {
          const { bucket, path } = extractBucketAndPath(c.resume_url, 'documents');
          const cleanName = (c.full_name || 'Candidate').replace(/[/\\?%*:|"<>]/g, '_');
          items.push({
            id: c.id,
            tableName: 'candidates',
            columnName: 'resume_url',
            category: 'onboarding',
            bucket,
            filePath: path,
            rawUrlOrPath: c.resume_url,
            fileName: `Resume_${cleanName}_${c.id.slice(0, 6)}.pdf`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan candidates resumes error:', e);
  }

  // 6. Leave Requests (Medical / Document Attachments)
  try {
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('id, document_url')
      .eq('company_id', companyId);

    if (leaves) {
      for (const lv of leaves) {
        if (lv.document_url && !isDrivePath(lv.document_url)) {
          const { bucket, path } = extractBucketAndPath(lv.document_url, 'documents');
          items.push({
            id: lv.id,
            tableName: 'leave_requests',
            columnName: 'document_url',
            category: 'documents',
            bucket,
            filePath: path,
            rawUrlOrPath: lv.document_url,
            fileName: `Leave_Attachment_${lv.id.slice(0, 8)}.pdf`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Scan leave_requests documents error:', e);
  }

  return items;
}

/**
 * Migrates scanned documents to Google Drive one by one with live progress updates.
 */
export async function migrateDocumentsToGoogleDrive(
  companyId: string,
  items: MigrationItem[],
  options: {
    accessToken?: string;
    deleteFromSupabaseAfterMigration?: boolean;
    onProgress?: (progress: MigrationProgress) => void;
    onAuthRequired?: () => Promise<string | null>;
  } = {}
): Promise<MigrationResult> {
  const config = await getCompanyStorageConfig(companyId, true);
  if (!config || !config.root_folder_id) {
    throw new Error('Google Drive is not connected for this company.');
  }

  let currentAccessToken = options.accessToken || config.access_token;
  if (!currentAccessToken) {
    if (options.onAuthRequired) {
      currentAccessToken = (await options.onAuthRequired()) || '';
    }
    if (!currentAccessToken) {
      throw new Error('No active Google Drive authorization token found. Please re-authenticate Google Drive.');
    }
  }

  const { deleteFromSupabaseAfterMigration = false, onProgress, onAuthRequired } = options;
  const subfolders = (config.subfolders || {}) as Record<string, any>;

  let completed = 0;
  let failed = 0;
  let totalBytes = 0;
  const errors: Array<{ fileName: string; error: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (onProgress) {
      onProgress({
        total: items.length,
        completed,
        failed,
        currentFileName: item.fileName,
        currentStatus: `Migrating (${i + 1}/${items.length})`,
        percent: Math.round(((i) / items.length) * 100),
        migratedBytes: totalBytes,
      });
    }

    try {
      // 1. Download file from any source (Base64, HTTP URL, or Supabase Storage with fallbacks)
      const { blob, mimeType } = await downloadFileBlobFromAnySource(
        item.rawUrlOrPath || item.filePath,
        item.bucket,
        companyId
      );

      // 2. Determine target subfolder in Google Drive
      const targetFolderId = subfolders[item.category]?.id || config.root_folder_id;

      // 3. Upload to Google Drive with automatic 401 token refresh retry
      let driveFile;
      try {
        driveFile = await uploadFileToGoogleDrive(
          currentAccessToken,
          blob,
          item.fileName,
          mimeType || blob.type || 'application/pdf',
          targetFolderId
        );
      } catch (uploadErr: any) {
        const uploadErrMsg = uploadErr?.message || String(uploadErr);
        if (
          (uploadErrMsg.includes('401') || uploadErrMsg.toLowerCase().includes('unauthorized') || uploadErrMsg.toLowerCase().includes('invalid credentials')) &&
          onAuthRequired
        ) {
          console.warn('[Migration] 401 Unauthorized detected during upload. Requesting fresh token...');
          const freshToken = await onAuthRequired();
          if (freshToken) {
            currentAccessToken = freshToken;
            // Retry upload with fresh token
            driveFile = await uploadFileToGoogleDrive(
              currentAccessToken,
              blob,
              item.fileName,
              mimeType || blob.type || 'application/pdf',
              targetFolderId
            );
          } else {
            throw uploadErr;
          }
        } else {
          throw uploadErr;
        }
      }

      const drivePath = `gdrive:${driveFile.id}`;

      // 4. Update the Database record with the new Google Drive reference
      const { error: updateErr } = await (supabase
        .from(item.tableName as any)
        .update({ [item.columnName]: drivePath } as any)
        .eq('id', item.id));

      if (updateErr) {
        // Rollback uploaded file if DB update fails
        await deleteFileFromDrive(currentAccessToken, driveFile.id);
        throw new Error(`Failed to update ${item.tableName} DB row: ${updateErr.message}`);
      }

      totalBytes += blob.size;
      completed++;

      // 5. Delete from Supabase Storage if requested to free space
      if (deleteFromSupabaseAfterMigration) {
        supabase.storage
          .from(item.bucket)
          .remove([item.filePath])
          .then(() => {})
          .catch((delErr) => console.warn(`Could not clean up ${item.filePath} from Supabase:`, delErr));
      }
    } catch (err: any) {
      failed++;
      errors.push({
        fileName: item.fileName,
        error: err?.message || String(err),
      });
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: items.length,
      completed,
      failed,
      currentFileName: 'Migration Completed',
      currentStatus: 'Finished',
      percent: 100,
      migratedBytes: totalBytes,
    });
  }

  // Update storage statistics
  await supabase
    .from('company_storage_integrations')
    .update({
      total_files_count: (config.total_files_count || 0) + completed,
      total_bytes_stored: (config.total_bytes_stored || 0) + totalBytes,
      last_synced_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);

  return {
    total: items.length,
    succeeded: completed,
    failed,
    skipped: 0,
    totalBytes,
    errors,
  };
}
