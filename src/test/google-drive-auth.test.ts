import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestGoogleDriveCodeAuth } from '@/lib/google-drive';
import { 
  ensureValidGoogleDriveAccessToken, 
  uploadDocumentToStorage, 
  invalidateStorageConfigCache 
} from '@/lib/storage-provider';
import * as googleDriveModule from '@/lib/google-drive';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-user-session-token' } },
        }),
      },
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: vi.fn().mockReturnValue({
              catch: vi.fn(),
            }),
          }),
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'fallback/path.pdf' } }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage/fallback.pdf' } }),
        }),
      },
    },
  };
});

describe('Google Drive BYOS Code Auth & Auto-Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateStorageConfigCache();
  });

  it('requestGoogleDriveCodeAuth should invoke initCodeClient and resolve the authorization code', async () => {
    let capturedCallback: any;
    const mockRequestCode = vi.fn();

    // Mock window.google
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(),
          initCodeClient: vi.fn().mockImplementation((config: any) => {
            capturedCallback = config.callback;
            return {
              requestCode: () => {
                mockRequestCode();
                // Simulate Google popup returning authorization code
                capturedCallback({ code: 'mock-google-auth-code-123' });
              },
            };
          }),
        },
      },
    } as any;

    const code = await requestGoogleDriveCodeAuth('mock-client-id.apps.googleusercontent.com');
    expect(window.google.accounts.oauth2.initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'mock-client-id.apps.googleusercontent.com',
        scope: expect.stringContaining('https://www.googleapis.com/auth/drive.file'),
        ux_mode: 'popup',
        select_account: true,
      })
    );
    expect(mockRequestCode).toHaveBeenCalled();
    expect(code).toBe('mock-google-auth-code-123');
  });

  it('ensureValidGoogleDriveAccessToken should return existing token if valid for >5 minutes', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins remaining

    (supabase.rpc as any).mockResolvedValue({
      data: [{
        company_id: 'comp-123',
        provider: 'google_drive',
        is_active: true,
        root_folder_id: 'folder-root-123',
        access_token: 'existing-valid-access-token',
        token_expires_at: futureExpiry,
      }],
      error: null,
    });

    const token = await ensureValidGoogleDriveAccessToken('comp-123');
    expect(token).toBe('existing-valid-access-token');
  });

  it('ensureValidGoogleDriveAccessToken should refresh token if expired or expiring within 5 minutes', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const expiredTime = new Date(Date.now() - 10 * 1000).toISOString(); // Expired 10s ago

    (supabase.rpc as any).mockResolvedValue({
      data: [{
        company_id: 'comp-123',
        provider: 'google_drive',
        is_active: true,
        root_folder_id: 'folder-root-123',
        access_token: 'old-expired-token',
        token_expires_at: expiredTime,
      }],
      error: null,
    });

    // Mock fetch calling google-storage-auth edge function
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        accessToken: 'brand-new-refreshed-token',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        refreshed: true,
      }),
    });
    global.fetch = mockFetch;

    const token = await ensureValidGoogleDriveAccessToken('comp-123');
    expect(token).toBe('brand-new-refreshed-token');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/google-storage-auth'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'refresh_token',
          company_id: 'comp-123',
          force_refresh: false,
        }),
      })
    );
  });

  it('uploadDocumentToStorage automatically refreshes token and uploads to Google Drive', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const expiredTime = new Date(Date.now() - 5000).toISOString();

    (supabase.rpc as any).mockResolvedValue({
      data: [{
        company_id: 'comp-123',
        provider: 'google_drive',
        is_active: true,
        root_folder_id: 'root-drive-folder-id',
        subfolders: {
          offer_letters: { id: 'offer-letters-subfolder-id' },
        },
        access_token: 'expired-token',
        token_expires_at: expiredTime,
      }],
      error: null,
    });

    // Mock edge function refresh
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        accessToken: 'freshly-refreshed-upload-token',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
    });

    // Spy on uploadFileToGoogleDrive
    const uploadSpy = vi.spyOn(googleDriveModule, 'uploadFileToGoogleDrive').mockResolvedValue({
      id: 'uploaded-drive-file-999',
      name: 'Offer-John-Doe.pdf',
      webViewLink: 'https://drive.google.com/file/d/uploaded-drive-file-999/view',
      webContentLink: 'https://drive.google.com/uc?id=uploaded-drive-file-999',
      size: 1024,
    });

    const fileBlob = new Blob(['Offer content'], { type: 'application/pdf' });
    const result = await uploadDocumentToStorage({
      companyId: 'comp-123',
      file: fileBlob,
      fileName: 'Offer-John-Doe.pdf',
      category: 'offer_letters',
    });

    expect(uploadSpy).toHaveBeenCalledWith(
      'freshly-refreshed-upload-token',
      fileBlob,
      'Offer-John-Doe.pdf',
      'application/pdf',
      'offer-letters-subfolder-id'
    );

    expect(result.provider).toBe('google_drive');
    expect(result.path).toBe('gdrive:uploaded-drive-file-999');
    expect(result.driveFileId).toBe('uploaded-drive-file-999');
  });
});

