-- Add missing signing columns to candidate_offers
ALTER TABLE public.candidate_offers 
ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS signed_pdf_url text;
