-- ============================================================
-- Global Employee Verification System v2
-- Migration: Upgrade global_employee table with structured attestations,
-- competency rubrics, masked IDs, consent tokens, and dispute handling
-- ============================================================

-- 1. Add new columns to public.global_employee
ALTER TABLE public.global_employee
  ADD COLUMN IF NOT EXISTS masked_aadhaar TEXT,
  ADD COLUMN IF NOT EXISTS masked_pan TEXT,
  ADD COLUMN IF NOT EXISTS masked_passport TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_tenure_records JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS structured_references JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_requests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disputes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competency_scores JSONB DEFAULT '{"technical_execution": 0, "collaboration_teamwork": 0, "problem_solving": 0, "integrity_reliability": 0}'::jsonb;

-- 2. Create helper function for ID masking
CREATE OR REPLACE FUNCTION public.mask_national_id(p_val TEXT, p_type TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_val IS NULL OR length(trim(p_val)) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- If already masked, return as-is
  IF p_val LIKE '%•%' THEN
    RETURN trim(p_val);
  END IF;

  IF p_type = 'aadhaar' THEN
    IF length(p_val) >= 4 THEN
      RETURN '•••• •••• ' || right(trim(p_val), 4);
    ELSE
      RETURN '•••• •••• ' || p_val;
    END IF;
  ELSIF p_type = 'pan' THEN
    IF length(p_val) >= 4 THEN
      RETURN left(trim(p_val), 2) || '••••' || right(trim(p_val), 2);
    ELSE
      RETURN '••••' || p_val;
    END IF;
  ELSE
    IF length(p_val) >= 4 THEN
      RETURN '••••' || right(trim(p_val), 4);
    ELSE
      RETURN '••••' || p_val;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = 'public';

-- 3. Trigger function to automatically maintain masked IDs
CREATE OR REPLACE FUNCTION public.sync_global_employee_masked_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.aadhaar IS NOT NULL AND length(trim(NEW.aadhaar)) > 0 THEN
    IF NEW.masked_aadhaar IS NULL OR NEW.masked_aadhaar NOT LIKE '%•%' THEN
      NEW.masked_aadhaar := public.mask_national_id(NEW.aadhaar, 'aadhaar');
    END IF;
  END IF;

  IF NEW.pan IS NOT NULL AND length(trim(NEW.pan)) > 0 THEN
    IF NEW.masked_pan IS NULL OR NEW.masked_pan NOT LIKE '%•%' THEN
      NEW.masked_pan := public.mask_national_id(NEW.pan, 'pan');
    END IF;
  END IF;

  IF NEW.passport IS NOT NULL AND length(trim(NEW.passport)) > 0 THEN
    IF NEW.masked_passport IS NULL OR NEW.masked_passport NOT LIKE '%•%' THEN
      NEW.masked_passport := public.mask_national_id(NEW.passport, 'passport');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

DROP TRIGGER IF EXISTS trg_sync_global_employee_masked_ids ON public.global_employee;
CREATE TRIGGER trg_sync_global_employee_masked_ids
  BEFORE INSERT OR UPDATE ON public.global_employee
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_global_employee_masked_ids();

-- 4. RPC: Add Structured Attestation & Competency Review
CREATE OR REPLACE FUNCTION public.add_global_employee_structured_attestation(
  p_employee_id UUID,
  p_reviewer_name TEXT,
  p_reviewer_email TEXT,
  p_reviewer_role TEXT,
  p_company_name TEXT,
  p_company_domain TEXT,
  p_relationship TEXT,
  p_employment_start TEXT,
  p_employment_end TEXT,
  p_official_designation TEXT,
  p_rehire_eligibility TEXT,
  p_technical_score NUMERIC,
  p_teamwork_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC,
  p_strengths TEXT,
  p_growth_areas TEXT,
  p_added_by_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ref JSONB;
  v_all_refs JSONB;
  v_avg_tech NUMERIC;
  v_avg_team NUMERIC;
  v_avg_prob NUMERIC;
  v_avg_integ NUMERIC;
  v_overall_rating NUMERIC;
  v_comp_scores JSONB;
BEGIN
  -- Build the structured reference object
  v_ref := jsonb_build_object(
    'id', gen_random_uuid()::TEXT,
    'reviewer_name', p_reviewer_name,
    'reviewer_email', p_reviewer_email,
    'reviewer_role', p_reviewer_role,
    'company_name', p_company_name,
    'company_domain', p_company_domain,
    'relationship', p_relationship,
    'employment_start', p_employment_start,
    'employment_end', p_employment_end,
    'official_designation', p_official_designation,
    'rehire_eligibility', p_rehire_eligibility,
    'competencies', jsonb_build_object(
      'technical_execution', p_technical_score,
      'collaboration_teamwork', p_teamwork_score,
      'problem_solving', p_problem_solving_score,
      'integrity_reliability', p_integrity_score
    ),
    'strengths', p_strengths,
    'growth_areas', p_growth_areas,
    'date', now()::TEXT,
    'added_by_id', p_added_by_id,
    'verified_domain', CASE WHEN p_reviewer_email ILIKE '%@' || p_company_domain THEN true ELSE false END
  );

  -- Append to structured_references
  UPDATE public.global_employee
  SET structured_references = COALESCE(structured_references, '[]'::jsonb) || jsonb_build_array(v_ref),
      updated_at = now()
  WHERE id = p_employee_id
  RETURNING structured_references INTO v_all_refs;

  -- Calculate average competency scores
  SELECT 
    COALESCE(AVG((r->'competencies'->>'technical_execution')::NUMERIC), 0),
    COALESCE(AVG((r->'competencies'->>'collaboration_teamwork')::NUMERIC), 0),
    COALESCE(AVG((r->'competencies'->>'problem_solving')::NUMERIC), 0),
    COALESCE(AVG((r->'competencies'->>'integrity_reliability')::NUMERIC), 0)
  INTO v_avg_tech, v_avg_team, v_avg_prob, v_avg_integ
  FROM jsonb_array_elements(v_all_refs) AS r;

  v_overall_rating := ROUND((v_avg_tech + v_avg_team + v_avg_prob + v_avg_integ) / 4.0, 2);

  v_comp_scores := jsonb_build_object(
    'technical_execution', ROUND(v_avg_tech, 2),
    'collaboration_teamwork', ROUND(v_avg_team, 2),
    'problem_solving', ROUND(v_avg_prob, 2),
    'integrity_reliability', ROUND(v_avg_integ, 2)
  );

  -- Update rating and competency scores on employee record
  UPDATE public.global_employee
  SET rating = v_overall_rating,
      competency_scores = v_comp_scores
  WHERE id = p_employee_id;

  RETURN jsonb_build_object(
    'success', true, 
    'overall_rating', v_overall_rating, 
    'competency_scores', v_comp_scores
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 5. RPC: Request Candidate Consent (for prospective employers)
CREATE OR REPLACE FUNCTION public.request_global_employee_consent(
  p_employee_id UUID,
  p_requester_company_name TEXT,
  p_requester_email TEXT,
  p_purpose TEXT,
  p_requester_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_request_id TEXT;
  v_request JSONB;
BEGIN
  v_request_id := gen_random_uuid()::TEXT;
  
  v_request := jsonb_build_object(
    'id', v_request_id,
    'requester_company_name', p_requester_company_name,
    'requester_email', p_requester_email,
    'purpose', p_purpose,
    'status', 'pending',
    'created_at', now()::TEXT,
    'expires_at', (now() + interval '30 days')::TEXT,
    'requester_id', p_requester_id
  );

  UPDATE public.global_employee
  SET consent_requests = COALESCE(consent_requests, '[]'::jsonb) || jsonb_build_array(v_request),
      updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 6. RPC: File a Dispute (FCRA/GDPR candidate right)
CREATE OR REPLACE FUNCTION public.file_global_employee_dispute(
  p_employee_id UUID,
  p_complainant_name TEXT,
  p_complainant_email TEXT,
  p_dispute_type TEXT,
  p_claim_details TEXT,
  p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_dispute_id TEXT;
  v_dispute JSONB;
BEGIN
  v_dispute_id := 'DSP-' || upper(substring(gen_random_uuid()::TEXT from 1 for 8));

  v_dispute := jsonb_build_object(
    'id', v_dispute_id,
    'complainant_name', p_complainant_name,
    'complainant_email', p_complainant_email,
    'dispute_type', p_dispute_type,
    'claim_details', p_claim_details,
    'evidence_url', p_evidence_url,
    'status', 'under_investigation',
    'created_at', now()::TEXT,
    'sla_deadline', (now() + interval '30 days')::TEXT
  );

  UPDATE public.global_employee
  SET disputes = COALESCE(disputes, '[]'::jsonb) || jsonb_build_array(v_dispute),
      updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'dispute_id', v_dispute_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 7. Ensure submit_global_employee_self_verification also synchronizes masked values
CREATE OR REPLACE FUNCTION public.submit_global_employee_self_verification(
  p_token TEXT,
  p_aadhaar TEXT DEFAULT NULL,
  p_pan TEXT DEFAULT NULL,
  p_driving_license TEXT DEFAULT NULL,
  p_passport TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL,
  p_work_experience JSONB DEFAULT NULL,
  p_linkedin_url TEXT DEFAULT NULL,
  p_github_url TEXT DEFAULT NULL,
  p_twitter_url TEXT DEFAULT NULL,
  p_facebook_url TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_profile_picture TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_employee RECORD;
BEGIN
  -- Find the employee by verification link
  SELECT * INTO v_employee
  FROM public.global_employee
  WHERE verification_link = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired verification link');
  END IF;
  
  -- Update allowed fields and populate masked versions
  UPDATE public.global_employee SET
    aadhaar = COALESCE(p_aadhaar, aadhaar),
    masked_aadhaar = COALESCE(p_aadhaar, masked_aadhaar, public.mask_national_id(aadhaar, 'aadhaar')),
    pan = COALESCE(p_pan, pan),
    masked_pan = COALESCE(p_pan, masked_pan, public.mask_national_id(pan, 'pan')),
    driving_license = COALESCE(p_driving_license, driving_license),
    passport = COALESCE(p_passport, passport),
    masked_passport = COALESCE(p_passport, masked_passport, public.mask_national_id(passport, 'passport')),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    country = COALESCE(p_country, country),
    pincode = COALESCE(p_pincode, pincode),
    skills = COALESCE(p_skills, skills),
    work_experience = COALESCE(p_work_experience, work_experience),
    linkedin_url = COALESCE(p_linkedin_url, linkedin_url),
    github_url = COALESCE(p_github_url, github_url),
    twitter_url = COALESCE(p_twitter_url, twitter_url),
    facebook_url = COALESCE(p_facebook_url, facebook_url),
    instagram_url = COALESCE(p_instagram_url, instagram_url),
    profile_picture = COALESCE(p_profile_picture, profile_picture),
    updated_at = now()
  WHERE id = v_employee.id;
  
  RETURN jsonb_build_object('success', true, 'employee_id', v_employee.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 8. Backfill existing records in global_employee
UPDATE public.global_employee
SET 
  masked_aadhaar = COALESCE(masked_aadhaar, public.mask_national_id(aadhaar, 'aadhaar')),
  masked_pan = COALESCE(masked_pan, public.mask_national_id(pan, 'pan')),
  masked_passport = COALESCE(masked_passport, public.mask_national_id(passport, 'passport')),
  structured_references = COALESCE(structured_references, '[]'::jsonb),
  consent_requests = COALESCE(consent_requests, '[]'::jsonb),
  disputes = COALESCE(disputes, '[]'::jsonb),
  competency_scores = COALESCE(competency_scores, '{"technical_execution": 0, "collaboration_teamwork": 0, "problem_solving": 0, "integrity_reliability": 0}'::jsonb),
  verified_tenure_records = COALESCE(verified_tenure_records, '[]'::jsonb),
  id_verification_status = COALESCE(id_verification_status, 'unverified')
WHERE id IS NOT NULL;

-- 9. Search with Masked Credentials Support
CREATE OR REPLACE FUNCTION public.search_global_employees(p_query TEXT)
RETURNS SETOF public.global_employee AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.global_employee
  WHERE
    (public = true OR auth.role() = 'authenticated')
    AND (
      name ILIKE '%' || p_query || '%'
      OR email ILIKE '%' || p_query || '%'
      OR phone ILIKE '%' || p_query || '%'
      OR aadhaar ILIKE '%' || p_query || '%'
      OR pan ILIKE '%' || p_query || '%'
      OR driving_license ILIKE '%' || p_query || '%'
      OR passport ILIKE '%' || p_query || '%'
      OR masked_aadhaar ILIKE '%' || p_query || '%'
      OR masked_pan ILIKE '%' || p_query || '%'
      OR masked_passport ILIKE '%' || p_query || '%'
    )
  ORDER BY verified DESC, rating DESC, name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 10. Explicit Grants
GRANT EXECUTE ON FUNCTION public.mask_national_id(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_global_employee_structured_attestation(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_global_employee_consent(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_global_employee_dispute(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_global_employee_self_verification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_global_employees(TEXT) TO anon, authenticated;

