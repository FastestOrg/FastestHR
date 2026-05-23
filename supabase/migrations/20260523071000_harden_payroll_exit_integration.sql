-- PostgreSQL Migration: Phase 4 - Unified Payroll & Final Settlement (F&F) Integration
-- Redefines public.process_payroll_run to check and integrate employee exit settlements.

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
    
    -- Employee specific variables
    v_base_monthly_gross numeric(12,2);
    v_lop_days numeric(5,1) := 0;
    v_paid_days numeric(5,1);
    v_proration_factor numeric(6,4);
    v_monthly_gross numeric(12,2);
    
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
BEGIN
    -- 1. Fetch company work days
    SELECT work_days INTO v_allowed_work_days
    FROM public.companies
    WHERE id = p_company_id;
    
    IF v_allowed_work_days IS NULL THEN
        v_allowed_work_days := ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
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
        
        -- Calculate Loss of Pay (LOP) days
        -- Iterating over each day in the period
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
            
            -- LOP counts only on allowed work days which are not holidays
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
                        -- Check if attendance entries mark employee as explicitly 'absent' on this date
                        SELECT EXISTS (
                            SELECT 1 
                            FROM public.attendance
                            WHERE employee_id = r_emp.employee_id
                              AND date = v_curr_date
                              AND status = 'absent'
                        ) INTO v_is_unpaid;
                        
                        IF v_is_unpaid THEN
                            v_lop_days := v_lop_days + 1;
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
        
        -- Prorated gross salary + settlement gross addons (which are subject to income tax)
        v_monthly_gross := (v_base_monthly_gross * v_proration_factor) + v_settlement_gross_addon;
        
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
            -- Include exit/settlement deductions directly to total_deductions
            v_ded_round numeric(12,2) := ROUND((v_income_tax_monthly + v_statutory_deductions_monthly + v_settlement_ded_addon) * 100) / 100;
            v_net_round numeric(12,2) := ROUND((v_monthly_gross - (v_income_tax_monthly + v_statutory_deductions_monthly + v_settlement_ded_addon)) * 100) / 100;
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
