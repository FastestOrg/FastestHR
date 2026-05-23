-- Create a secure RPC for candidates to sign their offers using their token
-- This bypasses the need for an UPDATE policy on the table for anon users

CREATE OR REPLACE FUNCTION public.sign_offer_by_token(
  p_token text,
  p_signature_placement jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.candidate_offers
  SET 
    status = 'signed',
    signed_at = now(),
    signature_placement = p_signature_placement
  WHERE token::text = p_token;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.sign_offer_by_token(text, jsonb) TO anon, authenticated;
