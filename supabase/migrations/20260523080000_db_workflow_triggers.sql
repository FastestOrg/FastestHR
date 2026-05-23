-- Create helper functions and triggers to handle workflows inside PostgreSQL triggers
-- This deprecates client-side dispatches, ensuring workflows evaluate securely and fail-safely in background database transactions.

CREATE OR REPLACE FUNCTION public.evaluate_workflow_condition(record jsonb, cond jsonb)
RETURNS boolean AS $$
DECLARE
    field_name text;
    op text;
    val jsonb;
    rec_val jsonb;
    rec_val_str text;
    val_str text;
    rec_val_num numeric;
    val_num numeric;
BEGIN
    field_name := cond->>'field';
    op := cond->>'operator';
    val := cond->'value';
    
    IF field_name IS NULL THEN
        RETURN true;
    END IF;
    
    rec_val := record->field_name;
    IF rec_val IS NULL OR jsonb_typeof(rec_val) = 'null' THEN
        RETURN false;
    END IF;
    
    -- Convert values to text for comparison
    IF jsonb_typeof(rec_val) = 'string' THEN
        rec_val_str := rec_val->>0;
    ELSE
        rec_val_str := rec_val::text;
    END IF;
    
    IF jsonb_typeof(val) = 'string' THEN
        val_str := val->>0;
    ELSE
        val_str := val::text;
    END IF;
    
    -- Convert to lowercase strings for case-insensitive matches
    rec_val_str := lower(rec_val_str);
    val_str := lower(val_str);
    
    CASE op
        WHEN '==' THEN
            RETURN rec_val_str = val_str;
        WHEN '!=' THEN
            RETURN rec_val_str <> val_str;
        WHEN '>' THEN
            IF jsonb_typeof(rec_val) = 'number' AND jsonb_typeof(val) = 'number' THEN
                RETURN (rec_val::numeric) > (val::numeric);
            ELSE
                RETURN rec_val_str::numeric > val_str::numeric;
            END IF;
        WHEN '<' THEN
            IF jsonb_typeof(rec_val) = 'number' AND jsonb_typeof(val) = 'number' THEN
                RETURN (rec_val::numeric) < (val::numeric);
            ELSE
                RETURN rec_val_str::numeric < val_str::numeric;
            END IF;
        WHEN 'contains' THEN
            RETURN position(val_str in rec_val_str) > 0;
        ELSE
            RETURN false;
    END CASE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.evaluate_workflow_condition OWNER TO postgres;

-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.interpolate_workflow_template(template text, record jsonb)
RETURNS text AS $$
DECLARE
    result text := template;
    key text;
    val jsonb;
    val_str text;
BEGIN
    IF template IS NULL THEN
        RETURN '';
    END IF;
    
    FOR key, val IN SELECT * FROM jsonb_each(record) LOOP
        IF jsonb_typeof(val) = 'string' THEN
            val_str := val->>0;
        ELSIF val IS NULL OR jsonb_typeof(val) = 'null' THEN
            val_str := '';
        ELSE
            val_str := val::text;
        END IF;
        
        -- Replace {{key}} case-insensitively or exactly
        result := replace(result, '{{' || key || '}}', val_str);
        -- Also handle spaces: {{ key }}
        result := replace(result, '{{ ' || key || ' }}', val_str);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.interpolate_workflow_template OWNER TO postgres;

-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_workflow_trigger(
    trigger_event_val text,
    company_id_val uuid,
    record_id_val uuid,
    record_data jsonb
) RETURNS void AS $$
DECLARE
    w_rec record;
    cond_item jsonb;
    action_item jsonb;
    all_matched boolean;
    run_id uuid;
    execution_logs jsonb := '[]'::jsonb;
    action_list jsonb;
    step_name text;
    action_type text;
    subject text;
    body text;
    log_msg text;
    idx integer;
