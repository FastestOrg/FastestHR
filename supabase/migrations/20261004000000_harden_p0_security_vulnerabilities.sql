-- Migration: 20261004000000_harden_p0_security_vulnerabilities.sql
-- Description: Comprehensive P0 Security Hardening
-- 1. Patch handle_new_user() to prevent privilege escalation on public signups
-- 2. Restrict public.global_employee RLS to prevent cross-tenant PII & Government ID harvesting
-- 3. Restrict public.company_storage_integrations RLS so non-admin employees cannot steal Google Drive OAuth tokens
-- 4. Add database triggers to prevent attendance tampering and employee self-escalation

-- ============================================================================
-- 1. PRIVILEGE ESCALATION FIX ON AUTH SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  target_company_id UUID;
  raw_role TEXT;
  assigned_role platform_role;
BEGIN
  raw_role := NEW.raw_user_meta_data->>'platform_role';

  -- Case A: New company registration (User is creating their own new company)
  IF raw_role = 'company_admin' AND NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    
    INSERT INTO public.companies (
      name, 
      slug, 
      size, 
      industry, 
      country,
      plan,
      plan_expires_at,
      license_limit
    ) VALUES (
      NEW.raw_user_meta_data->>'company_name',
      LOWER(REGEXP_REPLACE(NEW.raw_user_meta_data->>'company_name', '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(NEW.id::text, 1, 6),
      NEW.raw_user_meta_data->>'company_size',
      NEW.raw_user_meta_data->>'company_industry',
      NEW.raw_user_meta_data->>'company_country',
      'trial',
      now() + interval '14 days',
      5
    ) RETURNING id INTO new_company_id;

    -- Create profile with company_id as company_admin of their own newly registered company
    INSERT INTO public.profiles (id, company_id, full_name, platform_role)
    VALUES (
      NEW.id,
      new_company_id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'company_admin'::platform_role
    );

    -- Create primary employee record
    INSERT INTO public.employees (
      user_id,
      company_id,
      first_name,
      last_name,
      work_email,
      employment_type,
      status
    ) VALUES (
      NEW.id,
      new_company_id,
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1),
      COALESCE(NULLIF(substring(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) from ' (.*)'), ''), 'Admin'),
      NEW.email,
      'full_time',
      'active'
    );

  ELSE
    -- Case B: Standard user signup or candidate
    target_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;

    -- SECURITY GUARD: Public signups can NEVER self-appoint as super_admin, company_admin, or hr_manager!
    -- Elevated roles can only be granted by existing administrators or service_role edge functions.
    IF raw_role = 'candidate' THEN
      assigned_role := 'candidate'::platform_role;
    ELSE
      assigned_role := 'user'::platform_role;
    END IF;

    INSERT INTO public.profiles (id, full_name, platform_role, company_id, manager_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      assigned_role,
      target_company_id,
      NULLIF(NEW.raw_user_meta_data->>'manager_id', '')::UUID
    );

    -- Link employee record only if it exists with matching email AND user_id is currently NULL (prevents hijacking)
    IF target_company_id IS NOT NULL AND assigned_role != 'candidate' THEN
      IF EXISTS (
        SELECT 1 FROM public.employees 
        WHERE company_id = target_company_id 
          AND lower(work_email) = lower(NEW.email) 
          AND user_id IS NULL 
          AND deleted_at IS NULL
      ) THEN
        UPDATE public.employees 
        SET user_id = NEW.id 
        WHERE company_id = target_company_id 
          AND lower(work_email) = lower(NEW.email) 
          AND user_id IS NULL
          AND deleted_at IS NULL;
      ELSE
        INSERT INTO public.employees (
          user_id,
          company_id,
          first_name,
          last_name,
          work_email,
          employment_type,
          status
        ) VALUES (
          NEW.id,
          target_company_id,
          split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1),
          COALESCE(NULLIF(substring(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) from ' (.*)'), ''), 'User'),
          NEW.email,
          'full_time',
          'active'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. GLOBAL EMPLOYEE PII & GOVERNMENT ID HARVESTING PROTECTION
