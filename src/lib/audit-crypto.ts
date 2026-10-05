/**
 * Cryptographic Audit Trail Utilities (SOC2 / ISO27001)
 * Provides SHA-256 hash chaining, payload canonicalization, and tamper-detection verification.
 */

export interface AuditRecordToHash {
  prevHash: string;
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditRecord extends AuditRecordToHash {
  id: string;
  sequenceNumber: number;
  recordHash: string;
}

export interface AuditChainVerificationResult {
  isValid: boolean;
  totalRecords: number;
  brokenSequence?: number;
  errorReason?: string;
  lastHash?: string;
}

/**
 * Deterministically sorts object keys for canonical JSON serialization
 */
export function canonicalizePayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return '{}';
  }
  if (typeof payload !== 'object') {
    return JSON.stringify(payload);
  }
  if (Array.isArray(payload)) {
    return `[${payload.map(canonicalizePayload).join(',')}]`;
  }

  const keys = Object.keys(payload as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (payload as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizePayload(val)}`;
  });
  return `{${pairs.join(',')}}`;
}

/**
 * Computes SHA-256 hex digest using Web Crypto API
 */
export async function computeSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Fallback for environments where crypto.subtle is unavailable (rare)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Web Crypto API (crypto.subtle) is required for cryptographic audit hashing');
}

/**
 * Formats and hashes an audit log entry strictly matching the PostgreSQL trigger format
 */
export async function computeAuditRecordHash(record: AuditRecordToHash): Promise<string> {
  const rawStr = [
    record.prevHash || '',
    record.companyId,
    record.actorId || '',
    record.action,
    record.entityType,
    record.entityId || '',
    canonicalizePayload(record.payload),
    record.createdAt,
  ].join('|');

  return computeSha256(rawStr);
}

/**
 * Verifies an entire array of audit records to ensure no record has been altered,
 * reordered, or deleted in the chain.
 */
export async function verifyAuditTrailIntegrity(records: AuditRecord[]): Promise<AuditChainVerificationResult> {
  if (!records || records.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      errorReason: 'Empty audit log chain is trivially valid',
    };
  }

  // Sort ascending by sequence number
  const sorted = [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const companyId = sorted[0].companyId;
  let expectedPrevHash = `GENESIS_HASH_${companyId}`;

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];

    // 1. Verify previous hash pointer matches predecessor
    if (record.prevHash !== expectedPrevHash) {
      return {
        isValid: false,
        totalRecords: sorted.length,
        brokenSequence: record.sequenceNumber,
        errorReason: `Broken hash chain pointer at sequence ${record.sequenceNumber}: expected prevHash ${expectedPrevHash}, got ${record.prevHash}`,
      };
    }

    // 2. Re-compute SHA-256 hash using canonical values
    const expectedHash = await computeAuditRecordHash({
      prevHash: record.prevHash,
      companyId: record.companyId,
      actorId: record.actorId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      payload: record.payload,
      createdAt: record.createdAt,
    });

    if (record.recordHash !== expectedHash) {
      return {
        isValid: false,
        totalRecords: sorted.length,
        brokenSequence: record.sequenceNumber,
        errorReason: `Payload tampering detected at sequence ${record.sequenceNumber}: record hash does not match content digest`,
      };
    }

    expectedPrevHash = record.recordHash;
  }

  return {
    isValid: true,
    totalRecords: sorted.length,
    lastHash: expectedPrevHash,
    errorReason: 'All cryptographic hash chain links verified successfully',
  };
}
