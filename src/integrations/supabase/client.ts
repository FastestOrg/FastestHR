import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const DIRECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Default platform client for Auth, Subscriptions & Control Plane
export const platformClient = createClient<Database>(DIRECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
  },
});

let activeBYOSClient: SupabaseClient<Database> | null = null;

export function setActiveBYOSClient(client: SupabaseClient<Database> | null): void {
  activeBYOSClient = client;
}

export function getActiveBYOSClient(): SupabaseClient<Database> | null {
  return activeBYOSClient;
}

// Transparent dynamic Proxy that delegates database operations (.from, .rpc, .storage)
// to the customer's isolated BYOS Supabase instance when active, while keeping Auth on platform client.
export const supabase = new Proxy(platformClient, {
  get(target, prop, receiver) {
    if (activeBYOSClient && (prop === 'from' || prop === 'rpc' || prop === 'storage')) {
      const byosTarget = activeBYOSClient as any;
      const value = byosTarget[prop];
      if (typeof value === 'function') {
        return value.bind(byosTarget);
      }
      return value;
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
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
  activeBYOSClient = null;
}