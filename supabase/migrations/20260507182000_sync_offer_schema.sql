-- Ensure all required columns exist in candidate_offers before defining the RPC
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_offers' AND column_name = 'signature_placement') THEN
        ALTER TABLE public.candidate_offers ADD COLUMN signature_placement jsonb DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_offers' AND column_name = 'is_predefined_html') THEN
        ALTER TABLE public.candidate_offers ADD COLUMN is_predefined_html boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_offers' AND column_name = 'pdf_url') THEN
        ALTER TABLE public.candidate_offers ADD COLUMN pdf_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_offers' AND column_name = 'custom_variable_values') THEN
        ALTER TABLE public.candidate_offers ADD COLUMN custom_variable_values jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Now redefine the RPC to ensure it's using the correct schema
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

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION public.get_offer_details_by_token(text) TO anon, authenticated;
