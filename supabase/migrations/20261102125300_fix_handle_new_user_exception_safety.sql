-- Migration: 20261102125300_fix_handle_new_user_exception_safety.sql
-- Problem: "Database error creating new user" when creating portal accounts via edge function.
--   The handle_new_user() trigger fires inside the createUser() transaction and any unhandled
--   exception (duplicate employee, license limit, missing column, etc.) rolls back the entire
--   auth.users INSERT, returning a generic GoTrue error.
-- Fix: Wrap Case B (portal / invited user) operations in an EXCEPTION block so the trigger
--   never aborts the auth.users INSERT. The edge function already handles profile and employee
--   linking separately, so a trigger failure in those steps is safely recoverable.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  target_company_id UUID;
  raw_role TEXT;
  assigned_role platform_role;
BEGIN
  raw_role := NEW.raw_user_meta_data->>'platform_role';

  -- Case A: New company registration
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

    -- Create profile with company_id as company_admin
    INSERT INTO public.profiles (id, company_id, full_name, platform_role, is_active)
    VALUES (
      NEW.id,
      new_company_id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'company_admin'::platform_role,
      true
    ) ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      platform_role = EXCLUDED.platform_role,
      full_name = EXCLUDED.full_name,
      is_active = true;

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
    -- Case B: Standard user signup, invited employee, or portal account creation
    -- Wrap in exception block so a failure here never aborts the auth.users INSERT.
    -- The edge function (create-portal-account) handles profile upsert and employee
    -- linking separately, so these steps are best-effort inside the trigger.
    BEGIN
      target_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;

      -- Fallback: resolve company_id from employees by work_email
      IF target_company_id IS NULL THEN
        SELECT company_id INTO target_company_id
        FROM public.employees
        WHERE lower(trim(work_email)) = lower(trim(NEW.email))
          AND deleted_at IS NULL
        LIMIT 1;
      END IF;

      IF raw_role = 'candidate' THEN
        assigned_role := 'candidate'::platform_role;
      ELSE
        assigned_role := 'user'::platform_role;
      END IF;

      INSERT INTO public.profiles (id, full_name, platform_role, company_id, is_active)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        assigned_role,
        target_company_id,
        true
      ) ON CONFLICT (id) DO UPDATE SET
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
        full_name = EXCLUDED.full_name,
        is_active = true;

      -- Link employee record with matching email where user_id is currently NULL
      IF assigned_role != 'candidate' THEN
        UPDATE public.employees 
        SET user_id = NEW.id 
        WHERE (company_id = target_company_id OR target_company_id IS NULL)
          AND lower(trim(work_email)) = lower(trim(NEW.email)) 
          AND user_id IS NULL 
          AND deleted_at IS NULL;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log the error but do NOT re-raise, so the auth.users row is still committed.
      -- The edge function will handle profile and employee linking post-creation.
      RAISE WARNING 'handle_new_user Case B non-fatal error for user % (email: %): % [SQLSTATE %]',
        NEW.id, NEW.email, SQLERRM, SQLSTATE;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

