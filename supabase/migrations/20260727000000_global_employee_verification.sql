-- ============================================================
-- Global Employee Verification System
-- Migration: Create global_employee table with RLS, indexes, 
-- and verification link generation
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.global_employee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Personal info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  aadhaar TEXT,
  pan TEXT,
  driving_license TEXT,
  passport TEXT,
  
  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  
  -- Profile
  profile_picture TEXT,
  
  -- Verification
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_link TEXT UNIQUE,
  verification_date TIMESTAMPTZ,
  verified_by TEXT, -- user ID who verified
  
  -- Visibility
  public BOOLEAN NOT NULL DEFAULT true,
  
  -- Employer feedback (JSONB array)
  feedbacks_by_employer JSONB DEFAULT '[]'::jsonb,
  
  -- Skills (text array)
  skills TEXT[] DEFAULT '{}',
  
  -- Work experience (JSONB array of objects)
  work_experience JSONB DEFAULT '[]'::jsonb,
  
  -- Rating (average of employer ratings, 0-5)
  rating NUMERIC(3,2) DEFAULT 0,
  
  -- Social links
  linkedin_url TEXT,
  github_url TEXT,
  twitter_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  
  -- Tracking
  added_by_user_id UUID REFERENCES auth.users(id),
  added_by_company_id UUID REFERENCES public.companies(id)
);

-- 2. Add comment
COMMENT ON TABLE public.global_employee IS 'Global employee/candidate verification repository for employer reputation checks';

-- 3. Ensure pg_trgm extension for fuzzy name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Create indexes for fast uniqueness searches
CREATE INDEX IF NOT EXISTS idx_global_employee_email ON public.global_employee (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_phone ON public.global_employee (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_aadhaar ON public.global_employee (aadhaar) WHERE aadhaar IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_pan ON public.global_employee (pan) WHERE pan IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_driving_license ON public.global_employee (driving_license) WHERE driving_license IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_passport ON public.global_employee (passport) WHERE passport IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_name ON public.global_employee USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_employee_verification_link ON public.global_employee (verification_link) WHERE verification_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_employee_verified ON public.global_employee (verified);
CREATE INDEX IF NOT EXISTS idx_global_employee_public ON public.global_employee (public);

-- 4. Enable RLS
ALTER TABLE public.global_employee ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Anyone (including anon) can read public records
CREATE POLICY "global_employee_public_read" ON public.global_employee
  FOR SELECT
  TO anon, authenticated
  USING (public = true);

-- Authenticated users can read all records (for admin search)
CREATE POLICY "global_employee_auth_read_all" ON public.global_employee
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users with admin/HR roles can insert
CREATE POLICY "global_employee_auth_insert" ON public.global_employee
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_role IN ('super_admin', 'company_admin', 'hr_manager')
    )
  );

-- Authenticated users with admin/HR roles can update
CREATE POLICY "global_employee_auth_update" ON public.global_employee
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_role IN ('super_admin', 'company_admin', 'hr_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_role IN ('super_admin', 'company_admin', 'hr_manager')
    )
  );

-- Anon can update specific fields via verification link (handled via RPC instead for safety)

-- 6. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_global_employee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_global_employee_updated_at
  BEFORE UPDATE ON public.global_employee
  FOR EACH ROW
  EXECUTE FUNCTION public.update_global_employee_updated_at();

-- 7. RPC: Generate a verification link for an employee record
CREATE OR REPLACE FUNCTION public.generate_global_employee_verification_link(p_employee_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := gen_random_uuid()::TEXT;
  
  UPDATE public.global_employee
  SET verification_link = v_token, updated_at = now()
  WHERE id = p_employee_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Submit candidate self-verification via token
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
  
  -- Update allowed fields only
  UPDATE public.global_employee SET
    aadhaar = COALESCE(p_aadhaar, aadhaar),
    pan = COALESCE(p_pan, pan),
    driving_license = COALESCE(p_driving_license, driving_license),
    passport = COALESCE(p_passport, passport),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Add employer feedback to an employee
CREATE OR REPLACE FUNCTION public.add_global_employee_feedback(
  p_employee_id UUID,
  p_employer_name TEXT,
  p_company_name TEXT,
  p_feedback TEXT,
  p_rating NUMERIC,
  p_added_by_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_feedback JSONB;
  v_avg_rating NUMERIC;
  v_all_feedbacks JSONB;
BEGIN
  -- Build the feedback object
  v_feedback := jsonb_build_object(
    'employer_name', p_employer_name,
    'company_name', p_company_name,
    'feedback_by_employer', p_feedback,
    'rating', p_rating,
    'date', now()::TEXT,
    'added_by_id', p_added_by_id
  );
  
  -- Append to existing feedbacks
  UPDATE public.global_employee
  SET feedbacks_by_employer = COALESCE(feedbacks_by_employer, '[]'::jsonb) || jsonb_build_array(v_feedback),
      updated_at = now()
  WHERE id = p_employee_id
  RETURNING feedbacks_by_employer INTO v_all_feedbacks;
  
  -- Recalculate average rating from all feedbacks
  SELECT COALESCE(AVG((f->>'rating')::NUMERIC), 0)
  INTO v_avg_rating
  FROM jsonb_array_elements(v_all_feedbacks) AS f
  WHERE f->>'rating' IS NOT NULL;
  
  -- Update the rating
  UPDATE public.global_employee
  SET rating = ROUND(v_avg_rating, 2)
  WHERE id = p_employee_id;
  
  RETURN jsonb_build_object('success', true, 'new_rating', ROUND(v_avg_rating, 2));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Search global employees by any identifier
CREATE OR REPLACE FUNCTION public.search_global_employees(p_query TEXT)
RETURNS SETOF public.global_employee AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.global_employee
  WHERE
    name ILIKE '%' || p_query || '%'
    OR email ILIKE '%' || p_query || '%'
    OR phone ILIKE '%' || p_query || '%'
    OR aadhaar ILIKE '%' || p_query || '%'
    OR pan ILIKE '%' || p_query || '%'
    OR driving_license ILIKE '%' || p_query || '%'
    OR passport ILIKE '%' || p_query || '%'
  ORDER BY verified DESC, rating DESC, name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
