import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const DIRECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Default platform client for Auth, Subscriptions & Control Plane
export const supabase = createClient<Database>(DIRECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
  },
});

// ─── BYOS Client Factory & Singleton Cache ──────────────────────────────────
// Maps cacheKey: `${url}|${anonKey}` -> SupabaseClient instance
const byosClientCache = new Map<string, SupabaseClient<Database>>();

export function createTenantSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  const cacheKey = `${cleanUrl}|${cleanKey}`;

  const cached = byosClientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient<Database>(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-byos-${cleanUrl.slice(-8)}`,
    },
  });

  byosClientCache.set(cacheKey, client);
  return client;
}

export function clearBYOSClientCache(): void {
  byosClientCache.clear();
}