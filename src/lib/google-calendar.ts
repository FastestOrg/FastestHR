/**
 * Google Calendar API Service & Scheduling Utilities for FastestHR Meetings
 * Handles Google OAuth 2.0 (GIS), Free/Busy Calculation, Google Meet Creation, and Calendar Exports.
 */

import { DEFAULT_GOOGLE_CLIENT_ID, loadGoogleIdentityServices } from './google-drive';
import { DayOfWeek, TimeSlotRange, WeeklySchedule, SlotOption } from '@/types/meeting';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface GoogleCalendarAuthResult {
  accessToken: string;
  expiresIn: number;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface CreateGCalEventParams {
  accessToken: string;
  title: string;
  description?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestLinkedin?: string;
  startISO: string;
  endISO: string;
  timezone: string;
  autoGoogleMeet?: boolean;
}

export interface GCalEventResult {
  eventId: string;
  meetingLink: string;
  htmlLink?: string;
}

/**
 * Initiates Google OAuth 2.0 Token Client for Google Calendar access.
 */
export async function requestGoogleCalendarAuth(clientId?: string): Promise<GoogleCalendarAuthResult> {
  await loadGoogleIdentityServices();

  const activeClientId = (clientId && clientId.trim().length > 0)
    ? clientId.trim()
    : (import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID);

  if (!activeClientId) {
    throw new Error('Google OAuth Client ID is not configured.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: GOOGLE_CALENDAR_SCOPES,
        prompt: 'consent',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Google Calendar authorization failed'));
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('No access token received from Google'));
            return;
          }

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            let email = 'connected-calendar@google.com';
            let name = 'Google User';
            let avatarUrl: string | undefined;

            if (userRes.ok) {
              const userData = await userRes.json();
              email = userData.email || email;
              name = userData.name || userData.email || name;
              avatarUrl = userData.picture;
            }

            resolve({
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in || 3600,
              email,
              name,
              avatarUrl,
            });
          } catch {
            resolve({
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in || 3600,
              email: 'connected-calendar@google.com',
              name: 'Google Calendar User',
            });
          }
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google Calendar OAuth was cancelled or closed.'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(new Error('Failed to initialize Google Calendar sign-in: ' + (err?.message || String(err))));
    }
  });
}

/**
 * Fetches busy time intervals from Google Calendar (Events API & FreeBusy API) in real time.
 */
export async function fetchGoogleCalendarBusyRanges(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const busyRanges: { start: string; end: string }[] = [];

  // 1. First priority: Google Calendar Events List (singleEvents=true automatically expands recurring events)
  try {
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;

    const res = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      for (const item of data.items || []) {
        if (item.status === 'cancelled') continue;
        if (item.transparency === 'transparent') continue; // User marked as 'Available'

        let start = item.start?.dateTime || item.start?.date;
        let end = item.end?.dateTime || item.end?.date;

        if (item.start?.date && !item.start?.dateTime) {
          // All-day event: block from start of day to end of day
          start = new Date(`${item.start.date}T00:00:00`).toISOString();
          end = new Date(`${item.end.date}T23:59:59`).toISOString();
        }

        if (start && end) {
          busyRanges.push({ start, end });
        }
      }

      if (busyRanges.length > 0) {
        return busyRanges;
      }
    }
  } catch (err) {
    console.warn('Google Calendar Events API query notice:', err);
  }

  // 2. Second priority: FreeBusy API
  try {
    const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    });

    if (fbRes.ok) {
      const fbData = await fbRes.json();
      const fbBusy = fbData.calendars?.primary?.busy || [];
      for (const item of fbBusy) {
        busyRanges.push({ start: item.start, end: item.end });
      }
    }
  } catch (fbErr) {
    console.warn('Google Calendar FreeBusy query notice:', fbErr);
  }

  return busyRanges;
}

/**
 * Creates an event in the host's primary Google Calendar with auto-provisioned Google Meet link.
 */
