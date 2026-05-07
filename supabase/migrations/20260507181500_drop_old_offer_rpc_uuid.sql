-- Drop the old version of the function that takes UUID to resolve ambiguity
-- PostgREST cannot disambiguate between (text) and (uuid) when called from the frontend.

DROP FUNCTION IF EXISTS public.get_offer_details_by_token(uuid);
