import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateReplayNonce,
  queueAttendancePunch,
  getQueuedAttendancePunches,
  removeQueuedPunch,
  clearOfflineQueue,
  flushOfflineAttendanceQueue,
  isBrowserOnline,
} from '../lib/offline-sync';

describe('Offline Workforce Sync Queue', () => {
  beforeEach(async () => {
    await clearOfflineQueue();
  });

  it('should generate unique cryptographic nonces for replay prevention', () => {
    const nonce1 = generateReplayNonce();
    const nonce2 = generateReplayNonce();
    expect(nonce1).not.toBe(nonce2);
    expect(nonce1.length).toBeGreaterThan(10);
  });

  it('should queue attendance punches locally with client timestamp and nonces', async () => {
    const punch = await queueAttendancePunch('clock_in', {
      employeeId: 'emp-123',
      location: { lat: 12.9716, lng: 77.5946 },
    });

    expect(punch.id).toBeDefined();
    expect(punch.action).toBe('clock_in');
    expect(punch.payload.employeeId).toBe('emp-123');
    expect(punch.nonce).toBeDefined();
    expect(punch.clientTimestamp).toBeDefined();

    const queue = await getQueuedAttendancePunches();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(punch.id);
  });

  it('should remove synced punch upon request', async () => {
    const p1 = await queueAttendancePunch('clock_in', { emp: 1 });
    const p2 = await queueAttendancePunch('toggle_break', { emp: 1 });

    let queue = await getQueuedAttendancePunches();
    expect(queue.length).toBe(2);

    await removeQueuedPunch(p1.id);
    queue = await getQueuedAttendancePunches();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(p2.id);
  });

  it('should flush offline queue using executor and remove successful entries', async () => {
    const p1 = await queueAttendancePunch('clock_in', { punch: 'first' });
    const p2 = await queueAttendancePunch('clock_out', { punch: 'second' });

    const processedIds: string[] = [];

    const result = await flushOfflineAttendanceQueue(async (item) => {
      processedIds.push(item.id);
      return true; // Mark as successful
    });

    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(processedIds).toEqual([p1.id, p2.id]);

    const remaining = await getQueuedAttendancePunches();
    expect(remaining.length).toBe(0);
  });

  it('should preserve failed punches in queue when executor fails', async () => {
    const p1 = await queueAttendancePunch('clock_in', { punch: 'will_fail' });

    const result = await flushOfflineAttendanceQueue(async () => {
      return false; // Fails to sync
    });

    expect(result.syncedCount).toBe(0);
    expect(result.failedCount).toBe(1);

    const remaining = await getQueuedAttendancePunches();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(p1.id);
  });

  it('should check browser online state safely', () => {
    const online = isBrowserOnline();
    expect(typeof online).toBe('boolean');
  });
});
