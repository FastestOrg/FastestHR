-- Migration: 20261028130000_fix_profiles_rls_and_auth_lookup.sql
-- Description:
-- 1. Ensure authenticated users can always SELECT their own profile directly, preventing
--    circular dependencies or NULL company_id edge cases when loading user profiles.
-- 2. Update profiles SELECT policy to allow viewing either your own profile or profiles within your company.

-- 1. Allow authenticated users to view their own profile directly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2. Ensure get_user_company_id() safely falls back without recursive locks
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'company_id', '')::uuid,
    (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
$$;
