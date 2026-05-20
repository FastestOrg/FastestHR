-- PostgreSQL Migration: Initialize Leave Balances and Track double-entry pending/used balances automatically

-- 1. Create or replace the initialization function
CREATE OR REPLACE FUNCTION public.initialize_employee_leave_balances(emp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp_company_id UUID;
    current_year INTEGER;
    lt_record RECORD;
    balance_exists BOOLEAN;
    type_count INTEGER;
BEGIN
    -- Get employee's company_id
    SELECT company_id INTO emp_company_id
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
        INSERT INTO public.leave_types (company_id, name, code, max_days_per_year, color, is_active, carry_forward, requires_document)
        VALUES 
            (emp_company_id, 'Casual Leave', 'CL', 12.0, '#4F46E5', true, false, false),
            (emp_company_id, 'Sick Leave', 'SL', 12.0, '#EF4444', true, false, true),
            (emp_company_id, 'Earned Leave', 'EL', 15.0, '#10B981', true, true, false);
    END IF;

    -- Loop through active leave types and insert balances if they don't exist
    FOR lt_record IN 
        SELECT id, max_days_per_year
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
            INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days, pending_days)
            VALUES (emp_id, lt_record.id, current_year, lt_record.max_days_per_year, 0, 0);
        END IF;
    END LOOP;
END;
$$;

-- 2. Create trigger function and trigger to initialize leave balances on new employee record creation
CREATE OR REPLACE FUNCTION public.on_employee_created_initialize_leaves()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the initialization function for the newly created employee
    PERFORM public.initialize_employee_leave_balances(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_initialize_leaves_on_new_employee
AFTER INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.on_employee_created_initialize_leaves();

-- 3. Create trigger function and trigger to synchronize used_days and pending_days on leave request changes
CREATE OR REPLACE FUNCTION public.sync_leave_balances_on_request_change()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::INTEGER;

    -- Ensure a leave balance record exists first (safety net)
    PERFORM public.initialize_employee_leave_balances(COALESCE(NEW.employee_id, OLD.employee_id));

    -- Handle INSERT (New pending or approved leave request)
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            UPDATE public.leave_balances
            SET pending_days = pending_days + NEW.total_days
            WHERE employee_id = NEW.employee_id 
              AND leave_type_id = NEW.leave_type_id 
              AND year = current_year;
        ELSIF NEW.status = 'approved' THEN
            UPDATE public.leave_balances
            SET used_days = used_days + NEW.total_days
            WHERE employee_id = NEW.employee_id 
              AND leave_type_id = NEW.leave_type_id 
              AND year = current_year;
        END IF;

    -- Handle UPDATE (Status change)
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
            UPDATE public.leave_balances
            SET pending_days = pending_days - OLD.total_days,
                used_days = used_days + NEW.total_days
            WHERE employee_id = NEW.employee_id 
              AND leave_type_id = NEW.leave_type_id 
              AND year = current_year;
        ELSIF OLD.status = 'pending' AND (NEW.status = 'rejected' OR NEW.status = 'cancelled') THEN
            UPDATE public.leave_balances
            SET pending_days = pending_days - OLD.total_days
            WHERE employee_id = NEW.employee_id 
              AND leave_type_id = NEW.leave_type_id 
              AND year = current_year;
        ELSIF OLD.status = 'approved' AND (NEW.status = 'cancelled' OR NEW.status = 'rejected') THEN
            UPDATE public.leave_balances
            SET used_days = used_days - OLD.total_days
            WHERE employee_id = NEW.employee_id 
              AND leave_type_id = NEW.leave_type_id 
              AND year = current_year;
        END IF;

    -- Handle DELETE
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'pending' THEN
            UPDATE public.leave_balances
            SET pending_days = pending_days - OLD.total_days
            WHERE employee_id = OLD.employee_id 
              AND leave_type_id = OLD.leave_type_id 
              AND year = current_year;
        ELSIF OLD.status = 'approved' THEN
            UPDATE public.leave_balances
            SET used_days = used_days - OLD.total_days
            WHERE employee_id = OLD.employee_id 
              AND leave_type_id = OLD.leave_type_id 
              AND year = current_year;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_sync_leave_balances
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_leave_balances_on_request_change();
