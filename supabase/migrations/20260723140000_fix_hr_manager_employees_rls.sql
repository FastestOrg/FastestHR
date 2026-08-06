-- =============================================
-- Migration: Fix HR Manager RLS permissions for employees table
-- =============================================

-- 1. Create helper function public.is_hr_manager() if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_hr_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND platform_role = 'hr_manager'
  )
$$;

-- 2. Create helper function public.is_admin_or_hr() for convenient reuse across RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND platform_role IN ('company_admin', 'hr_manager', 'super_admin')
  )
$$;

-- 3. Drop existing manage policy on employees table
DROP POLICY IF EXISTS "Company admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Company admins and HR managers can manage employees" ON public.employees;

-- 4. Re-create policy granting company admins, HR managers, and super admins full management rights
CREATE POLICY "Company admins and HR managers can manage employees"
  ON public.employees FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id() 
    AND (public.is_company_admin() OR public.is_hr_manager() OR public.is_super_admin())
  )
  WITH CHECK (
    company_id = public.get_user_company_id() 
    AND (public.is_company_admin() OR public.is_hr_manager() OR public.is_super_admin())
  );
