
-- 1. Fix SECURITY DEFINER view: recreate public_companies with security_invoker=true
DROP VIEW IF EXISTS public.public_companies;
CREATE VIEW public.public_companies
WITH (security_invoker=true) AS
SELECT id, name, slug, logo_url, about_company, industry, size, country, website, linkedin_url, custom_domain
FROM public.companies
WHERE is_active = true AND deleted_at IS NULL;

-- Allow anon and authenticated to read this safe view explicitly
GRANT SELECT ON public.public_companies TO anon, authenticated;

-- Add a permissive SELECT policy on companies just for the safe view's anon path:
-- Anonymous users can read only the limited columns through the view.
-- Since view uses security_invoker, RLS on companies applies to anon. We add a narrow anon policy.
DROP POLICY IF EXISTS "anon_read_active_companies_basic" ON public.companies;
CREATE POLICY "anon_read_active_companies_basic" ON public.companies
  FOR SELECT TO anon
  USING (is_active = true AND deleted_at IS NULL);
-- Note: anon role only has table-level grants on view (not companies table directly), so this only fires through view.
-- Ensure anon has NO direct SELECT grant on companies table:
REVOKE SELECT ON public.companies FROM anon;

-- 2. Departments: replace overly broad anon SELECT with one limited to depts referenced by open jobs
DROP POLICY IF EXISTS "public_departments_read" ON public.departments;
CREATE POLICY "anon_read_departments_with_open_jobs" ON public.departments
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.department_id = departments.id AND j.status = 'open'
  ));

-- 3. Privilege escalation: prevent users from updating their own platform_role / company_id
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Allow super_admins to change anything
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  -- Prevent self-modification of sensitive fields
  IF NEW.id = auth.uid() THEN
    IF NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
      RAISE EXCEPTION 'You cannot modify your own platform_role';
    END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'You cannot modify your own company_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 4. Set search_path on functions missing it
ALTER FUNCTION public.add_seats(uuid, integer, uuid) SET search_path = public;
ALTER FUNCTION public.apply_discount_code(uuid) SET search_path = public;
ALTER FUNCTION public.check_employee_license_limit() SET search_path = public;
ALTER FUNCTION public.extend_subscription(uuid, integer, uuid) SET search_path = public;
ALTER FUNCTION public.handle_ai_interviews_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_candidate_hired() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.increment_offer_sequence(uuid) SET search_path = public;
ALTER FUNCTION public.redeem_gift_card(text, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.validate_discount_code(text, numeric) SET search_path = public;
ALTER FUNCTION public.wallet_credit(uuid, numeric, text, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.wallet_debit(uuid, numeric, text, uuid) SET search_path = public;