-- ============================================================================

DROP POLICY IF EXISTS "global_employee_auth_read_all" ON public.global_employee;
DROP POLICY IF EXISTS "global_employee_auth_read" ON public.global_employee;

CREATE POLICY "global_employee_auth_read" ON public.global_employee
  FOR SELECT TO authenticated
  USING (
    -- Super admins can view all
    (SELECT public.is_super_admin())
    -- Submitting company admins and HR managers can view records they added
    OR (
      added_by_company_id IS NOT NULL 
      AND added_by_company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      AND (SELECT platform_role FROM public.profiles WHERE id = (SELECT auth.uid())) IN ('company_admin', 'hr_manager')
    )
    -- Public verified profiles can be viewed for background check confirmation
    OR (public = true AND verified = true)
  );

-- ============================================================================
-- 3. STORAGE INTEGRATIONS OAUTH TOKEN LEAKAGE PROTECTION
-- ============================================================================

DROP POLICY IF EXISTS "company_storage_select_policy" ON public.company_storage_integrations;

-- Restrict SELECT on company_storage_integrations strictly to company administrators & super admins
CREATE POLICY "company_storage_select_policy" ON public.company_storage_integrations
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.company_id = company_storage_integrations.company_id
          AND p.platform_role IN ('company_admin', 'hr_manager', 'super_admin')
      )
    )
    OR (SELECT public.is_super_admin())
  );

-- ============================================================================
-- 4. ATTENDANCE TAMPERING SAFEGUARD TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_attendance_tampering()
RETURNS TRIGGER AS $$
DECLARE
  v_role platform_role;
BEGIN
  -- Fetch role of calling user
  SELECT platform_role INTO v_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  -- Admins can perform overrides / corrections
  IF v_role IN ('super_admin', 'company_admin', 'hr_manager') THEN
    RETURN NEW;
  END IF;

  -- Employee self-update validations:
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify employee_id on attendance records';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify company_id on attendance records';
  END IF;

  IF NEW.date IS DISTINCT FROM OLD.date THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify the attendance date';
  END IF;

  -- Non-admins cannot alter calculated/administrative fields directly
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot directly modify attendance status';
  END IF;

  IF NEW.overtime_hours IS DISTINCT FROM OLD.overtime_hours THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot directly modify overtime hours';
  END IF;

  -- Historical attendance lock: employees cannot modify records for days in the past
  IF OLD.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify historical attendance records';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_attendance_tampering ON public.attendance;
CREATE TRIGGER trg_prevent_attendance_tampering
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_attendance_tampering();

-- ============================================================================
-- 5. EMPLOYEE RECORD TAMPERING SAFEGUARD TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_employee_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_role platform_role;
BEGIN
  SELECT platform_role INTO v_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  -- Admins can update all fields
  IF v_role IN ('super_admin', 'company_admin', 'hr_manager') THEN
    RETURN NEW;
  END IF;

  -- Regular employees cannot alter structural organizational fields
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change company_id';
  END IF;

  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your department';
  END IF;

  IF NEW.designation_id IS DISTINCT FROM OLD.designation_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your designation';
  END IF;

  IF NEW.reporting_manager_id IS DISTINCT FROM OLD.reporting_manager_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your reporting manager';
  END IF;

  IF NEW.employment_type IS DISTINCT FROM OLD.employment_type THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your employment type';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your employment status';
  END IF;

  IF NEW.date_of_joining IS DISTINCT FROM OLD.date_of_joining THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot change your joining date';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify deleted_at';
  END IF;

  IF NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify employee_code';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_employee_self_escalation ON public.employees;
CREATE TRIGGER trg_prevent_employee_self_escalation
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_self_escalation();
