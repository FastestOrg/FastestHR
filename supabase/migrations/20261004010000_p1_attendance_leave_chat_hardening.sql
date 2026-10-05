-- ==============================================================================
-- Migration: P1 Hardening — Server-Side Clock Authority & Schema Upgrades
-- Tables updated: attendance (active_break_start), leave_requests (approval_tiers)
-- RPCs: record_clock_in, record_clock_out, toggle_attendance_break
-- ==============================================================================

-- 1. Schema Upgrades for Anti-Pattern Cleanup
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS active_break_start TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.leave_requests 
  ADD COLUMN IF NOT EXISTS approval_tiers JSONB DEFAULT NULL;

-- Index for active breaks lookup
CREATE INDEX IF NOT EXISTS idx_attendance_active_break 
  ON public.attendance(employee_id, active_break_start) 
  WHERE active_break_start IS NOT NULL;

-- 2. Server-Side Clock Authority: record_clock_in
CREATE OR REPLACE FUNCTION public.record_clock_in(
  p_employee_id UUID,
  p_location JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_emp_company_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_today DATE := (v_now AT TIME ZONE 'UTC')::date;
  v_existing_id UUID;
  v_new_record public.attendance;
  v_shift_start TIME := '09:00:00';
  v_grace_mins INT := 15;
  v_is_late BOOLEAN := false;
  v_company_settings JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT platform_role, company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles WHERE id = v_user_id;

  SELECT company_id INTO v_emp_company_id
  FROM public.employees WHERE id = p_employee_id AND deleted_at IS NULL;

  IF v_emp_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Verify tenant boundary: caller must be employee themselves OR staff in the same company
  IF v_caller_role <> 'super_admin' AND v_caller_company_id <> v_emp_company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Company mismatch');
  END IF;

  -- Check if already clocked in for today
  SELECT id INTO v_existing_id
  FROM public.attendance
  WHERE employee_id = p_employee_id AND date = v_today AND clock_in IS NOT NULL;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already clocked in today', 'id', v_existing_id);
  END IF;

  -- Determine late status based on company settings if available
  SELECT attendance_settings INTO v_company_settings
  FROM public.companies WHERE id = v_emp_company_id;

  IF v_company_settings IS NOT NULL AND v_company_settings->>'late_grace_period_mins' IS NOT NULL THEN
    v_grace_mins := (v_company_settings->>'late_grace_period_mins')::INT;
  END IF;

  -- Check if late relative to shift start + grace
  IF (v_now::time > (v_shift_start + (v_grace_mins || ' minutes')::interval)) THEN
    v_is_late := true;
  END IF;

  INSERT INTO public.attendance (
    company_id,
    employee_id,
    date,
    clock_in,
    clock_in_location,
    clock_in_ip,
    device_info,
    status,
    is_late
  ) VALUES (
    v_emp_company_id,
    p_employee_id,
    v_today,
    v_now,
    p_location,
    p_ip_address,
    p_device_info,
    'present',
    v_is_late
  )
  RETURNING * INTO v_new_record;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_record.id,
    'clock_in', v_new_record.clock_in,
    'date', v_new_record.date,
    'is_late', v_new_record.is_late,
    'status', v_new_record.status
  );
END;
$$;

-- 3. Server-Side Clock Authority: record_clock_out
CREATE OR REPLACE FUNCTION public.record_clock_out(
  p_attendance_id UUID,
  p_location JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_record public.attendance;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_final_break_minutes INT;
  v_total_hours NUMERIC;
  v_overtime_hours NUMERIC := 0;
  v_shift_hours NUMERIC := 9;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_record
  FROM public.attendance WHERE id = p_attendance_id;

  IF v_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance record not found');
  END IF;

  IF v_record.clock_out IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already clocked out');
  END IF;

  SELECT platform_role, company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles WHERE id = v_user_id;

  IF v_caller_role <> 'super_admin' AND v_caller_company_id <> v_record.company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Company mismatch');
  END IF;

  v_final_break_minutes := COALESCE(v_record.break_minutes, 0);

  -- If currently on active break, finalize it using server time
  IF v_record.active_break_start IS NOT NULL THEN
    v_final_break_minutes := v_final_break_minutes + GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_now - v_record.active_break_start)) / 60)::INT);
  END IF;

  -- Calculate total hours on server: (now - clock_in) - break
  v_total_hours := GREATEST(0, (EXTRACT(EPOCH FROM (v_now - v_record.clock_in)) / 3600.0) - (v_final_break_minutes / 60.0));
  v_total_hours := ROUND(v_total_hours, 2);

  IF v_total_hours > v_shift_hours THEN
    v_overtime_hours := ROUND(v_total_hours - v_shift_hours, 2);
  END IF;

  UPDATE public.attendance
  SET
    clock_out = v_now,
    clock_out_location = p_location,
    break_minutes = v_final_break_minutes,
    active_break_start = NULL,
    total_hours = v_total_hours,
    overtime_hours = v_overtime_hours,
    updated_at = v_now
  WHERE id = p_attendance_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_record.id,
    'clock_out', v_record.clock_out,
    'total_hours', v_record.total_hours,
    'overtime_hours', v_record.overtime_hours,
    'break_minutes', v_record.break_minutes
  );
END;
$$;

-- 4. Server-Side Clock Authority: toggle_attendance_break
CREATE OR REPLACE FUNCTION public.toggle_attendance_break(
  p_attendance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_record public.attendance;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_break_mins INT;
  v_started_break BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_record
  FROM public.attendance WHERE id = p_attendance_id;

  IF v_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance record not found');
  END IF;

  SELECT platform_role, company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles WHERE id = v_user_id;

  IF v_caller_role <> 'super_admin' AND v_caller_company_id <> v_record.company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Company mismatch');
  END IF;

  v_break_mins := COALESCE(v_record.break_minutes, 0);

  IF v_record.active_break_start IS NOT NULL THEN
    -- Ending break
    v_break_mins := v_break_mins + GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_now - v_record.active_break_start)) / 60)::INT);
    UPDATE public.attendance
    SET
      active_break_start = NULL,
      break_minutes = v_break_mins,
      updated_at = v_now
    WHERE id = p_attendance_id;
    v_started_break := false;
  ELSE
    -- Starting break
    UPDATE public.attendance
    SET
      active_break_start = v_now,
      updated_at = v_now
    WHERE id = p_attendance_id;
    v_started_break := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'startedBreak', v_started_break,
    'breakMinutes', v_break_mins
  );
END;
$$;

-- 5. Revoke anonymous access & Grant to authenticated & service_role
REVOKE EXECUTE ON FUNCTION public.record_clock_in(UUID, JSONB, TEXT, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_clock_in(UUID, JSONB, TEXT, JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_clock_out(UUID, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_clock_out(UUID, JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_attendance_break(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.toggle_attendance_break(UUID) TO authenticated, service_role;
