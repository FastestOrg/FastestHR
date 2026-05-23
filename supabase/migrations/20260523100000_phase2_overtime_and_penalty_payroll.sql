-- PostgreSQL Migration: Phase 2 - Overtime & Penalty Payroll Engine
-- Adds payroll_settings to companies, creates automatic attendance hours & overtime triggers, and updates the payroll calculation function.

-- 1. Add payroll_settings column to companies if not exists
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS payroll_settings JSONB DEFAULT '{"overtime_multiplier": 1.5, "late_grace_period_mins": 15, "late_penalty_rule": {"frequency_trigger": 3, "deduction_unit": "half_day"}, "overtime_threshold_mins": 0}'::jsonb;

-- 2. Trigger function to compute regular hours and overtime hours automatically on clock-out
CREATE OR REPLACE FUNCTION public.calculate_attendance_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_id uuid;
    v_start_time time;
    v_end_time time;
    v_break_mins integer;
    v_shift_dur numeric;
    v_worked_mins numeric;
    v_ot_threshold integer := 0;
    v_payroll_settings jsonb;
    v_comp_tz text;
    v_in_time time;
    v_late_grace_mins integer := 15;
BEGIN
    -- Only calculate if both clock_in and clock_out are present
    IF NEW.clock_in IS NOT NULL AND NEW.clock_out IS NOT NULL THEN
        -- Fetch company timezone
        SELECT timezone, payroll_settings INTO v_comp_tz, v_payroll_settings
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
            INTO v_start_time, v_end_time, v_break_mins
            FROM public.shifts
            WHERE id = v_shift_id;
            
            IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
                -- Calculate scheduled shift duration in hours
                IF v_end_time >= v_start_time THEN
                    v_shift_dur := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0;
                ELSE
                    v_shift_dur := (EXTRACT(EPOCH FROM (v_end_time - v_start_time)) + 86400) / 3600.0;
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
            END IF;
        ELSE
            -- No shifts exist, calculate simple hours elapsed minus default break
            IF NEW.break_minutes IS NULL OR NEW.break_minutes = 0 THEN
                NEW.break_minutes := 60;
            END IF;
            v_worked_mins := (EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60.0) - NEW.break_minutes;
            NEW.total_hours := ROUND((GREATEST(0.0, v_worked_mins) / 60.0)::numeric, 2);
            NEW.overtime_hours := 0.00;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on attendance to calculate metrics BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_calculate_attendance_metrics ON public.attendance;
CREATE TRIGGER trigger_calculate_attendance_metrics
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_metrics();

