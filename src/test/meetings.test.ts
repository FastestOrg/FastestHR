import { describe, it, expect } from 'vitest';
import {
  calculateAvailableSlots,
  generateICSContent,
  generateGoogleCalendarWebUrl,
  generateOutlookWebUrl,
} from '@/lib/google-calendar';
import { WeeklySchedule, DEFAULT_WEEKLY_SCHEDULE } from '@/types/meeting';

describe('Meeting Scheduler - Slot Calculation Engine', () => {
  it('should generate available time slots for enabled working days', () => {
    // Pick a future Monday (e.g. 2026-09-07 is a Monday)
    const testDate = new Date(2026, 8, 7); // Sep 7, 2026

    const schedule: WeeklySchedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      mon: {
        enabled: true,
        slots: [{ start: '09:00', end: '11:00' }],
      },
    };

    const slots = calculateAvailableSlots({
      date: testDate,
      weeklySchedule: schedule,
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeHours: 0,
      busyIntervals: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].timeFormatted).toBe('09:00 AM');
    expect(slots[0].available).toBe(true);
  });

  it('should return empty slots if the day is disabled in host schedule', () => {
    const testDate = new Date(2026, 8, 13); // Sunday

    const schedule: WeeklySchedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      sun: {
        enabled: false,
        slots: [{ start: '10:00', end: '14:00' }],
      },
    };

    const slots = calculateAvailableSlots({
      date: testDate,
      weeklySchedule: schedule,
      durationMinutes: 30,
      busyIntervals: [],
    });

    expect(slots).toEqual([]);
  });

  it('should correctly mark slots as conflicted when busy intervals overlap', () => {
    const testDate = new Date(2026, 8, 7); // Monday

    const schedule: WeeklySchedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      mon: {
        enabled: true,
        slots: [{ start: '09:00', end: '11:00' }],
      },
    };

    // Busy from 09:30 to 10:00
    const busyStart = new Date(2026, 8, 7, 9, 30, 0, 0);
    const busyEnd = new Date(2026, 8, 7, 10, 0, 0, 0);

    const slots = calculateAvailableSlots({
      date: testDate,
      weeklySchedule: schedule,
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeHours: 0,
      busyIntervals: [{ start: busyStart.toISOString(), end: busyEnd.toISOString() }],
    });

    // 09:00 AM should be available
    const slot0900 = slots.find((s) => s.timeFormatted === '09:00 AM');
    expect(slot0900?.available).toBe(true);

    // 09:30 AM should be conflicted (unavailable)
    const slot0930 = slots.find((s) => s.timeFormatted === '09:30 AM');
    expect(slot0930?.available).toBe(false);

    // 10:00 AM should be available
    const slot1000 = slots.find((s) => s.timeFormatted === '10:00 AM');
    expect(slot1000?.available).toBe(true);
  });

  it('should correctly handle external Google Calendar events: 3:00 PM busy, 3:30 PM free, 4:00 PM busy, 4:30 PM free', () => {
    const testDate = new Date(2026, 8, 2); // Wed, Sep 2, 2026

    const schedule: WeeklySchedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      wed: {
        enabled: true,
        slots: [{ start: '14:00', end: '18:00' }], // 2 PM to 6 PM
      },
    };

    // Event 1: 3:00 PM - 3:30 PM (Weskill Interview)
    const event1Start = new Date(2026, 8, 2, 15, 0, 0, 0).toISOString();
    const event1End = new Date(2026, 8, 2, 15, 30, 0, 0).toISOString();

    // Event 2: 4:00 PM - 4:30 PM (30 Min Meeting with Prashant)
    const event2Start = new Date(2026, 8, 2, 16, 0, 0, 0).toISOString();
    const event2End = new Date(2026, 8, 2, 16, 30, 0, 0).toISOString();

    const slots = calculateAvailableSlots({
      date: testDate,
      weeklySchedule: schedule,
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeHours: 0,
      busyIntervals: [
        { start: event1Start, end: event1End },
        { start: event2Start, end: event2End },
      ],
    });

    const slot3pm = slots.find((s) => s.timeFormatted === '03:00 PM');
    const slot330pm = slots.find((s) => s.timeFormatted === '03:30 PM');
    const slot4pm = slots.find((s) => s.timeFormatted === '04:00 PM');
    const slot430pm = slots.find((s) => s.timeFormatted === '04:30 PM');

    // 3:00 PM must NOT be available (busy)
    expect(slot3pm?.available).toBe(false);

    // 3:30 PM MUST be available (free!)
    expect(slot330pm?.available).toBe(true);

    // 4:00 PM must NOT be available (busy)
    expect(slot4pm?.available).toBe(false);

    // 4:30 PM MUST be available (free!)
    expect(slot430pm?.available).toBe(true);
  });

  it('should correctly generate 15-minute slots for default schedule: Mon-Sat 10:00-14:00 & 15:00-19:00', () => {
    const saturday = new Date(2026, 8, 5); // Saturday Sep 5, 2026

    const slots = calculateAvailableSlots({
      date: saturday,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      durationMinutes: 15,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeHours: 0,
      busyIntervals: [],
    });

    // Saturday is enabled in default schedule
    expect(slots.length).toBeGreaterThan(0);

    // Morning window starts at 10:00 AM
    expect(slots[0].timeFormatted).toBe('10:00 AM');
    // Total 15-min slots for two 4-hour blocks: (4 hrs * 4 slots) + (4 hrs * 4 slots) = 32 slots
    expect(slots.length).toBe(32);

    // Afternoon window starts at 03:00 PM
    const slot3pm = slots.find((s) => s.timeFormatted === '03:00 PM');
    expect(slot3pm).toBeDefined();
    expect(slot3pm?.available).toBe(true);

    // 2:00 PM to 3:00 PM break window should NOT have slots
    const slot2pm = slots.find((s) => s.timeFormatted === '02:00 PM');
    const slot230pm = slots.find((s) => s.timeFormatted === '02:30 PM');
    expect(slot2pm).toBeUndefined();
    expect(slot230pm).toBeUndefined();

    // Last afternoon slot is 06:45 PM (ending at 07:00 PM)
    const lastSlot = slots[slots.length - 1];
    expect(lastSlot.timeFormatted).toBe('06:45 PM');
  });
});

