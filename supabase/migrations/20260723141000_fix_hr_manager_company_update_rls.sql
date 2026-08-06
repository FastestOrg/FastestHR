-- =============================================
-- Migration: Fix HR Manager permissions to update company employee code sequence & company settings
-- =============================================

-- 1. Drop old UPDATE policy on companies table which only checked public.is_company_admin()
DROP POLICY IF EXISTS "Company admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Company admins and HR managers can update their company" ON public.companies;

-- 2. Create updated UPDATE policy on companies table allowing both company_admin and hr_manager (and super_admin)
CREATE POLICY "Company admins and HR managers can update their company"
  ON public.companies FOR UPDATE TO authenticated
  USING (
    id = public.get_user_company_id() 
    AND (public.is_company_admin() OR public.is_hr_manager() OR public.is_super_admin())
  )
  WITH CHECK (
    id = public.get_user_company_id() 
    AND (public.is_company_admin() OR public.is_hr_manager() OR public.is_super_admin())
  );
