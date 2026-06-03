-- PostgreSQL Migration: Add Attendance Settings & Policy Rules
--
-- Adds public.companies.attendance_settings column, Alters employee_status enum,
-- and creates functions for automatic clock-out and absconding status updates.

-- 1. Add attendance_settings JSONB column to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS attendance_settings JSONB DEFAULT '{
  "location_required": true,
  "auto_logout_hours": 24,
  "max_regularizations_per_month": 3,
  "non_logged_out_handling": {
    "action": "absent",
    "min_working_hours": 4
  },
  "late_login_handling": {
    "action": "late",
    "min_working_hours": 4
  },
  "absconding_consecutive_leaves": 5,
  "absconding_email_template": "Dear {{employee_name}},\n\nYou have been absent from work or on leave for {{consecutive_days}} consecutive days without any official communication. Please contact the HR department immediately.\n\nBest regards,\n{{company_name}}"
}'::jsonb;

-- 2. Alter employee_status enum type to add 'absconded'
-- NOTE: In Postgres, ALTER TYPE ADD VALUE cannot run inside a transaction block in some scenarios,
-- but standard Supabase migrations run safely if done conditionally.
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'absconded';

-- 3. Grant SELECT on the new settings column to authenticated users
GRANT SELECT (attendance_settings) ON public.companies TO authenticated;

