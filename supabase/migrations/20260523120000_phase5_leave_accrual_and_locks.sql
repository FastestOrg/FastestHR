-- PostgreSQL Migration: Phase 5 - Leave Accrual & Rollover locks
-- Implements prorated leave allotments for mid-year onboardings, carry-forward caps, accrual triggers, and retrospective leaves freeze.

-- 1. Redefine initialize_employee_leave_balances to support dynamic pro-rata leave allotments for mid-year hires
CREATE OR REPLACE FUNCTION public.initialize_employee_leave_balances(emp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp_company_id UUID;
    v_joining_date DATE;
    current_year INTEGER;
    lt_record RECORD;
    balance_exists BOOLEAN;
    type_count INTEGER;
    v_months_active NUMERIC;
    v_prorated_quota NUMERIC(5,1);
BEGIN
    -- Get employee's company_id and date of joining
    SELECT company_id, date_of_joining INTO emp_company_id, v_joining_date
    FROM public.employees
    WHERE id = emp_id;

    IF emp_company_id IS NULL THEN
        RAISE EXCEPTION 'Employee not found or company not assigned';
    END IF;

    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    -- Check if company has active leave types. If not, initialize default ones.
    SELECT COUNT(*) INTO type_count
    FROM public.leave_types
    WHERE company_id = emp_company_id AND is_active = true;

    IF type_count = 0 THEN
        INSERT INTO public.leave_types (company_id, name, code, max_days_per_year, color, is_active, carry_forward, max_carry_forward_days)
        VALUES 
            (emp_company_id, 'Casual Leave', 'CL', 12.0, '#4F46E5', true, false, 0.0),
            (emp_company_id, 'Sick Leave', 'SL', 12.0, '#EF4444', true, false, 0.0),
            (emp_company_id, 'Earned Leave', 'EL', 15.0, '#10B981', true, true, 10.0)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Loop through active leave types and insert balances if they don't exist
    FOR lt_record IN 
        SELECT id, max_days_per_year, carry_forward, name
        FROM public.leave_types
        WHERE company_id = emp_company_id AND is_active = true
    LOOP
        SELECT EXISTS (
            SELECT 1 
            FROM public.leave_balances
            WHERE employee_id = emp_id 
              AND leave_type_id = lt_record.id 
              AND year = current_year
        ) INTO balance_exists;

        IF NOT balance_exists THEN
            v_prorated_quota := COALESCE(lt_record.max_days_per_year, 0.0);
            
            -- If employee joined in current_year, calculate pro-rata balance
            IF v_joining_date IS NOT NULL AND EXTRACT(YEAR FROM v_joining_date)::INTEGER = current_year THEN
                v_months_active := 12 - EXTRACT(MONTH FROM v_joining_date)::INTEGER + 1;
                -- Calculate prorated quota and round to the nearest 0.5 days
                v_prorated_quota := ROUND(((COALESCE(lt_record.max_days_per_year, 0.0) * v_months_active) / 12.0) * 2) / 2.0;
            END IF;
            
            INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days, pending_days)
            VALUES (emp_id, lt_record.id, current_year, v_prorated_quota, 0, 0);
        END IF;
    END LOOP;
END;
$$;

-- 2. Create Year-End Carry Forward & Rollover function
CREATE OR REPLACE FUNCTION public.process_year_end_leave_rollover(
    p_company_id uuid,
    p_current_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_emp RECORD;
    r_lt RECORD;
    v_curr_bal RECORD;
    v_carry_days numeric(5,1) := 0.0;
    v_next_total numeric(5,1) := 0.0;
    v_next_year integer;
BEGIN
    v_next_year := p_current_year + 1;
    
    -- Loop through active employees in company
    FOR r_emp IN 
        SELECT id FROM public.employees 
        WHERE company_id = p_company_id AND deleted_at IS NULL
    LOOP
        -- Make sure employee's leaves are initialized for the current year
        PERFORM public.initialize_employee_leave_balances(r_emp.id);
        
        -- Loop through company's active leave types
        FOR r_lt IN 
            SELECT id, name, max_days_per_year, carry_forward, max_carry_forward_days
            FROM public.leave_types
            WHERE company_id = p_company_id AND is_active = true
        LOOP
            -- Fetch current balance
            SELECT total_days, used_days INTO v_curr_bal
            FROM public.leave_balances
            WHERE employee_id = r_emp.id AND leave_type_id = r_lt.id AND year = p_current_year;
            
            v_carry_days := 0.0;
            
            IF v_curr_bal.total_days IS NOT NULL THEN
                -- If carry forward is enabled, compute capped days
                IF r_lt.carry_forward = true THEN
                    v_carry_days := GREATEST(0.0, v_curr_bal.total_days - v_curr_bal.used_days);
                    IF r_lt.max_carry_forward_days IS NOT NULL THEN
                        v_carry_days := LEAST(v_carry_days, r_lt.max_carry_forward_days);
                    END IF;
                END IF;
            END IF;
            
            -- Next year's new quota = max_days_per_year + carry_forward_days
            v_next_total := COALESCE(r_lt.max_days_per_year, 0.0) + v_carry_days;
            
            -- Insert or update next year's balance record
            INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days, pending_days)
            VALUES (r_emp.id, r_lt.id, v_next_year, v_next_total, 0, 0)
            ON CONFLICT (id) DO UPDATE 
            SET total_days = v_next_total,
                updated_at = now();
        END LOOP;
    END LOOP;