describe('Meeting Scheduler - Calendar Exporters & URLs', () => {
  it('should generate valid RFC 5545 iCalendar (.ics) content', () => {
    const startISO = '2026-09-07T10:00:00.000Z';
    const endISO = '2026-09-07T10:30:00.000Z';

    const ics = generateICSContent({
      title: 'Strategy Consultation',
      description: 'Discuss Q4 roadmap',
      location: 'https://meet.google.com/abc-defg-hij',
      startISO,
      endISO,
      organizerName: 'Sarah Connor',
      organizerEmail: 'sarah@acme.com',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('SUMMARY:Strategy Consultation');
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('ORGANIZER;CN=Sarah Connor:mailto:sarah@acme.com');
    expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('should generate valid Google Calendar web template URL', () => {
    const url = generateGoogleCalendarWebUrl({
      title: 'Quick 30 Min Sync',
      description: 'Syncing on project milestones',
      location: 'https://meet.google.com/xyz',
      startISO: '2026-09-07T14:00:00.000Z',
      endISO: '2026-09-07T14:30:00.000Z',
    });

    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Quick+30+Min+Sync');
    expect(url).toContain('location=https%3A%2F%2Fmeet.google.com%2Fxyz');
  });

  it('should generate valid Outlook Live web template URL', () => {
    const url = generateOutlookWebUrl({
      title: 'Candidate Interview',
      description: 'Senior Frontend Engineer Interview',
      location: 'Google Meet',
      startISO: '2026-09-07T15:00:00.000Z',
      endISO: '2026-09-07T15:45:00.000Z',
    });

    expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url).toContain('rru=addevent');
    expect(url).toContain('subject=Candidate+Interview');
  });
});
