-- Fix: The previous column-level grant was not sufficient because the anon role
-- also needs access to the columns referenced in the RLS policy
-- (is_active, deleted_at) to evaluate the WHERE clause.
--
-- Grant anon SELECT on ALL columns needed: both the view columns and the RLS policy columns.
-- The RLS policy "anon_read_active_companies_basic" still restricts which rows are visible.

GRANT SELECT (
  id, name, slug, logo_url, about_company, industry, size, country,
  website, linkedin_url, custom_domain, is_active, deleted_at
) ON public.companies TO anon;