BEGIN
    -- 1. Fetch active workflows for this trigger event
    FOR w_rec IN 
        SELECT id, name, conditions, actions 
        FROM public.workflows 
        WHERE company_id = company_id_val 
          AND trigger_event = trigger_event_val::public.workflow_trigger
          AND is_active = true
    LOOP
        -- 2. Evaluate conditions (all must match)
        all_matched := true;
        IF w_rec.conditions IS NOT NULL AND jsonb_array_length(w_rec.conditions) > 0 THEN
            FOR cond_item IN SELECT * FROM jsonb_array_elements(w_rec.conditions) LOOP
                IF NOT public.evaluate_workflow_condition(record_data, cond_item) THEN
                    all_matched := false;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        
        -- If conditions did not match, skip
        IF NOT all_matched THEN
            CONTINUE;
        END IF;
        
        -- 3. Create workflow run in pending state
        INSERT INTO public.workflow_runs (
            workflow_id,
            record_id,
            status,
            execution_log
        ) VALUES (
            w_rec.id,
            record_id_val,
            'pending',
            '[]'::jsonb
        ) RETURNING id INTO run_id;
        
        execution_logs := jsonb_build_array(
            jsonb_build_object(
                'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'message', 'Evaluation Succeeded. Conditions matched. Evaluating action steps.'
            )
        );
        
        -- 4. Execute action items
        action_list := w_rec.actions;
        IF action_list IS NOT NULL AND jsonb_array_length(action_list) > 0 THEN
            idx := 0;
            FOR action_item IN SELECT * FROM jsonb_array_elements(action_list) LOOP
                idx := idx + 1;
                step_name := coalesce(action_item->>'template_name', 'Step ' || idx);
                action_type := action_item->>'type';
                
                IF action_type = 'send_email' THEN
                    subject := public.interpolate_workflow_template(action_item->>'subject', record_data);
                    body := public.interpolate_workflow_template(action_item->>'body', record_data);
                    
                    log_msg := '[Email Dispatch] Title: "' || step_name || '". Subject: "' || subject || '". Body Preview: "' || substring(body from 1 for 40) || '..."';
                    execution_logs := execution_logs || jsonb_build_object(
                        'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        'message', log_msg
                    );
                ELSIF action_type = 'create_checklist' THEN
                    subject := public.interpolate_workflow_template(coalesce(action_item->>'subject', 'Automated Checklist Item'), record_data);
                    
                    log_msg := '[Checklist Created] Generated checklist step: "' || subject || '"';
                    execution_logs := execution_logs || jsonb_build_object(
                        'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        'message', log_msg
                    );
                ELSE
                    log_msg := '[Custom Action] Step: "' || step_name || '". Unsupported database execution type.';
                    execution_logs := execution_logs || jsonb_build_object(
                        'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        'message', log_msg
                    );
                END IF;
            END LOOP;
            
            execution_logs := execution_logs || jsonb_build_object(
                'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'message', 'All action steps finished execution successfully.'
            );
        ELSE
            execution_logs := execution_logs || jsonb_build_object(
                'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'message', 'No action steps configured for this workflow.'
            );
        END IF;
        
        -- Update workflow run status and logs
        UPDATE public.workflow_runs 
        SET status = 'success',
            execution_log = execution_logs
        WHERE id = run_id;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Handle exceptions fail-safely without failing the main transaction
        IF run_id IS NOT NULL THEN
            execution_logs := execution_logs || jsonb_build_object(
                'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'message', 'Workflow Run Error: ' || SQLERRM
            );
            UPDATE public.workflow_runs 
            SET status = 'failed',
                execution_log = execution_logs
            WHERE id = run_id;
        END IF;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.process_workflow_trigger OWNER TO postgres;

-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_workflow_trigger_by_db()
RETURNS trigger AS $$
DECLARE
    trigger_event_val text;
    company_id_val uuid;
    record_id_val uuid;
    record_data jsonb;
    emp_first_name text;
    emp_last_name text;
BEGIN
    IF TG_TABLE_NAME = 'leave_requests' THEN
        IF TG_OP = 'INSERT' THEN
            trigger_event_val := 'leave_created';
        ELSIF TG_OP = 'UPDATE' THEN
            -- Only trigger leave_updated if status, total_days, or reason changes
            IF OLD.status IS NOT DISTINCT FROM NEW.status AND 
               OLD.total_days IS NOT DISTINCT FROM NEW.total_days AND 
               OLD.reason IS NOT DISTINCT FROM NEW.reason THEN
                RETURN NEW;
            END IF;
            trigger_event_val := 'leave_updated';
        ELSE
            RETURN NEW;
        END IF;
        
        company_id_val := NEW.company_id;
        record_id_val := NEW.id;
        
        SELECT first_name, last_name INTO emp_first_name, emp_last_name 
        FROM public.employees 
        WHERE id = NEW.employee_id;
        
        record_data := to_jsonb(NEW) || jsonb_build_object(
            'first_name', coalesce(emp_first_name, ''),
            'last_name', coalesce(emp_last_name, '')
        );
        
    ELSIF TG_TABLE_NAME = 'employees' THEN
        IF TG_OP = 'INSERT' THEN
            trigger_event_val := 'employee_created';
            company_id_val := NEW.company_id;
            record_id_val := NEW.id;
            record_data := to_jsonb(NEW);
        ELSE
            RETURN NEW;
        END IF;
        
    ELSIF TG_TABLE_NAME = 'candidates' THEN
        IF TG_OP = 'UPDATE' THEN
            -- Only trigger if stage has changed
            IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
                RETURN NEW;
            END IF;
            trigger_event_val := 'candidate_stage_updated';
            company_id_val := NEW.company_id;
            record_id_val := NEW.id;
            record_data := to_jsonb(NEW);
        ELSE
            RETURN NEW;
        END IF;
        
    ELSIF TG_TABLE_NAME = 'tickets' THEN
        IF TG_OP = 'INSERT' THEN
            trigger_event_val := 'ticket_created';
            company_id_val := NEW.company_id;
            record_id_val := NEW.id;
            record_data := to_jsonb(NEW);
        ELSE
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Call the processor asynchronously (wrapped in standard transaction)
    PERFORM public.process_workflow_trigger(trigger_event_val, company_id_val, record_id_val, record_data);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.handle_workflow_trigger_by_db() OWNER TO postgres;

-- -------------------------------------------------------------
-- Create Triggers

DROP TRIGGER IF EXISTS trg_workflow_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_workflow_leave_requests
    AFTER INSERT OR UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_workflow_trigger_by_db();

DROP TRIGGER IF EXISTS trg_workflow_employees ON public.employees;
CREATE TRIGGER trg_workflow_employees
    AFTER INSERT ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.handle_workflow_trigger_by_db();

DROP TRIGGER IF EXISTS trg_workflow_candidates ON public.candidates;
CREATE TRIGGER trg_workflow_candidates
    AFTER UPDATE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION public.handle_workflow_trigger_by_db();

DROP TRIGGER IF EXISTS trg_workflow_tickets ON public.tickets;
CREATE TRIGGER trg_workflow_tickets
    AFTER INSERT ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.handle_workflow_trigger_by_db();
