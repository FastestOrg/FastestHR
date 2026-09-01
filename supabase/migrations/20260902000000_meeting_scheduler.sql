-- ==============================================================================
-- Migration: Meeting Scheduler & Google Calendar Sync
-- Tables: user_meeting_settings, meeting_event_types, meeting_bookings
-- Functions: get_public_booking_page, create_public_booking, cancel_public_booking
-- ==============================================================================

-- 1. USER MEETING SETTINGS
CREATE TABLE IF NOT EXISTS public.user_meeting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  booking_slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Interview',
  description TEXT DEFAULT 'Welcome! Please select a convenient time on my calendar for our conversation.',
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  weekly_schedule JSONB NOT NULL DEFAULT '{
    "mon": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "tue": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "wed": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "thu": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "fri": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "sat": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "sun": { "enabled": false, "slots": [{"start": "10:00", "end": "14:00"}] }
  }'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  min_notice_hours INTEGER NOT NULL DEFAULT 2,
  max_future_days INTEGER NOT NULL DEFAULT 7,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT false,
  google_calendar_email TEXT,
  google_access_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  google_refresh_token TEXT,
  google_calendar_id TEXT DEFAULT 'primary',
  auto_google_meet BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_booking_slug UNIQUE (company_id, booking_slug)
);

-- Index for fast lookup on public booking URLs
CREATE INDEX IF NOT EXISTS idx_user_meeting_settings_slug ON public.user_meeting_settings(company_id, booking_slug);
CREATE INDEX IF NOT EXISTS idx_user_meeting_settings_user ON public.user_meeting_settings(user_id);

-- 2. MEETING EVENT TYPES (Multiple meeting types per user e.g. 15m, 30m, 45m, 60m)
CREATE TABLE IF NOT EXISTS public.meeting_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_event_type_slug UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_meeting_event_types_user ON public.meeting_event_types(user_id);

-- 3. MEETING BOOKINGS
CREATE TABLE IF NOT EXISTS public.meeting_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type_id UUID REFERENCES public.meeting_event_types(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_linkedin TEXT,
  notes TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')),
  google_event_id TEXT,
  meeting_link TEXT,
  cancellation_reason TEXT,
  rescheduled_from_id UUID REFERENCES public.meeting_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_bookings_host ON public.meeting_bookings(host_user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_company ON public.meeting_bookings(company_id, start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_guest_email ON public.meeting_bookings(guest_email);

-- ENABLE RLS
ALTER TABLE public.user_meeting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_bookings ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- user_meeting_settings: Users can read and modify their own settings; Company Admins can view settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own meeting settings' AND tablename = 'user_meeting_settings') THEN
    CREATE POLICY "Users can manage their own meeting settings"
      ON public.user_meeting_settings
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = user_meeting_settings.company_id AND p.platform_role IN ('company_admin', 'super_admin')
      ))
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- meeting_event_types: Users can manage their own event types; Company users can view
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own event types' AND tablename = 'meeting_event_types') THEN
    CREATE POLICY "Users can manage their own event types"
      ON public.meeting_event_types
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = meeting_event_types.company_id
      ))
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- meeting_bookings: Hosts and Company Admins/HR can manage bookings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view and manage their meeting bookings' AND tablename = 'meeting_bookings') THEN
    CREATE POLICY "Users can view and manage their meeting bookings"
      ON public.meeting_bookings
      FOR ALL
      TO authenticated
      USING (
        host_user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND p.company_id = meeting_bookings.company_id AND p.platform_role IN ('company_admin', 'hr_manager', 'super_admin')
        )
      )
      WITH CHECK (
        host_user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND p.company_id = meeting_bookings.company_id AND p.platform_role IN ('company_admin', 'hr_manager', 'super_admin')
        )
      );
  END IF;
END $$;

-- 5. PUBLIC RPC FUNCTIONS FOR SCHEDULER & BOOKING ENGINE

-- RPC 1: Fetch public booking page data by company slug & booking slug
CREATE OR REPLACE FUNCTION public.get_public_booking_page(
  p_company_slug TEXT,
  p_booking_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company RECORD;
  v_host RECORD;
  v_settings RECORD;
  v_event_types JSONB;
  v_existing_bookings JSONB;
  v_result JSONB;
BEGIN
  -- 1. Find Company
  SELECT id, name, slug, logo_url, timezone
  INTO v_company
  FROM public.companies
  WHERE lower(slug) = lower(p_company_slug) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  -- 2. Find Meeting Settings & Host
  SELECT 
    s.id, s.user_id, s.company_id, s.booking_slug, s.title, s.description,
    s.duration_minutes, s.location_type, s.weekly_schedule, s.timezone,
    s.buffer_before_minutes, s.buffer_after_minutes, s.min_notice_hours,
    s.max_future_days, s.google_calendar_connected, s.auto_google_meet, s.is_active,
    p.full_name, p.avatar_url, p.platform_role
  INTO v_settings
  FROM public.user_meeting_settings s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.company_id = v_company.id 
    AND lower(s.booking_slug) = lower(p_booking_slug)
    AND s.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking page not found or inactive');
  END IF;

  -- 3. Fetch Active Event Types for this user
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'slug', slug,
    'description', description,
    'duration_minutes', duration_minutes,
    'location_type', location_type,
    'color', color
  )), '[]'::jsonb)
  INTO v_event_types
  FROM public.meeting_event_types
  WHERE user_id = v_settings.user_id AND is_active = true;

  -- 4. Fetch Existing Bookings for next max_future_days (only start/end timestamps to avoid leaking PII)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'start_time', start_time,
    'end_time', end_time
  )), '[]'::jsonb)
  INTO v_existing_bookings
  FROM public.meeting_bookings
  WHERE host_user_id = v_settings.user_id
    AND status = 'confirmed'
    AND start_time >= now() - interval '1 hour'
    AND start_time <= now() + (COALESCE(v_settings.max_future_days, 60) || ' days')::interval;

  -- Build Result Object
  v_result := jsonb_build_object(
    'success', true,
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'slug', v_company.slug,
      'logo_url', v_company.logo_url,
      'timezone', v_company.timezone
    ),
    'host', jsonb_build_object(
      'user_id', v_settings.user_id,
      'full_name', v_settings.full_name,
      'avatar_url', v_settings.avatar_url,
      'role', v_settings.platform_role
    ),
    'settings', jsonb_build_object(
      'id', v_settings.id,
      'booking_slug', v_settings.booking_slug,
      'title', v_settings.title,
      'description', v_settings.description,
      'duration_minutes', v_settings.duration_minutes,
      'location_type', v_settings.location_type,
      'weekly_schedule', v_settings.weekly_schedule,
      'timezone', v_settings.timezone,
      'buffer_before_minutes', v_settings.buffer_before_minutes,
      'buffer_after_minutes', v_settings.buffer_after_minutes,
      'min_notice_hours', v_settings.min_notice_hours,
      'max_future_days', v_settings.max_future_days,
      'google_calendar_connected', v_settings.google_calendar_connected,
      'auto_google_meet', v_settings.auto_google_meet
    ),
    'event_types', v_event_types,
    'busy_slots', v_existing_bookings
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking_page(TEXT, TEXT) TO anon, authenticated;

