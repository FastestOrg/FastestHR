import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface SmartClientOptions {
  tenantId?: string | null;
  isBYOS?: boolean;
  orgClient?: SupabaseClient<Database> | null;
}

/**
 * Returns the appropriate database client (dedicated BYOS customer client or centralized platform client)
 * based on the active organizational context.
 */
export function getSmartClient(options?: SmartClientOptions): SupabaseClient<Database> {
  if (!options) return supabase;

  if (options.isBYOS && options.orgClient) {
    return options.orgClient;
  }

  return supabase;
}

/**
 * Creates tenant-partitioned React Query cache keys preventing cross-tenant cache pollution
 */
export function makeTenantQueryKey(baseKey: string | readonly unknown[], tenantId?: string | null): unknown[] {
  const normalizedBase = Array.isArray(baseKey) ? [...baseKey] : [baseKey];
  return ['tenant', tenantId || 'platform', ...normalizedBase];
}
