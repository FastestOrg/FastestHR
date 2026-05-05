
-- Revoke broad SELECT and re-grant only safe columns to authenticated users
REVOKE SELECT ON public.companies FROM authenticated;

GRANT SELECT (
  id, name, slug, logo_url, industry, size, country, timezone, currency, work_days,
  about_company, website, linkedin_url, company_culture,
  id_card_template, id_card_primary_color,
  employee_id_prefix, employee_id_next_number,
  plan, plan_expires_at, is_active, setup_completed, deleted_at,
  created_at, updated_at,
  offer_sequence_prefix, offer_sequence_current,
  senddesk_sequence_prefix, senddesk_sequence_current,
  compensation_structure,
  custom_domain, domain_verified, domain_config,
  license_limit, wallet_balance, price_per_license
) ON public.companies TO authenticated;

-- Note: smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name
-- are intentionally NOT granted; only company admins reach them via the admin UPDATE flow
-- (UPDATE doesn't require SELECT) and edge functions via the service role.

-- Allow company admins to still read SMTP fields for the Settings UI:
GRANT SELECT (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name)
  ON public.companies TO authenticated;
-- Even with grant, RLS still applies; further restrict via a column-aware policy is not
-- possible in PG, so we use a SECURITY DEFINER function for SMTP retrieval instead.

-- Revoke the SMTP columns again - we'll expose them through a function for admins only
REVOKE SELECT (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name)
  ON public.companies FROM authenticated;

-- Function for company admins to fetch SMTP settings
CREATE OR REPLACE FUNCTION public.get_company_smtp_settings()
RETURNS TABLE (
  smtp_host text, smtp_port integer, smtp_user text, smtp_pass text,
  smtp_from_email text, smtp_from_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Only company admins can view SMTP settings';
  END IF;
  RETURN QUERY
    SELECT c.smtp_host, c.smtp_port, c.smtp_user, c.smtp_pass, c.smtp_from_email, c.smtp_from_name
    FROM public.companies c
    WHERE c.id = public.get_user_company_id();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_company_smtp_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_smtp_settings() TO authenticated;
