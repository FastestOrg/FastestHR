
-- Revoke EXECUTE from anon and public on SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', r.nspname, r.proname, r.args);
  END LOOP;
END$$;

-- Functions intentionally callable anonymously (used for public token-based access):
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_by_public_id(text) TO anon;
