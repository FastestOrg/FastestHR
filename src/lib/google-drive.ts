/**
 * Google Drive Storage Client & API Service for FastestHR (BYOS)
 * Handles Google Identity Services (GIS) OAuth, Folder Structure Provisioning, and File CRUD.
 */

// Default scopes for FastestHR Drive integration:
// - drive.file: Per-file access to files created/opened by the app (recommended by Google for privacy)
// - userinfo.email & profile: To display connected Google account identity
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// Platform Default Google OAuth Web Client ID (Can be overridden by custom company settings)
export const DEFAULT_GOOGLE_CLIENT_ID = '1033874890501-66h08rultd6tho444rdmj1l71kccfp8k.apps.googleusercontent.com';

export interface GoogleDriveUser {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface GoogleDriveSubfolders {
  documents?: GoogleDriveFolder;
  payslips?: GoogleDriveFolder;
  offer_letters?: GoogleDriveFolder;
  onboarding?: GoogleDriveFolder;
  senddesk?: GoogleDriveFolder;
}

export interface GoogleDriveFileResult {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  size?: number;
  mimeType?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

/**
 * Dynamically loads the official Google Identity Services script.
 */
export async function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services SDK: ' + String(err)));
    document.head.appendChild(script);
  });
}

/**
 * Initiates Google Sign-In and requests OAuth 2.0 Access Token for Google Drive.
 */
export async function requestGoogleDriveAuthorization(clientId?: string): Promise<{
  accessToken: string;
  expiresIn: number;
  user: GoogleDriveUser;
}> {
  await loadGoogleIdentityServices();

  const activeClientId = (clientId && clientId.trim().length > 0)
    ? clientId.trim()
    : (import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID);

  if (!activeClientId) {
    throw new Error('Google OAuth Client ID is not configured. Please configure it in Storage Settings.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: GOOGLE_DRIVE_SCOPES,
        prompt: 'consent',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Authorization failed'));
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('No access token returned from Google authentication'));
            return;
          }

          try {
            // Fetch Google User Profile info
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            let user: GoogleDriveUser = {
              email: 'connected-user@google.com',
              name: 'Google Drive Account',
            };

            if (userRes.ok) {
              const userData = await userRes.json();
              user = {
                email: userData.email || user.email,
                name: userData.name || userData.email || user.name,
                picture: userData.picture,
              };
            }

            resolve({
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in || 3600,
              user,
            });
          } catch (profileErr) {
            // Still succeed if user info fails but token is valid
            resolve({
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in || 3600,
              user: {
                email: 'connected-user@google.com',
                name: 'Google Drive Account',
              },
            });
          }
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google OAuth failed or popup was closed.'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(new Error('Failed to initialize Google Sign-In: ' + (err?.message || String(err))));
    }
  });
}

/**
 * Searches for a folder by name in Google Drive.
 */
export async function findDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<GoogleDriveFolder | null> {
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&spaces=drive`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to query Google Drive folder "${folderName}": ${errorText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return {
      id: data.files[0].id,
      name: data.files[0].name,
      webViewLink: data.files[0].webViewLink,
    };
  }

  return null;
}

/**
 * Creates a new folder in Google Drive.
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<GoogleDriveFolder> {
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Google Drive folder "${folderName}": ${errorText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
}

/**
 * Finds or creates the root "FastestHR" folder and all standard subfolders.
 */
export async function ensureFastestHRFolderStructure(accessToken: string): Promise<{
  rootFolder: GoogleDriveFolder;
  subfolders: GoogleDriveSubfolders;
}> {
  // 1. Ensure Root "FastestHR" Folder
  let rootFolder = await findDriveFolder(accessToken, 'FastestHR');
  if (!rootFolder) {
    rootFolder = await createDriveFolder(accessToken, 'FastestHR');
  }

  // 2. Standard Subfolders Mapping
  const targetSubfolders: Array<{ key: keyof GoogleDriveSubfolders; name: string }> = [
    { key: 'documents', name: 'Company Documents' },
    { key: 'payslips', name: 'Payslips' },
    { key: 'offer_letters', name: 'Offer Letters' },
    { key: 'onboarding', name: 'Onboarding' },
    { key: 'senddesk', name: 'SendDesk' },
  ];

  const subfolders: GoogleDriveSubfolders = {};

  for (const item of targetSubfolders) {
    let sub = await findDriveFolder(accessToken, item.name, rootFolder.id);
    if (!sub) {
      sub = await createDriveFolder(accessToken, item.name, rootFolder.id);
    }
    subfolders[item.key] = sub;
  }

  return { rootFolder, subfolders };
}

/**
 * Uploads a file (Blob / File) directly to Google Drive via multipart upload.
 */
export async function uploadFileToGoogleDrive(
  accessToken: string,
  fileContent: Blob | File | ArrayBuffer,
  fileName: string,
  mimeType: string = 'application/octet-stream',
  parentFolderId?: string
): Promise<GoogleDriveFileResult> {
  const boundary = '-------FastestHRBoundary' + Math.random().toString(36).substring(2);

  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: parentFolderId ? [parentFolderId] : undefined,
  };

  // Convert content to Blob if needed
  const contentBlob = fileContent instanceof Blob
    ? fileContent
    : new Blob([fileContent], { type: mimeType });

  // Part 1: Metadata JSON (starts directly with --boundary, no leading \r\n)
  const part1 = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;

  // Part 2: Media Binary Header
  const part2 = `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;

  // Part 3: Closing Boundary
  const part3 = `\r\n--${boundary}--`;

  const multipartBody = new Blob([
    part1,
    part2,
    contentBlob,
    part3
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,mimeType';
  
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    webContentLink: data.webContentLink || `https://drive.google.com/uc?export=download&id=${data.id}`,
    size: Number(data.size) || contentBlob.size,
    mimeType: data.mimeType || mimeType,
  };
}

/**
 * Downloads a file from Google Drive as a binary Blob.
 */
export async function downloadFileFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to download file from Google Drive: ${errorText}`);
  }

  return await res.blob();
}

/**
 * Deletes a file from Google Drive.
 */
export async function deleteFileFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Failed to delete file from Google Drive: ${errorText}`);
  }
}

/**
 * Tests connection and write permissions to Google Drive by creating and deleting a test probe file.
 */
export async function testGoogleDriveConnection(
  accessToken: string,
  folderId: string
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const startTime = Date.now();
  try {
    const testBlob = new Blob(['FastestHR Connection Test Marker: ' + new Date().toISOString()], {
      type: 'text/plain',
    });
    const testFileName = `.fastesthrtemp_${Date.now()}.txt`;

    const uploaded = await uploadFileToGoogleDrive(
      accessToken,
      testBlob,
      testFileName,
      'text/plain',
      folderId
    );

    if (!uploaded.id) {
      throw new Error('Test file did not return a valid file ID');
    }

    // Clean up test file
    await deleteFileFromDrive(accessToken, uploaded.id);
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      latencyMs,
      message: `Google Drive connection verified successfully in ${latencyMs}ms`,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      message: err?.message || 'Connection test failed',
    };
  }
}

/**
 * Lists files in a given Google Drive folder.
 */
export async function listDriveFilesInFolder(
  accessToken: string,
  folderId: string,
  pageSize: number = 50
): Promise<Array<{ id: string; name: string; size?: number; mimeType?: string; webViewLink?: string; createdTime?: string }>> {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,size,mimeType,webViewLink,createdTime)&orderBy=createdTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list files in folder: ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
}

export const deleteFileFromDrive = deleteFileFromGoogleDrive;
