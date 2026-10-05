-- ====================================================================
-- Migration: 20261004020000_tamper_proof_audit_trail.sql
-- Description: Tamper-Evident Cryptographic Audit Trail (SOC2 / ISO27001)
-- Features: Append-only immutability, SHA-256 hash chaining, verification RPC
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create tamper_evident_audit_log table
CREATE TABLE IF NOT EXISTS public.tamper_evident_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sequence_number BIGSERIAL NOT NULL,
  prev_hash TEXT NOT NULL,
  record_hash TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tamper_audit_company_seq ON public.tamper_evident_audit_log (company_id, sequence_number ASC);
CREATE INDEX IF NOT EXISTS idx_tamper_audit_actor ON public.tamper_evident_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_tamper_audit_created ON public.tamper_evident_audit_log (created_at DESC);

-- 2. Hash calculation helper function
CREATE OR REPLACE FUNCTION public.compute_audit_record_hash(
  p_prev_hash TEXT,
  p_company_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB,
  p_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  v_raw_str TEXT;
BEGIN
  v_raw_str := coalesce(p_prev_hash, '') || '|' ||
               p_company_id::text || '|' ||
               coalesce(p_actor_id::text, '') || '|' ||
               p_action || '|' ||
               p_entity_type || '|' ||
               coalesce(p_entity_id::text, '') || '|' ||
               coalesce(p_payload::text, '{}') || '|' ||
               to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  
  RETURN encode(digest(v_raw_str, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Trigger to enforce prev_hash chaining and record_hash computation
CREATE OR REPLACE FUNCTION public.trg_tamper_evident_audit_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
BEGIN
  -- Authoritative server-side timestamp
  NEW.created_at := clock_timestamp();

  -- Get latest record_hash for this company
  SELECT record_hash INTO v_prev_hash
  FROM public.tamper_evident_audit_log
  WHERE company_id = NEW.company_id
  ORDER BY sequence_number DESC
  LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := 'GENESIS_HASH_' || NEW.company_id::text;
  END IF;

  NEW.prev_hash := v_prev_hash;
  NEW.record_hash := public.compute_audit_record_hash(
    NEW.prev_hash,
    NEW.company_id,
    NEW.actor_id,
    NEW.action,
    NEW.entity_type,
    NEW.entity_id,
    NEW.payload,
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_tamper_evident_audit ON public.tamper_evident_audit_log;
CREATE TRIGGER before_insert_tamper_evident_audit
BEFORE INSERT ON public.tamper_evident_audit_log
FOR EACH ROW EXECUTE FUNCTION public.trg_tamper_evident_audit_insert();

-- 4. Strictly prevent any UPDATE or DELETE mutations (Append-Only)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Cryptographic audit log is strictly immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.tamper_evident_audit_log;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.tamper_evident_audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 5. Row Level Security Policies
ALTER TABLE public.tamper_evident_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company staff can view company audit trail" ON public.tamper_evident_audit_log;
CREATE POLICY "Company staff can view company audit trail"
  ON public.tamper_evident_audit_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND platform_role IN ('super_admin', 'company_admin', 'hr_manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND platform_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can record audit entries" ON public.tamper_evident_audit_log;
CREATE POLICY "Authenticated users can record audit entries"
  ON public.tamper_evident_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND platform_role = 'super_admin'
    )
  );

-- 6. Verification RPC: Verifies cryptographic hash chain integrity for an entire company
CREATE OR REPLACE FUNCTION public.verify_tamper_evident_chain(p_company_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  broken_sequence BIGINT,
  total_records BIGINT,
  last_hash TEXT,
  error_reason TEXT
) AS $$
DECLARE
  v_rec RECORD;
  v_expected_prev TEXT := 'GENESIS_HASH_' || p_company_id::text;
  v_computed_hash TEXT;
  v_count BIGINT := 0;
BEGIN
  FOR v_rec IN
    SELECT *
    FROM public.tamper_evident_audit_log
    WHERE company_id = p_company_id
    ORDER BY sequence_number ASC
  LOOP
    v_count := v_count + 1;

    -- 1. Check that prev_hash matches the previous record's hash
    IF v_rec.prev_hash <> v_expected_prev THEN
      RETURN QUERY SELECT 
        false, 
        v_rec.sequence_number, 
        v_count, 
        v_rec.record_hash, 
        'Broken hash chain link: stored prev_hash does not match expected previous hash';
      RETURN;
    END IF;

    -- 2. Re-compute hash and check validity
    v_computed_hash := public.compute_audit_record_hash(
      v_rec.prev_hash,
      v_rec.company_id,
      v_rec.actor_id,
      v_rec.action,
      v_rec.entity_type,
      v_rec.entity_id,
      v_rec.payload,
      v_rec.created_at
    );

    IF v_computed_hash <> v_rec.record_hash THEN
      RETURN QUERY SELECT 
        false, 
        v_rec.sequence_number, 
        v_count, 
        v_rec.record_hash, 
        'Data tampering detected: computed record hash does not match stored hash';
      RETURN;
    END IF;

    v_expected_prev := v_rec.record_hash;
  END LOOP;

  -- If reached here, chain is 100% valid
  RETURN QUERY SELECT true, NULL::BIGINT, v_count, v_expected_prev, 'Audit trail verified cryptographically valid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
