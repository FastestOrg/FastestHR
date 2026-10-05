import { describe, it, expect } from 'vitest';
import { getSmartClient, makeTenantQueryKey } from '../lib/smart-client';
import { supabase } from '../integrations/supabase/client';

describe('Smart Client - Multi-Tenant Proxy & Cache Routing', () => {
  it('should default to platform supabase client when no BYOS options provided', () => {
    const client = getSmartClient();
    expect(client).toBe(supabase);
  });

  it('should return custom orgClient when BYOS is active', () => {
    const mockBYOSClient = { id: 'mock-byos-client' } as any;

    const client = getSmartClient({
      tenantId: 'tenant-123',
      isBYOS: true,
      orgClient: mockBYOSClient,
    });

    expect(client).toBe(mockBYOSClient);
  });

  it('should fallback to platform client when isBYOS is false even if orgClient passed', () => {
    const mockBYOSClient = { id: 'mock-byos-client' } as any;

    const client = getSmartClient({
      tenantId: 'tenant-123',
      isBYOS: false,
      orgClient: mockBYOSClient,
    });

    expect(client).toBe(supabase);
  });

  it('should construct isolated query keys partitioned by tenant', () => {
    const key1 = makeTenantQueryKey('employees', 'tenant-alpha');
    const key2 = makeTenantQueryKey('employees', 'tenant-beta');
    const keyDefault = makeTenantQueryKey(['employees', 'active']);

    expect(key1).toEqual(['tenant', 'tenant-alpha', 'employees']);
    expect(key2).toEqual(['tenant', 'tenant-beta', 'employees']);
    expect(keyDefault).toEqual(['tenant', 'platform', 'employees', 'active']);
  });
});
