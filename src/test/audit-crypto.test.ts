import { describe, it, expect } from 'vitest';
import {
  canonicalizePayload,
  computeSha256,
  computeAuditRecordHash,
  verifyAuditTrailIntegrity,
  AuditRecord,
} from '../lib/audit-crypto';

describe('Audit Crypto - Tamper-Evident Cryptographic Audit Trail', () => {
  it('should deterministically canonicalize payloads with sorted keys and arrays', () => {
    const payloadA = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const payloadB = { c: { x: 10, y: 20 }, a: 1, b: 2 };

    expect(canonicalizePayload(payloadA)).toBe(canonicalizePayload(payloadB));
    expect(canonicalizePayload(payloadA)).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
  });

  it('should compute valid SHA-256 hex string', async () => {
    const hash = await computeSha256('FastestHR');
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  it('should verify a valid cryptographic audit chain linked by SHA-256 hashes', async () => {
    const companyId = '11111111-1111-1111-1111-111111111111';
    const genesisPrev = `GENESIS_HASH_${companyId}`;

    const rec1Base = {
      prevHash: genesisPrev,
      companyId,
      actorId: '22222222-2222-2222-2222-222222222222',
      action: 'EMPLOYEE_PROMOTED',
      entityType: 'employee',
      entityId: '33333333-3333-3333-3333-333333333333',
      payload: { oldRole: 'Junior Dev', newRole: 'Senior Dev' },
      createdAt: '2026-10-04T12:00:00.000000Z',
    };
    const hash1 = await computeAuditRecordHash(rec1Base);

    const rec1: AuditRecord = {
      ...rec1Base,
      id: 'rec-1',
      sequenceNumber: 1,
      recordHash: hash1,
    };

    const rec2Base = {
      prevHash: hash1,
      companyId,
      actorId: '22222222-2222-2222-2222-222222222222',
      action: 'PAYROLL_PROCESSED',
      entityType: 'payroll',
      entityId: '44444444-4444-4444-4444-444444444444',
      payload: { month: 'October', year: 2026 },
      createdAt: '2026-10-04T12:05:00.000000Z',
    };
    const hash2 = await computeAuditRecordHash(rec2Base);

    const rec2: AuditRecord = {
      ...rec2Base,
      id: 'rec-2',
      sequenceNumber: 2,
      recordHash: hash2,
    };

    const verification = await verifyAuditTrailIntegrity([rec1, rec2]);
    expect(verification.isValid).toBe(true);
    expect(verification.totalRecords).toBe(2);
    expect(verification.lastHash).toBe(hash2);
  });

  it('should detect data tampering in payload and fail validation', async () => {
    const companyId = '11111111-1111-1111-1111-111111111111';
    const genesisPrev = `GENESIS_HASH_${companyId}`;

    const rec1Base = {
      prevHash: genesisPrev,
      companyId,
      actorId: 'user-1',
      action: 'SALARY_ADJUSTMENT',
      entityType: 'employee',
      entityId: 'emp-1',
      payload: { originalSalary: 50000, newSalary: 60000 },
      createdAt: '2026-10-04T12:00:00.000000Z',
    };
    const hash1 = await computeAuditRecordHash(rec1Base);

    const rec1: AuditRecord = {
      ...rec1Base,
      id: 'rec-1',
      sequenceNumber: 1,
      recordHash: hash1,
    };

    // Attacker modifies the payload in the database without updating the hash
    const tamperedRec1: AuditRecord = {
      ...rec1,
      payload: { originalSalary: 50000, newSalary: 999999 }, // Tampered value!
    };

    const result = await verifyAuditTrailIntegrity([tamperedRec1]);
    expect(result.isValid).toBe(false);
    expect(result.brokenSequence).toBe(1);
    expect(result.errorReason).toContain('Payload tampering detected');
  });

  it('should detect deletion or tampering with hash chain links', async () => {
    const companyId = '11111111-1111-1111-1111-111111111111';

    const rec1Base = {
      prevHash: `GENESIS_HASH_${companyId}`,
      companyId,
      action: 'TEST_A',
      entityType: 'test',
      payload: {},
      createdAt: '2026-10-04T12:00:00.000000Z',
    };
    const validHash1 = await computeAuditRecordHash(rec1Base);

    const rec1: AuditRecord = {
      ...rec1Base,
      id: 'rec-1',
      sequenceNumber: 1,
      recordHash: validHash1,
    };

    const rec2: AuditRecord = {
      prevHash: 'BROKEN_LINK_HASH', // Doesn't match validHash1
      companyId,
      action: 'TEST_B',
      entityType: 'test',
      payload: {},
      createdAt: '2026-10-04T12:01:00.000000Z',
      id: 'rec-2',
      sequenceNumber: 2,
      recordHash: 'dummy_hash_2',
    };

    const result = await verifyAuditTrailIntegrity([rec1, rec2]);
    expect(result.isValid).toBe(false);
    expect(result.brokenSequence).toBe(2);
    expect(result.errorReason).toContain('Broken hash chain pointer');
  });
});
