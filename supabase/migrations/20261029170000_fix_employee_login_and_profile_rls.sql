-- Migration: 20261029170000_fix_employee_login_and_profile_rls.sql
-- Description:
-- 1. Ensure authenticated users can always SELECT, INSERT, and UPDATE their own profile directly,
--    preventing RLS recursion errors (SQLSTATE 42P17) when loading the dashboard.
-- 2. Make get_user_company_id() fully non-recursive and include an employees table fallback.
-- 3. Update handle_new_user() trigger to automatically resolve company_id and link employees.
-- 4. One-time data healing: Link existing employees whose user_id is currently NULL to matching auth users.

-- 1. Allow authenticated users to view their own profile directly
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- 2. Allow authenticated users to insert their own profile if missing
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- 3. Allow authenticated users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- 4. Ensure non-recursive get_user_company_id()
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'company_id', '')::uuid,
    (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid())),
    (SELECT company_id FROM public.employees WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL LIMIT 1)
  );
$$;

-- 5. Harden handle_new_user() to safely link employees and populate profiles
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
    -- Case B: Standard user signup, invited employee, or portal account
    target_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;

    -- Fallback: If company_id was not passed in user_metadata, resolve from employees by work_email
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

    INSERT INTO public.profiles (id, full_name, platform_role, company_id, manager_id, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      assigned_role,
      target_company_id,
      NULLIF(NEW.raw_user_meta_data->>'manager_id', '')::UUID,
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Retroactive auto-heal: link any existing employees whose work_email matches an existing auth user
DO $$
BEGIN
  -- Link employees by email to existing auth.users
  UPDATE public.employees e
  SET user_id = u.id
  FROM auth.users u
  WHERE lower(trim(e.work_email)) = lower(trim(u.email))
    AND e.user_id IS NULL
    AND e.deleted_at IS NULL;

  -- Ensure all users with an employee record have an active profile with company_id set
  INSERT INTO public.profiles (id, company_id, full_name, platform_role, is_active)
  SELECT 
    e.user_id,
    e.company_id,
    TRIM(CONCAT(e.first_name, ' ', e.last_name)),
    'user'::platform_role,
    true
  FROM public.employees e
  WHERE e.user_id IS NOT NULL
  ON CONFLICT (id) DO UPDATE SET
    company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
    is_active = true;
END $$;