END;
$$;

-- 3. Redefine verify_leave_request_safeguards to add strict historic payroll balance locks
CREATE OR REPLACE FUNCTION public.verify_leave_request_safeguards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_year INTEGER;
    v_overlap_exists BOOLEAN;
    v_leave_name text;
    v_requires_doc boolean;
    v_balance_exists boolean;
    v_total_days numeric(5,1);
    v_used_days numeric(5,1);
    v_pending_days numeric(5,1);
    v_remaining numeric(5,1);
    v_adjustment numeric(5,1);
    v_overlap_start date;
    v_overlap_end date;
BEGIN
    current_year := EXTRACT(YEAR FROM NEW.start_date)::INTEGER;

    -- 1. Historic payroll freeze check
    -- Blocks requests that overlap with a finalized or paid payroll cycle
    SELECT EXISTS (
        SELECT 1 
        FROM public.payroll_runs
        WHERE company_id = NEW.company_id
          AND status = 'finalized'
          AND period_start <= NEW.end_date
          AND period_end >= NEW.start_date
    ) INTO v_overlap_exists;
    
    IF v_overlap_exists THEN
        RAISE EXCEPTION 'Action Denied. Leave application overlaps with a finalized/paid payroll cycle. Retrospective adjustments are locked.';
    END IF;

    -- 2. Ensure a leave balance record exists first (safety net)
    PERFORM public.initialize_employee_leave_balances(NEW.employee_id);

    -- Fetch leave type settings
    SELECT name, requires_document INTO v_leave_name, v_requires_doc
    FROM public.leave_types
    WHERE id = NEW.leave_type_id;

    -- 3. Document attachment validation (duration >= 3 and requires_document = true)
    IF v_requires_doc AND NEW.total_days >= 3.0 THEN
        IF NEW.document_url IS NULL OR trim(NEW.document_url) = '' THEN
            RAISE EXCEPTION 'A supporting document is required for % requests of 3 or more days.', v_leave_name;
        END IF;
    END IF;

    -- 4. Overlap check (only for active requests: pending or approved)
    IF NEW.status IN ('pending', 'approved') THEN
        SELECT EXISTS (
            SELECT 1 
            FROM public.leave_requests
            WHERE employee_id = NEW.employee_id
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND status IN ('pending', 'approved')
              AND start_date <= NEW.end_date
              AND end_date >= NEW.start_date
        ) INTO v_overlap_exists;

        IF v_overlap_exists THEN
            SELECT start_date, end_date INTO v_overlap_start, v_overlap_end
            FROM public.leave_requests
            WHERE employee_id = NEW.employee_id
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND status IN ('pending', 'approved')
              AND start_date <= NEW.end_date
              AND end_date >= NEW.start_date
            LIMIT 1;
            
            RAISE EXCEPTION 'You already have an active leave request (% from % to %) that overlaps with your selected dates.', 
                v_leave_name, v_overlap_start, v_overlap_end;
        END IF;
    END IF;

    -- 5. Balance check (available remaining balance check)
    IF NEW.status IN ('pending', 'approved') THEN
        -- Fetch existing balances
        SELECT total_days, used_days, pending_days
        INTO v_total_days, v_used_days, v_pending_days
        FROM public.leave_balances
        WHERE employee_id = NEW.employee_id
          AND leave_type_id = NEW.leave_type_id
          AND year = current_year;

        v_remaining := COALESCE(v_total_days, 0) - COALESCE(v_used_days, 0) - COALESCE(v_pending_days, 0);

        -- Calculate adjustment for updates or inserts
        v_adjustment := 0;
        IF TG_OP = 'INSERT' THEN
            v_adjustment := NEW.total_days;
        ELSIF TG_OP = 'UPDATE' THEN
            -- If changing from inactive (cancelled/rejected) to active
            IF OLD.status NOT IN ('pending', 'approved') THEN
                v_adjustment := NEW.total_days;
            -- If changing within active states
            ELSIF OLD.status IN ('pending', 'approved') THEN
                -- If leave type changes, we have a complete switch of balance buckets
                IF OLD.leave_type_id <> NEW.leave_type_id THEN
                    v_adjustment := NEW.total_days;
                ELSE
                    v_adjustment := NEW.total_days - OLD.total_days;
                END IF;
            END IF;
        END IF;

        IF v_adjustment > v_remaining THEN
            RAISE EXCEPTION 'Insufficient leave balance. You requested % days of %, but only have % days remaining.', 
                NEW.total_days, v_leave_name, v_remaining;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
