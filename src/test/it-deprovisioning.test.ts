import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeITDeprovisioningKillswitch } from '@/lib/integrations/itDeprovisioningService';

// Mock Supabase Client
vi.mock('@/integrations/supabase/client', () => {
  const mockEmployee = {
    id: 'emp-123',
    first_name: 'Alex',
    last_name: 'Morgan',
    work_email: 'alex@acme.com',
    user_id: 'user-123',
    status: 'active',
    employee_code: 'EMP-007',
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'employees') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockEmployee, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (table === 'audit_logs') {
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return {
      select: vi.fn(() => ({ eq: vi.fn() })),
    };
  });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('executeITDeprovisioningKillswitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully revokes selected services and generates SHA-256 clearance hash', async () => {
    const result = await executeITDeprovisioningKillswitch({
      employeeId: 'emp-123',
      companyId: 'comp-456',
      executedByUserId: 'admin-789',
      executedByName: 'HR Director',
      servicesToRevoke: {
        fastestHrPortal: true,
        googleWorkspace: true,
        slack: true,
        github: true,
        hardwareAssets: true,
      },
    });

    expect(result.employeeId).toBe('emp-123');
    expect(result.employeeName).toBe('Alex Morgan');
    expect(result.workEmail).toBe('alex@acme.com');
    expect(result.executedBy).toBe('HR Director');

    // Verify clearance hash is a 64-character hex string (SHA-256)
    expect(result.clearanceHash).toHaveLength(64);
    expect(result.clearanceHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify all 5 services were revoked
    expect(result.results).toHaveLength(5);
    const servicesRevoked = result.results.map((r) => r.service);
    expect(servicesRevoked).toContain('FastestHR Portal & Auth Sessions');
    expect(servicesRevoked).toContain('Google Workspace / M365 Mailbox');
    expect(servicesRevoked).toContain('Slack Organization Access');
    expect(servicesRevoked).toContain('GitHub / GitLab / Linear Access');
    expect(servicesRevoked).toContain('Hardware Assets & Access Badges');
  });

  it('respects selective revocation options', async () => {
    const result = await executeITDeprovisioningKillswitch({
      employeeId: 'emp-123',
      companyId: 'comp-456',
      executedByUserId: 'admin-789',
      executedByName: 'HR Director',
      servicesToRevoke: {
        fastestHrPortal: true,
        googleWorkspace: false,
        slack: true,
        github: false,
        hardwareAssets: false,
      },
    });

    expect(result.results).toHaveLength(2);
    const services = result.results.map((r) => r.service);
    expect(services).toContain('FastestHR Portal & Auth Sessions');
    expect(services).toContain('Slack Organization Access');
    expect(services).not.toContain('Google Workspace / M365 Mailbox');
    expect(result.clearanceHash).toHaveLength(64);
  });
});
