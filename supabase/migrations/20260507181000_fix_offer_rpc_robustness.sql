-- Redefine the RPC to be more robust by accepting TEXT and casting to UUID
-- This prevents PostgREST from failing with 400 when an invalid or slightly malformed string is passed.

CREATE OR REPLACE FUNCTION public.get_offer_details_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_uuid uuid;
  result jsonb;
BEGIN
  -- Try to cast the text token to UUID
  BEGIN
    v_token_uuid := p_token::uuid;
  EXCEPTION WHEN others THEN
    -- If it's not a valid UUID, it definitely won't be found in our co.token (which is UUID)
    RETURN NULL;
  END;

  SELECT 
    jsonb_build_object(
      'id', co.id,
      'company_id', co.company_id,
      'candidate_id', co.candidate_id,
      'job_id', co.job_id,
      'offer_number', co.offer_number,
      'joining_date', co.joining_date,
      'payout', co.payout,
      'html_content', co.html_content,
      'status', co.status,
      'expires_at', co.expires_at,
      'token', co.token,
      'created_at', co.created_at,
      'updated_at', co.updated_at,
      'is_predefined_html', co.is_predefined_html,
      'pdf_url', co.pdf_url,
      'custom_variable_values', co.custom_variable_values,
      'signature_placement', co.signature_placement,
      'companies', jsonb_build_object(
        'name', c.name,
        'logo_url', c.logo_url,
        'currency', c.currency
      ),
      'candidates', jsonb_build_object(
        'full_name', cand.full_name,
        'email', cand.email
      ),
      'jobs', jsonb_build_object(
        'title', j.title
      )
    ) INTO result
  FROM public.candidate_offers co
  LEFT JOIN public.companies c ON co.company_id = c.id
  LEFT JOIN public.candidates cand ON co.candidate_id = cand.id
  LEFT JOIN public.jobs j ON co.job_id = j.id
  WHERE co.token = v_token_uuid
  LIMIT 1;

  RETURN result;
END;
$$;

-- Ensure permissions are granted to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_offer_details_by_token(text) TO anon, authenticated;
