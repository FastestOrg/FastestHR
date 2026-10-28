-- Migration: 20261028140000_allow_recruiters_candidate_offers.sql
-- Description:
-- 1. Helper function is_recruiter() to detect recruiter role directly from JWT or profiles.
-- 2. Update public.candidate_offers RLS policies to allow recruiters within the company to
--    view, insert, and update candidate offer records and verify offer status.

-- 1. Helper function: is_recruiter
CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN auth.jwt() -> 'user_metadata' ->> 'platform_role' = 'recruiter' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) 
        AND platform_role = 'recruiter'
    )
  END;
$$;

-- 2. CANDIDATE OFFERS: Allow recruiters to read offers for their company
DROP POLICY IF EXISTS "Enable read for team members" ON public.candidate_offers;
CREATE POLICY "Enable read for team members" ON public.candidate_offers
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.is_admin_or_hr()
      OR public.is_super_admin()
      OR public.is_recruiter()
    )
  );

-- 3. CANDIDATE OFFERS: Allow recruiters to insert offers for their company
DROP POLICY IF EXISTS "Enable insert for team members" ON public.candidate_offers;
CREATE POLICY "Enable insert for team members" ON public.candidate_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      public.is_admin_or_hr()
      OR public.is_super_admin()
      OR public.is_recruiter()
    )
  );

-- 4. CANDIDATE OFFERS: Allow recruiters to update offers for their company
DROP POLICY IF EXISTS "Enable update for team members" ON public.candidate_offers;
CREATE POLICY "Enable update for team members" ON public.candidate_offers
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.is_admin_or_hr()
      OR public.is_super_admin()
      OR public.is_recruiter()
    )
  );