-- 4. Create public.process_auto_clock_outs(p_company_id uuid)
CREATE OR REPLACE FUNCTION public.process_auto_clock_outs(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record record;
    v_auto_logout_hours double precision;
    v_action text;
    v_min_hours numeric;
    v_out_time timestamptz;
    v_total_hours numeric;
    v_status text;
BEGIN
    FOR v_record IN 
        SELECT a.id, a.clock_in, c.attendance_settings
        FROM public.attendance a
        JOIN public.companies c ON a.company_id = c.id
        WHERE a.company_id = p_company_id 
          AND a.clock_out IS NULL
    LOOP
        v_auto_logout_hours := COALESCE((v_record.attendance_settings->>'auto_logout_hours')::double precision, 24.0);
        
        -- If elapsed time since clock_in is greater than auto_logout_hours
        IF EXTRACT(EPOCH FROM (now() - v_record.clock_in)) / 3600.0 > v_auto_logout_hours THEN
            v_action := COALESCE(v_record.attendance_settings->'non_logged_out_handling'->>'action', 'absent');
            v_min_hours := COALESCE((v_record.attendance_settings->'non_logged_out_handling'->>'min_working_hours')::numeric, 4.0);
            
            IF v_action = 'half_day' THEN
                v_status := 'half_day';
                v_total_hours := v_min_hours;
                v_out_time := v_record.clock_in + (v_min_hours * interval '1 hour');
            ELSIF v_action = 'present' THEN
                v_status := 'present';
                v_total_hours := 8.0;
                v_out_time := v_record.clock_in + (8.0 * interval '1 hour');
            ELSE
                v_status := 'absent';
                v_total_hours := 0.0;
                v_out_time := v_record.clock_in + (8.0 * interval '1 hour');
            END IF;
            
            UPDATE public.attendance
            SET clock_out = v_out_time,
                total_hours = v_total_hours,
                status = v_status::attendance_status,
                regularization_reason = jsonb_build_object('system_note', 'Auto clocked-out by system due to shift timeout.')::text
            WHERE id = v_record.id;
        END IF;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_auto_clock_outs(uuid) TO authenticated;

-- 5. Create public.check_and_process_absconding(p_company_id uuid)
CREATE OR REPLACE FUNCTION public.check_and_process_absconding(p_company_id uuid)
RETURNS TABLE (
    r_employee_id uuid,
    r_first_name text,
    r_last_name text,
    r_email text,
    r_consecutive_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emp record;
    v_threshold integer;
    v_check_date date;
    v_consec_days integer;
    v_is_absent_or_leave boolean;
    v_is_holiday boolean;
    v_day_name text;
    v_is_workday boolean;
    v_work_days text[];
BEGIN
    -- Fetch absconding threshold for this company
    SELECT COALESCE((attendance_settings->>'absconding_consecutive_leaves')::integer, 5)
    INTO v_threshold
    FROM public.companies
    WHERE id = p_company_id;

    -- Loop through active employees
    FOR v_emp IN 
        SELECT e.id, e.first_name, e.last_name, e.work_email, c.work_days
        FROM public.employees e
        JOIN public.companies c ON e.company_id = c.id
        WHERE e.company_id = p_company_id 
          AND e.status IN ('active', 'probation', 'on_leave')
          AND e.deleted_at IS NULL
    LOOP
        v_consec_days := 0;
        v_check_date := (now()::date) - 1; -- start from yesterday
        v_work_days := COALESCE(v_emp.work_days, ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        
        LOOP
            -- 1. Check if check_date is a weekend / non-workday
            v_day_name := to_char(v_check_date, 'Dy');
            v_is_workday := v_day_name = ANY(v_work_days);
            
            -- 2. Check if check_date is a public holiday
            SELECT EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE company_id = p_company_id AND date = v_check_date
            ) INTO v_is_holiday;
            
            IF NOT v_is_workday OR v_is_holiday THEN
                -- Weekends and holidays are skipped (do not break the chain, but do not increment either)
                v_check_date := v_check_date - 1;
                -- Avoid infinite loop if we go back too far (cap at 60 days)
                IF v_check_date < (now()::date) - 60 THEN
                    EXIT;
                END IF;
                CONTINUE;
            END IF;
            
            -- 3. Check if there was an approved leave
            SELECT EXISTS (
                SELECT 1 FROM public.leave_requests 
                WHERE employee_id = v_emp.id 
                  AND status = 'approved' 
                  AND start_date <= v_check_date 
                  AND end_date >= v_check_date
            ) INTO v_is_absent_or_leave;
            
            -- 4. If no leave, check if there was a clocked-in attendance
            IF NOT v_is_absent_or_leave THEN
                SELECT EXISTS (
                    SELECT 1 FROM public.attendance 
                    WHERE employee_id = v_emp.id 
                      AND date = v_check_date 
                      AND clock_in IS NOT NULL
                ) INTO v_is_absent_or_leave;
                
                -- If they clocked in, it means they were NOT absent/on leave
                IF v_is_absent_or_leave THEN
                    -- They worked on this day! Chain is broken.
                    EXIT;
                ELSE
                    -- No attendance clock-in on a workday means they were absent
                    v_is_absent_or_leave := true;
                END IF;
            ELSE
                -- They were on approved leave
                v_is_absent_or_leave := true;
            END IF;
            
            IF v_is_absent_or_leave THEN
                v_consec_days := v_consec_days + 1;
            ELSE
                EXIT;
            END IF;
            
            v_check_date := v_check_date - 1;
            
            -- Safety cap
            IF v_check_date < (now()::date) - 60 THEN
                EXIT;
            END IF;
        END LOOP;
        
        -- If consecutive days meets or exceeds threshold
        IF v_consec_days >= v_threshold THEN
            -- Update employee status to 'absconded'
            UPDATE public.employees
            SET status = 'absconded'
            WHERE id = v_emp.id;
            
            -- Return the details of the employee so email can be fired
            r_employee_id := v_emp.id;
            r_first_name := v_emp.first_name;
            r_last_name := v_emp.last_name;
            r_email := v_emp.work_email;
            r_consecutive_days := v_consec_days;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_process_absconding(uuid) TO authenticated;

-- 6. Modify verify_attendance_geofence() trigger to respect location_required toggle
CREATE OR REPLACE FUNCTION public.verify_attendance_geofence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comp_lat double precision;
    v_comp_lon double precision;
    v_comp_rad integer;
    v_gps jsonb;
    v_lat double precision;
    v_lon double precision;
    v_distance double precision;
    v_work_type text;
    v_attendance_settings jsonb;
    v_location_required boolean := true;
BEGIN
    -- Fetch company geofencing parameters and attendance settings
    SELECT geofence_latitude, geofence_longitude, geofence_radius, attendance_settings
    INTO v_comp_lat, v_comp_lon, v_comp_rad, v_attendance_settings
    FROM public.companies
    WHERE id = NEW.company_id;

    IF v_attendance_settings IS NOT NULL AND v_attendance_settings->>'location_required' IS NOT NULL THEN
        v_location_required := (v_attendance_settings->>'location_required')::boolean;
    END IF;

    -- Check clock-in location
    IF NEW.clock_in_location IS NOT NULL THEN
        v_work_type := NEW.clock_in_location->>'work_type';
        
        IF v_work_type = 'office' AND v_location_required THEN
            -- Only validate if company actually has geofencing coordinates set
            IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                v_gps := NEW.clock_in_location->'gps';
                IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                    RAISE EXCEPTION 'Office clock-in requires valid GPS location verification.';
                END IF;
                
                v_lat := (v_gps->>'latitude')::double precision;
                v_lon := (v_gps->>'longitude')::double precision;
                v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                
                IF v_distance > COALESCE(v_comp_rad, 200) THEN
                    RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundary (% meters away, allowed radius: % meters).', 
                        ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                END IF;
            END IF;
        END IF;
    END IF;

    -- Check clock-out location
    IF NEW.clock_out_location IS NOT NULL THEN
        v_work_type := NEW.clock_out_location->>'work_type';
        
        IF v_work_type = 'office' AND v_location_required THEN
            IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                v_gps := NEW.clock_out_location->'gps';
                IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                    RAISE EXCEPTION 'Office clock-out requires valid GPS location verification.';
                END IF;
                
                v_lat := (v_gps->>'latitude')::double precision;
                v_lon := (v_gps->>'longitude')::double precision;
                v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                
                IF v_distance > COALESCE(v_comp_rad, 200) THEN
                    RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundary (% meters away on clock-out, allowed radius: % meters).', 
                        ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
