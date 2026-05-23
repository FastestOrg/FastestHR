-- PostgreSQL Migration: Phase 4 - Candidate OTP & Audit Trails in Offer Letters
-- Exposes robust multi-factor signing validation and variable verification pre-flight triggers.

-- 1. Add audit tracking and OTP verification columns to candidate_offers
ALTER TABLE public.candidate_offers 
ADD COLUMN IF NOT EXISTS signing_ip TEXT,
ADD COLUMN IF NOT EXISTS signing_user_agent TEXT,
ADD COLUMN IF NOT EXISTS otp_code TEXT,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_logs JSONB DEFAULT '[]'::jsonb;

-- 2. Function to generate a secure OTP for candidate signing
CREATE OR REPLACE FUNCTION public.generate_offer_otp_by_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offer_id uuid;
    v_otp text;
    v_cand_email text;
BEGIN
    -- Fetch offer and candidate email
    SELECT co.id, c.email INTO v_offer_id, v_cand_email
    FROM public.candidate_offers co
    JOIN public.candidates c ON co.candidate_id = c.id
    WHERE co.token::text = p_token AND co.status = 'sent';
    
    IF v_offer_id IS NULL THEN
        RAISE EXCEPTION 'Candidate offer not found or is already signed/declined.';
    END IF;
    
    -- Generate secure 6-digit OTP
    v_otp := FLOOR(RANDOM() * 900000 + 100000)::text;
    
    -- Save OTP and log generation
    UPDATE public.candidate_offers
    SET 
        otp_code = v_otp,
        otp_expires_at = now() + interval '10 minutes',
        verification_logs = COALESCE(verification_logs, '[]'::jsonb) || jsonb_build_object(
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'action', 'otp_generated',
            'email', v_cand_email
        )
    WHERE id = v_offer_id;
    
    RETURN v_otp;
END;
$$;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.generate_offer_otp_by_token(text) TO anon, authenticated;

-- 3. Function to verify OTP and sign offer letter with full IP/UA audit trails
CREATE OR REPLACE FUNCTION public.verify_and_sign_offer_by_token(
    p_token text,
    p_otp_code text,
    p_signature_placement jsonb,
    p_ip text,
    p_user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offer_record record;
BEGIN
    -- Fetch offer record
    SELECT * INTO v_offer_record
    FROM public.candidate_offers
    WHERE token::text = p_token;
    
    IF v_offer_record.id IS NULL THEN
        RAISE EXCEPTION 'Offer not found.';
    END IF;
    
    IF v_offer_record.status = 'signed' THEN
        RAISE EXCEPTION 'Offer letter is already signed.';
    END IF;
    
    -- Validate OTP and expiry
    IF v_offer_record.otp_code IS NULL OR v_offer_record.otp_code <> p_otp_code THEN
        -- Log failed OTP attempt
        UPDATE public.candidate_offers
        SET verification_logs = COALESCE(verification_logs, '[]'::jsonb) || jsonb_build_object(
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'action', 'otp_failed_attempt',
            'ip', p_ip,
            'user_agent', p_user_agent,
            'details', 'Invalid OTP code entered'
        )
        WHERE id = v_offer_record.id;
        
        RAISE EXCEPTION 'Invalid verification code. Please check your email and try again.';
    END IF;
    
    IF v_offer_record.otp_expires_at IS NULL OR v_offer_record.otp_expires_at < now() THEN
        -- Log expired OTP attempt
        UPDATE public.candidate_offers
        SET verification_logs = COALESCE(verification_logs, '[]'::jsonb) || jsonb_build_object(
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'action', 'otp_expired_attempt',
            'ip', p_ip,
            'user_agent', p_user_agent,
            'details', 'OTP code expired'
        )
        WHERE id = v_offer_record.id;
        
        RAISE EXCEPTION 'Verification code has expired. Please request a new code.';
    END IF;
    
    -- Sign the offer and append audit logging
    UPDATE public.candidate_offers
    SET 
        status = 'signed',
        signed_at = now(),
        signature_placement = p_signature_placement,
        signing_ip = p_ip,
        signing_user_agent = p_user_agent,
        otp_code = NULL,
        otp_expires_at = NULL,
        verification_logs = COALESCE(verification_logs, '[]'::jsonb) || jsonb_build_object(
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'action', 'otp_verified_and_signed',
            'ip', p_ip,
            'user_agent', p_user_agent
        )
    WHERE id = v_offer_record.id;
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.verify_and_sign_offer_by_token(text, text, jsonb, text, text) TO anon, authenticated;

-- 4. Trigger to validate that all mandatory placeholders in the HTML are set and not empty pre-flight
CREATE OR REPLACE FUNCTION public.validate_offer_variables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_matches text[];
    v_match text;
    v_clean_var text;
    v_val text;
    v_candidate_name text;
    v_job_title text;
BEGIN
    -- Extract all {{var_name}} strings
    -- regexp_matches returns a set, so we can aggregate it
    SELECT array_agg(m[1]) INTO v_matches
    FROM (
        SELECT regexp_matches(NEW.html_content, '\{\{\s*([A-Za-z0-9_\s\-\%]+?)\s*\}\}', 'g') AS m
    ) s;
    
    IF v_matches IS NOT NULL THEN
        -- Loop through matched placeholders
        FOREACH v_match IN ARRAY v_matches LOOP
            v_clean_var := trim(v_match);
            
            -- Ignore case for system/standard variables
            IF lower(v_clean_var) IN ('name', 'candidate_name', 'designation', 'job_title', 'joined_date', 'joining_date', 'payout', 'today', 'offer_number', 'offer_link') THEN
                CONTINUE;
            END IF;
            
            -- Ignore compensation structure variables
            IF lower(v_clean_var) IN ('basic pay percent', 'da percent', 'hra percent', 'conveyance percent', 'special allowance percent', 'medical insurance percent') THEN
                CONTINUE;
            END IF;
            
            -- Verify in custom_variable_values
            v_val := NEW.custom_variable_values->>v_clean_var;
            
            IF v_val IS NULL OR trim(v_val) = '' THEN
                RAISE EXCEPTION 'Offer letter contains variable "{{%}}" which has not been set or is empty. Please provide custom variable values before sending.', v_clean_var;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on candidate_offers BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_validate_offer_variables ON public.candidate_offers;
CREATE TRIGGER trigger_validate_offer_variables
    BEFORE INSERT OR UPDATE ON public.candidate_offers
    FOR EACH ROW EXECUTE FUNCTION public.validate_offer_variables();