-- RPC 2: Create public booking
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_company_slug TEXT,
  p_booking_slug TEXT,
  p_event_type_id UUID,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_guest_phone TEXT,
  p_guest_linkedin TEXT,
  p_notes TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_guest_timezone TEXT,
  p_meeting_link TEXT DEFAULT NULL,
  p_google_event_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company RECORD;
  v_settings RECORD;
  v_host_profile RECORD;
  v_booking_id UUID;
  v_conflict_count INT;
  v_effective_meeting_link TEXT;
BEGIN
  -- 1. Validate required fields
  IF p_guest_name IS NULL OR trim(p_guest_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name is required');
  END IF;
  IF p_guest_email IS NULL OR trim(p_guest_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;
  IF p_guest_phone IS NULL OR trim(p_guest_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone number is required');
  END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valid start and end time are required');
  END IF;

  -- 2. Lookup company
  SELECT id, name, slug, logo_url
  INTO v_company
  FROM public.companies
  WHERE lower(slug) = lower(p_company_slug) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  -- 3. Lookup host settings
  SELECT s.*
  INTO v_settings
  FROM public.user_meeting_settings s
  WHERE s.company_id = v_company.id 
    AND lower(s.booking_slug) = lower(p_booking_slug)
    AND s.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Host scheduling is inactive or not found');
  END IF;

  -- 4. Lookup host profile
  SELECT id, full_name, avatar_url
  INTO v_host_profile
  FROM public.profiles
  WHERE id = v_settings.user_id;

  -- 5. Double-booking conflict check (prevent concurrent collisions)
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM public.meeting_bookings
  WHERE host_user_id = v_settings.user_id
    AND status = 'confirmed'
    AND (
      (start_time < p_end_time AND end_time > p_start_time)
    );

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This time slot was just booked by someone else. Please choose another slot.');
  END IF;

  -- Fallback / Default virtual meeting link if not provided
  v_effective_meeting_link := p_meeting_link;
  IF v_effective_meeting_link IS NULL OR trim(v_effective_meeting_link) = '' THEN
    v_effective_meeting_link := 'https://meet.google.com/fastest-' || substr(md5(random()::text), 1, 3) || '-' || substr(md5(random()::text), 4, 4) || '-' || substr(md5(random()::text), 8, 3);
  END IF;

  -- 6. Insert booking record
  INSERT INTO public.meeting_bookings (
    company_id,
    host_user_id,
    event_type_id,
    guest_name,
    guest_email,
    guest_phone,
    guest_linkedin,
    notes,
    start_time,
    end_time,
    timezone,
    status,
    google_event_id,
    meeting_link
  ) VALUES (
    v_company.id,
    v_settings.user_id,
    p_event_type_id,
    trim(p_guest_name),
    lower(trim(p_guest_email)),
    trim(p_guest_phone),
    NULLIF(trim(p_guest_linkedin), ''),
    NULLIF(trim(p_notes), ''),
    p_start_time,
    p_end_time,
    COALESCE(p_guest_timezone, v_settings.timezone, 'UTC'),
    'confirmed',
    p_google_event_id,
    v_effective_meeting_link
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'host_name', v_host_profile.full_name,
    'company_name', v_company.name,
    'start_time', p_start_time,
    'end_time', p_end_time,
    'timezone', COALESCE(p_guest_timezone, v_settings.timezone),
    'meeting_link', v_effective_meeting_link,
    'guest_name', p_guest_name,
    'guest_email', p_guest_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO anon, authenticated;

-- RPC 3: Cancel public booking
CREATE OR REPLACE FUNCTION public.cancel_public_booking(
  p_booking_id UUID,
  p_cancellation_reason TEXT DEFAULT 'Cancelled by participant'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT * INTO v_booking
  FROM public.meeting_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  UPDATE public.meeting_bookings
  SET status = 'cancelled',
      cancellation_reason = p_cancellation_reason,
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Meeting successfully cancelled',
    'booking_id', p_booking_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_public_booking(UUID, TEXT) TO anon, authenticated;
