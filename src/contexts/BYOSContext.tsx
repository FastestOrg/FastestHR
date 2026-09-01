import { createContext, useContext, useMemo, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase, createTenantSupabaseClient } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuthStore } from '@/store/auth-store';

export interface BYOSConnection {
  id: string;
  supabase_url: string;
  supabase_anon_key: string;
  status: string;
  migration_version: string | null;
  last_health_check: string | null;
  health_status: string;
  byos_enabled: boolean;
}

export interface BYOSContextType {
  orgClient: SupabaseClient<Database>;
  isBYOS: boolean;
  byosStatus: string | null;
  healthStatus: string | null;
  isLoading: boolean;
  byosUrl: string | null;
  connection: BYOSConnection | null;
  refetch: () => Promise<any>;
}

const BYOSContext = createContext<BYOSContextType>({
  orgClient: supabase,
  isBYOS: false,
  byosStatus: null,
  healthStatus: null,
  isLoading: false,
  byosUrl: null,
  connection: null,
  refetch: async () => {},
});

export function BYOSProvider({
  children,
  tenantId: propTenantId,
  byosEnabled: propByosEnabled,
}: {
  children: ReactNode;
  tenantId?: string | null;
  byosEnabled?: boolean;
}) {
  const { profile } = useAuthStore();
  const tenantId = propTenantId ?? profile?.company_id;

  const { data: byosConn, isLoading, refetch } = useQuery({
    queryKey: ['byos-connection', tenantId],
    queryFn: async (): Promise<BYOSConnection | null> => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase.rpc('get_byos_connection', {
          p_tenant_id: tenantId,
        });

        if (!error && data) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row && (row as BYOSConnection).supabase_url) {
            return row as BYOSConnection;
          }
        }
      } catch (rpcErr) {
        console.warn('[BYOSContext] get_byos_connection RPC query returned fallback:', rpcErr);
      }

      // Fallback direct check for company admins
      try {
        const { data: conn } = await supabase
          .from('byos_connections')
          .select('id, tenant_id, supabase_url, supabase_anon_key, status, migration_version, last_health_check, health_status')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (conn && conn.status === 'active') {
          return {
            id: conn.id,
            supabase_url: conn.supabase_url,
            supabase_anon_key: conn.supabase_anon_key,
            status: conn.status,
            migration_version: conn.migration_version,
            last_health_check: conn.last_health_check,
            health_status: conn.health_status,
            byos_enabled: true,
          };
        }
      } catch (tableErr) {
        // Table or RLS not yet available
      }

      return null;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  const isBYOSActive = !!byosConn?.byos_enabled && byosConn?.status === 'active' && !!byosConn?.supabase_url;

  const orgClient = useMemo<SupabaseClient<Database>>(() => {
    if (isBYOSActive && byosConn?.supabase_url && byosConn?.supabase_anon_key) {
      return createTenantSupabaseClient(byosConn.supabase_url, byosConn.supabase_anon_key);
    }
    return supabase;
  }, [isBYOSActive, byosConn]);

  const contextValue = useMemo<BYOSContextType>(
    () => ({
      orgClient,
      isBYOS: isBYOSActive,
      byosStatus: byosConn?.status || null,
      healthStatus: byosConn?.health_status || null,
      isLoading,
      byosUrl: byosConn?.supabase_url || null,
      connection: byosConn || null,
      refetch,
    }),
    [orgClient, isBYOSActive, byosConn, isLoading, refetch]
  );

  return <BYOSContext.Provider value={contextValue}>{children}</BYOSContext.Provider>;
}

export function useBYOS() {
  return useContext(BYOSContext);
}
