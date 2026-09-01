import { SupabaseClient } from '@supabase/supabase-js';

const missingTablesCache = new Set<string>();

/**
 * Extracts the base URL of a Supabase client for React Query cache key partitioning.
 */
export function getClientHostUrl(client: any): string {
  if (!client) return 'default';
  return client?.supabaseUrl || client?.rest?.url || 'default';
}

/**
 * Constructs a host-partitioned React Query key to prevent cache collisions
 * between the Main Platform DB and Customer BYOS DB instances.
 */
export function makeBYOSQueryKey(
  entity: string,
  client: any,
  companyId?: string | null,
  extra: any[] = []
): (string | undefined | null | any)[] {
  const host = getClientHostUrl(client);
  return [entity, host, companyId || 'no-company', ...extra];
}

/**
 * Dynamic schema resilience helper with 404 cache to prevent repeated failed network requests
 */
export async function fetchWithFallback<T = any>(
  orgClient: SupabaseClient<any>,
  primaryTable: string,
  fallbackTable: string,
  companyId?: string
): Promise<T[]> {
  const host = getClientHostUrl(orgClient);
  const cacheKey = `${host}_missing_${primaryTable}`;

  if (!missingTablesCache.has(cacheKey)) {
    let query = orgClient.from(primaryTable).select('*');
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (!error && data) return data as T[];
    if (error) missingTablesCache.add(cacheKey);
  }

  // Fallback table attempt
  let fallbackQuery = orgClient.from(fallbackTable).select('*');
  if (companyId) {
    fallbackQuery = fallbackQuery.eq('company_id', companyId);
  }

  const { data: fallbackData } = await fallbackQuery;
  return (fallbackData || []) as T[];
}
