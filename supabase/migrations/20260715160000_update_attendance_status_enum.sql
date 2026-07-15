-- PostgreSQL Migration: Add 'late' and 'early_leave' to attendance_status enum, and update calculate_attendance_metrics trigger

-- 1. Safely add 'late' and 'early_leave' values to public.attendance_status enum type
-- In PostgreSQL, ALTER TYPE ADD VALUE cannot be executed in a transaction block under some circumstances.
-- Supabase handles this automatically.
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'late';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'early_leave';

-- 2. Update calculate_attendance_metrics trigger function to calculate status and enforce late policies
CREATE OR REPLACE FUNCTION public.calculate_attendance_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_id uuid;
    v_shift_start time;
    v_shift_end time;
    v_break_mins integer;
    v_shift_dur numeric;
    v_worked_mins numeric;
    v_ot_threshold integer := 0;
    v_payroll_settings jsonb;
    v_comp_tz text;
    v_attendance_settings jsonb;
    v_absent_limit numeric := 4.0;
    v_half_day_limit numeric := 7.0;
    v_late_grace_mins integer := 15;
    v_allow_late_login boolean := true;
    v_is_late boolean := false;
    v_is_early boolean := false;
    v_clock_in_time time;
    v_clock_out_time time;
BEGIN
    -- Only calculate if clock_in is present
    IF NEW.clock_in IS NOT NULL THEN
        -- Fetch company timezone, payroll settings, and attendance settings
        SELECT timezone, payroll_settings, attendance_settings 
        INTO v_comp_tz, v_payroll_settings, v_attendance_settings
        FROM public.companies
        WHERE id = NEW.company_id;
        
        v_comp_tz := COALESCE(v_comp_tz, 'UTC');
        
        -- Get shift assigned to the employee
        SELECT shift_id INTO v_shift_id
        FROM public.employee_shifts
        WHERE employee_id = NEW.employee_id
          AND (effective_from IS NULL OR effective_from <= NEW.date)
          AND (effective_to IS NULL OR effective_to >= NEW.date)
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Fallback to first company shift if none assigned
        IF v_shift_id IS NULL THEN
            SELECT id INTO v_shift_id
            FROM public.shifts
            WHERE company_id = NEW.company_id
            LIMIT 1;
        END IF;
        
        IF v_shift_id IS NOT NULL THEN
            SELECT start_time, end_time, break_minutes
            INTO v_shift_start, v_shift_end, v_break_mins
            FROM public.shifts
            WHERE id = v_shift_id;
        END IF;
        
        -- Default fallbacks for shift hours
        v_shift_start := COALESCE(v_shift_start, '09:00:00'::time);
        v_shift_end := COALESCE(v_shift_end, '18:00:00'::time);

        -- Parse attendance settings
        IF v_attendance_settings IS NOT NULL THEN
            v_absent_limit := COALESCE((v_attendance_settings->'brackets'->>'absent_limit_hours')::numeric, 4.0);
            v_half_day_limit := COALESCE((v_attendance_settings->'brackets'->>'half_day_limit_hours')::numeric, 7.0);
            v_late_grace_mins := COALESCE((v_attendance_settings->>'late_grace_period_mins')::integer, 15);
            v_allow_late_login := COALESCE((v_attendance_settings->>'allow_late_login')::boolean, true);
        END IF;

        -- Check if clocked in late
        v_clock_in_time := (NEW.clock_in AT TIME ZONE v_comp_tz)::time;
        IF v_clock_in_time > (v_shift_start + (v_late_grace_mins || ' minutes')::interval) THEN
            v_is_late := true;
        END IF;

        -- If performing clock-in (clock_out is NULL), enforce late login block if disallowed
        IF NEW.clock_out IS NULL THEN
            IF v_is_late AND NOT v_allow_late_login THEN
                RAISE EXCEPTION 'Late login is not allowed. Your shift starts at % and the allowed late buffer is % minutes.', 
                    to_char(v_shift_start, 'HH24:MI'), v_late_grace_mins;
            END IF;
            
            -- Set initial status on clock-in
            IF v_is_late THEN
                NEW.status := 'late'::public.attendance_status;
            ELSE
                NEW.status := 'present'::public.attendance_status;
            END IF;
        ELSE
            -- They are clocking out (or updating a completed shift)
            -- Calculate actual hours worked
            IF v_shift_end >= v_shift_start THEN
                v_shift_dur := EXTRACT(EPOCH FROM (v_shift_end - v_shift_start)) / 3600.0;
            ELSE
                v_shift_dur := (EXTRACT(EPOCH FROM (v_shift_end - v_shift_start)) + 86400) / 3600.0;
            END IF;
            
            -- Exclude break from shift duration
            v_shift_dur := GREATEST(0.0, v_shift_dur - (COALESCE(v_break_mins, 60)::numeric / 60.0));
            
            -- Determine break minutes for actual attendance
            IF NEW.break_minutes IS NULL OR NEW.break_minutes = 0 THEN
                NEW.break_minutes := COALESCE(v_break_mins, 60);
            END IF;
            
            -- Calculate actual minutes worked
            v_worked_mins := (EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60.0) - COALESCE(NEW.break_minutes, 0);
            v_worked_mins := GREATEST(0.0, v_worked_mins);
            
            -- Set total_hours
            NEW.total_hours := ROUND((v_worked_mins / 60.0)::numeric, 2);
            
            -- Fetch overtime threshold
            IF v_payroll_settings IS NOT NULL AND v_payroll_settings->>'overtime_threshold_mins' IS NOT NULL THEN
                v_ot_threshold := (v_payroll_settings->>'overtime_threshold_mins')::integer;
            END IF;
            
            -- Calculate overtime hours
            IF v_worked_mins > ((v_shift_dur * 60.0) + v_ot_threshold) THEN
                NEW.overtime_hours := ROUND(((v_worked_mins - (v_shift_dur * 60.0)) / 60.0)::numeric, 2);
            ELSE
                NEW.overtime_hours := 0.00;
            END IF;

            -- Check if clocked out early
            v_clock_out_time := (NEW.clock_out AT TIME ZONE v_comp_tz)::time;
            IF v_clock_out_time < v_shift_end THEN
                v_is_early := true;
            END IF;

            -- Apply working hours brackets to set final status
            IF NEW.total_hours < v_absent_limit THEN
                NEW.status := 'absent'::public.attendance_status;
            ELSIF NEW.total_hours < v_half_day_limit THEN
                NEW.status := 'half_day'::public.attendance_status;
            ELSE
                -- Full day present, verify if late or early leave occurred
                IF v_is_late THEN
                    NEW.status := 'late'::public.attendance_status;
                ELSIF v_is_early THEN
                    NEW.status := 'early_leave'::public.attendance_status;
                ELSE
                    NEW.status := 'present'::public.attendance_status;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;
