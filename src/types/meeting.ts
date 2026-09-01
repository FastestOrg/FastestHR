export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface TimeSlotRange {
  start: string; // e.g. "09:00"
  end: string;   // e.g. "17:00"
}

export interface DaySchedule {
  enabled: boolean;
  slots: TimeSlotRange[];
}

export type WeeklySchedule = Record<DayOfWeek, DaySchedule>;

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  mon: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  tue: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  wed: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  thu: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  fri: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  sat: { enabled: true, slots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] },
  sun: { enabled: false, slots: [{ start: '10:00', end: '14:00' }] },
};

export const DEFAULT_MEETING_SETTINGS = {
  title: 'Interview',
  duration_minutes: 15,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 2,
  max_future_days: 7,
  auto_google_meet: true,
  location_type: 'google_meet' as LocationType,
};

export type LocationType = 'google_meet' | 'phone' | 'in_person' | 'custom';

export interface UserMeetingSettings {
  id?: string;
  user_id: string;
  company_id: string;
  booking_slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  location_type: LocationType;
  weekly_schedule: WeeklySchedule;
  timezone: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_future_days: number;
  google_calendar_connected: boolean;
  google_calendar_email?: string | null;
  google_access_token?: string | null;
  google_token_expiry?: string | null;
  google_refresh_token?: string | null;
  google_calendar_id?: string;
  auto_google_meet: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MeetingEventType {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  slug: string;
  description?: string | null;
  duration_minutes: number;
  location_type: LocationType;
  color?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';

export interface MeetingBooking {
  id: string;
  company_id: string;
  host_user_id: string;
  event_type_id?: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_linkedin?: string | null;
  notes?: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: BookingStatus;
  google_event_id?: string | null;
  meeting_link?: string | null;
  cancellation_reason?: string | null;
  rescheduled_from_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined host profile info (if loaded in portal)
  host_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  event_type?: MeetingEventType | null;
}

export interface PublicBookingCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
}

export interface PublicBookingHost {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

export interface PublicBookingPageData {
  success: boolean;
  error?: string;
  company?: PublicBookingCompany;
  host?: PublicBookingHost;
  settings?: UserMeetingSettings;
  event_types?: MeetingEventType[];
  busy_slots?: { start_time: string; end_time: string }[];
}

export interface CreateBookingPayload {
  companySlug: string;
  bookingSlug: string;
  eventTypeId?: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestLinkedin?: string;
  notes?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  guestTimezone: string;
  meetingLink?: string;
  googleEventId?: string;
}

export interface SlotOption {
  timeFormatted: string; // e.g. "09:30 AM"
  startISO: string;      // 2026-09-02T09:30:00Z
  endISO: string;        // 2026-09-02T10:00:00Z
  available: boolean;
}
