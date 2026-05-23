-- PostgreSQL Migration: Harden Leave Safeguards Server-Side
-- Enforces leave balance availability, overlaps, and mandatory supporting documents inside database transactions

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

    -- 1. Ensure a leave balance record exists first (safety net)
    PERFORM public.initialize_employee_leave_balances(NEW.employee_id);

    -- Fetch leave type settings
    SELECT name, requires_document INTO v_leave_name, v_requires_doc
    FROM public.leave_types
    WHERE id = NEW.leave_type_id;

    -- 2. Document attachment validation (duration >= 3 and requires_document = true)
    IF v_requires_doc AND NEW.total_days >= 3.0 THEN
        IF NEW.document_url IS NULL OR trim(NEW.document_url) = '' THEN
            RAISE EXCEPTION 'A supporting document is required for % requests of 3 or more days.', v_leave_name;
        END IF;
    END IF;

    -- 3. Overlap check (only for active requests: pending or approved)
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

    -- 4. Balance check (available remaining balance check)
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

-- Attach trigger BEFORE INSERT OR UPDATE ON public.leave_requests
DROP TRIGGER IF EXISTS trigger_verify_leave_request_safeguards ON public.leave_requests;
CREATE TRIGGER trigger_verify_leave_request_safeguards
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.verify_leave_request_safeguards();
