-- Allow company admins and HR managers to update profiles within their company
CREATE POLICY "Admins can update profiles in company" ON profiles
FOR UPDATE
USING (
  company_id = get_user_company_id() 
  AND (
    (SELECT platform_role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'hr_manager', 'super_admin')
  )
);