export async function createGoogleCalendarMeetingEvent(
  params: CreateGCalEventParams
): Promise<GCalEventResult> {
  const {
    accessToken,
    title,
    description = '',
    guestName,
    guestEmail,
    guestPhone,
    guestLinkedin,
    startISO,
    endISO,
    timezone,
    autoGoogleMeet = true,
  } = params;

  const requestId = 'fastest-meet-' + Math.random().toString(36).substring(2, 12);

  let fullDescription = description || '';
  fullDescription += `\n\n--- Attendee Details ---\n`;
  fullDescription += `Guest: ${guestName}\n`;
  fullDescription += `Email: ${guestEmail}\n`;
  if (guestPhone) fullDescription += `Phone: ${guestPhone}\n`;
  if (guestLinkedin) fullDescription += `LinkedIn: ${guestLinkedin}\n`;
  fullDescription += `Scheduled via FastestHR Scheduler`;

  const requestBody: any = {
    summary: title,
    description: fullDescription,
    start: {
      dateTime: startISO,
      timeZone: timezone,
    },
    end: {
      dateTime: endISO,
      timeZone: timezone,
    },
    attendees: [
      { email: guestEmail, displayName: guestName },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
  };

  if (autoGoogleMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Calendar event: ${errText}`);
  }

  const eventData = await res.json();
  const meetingLink =
    eventData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
    eventData.hangoutLink ||
    null;

  return {
    eventId: eventData.id,
    meetingLink: meetingLink || '',
    htmlLink: eventData.htmlLink,
  };
}

/**
 * Deletes an event from Google Calendar on cancellation.
 */
export async function deleteGoogleCalendarMeetingEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok || res.status === 404 || res.status === 410;
  } catch (err) {
    console.error('Error deleting Google Calendar event:', err);
    return false;
  }
}

/**
 * Quick latency / health check for connected Google Calendar.
 */
export async function testGoogleCalendarSync(accessToken: string): Promise<{ success: boolean; latencyMs: number }> {
  const start = performance.now();
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const latencyMs = Math.round(performance.now() - start);

  if (!res.ok) {
    throw new Error(`Google Calendar check failed (${res.status})`);
  }
  return { success: true, latencyMs };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULING & SLOT CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

/**
 * Calculates available time slots for a given date based on:
 * - Host weekly schedule for that day of week
 * - Meeting duration & interval step
 * - Minimum notice hours from now
 * - Existing DB bookings + Google Calendar live events (busy slots)
 */
export function calculateAvailableSlots(params: {
  date: Date;
  weeklySchedule: WeeklySchedule;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minNoticeHours?: number;
  hostTimezone?: string;
  busyIntervals: { start: string | Date; end: string | Date }[];
}): SlotOption[] {
  const {
    date,
    weeklySchedule,
    durationMinutes = 30,
    bufferBeforeMinutes = 0,
    bufferAfterMinutes = 0,
    minNoticeHours = 2,
    busyIntervals = [],
  } = params;

  const dayOfWeek = DAY_MAP[date.getDay()];
  const daySchedule = weeklySchedule[dayOfWeek];

  if (!daySchedule || !daySchedule.enabled || !daySchedule.slots || daySchedule.slots.length === 0) {
    return [];
  }

  const now = new Date();
  const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

  // Normalize busy intervals into epoch ranges
  const busyRanges = busyIntervals.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const slots: SlotOption[] = [];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (const slotRange of daySchedule.slots) {
    const [startH, startM] = slotRange.start.split(':').map(Number);
    const [endH, endM] = slotRange.end.split(':').map(Number);

    const rangeStartTime = new Date(year, month, day, startH, startM, 0, 0);
    const rangeEndTime = new Date(year, month, day, endH, endM, 0, 0);

    // Slot step: interval equals durationMinutes (e.g. 15m, 30m, 45m, 60m)
    const stepMinutes = durationMinutes > 0 ? durationMinutes : 30;
    let currentSlotStart = new Date(rangeStartTime.getTime());

    while (true) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000);

      // If slot goes past the end of available working range, break
      if (currentSlotEnd.getTime() > rangeEndTime.getTime()) {
        break;
      }

      // Check if slot meets minimum notice lead time
      const isPastNotice = currentSlotStart.getTime() >= minAllowedTime.getTime();

      // Check direct collision with any busy interval
      // A slot [start, end] conflicts with [busy.start, busy.end] if start < busy.end && end > busy.start
      const slotStartTime = currentSlotStart.getTime();
      const slotEndTime = currentSlotEnd.getTime();

      let isConflicted = false;
      for (const busy of busyRanges) {
        if (slotStartTime < busy.end && slotEndTime > busy.start) {
          isConflicted = true;
          break;
        }
      }

      const available = isPastNotice && !isConflicted;

      const hours = currentSlotStart.getHours();
      const minutes = currentSlotStart.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 === 0 ? 12 : hours % 12;
      const timeFormatted = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;

      slots.push({
        timeFormatted,
        startISO: currentSlotStart.toISOString(),
        endISO: currentSlotEnd.toISOString(),
        available,
      });

      // Advance by step duration
      currentSlotStart = new Date(currentSlotStart.getTime() + stepMinutes * 60 * 1000);
    }
  }

  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR URL & ICS GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

function formatToICSDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates valid iCalendar (.ics) content for downloading.
 */
export function generateICSContent(params: {
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  organizerName?: string;
  organizerEmail?: string;
  guestName?: string;
  guestEmail?: string;
}): string {
  const {
    title,
    description = '',
    location = '',
    startISO,
    endISO,
    organizerName = 'FastestHR Host',
    organizerEmail = 'no-reply@fastesthr.com',
    guestName,
    guestEmail,
  } = params;

  const uid = 'fastesthq-' + Math.random().toString(36).substring(2, 15) + '@fastesthr.com';
  const nowICS = formatToICSDate(new Date().toISOString());
  const startICS = formatToICSDate(startISO);
  const endICS = formatToICSDate(endISO);

  const cleanDesc = description.replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FastestHR//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowICS}`,
    `DTSTART:${startICS}`,
    `DTEND:${endICS}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${cleanDesc}`,
    location ? `LOCATION:${location}` : '',
    `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
    guestEmail ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${guestName || 'Guest'}:mailto:${guestEmail}` : '',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Generates instant Google Calendar Web Add Event Link.
 */
export function generateGoogleCalendarWebUrl(params: {
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
}): string {
  const start = formatToICSDate(params.startISO);
  const end = formatToICSDate(params.endISO);
  const dates = `${start}/${end}`;

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates,
    details: params.description || '',
    location: params.location || '',
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/**
 * Generates instant Outlook Live Web Add Event Link.
 */
export function generateOutlookWebUrl(params: {
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
}): string {
  const query = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: params.title,
    startdt: params.startISO,
    enddt: params.endISO,
    body: params.description || '',
    location: params.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${query.toString()}`;
}
