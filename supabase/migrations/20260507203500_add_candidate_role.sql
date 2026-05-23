-- Add 'candidate' to the platform_role enum
-- We use a DO block because ADD VALUE cannot be run inside a transaction in some PG versions, 
-- but Supabase migrations handle this.
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'candidate';

-- Update handle_new_user to handle candidates properly and skip employee creation for them
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  target_company_id UUID;
  user_role TEXT;
BEGIN
  user_role := NEW.raw_user_meta_data->>'platform_role';

  -- If user is registering as a company admin (has company name)
  IF user_role = 'company_admin' AND NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    
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

    -- Create profile with company_id
    INSERT INTO public.profiles (id, company_id, full_name, platform_role)
    VALUES (
      NEW.id,
      new_company_id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'company_admin'
    );

    -- Also create an employee record for them
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
    -- Standard user signup (invited or standard) or candidate
    target_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;

    INSERT INTO public.profiles (id, full_name, platform_role, company_id, manager_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(user_role::platform_role, 'user'::platform_role),
      target_company_id,
      NULLIF(NEW.raw_user_meta_data->>'manager_id', '')::UUID
    );

    -- If they belong to a company, ensure they have an employee record (SKIP for candidates)
    IF target_company_id IS NOT NULL AND (user_role IS NULL OR user_role != 'candidate') THEN
      IF EXISTS (SELECT 1 FROM public.employees WHERE company_id = target_company_id AND work_email = NEW.email AND deleted_at IS NULL) THEN
        UPDATE public.employees 
        SET user_id = NEW.id 
        WHERE company_id = target_company_id 
          AND work_email = NEW.email 
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
