-- Fix: Grant anon SELECT on the specific columns exposed by the public_companies view.
-- 
-- The public_companies view uses security_invoker=true, which means queries through
-- the view run with the caller's permissions (anon for public visitors).
-- Migration 20260505072801 revoked ALL SELECT on companies from anon, which broke
-- the view for anonymous visitors (career pages show "Company Not Found").
--
-- The RLS policy "anon_read_active_companies_basic" already restricts anon to only
-- active, non-deleted companies. We just need the table-level column grants so that
-- policy can actually take effect through the view.

GRANT SELECT (
  id, name, slug, logo_url, about_company, industry, size, country,
  website, linkedin_url, custom_domain
) ON public.companies TO anon;
