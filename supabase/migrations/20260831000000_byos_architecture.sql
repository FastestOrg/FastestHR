-- ============================================================================
-- FastestHR BYOS (Bring Your Own Supabase) — Control Plane Migration
-- ============================================================================

-- 1. Enable pgcrypto extension in extensions schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Safely initialize session configuration parameter for encryption
DO $$
BEGIN
  PERFORM set_config('app.settings.byos_encryption_key', 'fastesthr-byos-prod-key-2026-secure-salt', false);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Add BYOS flag to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS byos_enabled BOOLEAN NOT NULL DEFAULT false;

-- 4. Create byos_connections table
CREATE TABLE IF NOT EXISTS public.byos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  -- Encrypted at rest via pgcrypto
  supabase_service_role_key_encrypted BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN (
      'pending_validation', 'validating', 'validated',
      'migration_running', 'migration_failed',
      'active', 'disconnecting', 'migrating_back', 'error'
    )),
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 5. Create byos_audit_log table
CREATE TABLE IF NOT EXISTS public.byos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'connect', 'validate', 'migrate', 'health_check',
      'sync_data', 'disconnect', 'migrate_back', 'error'
    )),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  details JSONB DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable Row Level Security
ALTER TABLE public.byos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.byos_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Policies: Company Admins and Super Admins can manage connections
DROP POLICY IF EXISTS "byos_connections_admin_all" ON public.byos_connections;
CREATE POLICY "byos_connections_admin_all"
  ON public.byos_connections FOR ALL
  USING (
    tenant_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND (platform_role = 'company_admin' OR platform_role = 'super_admin')
    )
    OR (SELECT platform_role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    tenant_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND (platform_role = 'company_admin' OR platform_role = 'super_admin')
    )
    OR (SELECT platform_role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "byos_audit_log_admin_select" ON public.byos_audit_log;
CREATE POLICY "byos_audit_log_admin_select"
  ON public.byos_audit_log FOR SELECT
  USING (
    tenant_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND (platform_role = 'company_admin' OR platform_role = 'super_admin')
    )
    OR (SELECT platform_role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "byos_audit_log_service_insert" ON public.byos_audit_log;
CREATE POLICY "byos_audit_log_service_insert"
  ON public.byos_audit_log FOR INSERT
  WITH CHECK (true);

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_byos_connections_tenant_id ON public.byos_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_byos_connections_status ON public.byos_connections(status);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_tenant_id ON public.byos_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_created_at ON public.byos_audit_log(created_at DESC);

-- 9. Encryption / Decryption Security Definer Helpers
CREATE OR REPLACE FUNCTION public.byos_encrypt_key(plain_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'fastesthr-byos-prod-key-2026-secure-salt');
  RETURN extensions.pgp_sym_encrypt(plain_key, passphrase);
END;
$$;

CREATE OR REPLACE FUNCTION public.byos_decrypt_key(encrypted_key BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'fastesthr-byos-prod-key-2026-secure-salt');
  RETURN extensions.pgp_sym_decrypt(encrypted_key, passphrase);
END;
$$;

-- 10. Safe Frontend RPC (Excludes service_role_key from payload)
CREATE OR REPLACE FUNCTION public.get_byos_connection(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  supabase_url TEXT,
  supabase_anon_key TEXT,
  status TEXT,
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT,
  byos_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.supabase_url,
    bc.supabase_anon_key,
    bc.status,
    bc.migration_version,
    bc.last_health_check,
    bc.health_status,
    c.byos_enabled
  FROM public.byos_connections bc
  JOIN public.companies c ON c.id = bc.tenant_id
  WHERE bc.tenant_id = p_tenant_id
    AND (
      -- Verify caller has admin privileges for this company
      p_tenant_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid() AND (platform_role = 'company_admin' OR platform_role = 'super_admin')
      )
      OR (SELECT platform_role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
      OR auth.role() = 'service_role'
    );
END;
$$;
