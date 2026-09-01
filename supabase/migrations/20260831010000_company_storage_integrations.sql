-- PostgreSQL Migration: Company Storage Integrations (BYOS - Google Drive)
-- Enables organizations to connect their Google Drive for document and PDF storage

-- 1. Create company_storage_integrations table
CREATE TABLE IF NOT EXISTS public.company_storage_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google_drive' CHECK (provider IN ('google_drive', 'supabase')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_email TEXT,
  account_name TEXT,
  account_avatar TEXT,
  root_folder_id TEXT NOT NULL,
  root_folder_name TEXT NOT NULL DEFAULT 'FastestHR',
  root_folder_url TEXT,
  subfolders JSONB NOT NULL DEFAULT '{"documents":"","payslips":"","offer_letters":"","onboarding":"","senddesk":""}'::jsonb,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  client_id TEXT,
  total_files_count INTEGER NOT NULL DEFAULT 0,
  total_bytes_stored BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_company_storage_company_id ON public.company_storage_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_storage_provider ON public.company_storage_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_company_storage_is_active ON public.company_storage_integrations(is_active);

-- 3. Enable Row Level Security
ALTER TABLE public.company_storage_integrations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "company_storage_select_policy" ON public.company_storage_integrations;
CREATE POLICY "company_storage_select_policy" ON public.company_storage_integrations
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "company_storage_admin_manage_policy" ON public.company_storage_integrations;
CREATE POLICY "company_storage_admin_manage_policy" ON public.company_storage_integrations
  FOR ALL TO authenticated
  USING (
    (
      public.is_company_admin() AND company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_company_admin() AND company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
    OR public.is_super_admin()
  );

-- 5. Helper RPC to get active company storage configuration
CREATE OR REPLACE FUNCTION public.get_company_storage_integration(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  provider TEXT,
  is_active BOOLEAN,
  connected_email TEXT,
  account_name TEXT,
  account_avatar TEXT,
  root_folder_id TEXT,
  root_folder_name TEXT,
  root_folder_url TEXT,
  subfolders JSONB,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  client_id TEXT,
  total_files_count INTEGER,
  total_bytes_stored BIGINT,
  last_synced_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    csi.id,
    csi.company_id,
    csi.provider,
    csi.is_active,
    csi.connected_email,
    csi.account_name,
    csi.account_avatar,
    csi.root_folder_id,
    csi.root_folder_name,
    csi.root_folder_url,
    csi.subfolders,
    csi.access_token,
    csi.token_expires_at,
    csi.client_id,
    csi.total_files_count,
    csi.total_bytes_stored,
    csi.last_synced_at,
    csi.status
  FROM public.company_storage_integrations csi
  WHERE csi.company_id = p_company_id
    AND (
      csi.company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
      OR public.is_super_admin()
      OR auth.role() = 'service_role'
    );
END;
$$;

-- 6. Helper RPC to save or update Google Drive connection
CREATE OR REPLACE FUNCTION public.save_company_storage_integration(
  p_company_id UUID,
  p_provider TEXT,
  p_connected_email TEXT,
  p_account_name TEXT,
  p_account_avatar TEXT,
  p_root_folder_id TEXT,
  p_root_folder_name TEXT,
  p_root_folder_url TEXT,
  p_subfolders JSONB,
  p_access_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_client_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Verify caller is admin or super admin
  IF NOT (
    public.is_super_admin() OR 
    (public.is_company_admin() AND p_company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only company admins can manage storage settings';
  END IF;

  INSERT INTO public.company_storage_integrations (
    company_id,
    provider,
    is_active,
    connected_email,
    account_name,
    account_avatar,
    root_folder_id,
    root_folder_name,
    root_folder_url,
    subfolders,
    access_token,
    token_expires_at,
    client_id,
    status,
    updated_at
  ) VALUES (
    p_company_id,
    COALESCE(p_provider, 'google_drive'),
    true,
    p_connected_email,
    p_account_name,
    p_account_avatar,
    p_root_folder_id,
    COALESCE(p_root_folder_name, 'FastestHR'),
    p_root_folder_url,
    COALESCE(p_subfolders, '{}'::jsonb),
    p_access_token,
    p_token_expires_at,
    p_client_id,
    'connected',
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    is_active = true,
    connected_email = EXCLUDED.connected_email,
    account_name = EXCLUDED.account_name,
    account_avatar = EXCLUDED.account_avatar,
    root_folder_id = EXCLUDED.root_folder_id,
    root_folder_name = EXCLUDED.root_folder_name,
    root_folder_url = EXCLUDED.root_folder_url,
    subfolders = EXCLUDED.subfolders,
    access_token = EXCLUDED.access_token,
    token_expires_at = EXCLUDED.token_expires_at,
    client_id = COALESCE(EXCLUDED.client_id, company_storage_integrations.client_id),
    status = 'connected',
    error_message = NULL,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7. Helper RPC to disconnect storage
CREATE OR REPLACE FUNCTION public.disconnect_company_storage(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin or super admin
  IF NOT (
    public.is_super_admin() OR 
    (public.is_company_admin() AND p_company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only company admins can manage storage settings';
  END IF;

  UPDATE public.company_storage_integrations
  SET 
    is_active = false,
    status = 'disconnected',
    access_token = NULL,
    refresh_token = NULL,
    updated_at = now()
  WHERE company_id = p_company_id;

  RETURN true;
END;
$$;
