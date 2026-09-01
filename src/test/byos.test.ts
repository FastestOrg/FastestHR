import { describe, it, expect, beforeEach } from 'vitest';
import { createTenantSupabaseClient, clearBYOSClientCache, supabase } from '@/integrations/supabase/client';
import { getClientHostUrl, makeBYOSQueryKey } from '@/utils/byosUtils';
import { BYOS_MIGRATION_SQL, BYOS_SCHEMA_VERSION } from '@/lib/byos-migration-bundle';

describe('BYOS Client Factory & Cache', () => {
  beforeEach(() => {
    clearBYOSClientCache();
  });

  it('creates and caches tenant Supabase clients by URL and key', () => {
    const url1 = 'https://acme-corp.supabase.co';
    const key1 = 'anon-key-12345';

    const client1 = createTenantSupabaseClient(url1, key1);
    const client2 = createTenantSupabaseClient(url1, key1);

    expect(client1).toBe(client2); // Same instance from cache
  });

  it('creates distinct client instances for different tenant URLs', () => {
    const client1 = createTenantSupabaseClient('https://tenant-a.supabase.co', 'key-a');
    const client2 = createTenantSupabaseClient('https://tenant-b.supabase.co', 'key-b');

    expect(client1).not.toBe(client2);
  });

  it('clears cache when requested', () => {
    const url = 'https://tenant-c.supabase.co';
    const key = 'key-c';

    const client1 = createTenantSupabaseClient(url, key);
    clearBYOSClientCache();
    const client2 = createTenantSupabaseClient(url, key);

    expect(client1).not.toBe(client2);
  });
});

describe('BYOS Query Key Partitioning', () => {
  it('extracts host URL or falls back to default', () => {
    expect(getClientHostUrl(null)).toBe('default');
    expect(getClientHostUrl({ supabaseUrl: 'https://test.supabase.co' })).toBe('https://test.supabase.co');
  });

  it('builds query keys that prevent cross-host cache collisions', () => {
    const mockPlatformClient = { supabaseUrl: 'https://platform.supabase.co' };
    const mockBYOSClient = { supabaseUrl: 'https://acme.supabase.co' };

    const keyPlatform = makeBYOSQueryKey('employees', mockPlatformClient, 'company-123', ['active']);
    const keyBYOS = makeBYOSQueryKey('employees', mockBYOSClient, 'company-123', ['active']);

    expect(keyPlatform).toEqual(['employees', 'https://platform.supabase.co', 'company-123', 'active']);
    expect(keyBYOS).toEqual(['employees', 'https://acme.supabase.co', 'company-123', 'active']);
    expect(keyPlatform).not.toEqual(keyBYOS);
  });
});

describe('BYOS Customer Migration Bundle', () => {
  it('exports valid version string and SQL bundle', () => {
    expect(BYOS_SCHEMA_VERSION).toBe('1.0.0');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public._byos_meta');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.employees');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.attendance');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.payroll_runs');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.candidates');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.chat_messages');
    expect(BYOS_MIGRATION_SQL).toContain('CREATE POLICY "byos_');
    expect(BYOS_MIGRATION_SQL).toContain('FOR ALL USING (true) WITH CHECK (true)');
  });
});
