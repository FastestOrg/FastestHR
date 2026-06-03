-- Update check_and_process_absconding function to respect date_of_joining
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

    -- Loop through active employees who have a non-null joining date
    FOR v_emp IN 
        SELECT e.id, e.first_name, e.last_name, e.work_email, e.date_of_joining, c.work_days
        FROM public.employees e
        JOIN public.companies c ON e.company_id = c.id
        WHERE e.company_id = p_company_id 
          AND e.status IN ('active', 'probation', 'on_leave')
          AND e.deleted_at IS NULL
          AND e.date_of_joining IS NOT NULL
    LOOP
        v_consec_days := 0;
        v_check_date := (now()::date) - 1; -- start from yesterday
        v_work_days := COALESCE(v_emp.work_days, ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        
        LOOP
            -- If the check date is before the employee's joining date, stop checking (exit the loop)
            IF v_check_date < v_emp.date_of_joining THEN
                EXIT;
            END IF;

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
