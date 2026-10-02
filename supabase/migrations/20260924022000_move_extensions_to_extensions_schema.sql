-- Migration: 20260924022000_move_extensions_to_extensions_schema.sql
-- Description: Move vector and pg_trgm extensions to extensions schema to resolve extension_in_public warning

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;

-- Ensure match_candidates has public and extensions in search_path
ALTER FUNCTION public.match_candidates(extensions.vector, double precision, integer, uuid) SET search_path = public, extensions;
