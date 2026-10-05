import { useMemo } from 'react';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useAuthStore } from '@/store/auth-store';
import { getSmartClient, makeTenantQueryKey } from '@/lib/smart-client';
import { isBrowserOnline } from '@/lib/offline-sync';

/**
 * Universal hook providing the active database client, tenant context,
 * offline awareness, and cache key generation.
 */
export function useSmartClient() {
  const org = useOrgClient();
  const { profile } = useAuthStore();

  const tenantId = profile?.company_id || null;
  const isOnline = isBrowserOnline();

  const client = useMemo(() => {
    return getSmartClient({
      tenantId,
      isBYOS: org.isBYOS,
      orgClient: org.orgClient,
    });
  }, [tenantId, org.isBYOS, org.orgClient]);

  const makeQueryKey = useMemo(() => {
    return (baseKey: string | readonly unknown[]) => makeTenantQueryKey(baseKey, tenantId);
  }, [tenantId]);

  return {
    client,
    tenantId,
    isBYOS: org.isBYOS,
    byosStatus: org.byosStatus,
    healthStatus: org.healthStatus,
    byosUrl: org.byosUrl,
    isOnline,
    makeQueryKey,
    refreshTenant: org.refreshBYOS,
  };
}