-- 3. Redefine process_payroll_run to automatically include dynamic overtime earnings and late deductions
CREATE OR REPLACE FUNCTION public.process_payroll_run(
    p_company_id uuid,
    p_period_start date,
    p_period_end date,
    p_processed_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run_id uuid;
    v_allowed_work_days text[];
    v_working_days_count integer := 0;
    v_total_gross numeric(12,2) := 0;
    v_total_deductions numeric(12,2) := 0;
    v_total_net numeric(12,2) := 0;
    
    -- Record variables
    r_emp record;
    r_att record;
    
    -- Employee specific variables
    v_base_monthly_gross numeric(12,2);
    v_lop_days numeric(5,1) := 0;
    v_paid_days numeric(5,1);
    v_proration_factor numeric(6,4);
    v_monthly_gross numeric(12,2);
    
    -- Overtime and penalty config/variables
    v_payroll_settings jsonb;
    v_ot_multiplier numeric(4,2) := 1.5;
    v_late_grace_mins integer := 15;
    v_penalty_rule jsonb;
    v_late_trigger integer := 3;
    v_deduction_unit text := 'half_day';
    
    v_emp_overtime_hours numeric(6,2) := 0.00;
    v_overtime_payout numeric(12,2) := 0.00;
    v_late_count integer := 0;
    v_attendance_penalty numeric(12,2) := 0.00;
    
    -- Exit integration variables
    v_exit_date date;
    v_settlement_done boolean;
    v_settlement_summary jsonb;
    v_settlement_gross_addon numeric(12,2) := 0;
    v_settlement_ded_addon numeric(12,2) := 0;
    
    -- Tax calculation variables
    v_jurisdiction text;
    v_declaration jsonb;
    v_taxable_income numeric(12,2);
    v_income_tax_monthly numeric(12,2);
    v_statutory_deductions_monthly numeric(12,2);
    v_tax_details jsonb;
    
    -- Temporary / loop variables
    v_curr_date date;
    v_date_str text;
    v_weekday text;
    v_is_unpaid boolean;
    v_is_holiday boolean;
    v_company_tz text;
    v_shift_start time;
    v_clock_in_time time;
    v_shift_id uuid;
    v_penalty_cycles integer := 0;
BEGIN
    -- 1. Fetch company work days, timezone, and payroll settings
    SELECT work_days, timezone, payroll_settings INTO v_allowed_work_days, v_company_tz, v_payroll_settings
    FROM public.companies
    WHERE id = p_company_id;
    
    IF v_allowed_work_days IS NULL THEN
        v_allowed_work_days := ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    END IF;
    v_company_tz := COALESCE(v_company_tz, 'UTC');
    
    -- Parse payroll settings
    IF v_payroll_settings IS NOT NULL THEN
        v_ot_multiplier := COALESCE((v_payroll_settings->>'overtime_multiplier')::numeric, 1.5);
        v_late_grace_mins := COALESCE((v_payroll_settings->>'late_grace_period_mins')::integer, 15);
        v_penalty_rule := v_payroll_settings->'late_penalty_rule';
        IF v_penalty_rule IS NOT NULL THEN
            v_late_trigger := COALESCE((v_penalty_rule->>'frequency_trigger')::integer, 3);
            v_deduction_unit := COALESCE(v_penalty_rule->>'deduction_unit', 'half_day');
        END IF;
    END IF;
    
    -- 2. Count period working days (work day & not in holiday table)
    FOR v_curr_date IN 
        SELECT g.date::date 
        FROM generate_series(p_period_start::timestamp, p_period_end::timestamp, '1 day'::interval) g(date)
    LOOP
        v_weekday := to_char(v_curr_date, 'Dy');
        
        -- Check if it's a holiday
        SELECT EXISTS (
            SELECT 1 FROM public.holidays 
            WHERE company_id = p_company_id AND date = v_curr_date
        ) INTO v_is_holiday;
        
        IF v_weekday = ANY(v_allowed_work_days) AND NOT v_is_holiday THEN
            v_working_days_count := v_working_days_count + 1;
        END IF;
    END LOOP;
    
    IF v_working_days_count = 0 THEN
        v_working_days_count := 22; -- fallback
    END IF;
 
    -- 3. Create the payroll run in processing state
    INSERT INTO public.payroll_runs (
        company_id,
        period_start,
        period_end,
        status,
        processed_by,
        total_gross,
        total_deductions,
        total_net
    ) VALUES (
        p_company_id,
        p_period_start,
        p_period_end,
        'processing',
        p_processed_by,
        0,
        0,
        0
    ) RETURNING id INTO v_run_id;
 
    -- 4. Process each employee with a salary structure
    FOR r_emp IN 
        SELECT ss.gross_salary, ss.components, 
               e.id AS employee_id, e.tax_jurisdiction, e.tax_declaration,
               e.date_of_joining
         FROM public.salary_structures ss
         JOIN public.employees e ON ss.employee_id = e.id
         WHERE ss.company_id = p_company_id AND e.deleted_at IS NULL
    LOOP
        v_base_monthly_gross := (COALESCE(r_emp.gross_salary, 0) / 12.0);
        v_lop_days := 0;
        v_exit_date := NULL;
        v_settlement_done := false;
        v_settlement_summary := NULL;
        v_emp_overtime_hours := 0.00;
        v_overtime_payout := 0.00;
        v_late_count := 0;
        v_attendance_penalty := 0.00;
        
        -- Fetch exit details for the employee
        SELECT last_working_day, settlement_done, settlement_summary
        INTO v_exit_date, v_settlement_done, v_settlement_summary
        FROM public.employee_exits
        WHERE employee_id = r_emp.employee_id
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- RULE 1: Skip standard payroll execution for an employee if a finalized exit settlement exists in the period.
        IF v_exit_date IS NOT NULL AND v_exit_date >= p_period_start AND v_exit_date <= p_period_end AND v_settlement_done = true THEN
            CONTINUE;
        END IF;
        
        -- Calculate LOP days, overtime hours, and late clock-in counts
        FOR v_curr_date IN 
            SELECT g.date::date 
            FROM generate_series(p_period_start::timestamp, p_period_end::timestamp, '1 day'::interval) g(date)
        LOOP
            v_weekday := to_char(v_curr_date, 'Dy');
            
            -- Check if it is a company holiday
            SELECT EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE company_id = p_company_id AND date = v_curr_date
            ) INTO v_is_holiday;
            
            IF v_weekday = ANY(v_allowed_work_days) AND NOT v_is_holiday THEN
                -- If day falls before joining date or after exit date, it must be considered loss of pay (prorated out)
                IF (r_emp.date_of_joining IS NOT NULL AND v_curr_date < r_emp.date_of_joining) OR 
                   (v_exit_date IS NOT NULL AND v_curr_date > v_exit_date) THEN
                    v_lop_days := v_lop_days + 1;
                ELSE
                    v_date_str := to_char(v_curr_date, 'YYYY-MM-DD');
                    
                    -- Check if employee has an approved unpaid leave on this day
                    SELECT EXISTS (
                        SELECT 1 
                        FROM public.leave_requests lr
                        JOIN public.leave_types lt ON lr.leave_type_id = lt.id
                        WHERE lr.employee_id = r_emp.employee_id
                          AND lr.status = 'approved'
                          AND lr.start_date <= v_curr_date
                          AND lr.end_date >= v_curr_date
                          AND (
                              lt.code = 'LWP' 
                              OR lower(lt.name) LIKE '%unpaid%'
                              OR lower(lt.name) LIKE '%loss of pay%'
                              OR lower(lt.name) LIKE '%without pay%'
                          )
                    ) INTO v_is_unpaid;
                    
                    IF v_is_unpaid THEN
                        v_lop_days := v_lop_days + 1;
                    ELSE
                        -- Check if attendance entries mark employee as explicitly 'absent' or track clock times
                        SELECT * INTO r_att 
                        FROM public.attendance
                        WHERE employee_id = r_emp.employee_id
                          AND date = v_curr_date
                        LIMIT 1;
                        
                        IF r_att.id IS NOT NULL THEN
                            IF r_att.status = 'absent' THEN
                                v_lop_days := v_lop_days + 1;
                            ELSIF r_att.status = 'present' THEN
                                -- Accumulate overtime hours
                                v_emp_overtime_hours := v_emp_overtime_hours + COALESCE(r_att.overtime_hours, 0.00);
                                
                                -- Verify late clock-in
                                IF r_att.clock_in IS NOT NULL THEN
                                    -- Get shift assigned to the employee
                                    SELECT shift_id INTO v_shift_id
                                    FROM public.employee_shifts
                                    WHERE employee_id = r_emp.employee_id
                                      AND (effective_from IS NULL OR effective_from <= v_curr_date)
                                      AND (effective_to IS NULL OR effective_to >= v_curr_date)
                                    ORDER BY created_at DESC
                                    LIMIT 1;
                                    
                                    IF v_shift_id IS NULL THEN
                                        SELECT id INTO v_shift_id
                                        FROM public.shifts
                                        WHERE company_id = p_company_id
                                        LIMIT 1;
                                    END IF;
                                    
                                    IF v_shift_id IS NOT NULL THEN
                                        SELECT start_time INTO v_shift_start
                                        FROM public.shifts
                                        WHERE id = v_shift_id;
                                        
                                        IF v_shift_start IS NOT NULL THEN
                                            v_clock_in_time := (r_att.clock_in AT TIME ZONE v_company_tz)::time;
                                            IF v_clock_in_time > (v_shift_start + (v_late_grace_mins || ' minutes')::interval) THEN
                                                v_late_count := v_late_count + 1;
                                            END IF;
                                        END IF;
                                    END IF;
                                END IF;
                            END IF;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END LOOP;
 
        v_paid_days := GREATEST(0.0, v_working_days_count::numeric - v_lop_days);
        v_proration_factor := v_paid_days / v_working_days_count::numeric;
        
        -- RULE 2: If a draft settlement exists, pull notice recoveries, leave encashments, and bonuses/claims
        v_settlement_gross_addon := 0;
        v_settlement_ded_addon := 0;
        IF v_exit_date IS NOT NULL AND v_settlement_summary IS NOT NULL THEN
            v_settlement_gross_addon := COALESCE((v_settlement_summary->>'leave_encashment')::numeric, 0.0) +
                                         COALESCE((v_settlement_summary->>'custom_bonus')::numeric, 0.0);
            v_settlement_ded_addon := COALESCE((v_settlement_summary->>'notice_recovery')::numeric, 0.0) +
                                       COALESCE((v_settlement_summary->>'custom_deduction')::numeric, 0.0);
        END IF;
        
        -- Calculate Overtime payout: hourly rate = gross monthly salary / (working_days * 8.0)
        IF v_emp_overtime_hours > 0 THEN
            v_overtime_payout := ROUND((v_emp_overtime_hours * (v_base_monthly_gross / (v_working_days_count::numeric * 8.0)) * v_ot_multiplier), 2);
        END IF;
        
        -- Calculate Late-in deduction
        IF v_late_count >= v_late_trigger AND v_late_trigger > 0 THEN
            v_penalty_cycles := FLOOR(v_late_count / v_late_trigger);
            IF v_deduction_unit = 'half_day' THEN
                v_attendance_penalty := ROUND((v_penalty_cycles * 0.5 * (v_base_monthly_gross / v_working_days_count::numeric)), 2);
            ELSIF v_deduction_unit = 'full_day' THEN
                v_attendance_penalty := ROUND((v_penalty_cycles * 1.0 * (v_base_monthly_gross / v_working_days_count::numeric)), 2);
            END IF;
        END IF;
        
        -- Prorated gross salary + settlement gross addons + overtime pay (subject to tax)
        v_monthly_gross := (v_base_monthly_gross * v_proration_factor) + v_settlement_gross_addon + v_overtime_payout;
        
        v_jurisdiction := COALESCE(r_emp.tax_jurisdiction, 'USA');
        v_declaration := COALESCE(r_emp.tax_declaration, '{}'::jsonb);
        
        -- 5. Progressive Tax Calculation logic in PL/pgSQL
        IF v_jurisdiction = 'IND' THEN
            -- India calculations
            DECLARE
                v_standard_deduction numeric(12,2) := 75000.00;
                v_basic_salary_monthly numeric(12,2);
                v_epf_monthly numeric(12,2);
                v_gross_annual numeric(12,2);
                v_regime text;
                v_section_80c numeric(12,2) := 0;
                v_section_80d numeric(12,2) := 0;
                v_hra_exemption numeric(12,2) := 0;
                
                v_tax_annual numeric(12,2) := 0;
                v_cess numeric(12,2) := 0;
            BEGIN
                v_gross_annual := v_monthly_gross * 12.0;
                v_basic_salary_monthly := v_monthly_gross * 0.50;
                v_epf_monthly := v_basic_salary_monthly * 0.12;
                
                v_regime := COALESCE(v_declaration->>'regime', 'new');
                v_taxable_income := GREATEST(0.00, v_gross_annual - v_standard_deduction);
                
                IF v_regime = 'old' THEN
                    v_section_80c := LEAST(150000.00, COALESCE((v_declaration->>'section_80c')::numeric, 0.00) + (v_epf_monthly * 12.0));
                    v_section_80d := LEAST(25000.00, COALESCE((v_declaration->>'section_80d')::numeric, 0.00));
                    v_hra_exemption := COALESCE((v_declaration->>'hra_exemption')::numeric, 0.00);
                    
                    v_taxable_income := GREATEST(0.00, v_taxable_income - v_section_80c - v_section_80d - v_hra_exemption);
                    
                    -- Old Regime brackets
                    IF v_taxable_income <= 250000 THEN
                        v_tax_annual := 0;
                    ELSIF v_taxable_income <= 500000 THEN
                        v_tax_annual := (v_taxable_income - 250000) * 0.05;
                    ELSIF v_taxable_income <= 1000000 THEN
                        v_tax_annual := 12500 + (v_taxable_income - 500000) * 0.20;
                    ELSE
                        v_tax_annual := 12500 + 100000 + (v_taxable_income - 1000000) * 0.30;
                    END IF;
                ELSE
                    -- New Regime brackets
                    IF v_taxable_income <= 300000 THEN
                        v_tax_annual := 0;
                    ELSIF v_taxable_income <= 600000 THEN
                        v_tax_annual := (v_taxable_income - 300000) * 0.05;
                    ELSIF v_taxable_income <= 900000 THEN
                        v_tax_annual := 15000 + (v_taxable_income - 600000) * 0.10;
                    ELSIF v_taxable_income <= 1200000 THEN
                        v_tax_annual := 15000 + 30000 + (v_taxable_income - 900000) * 0.15;
                    ELSIF v_taxable_income <= 1500000 THEN
                        v_tax_annual := 15000 + 30000 + 45000 + (v_taxable_income - 1200000) * 0.20;
                    ELSE
                        v_tax_annual := 15000 + 30000 + 45000 + 60000 + (v_taxable_income - 1500000) * 0.30;
                    END IF;
                END IF;
                
                v_cess := v_tax_annual * 0.04;
                v_tax_annual := v_tax_annual + v_cess;
                
                v_income_tax_monthly := ROUND((v_tax_annual / 12.0) * 100) / 100;
                v_statutory_deductions_monthly := ROUND(v_epf_monthly * 100) / 100;
                
                v_tax_details := jsonb_build_object(
                    'regime', v_regime,
                    'standardDeduction', v_standard_deduction,
                    'epfMonthly', v_epf_monthly,
                    'cess', v_cess,
                    'taxableIncome', v_taxable_income,
                    'taxAnnual', v_tax_annual
                );
            END;
        ELSE
            -- Default USA calculations
            DECLARE
                v_standard_deduction numeric(12,2) := 15000.00;
                v_itemized_deductions numeric(12,2);
                v_gross_annual numeric(12,2);
                
                v_tax_annual numeric(12,2) := 0;
                v_ss_monthly numeric(12,2);
                v_medicare_monthly numeric(12,2);
            BEGIN
                v_gross_annual := v_monthly_gross * 12.0;
                v_itemized_deductions := COALESCE((v_declaration->>'pre_tax_deductions')::numeric, 0.00);
                v_taxable_income := GREATEST(0.00, v_gross_annual - v_standard_deduction - v_itemized_deductions);
                
                -- USA Progressive Brackets
                IF v_taxable_income <= 11600 THEN
                    v_tax_annual := v_taxable_income * 0.10;
                ELSIF v_taxable_income <= 47150 THEN
                    v_tax_annual := 1160 + (v_taxable_income - 11600) * 0.12;
                ELSIF v_taxable_income <= 100525 THEN
                    v_tax_annual := 1160 + 4266 + (v_taxable_income - 47150) * 0.22;
                ELSIF v_taxable_income <= 191950 THEN
                    v_tax_annual := 1160 + 4266 + 11742.50 + (v_taxable_income - 100525) * 0.24;
                ELSIF v_taxable_income <= 243725 THEN
                    v_tax_annual := 1160 + 4266 + 11742.50 + 21942 + (v_taxable_income - 191950) * 0.32;
                ELSIF v_taxable_income <= 609350 THEN
                    v_tax_annual := 1160 + 4266 + 11742.50 + 21942 + 16568 + (v_taxable_income - 243725) * 0.35;
                ELSE
                    v_tax_annual := 1160 + 4266 + 11742.50 + 21942 + 16568 + 127968.75 + (v_taxable_income - 609350) * 0.37;
                END IF;
                
                v_income_tax_monthly := ROUND((v_tax_annual / 12.0) * 100) / 100;
                
                v_ss_monthly := ROUND((LEAST(v_monthly_gross, 14050.00) * 0.062) * 100) / 100;
                v_medicare_monthly := ROUND((v_monthly_gross * 0.0145) * 100) / 100;
                
                v_statutory_deductions_monthly := v_ss_monthly + v_medicare_monthly;
                
                v_tax_details := jsonb_build_object(
                    'standardDeduction', v_standard_deduction,
                    'taxableIncome', v_taxable_income,
                    'federalTaxAnnual', v_tax_annual,
                    'socialSecurityMonthly', v_ss_monthly,
                    'medicareMonthly', v_medicare_monthly,
                    'statutoryMonthly', v_statutory_deductions_monthly
                );
            END;
        END IF;
        
        -- Round calculations
        v_income_tax_monthly := ROUND(v_income_tax_monthly * 100) / 100;
        v_statutory_deductions_monthly := ROUND(v_statutory_deductions_monthly * 100) / 100;
        
        DECLARE
            v_gross_round numeric(12,2) := ROUND(v_monthly_gross * 100) / 100;
            -- Include exit/settlement deductions AND attendance penalties
            v_ded_round numeric(12,2) := ROUND((v_income_tax_monthly + v_statutory_deductions_monthly + v_settlement_ded_addon + v_attendance_penalty) * 100) / 100;
            v_net_round numeric(12,2) := ROUND((v_monthly_gross - (v_income_tax_monthly + v_statutory_deductions_monthly + v_settlement_ded_addon + v_attendance_penalty)) * 100) / 100;
            v_breakdown jsonb;
        BEGIN
            v_breakdown := jsonb_build_object(
                'components', COALESCE(r_emp.components, '[]'::jsonb),
                'jurisdiction', v_jurisdiction,
                'taxable_income', v_taxable_income,
                'income_tax_monthly', v_income_tax_monthly,
                'statutory_deductions_monthly', v_statutory_deductions_monthly,
                'details', v_tax_details,
                'working_days', v_working_days_count,
                'paid_days', v_paid_days,
                'lop_days', v_lop_days,
                'base_monthly_gross', ROUND(v_base_monthly_gross * 100) / 100,
                'proration_factor', ROUND(v_proration_factor * 10000) / 10000.0,
                
                -- Overtime outputs
                'overtime_hours', v_emp_overtime_hours,
                'overtime_multiplier', v_ot_multiplier,
                'overtime_payout', v_overtime_payout,
                
                -- Penalty outputs
                'late_count', v_late_count,
                'attendance_penalty', v_attendance_penalty,
                'late_trigger', v_late_trigger,
                'deduction_unit', v_deduction_unit,
                
                -- Exit settlement summary details
                'notice_recovery', COALESCE((v_settlement_summary->>'notice_recovery')::numeric, 0.0),
                'leave_encashment', COALESCE((v_settlement_summary->>'leave_encashment')::numeric, 0.0),
                'custom_bonus', COALESCE((v_settlement_summary->>'custom_bonus')::numeric, 0.0),
                'custom_deduction', COALESCE((v_settlement_summary->>'custom_deduction')::numeric, 0.0)
            );
            
            -- Insert the payslip
            INSERT INTO public.payslips (
                payroll_run_id,
                employee_id,
                company_id,
                gross_salary,
                total_deductions,
                net_salary,
                working_days,
                paid_days,
                lop_days,
                breakdown
            ) VALUES (
                v_run_id,
                r_emp.employee_id,
                p_company_id,
                v_gross_round,
                v_ded_round,
                v_net_round,
                v_working_days_count,
                v_paid_days,
                v_lop_days,
                v_breakdown
            );
            
            -- Accumulate aggregates for the run
            v_total_gross := v_total_gross + v_gross_round;
            v_total_deductions := v_total_deductions + v_ded_round;
            v_total_net := v_total_net + v_net_round;
        END;
    END LOOP;
 
    -- 6. Update the payroll run with finalized totals and status
    UPDATE public.payroll_runs
    SET total_gross = v_total_gross,
        total_deductions = v_total_deductions,
        total_net = v_total_net,
        status = 'finalized',
        finalized_at = now()
    WHERE id = v_run_id;
 
    RETURN v_run_id;
END;
$$;
