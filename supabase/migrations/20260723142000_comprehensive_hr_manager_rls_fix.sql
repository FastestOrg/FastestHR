-- =============================================
-- Comprehensive RLS audit fix for HR Managers across all HR & Admin modules
-- =============================================

-- 1. ROLES & ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Company admins can manage roles" ON public.roles;
CREATE POLICY "Company admins and HR managers can manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Company admins and HR managers can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

-- 2. USER_ROLES
DROP POLICY IF EXISTS "Company admins can manage user roles" ON public.user_roles;
CREATE POLICY "Company admins and HR managers can manage user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

-- 3. DEPARTMENTS & DESIGNATIONS
DROP POLICY IF EXISTS "Company admins can manage departments" ON public.departments;
CREATE POLICY "Company admins and HR managers can manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage designations" ON public.designations;
CREATE POLICY "Company admins and HR managers can manage designations"
  ON public.designations FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 4. INVITATIONS
DROP POLICY IF EXISTS "Company admins can manage invitations" ON public.invitations;
CREATE POLICY "Company admins and HR managers can manage invitations"
  ON public.invitations FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 5. ATTENDANCE & SHIFTS & EMPLOYEE_SHIFTS
DROP POLICY IF EXISTS "Company admins can manage attendance" ON public.attendance;
CREATE POLICY "Company admins and HR managers can manage attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage shifts" ON public.shifts;
CREATE POLICY "Company admins and HR managers can manage shifts"
  ON public.shifts FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage employee shifts" ON public.employee_shifts;
CREATE POLICY "Company admins and HR managers can manage employee shifts"
  ON public.employee_shifts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

-- 6. LEAVE_TYPES, LEAVE_BALANCES, LEAVE_REQUESTS
DROP POLICY IF EXISTS "Company admins can manage leave types" ON public.leave_types;
CREATE POLICY "Company admins and HR managers can manage leave types"
  ON public.leave_types FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage leave balances" ON public.leave_balances;
CREATE POLICY "Company admins and HR managers can manage leave balances"
  ON public.leave_balances FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage leave requests" ON public.leave_requests;
CREATE POLICY "Company admins and HR managers can manage leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 7. HOLIDAYS & PAY_GRADES & SALARY_STRUCTURES & PAYROLL_RUNS & PAYSLIPS
DROP POLICY IF EXISTS "Company admins can manage holidays" ON public.holidays;
CREATE POLICY "Company admins and HR managers can manage holidays"
  ON public.holidays FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage pay grades" ON public.pay_grades;
CREATE POLICY "Company admins and HR managers can manage pay grades"
  ON public.pay_grades FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage salary structures" ON public.salary_structures;
CREATE POLICY "Company admins and HR managers can manage salary structures"
  ON public.salary_structures FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage payroll runs" ON public.payroll_runs;
CREATE POLICY "Company admins and HR managers can manage payroll runs"
  ON public.payroll_runs FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage payslips" ON public.payslips;
CREATE POLICY "Company admins and HR managers can manage payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 8. REVIEW_CYCLES & PERFORMANCE_REVIEWS
DROP POLICY IF EXISTS "Company admins can manage review cycles" ON public.review_cycles;
CREATE POLICY "Company admins and HR managers can manage review cycles"
  ON public.review_cycles FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage performance reviews" ON public.performance_reviews;
CREATE POLICY "Company admins and HR managers can manage performance reviews"
  ON public.performance_reviews FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = reviewee_id AND e.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

-- 9. COURSES & COURSE_ENROLLMENTS
DROP POLICY IF EXISTS "Company admins can manage courses" ON public.courses;
CREATE POLICY "Company admins and HR managers can manage courses"
  ON public.courses FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage course enrollments" ON public.course_enrollments;
CREATE POLICY "Company admins and HR managers can manage course enrollments"
  ON public.course_enrollments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.company_id = public.get_user_company_id()
  ) AND public.is_admin_or_hr());

-- 10. TICKETS & ANNOUNCEMENTS & SURVEYS
DROP POLICY IF EXISTS "Company admins can manage tickets" ON public.tickets;
CREATE POLICY "Company admins and HR managers can manage tickets"
  ON public.tickets FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage announcements" ON public.announcements;
CREATE POLICY "Company admins and HR managers can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage surveys" ON public.surveys;
CREATE POLICY "Company admins and HR managers can manage surveys"
  ON public.surveys FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 11. EMPLOYEE_EXITS & COMPANY_LOCATIONS (BRANCHES)
DROP POLICY IF EXISTS "Company admins can manage employee exits" ON public.employee_exits;
CREATE POLICY "Company admins and HR managers can manage employee exits"
  ON public.employee_exits FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS "Company admins can manage company locations" ON public.company_locations;
CREATE POLICY "Company admins and HR managers can manage company locations"
  ON public.company_locations FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_hr());

-- 12. STORAGE OBJECTS (payslips & documents buckets)
DROP POLICY IF EXISTS "payslips_read_policy" ON storage.objects;
CREATE POLICY "payslips_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_admin_or_hr() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text OR
            (storage.foldername(name))[2] = (public.get_user_employee_id())::text
        )
    );

DROP POLICY IF EXISTS "payslips_write_policy" ON storage.objects;
CREATE POLICY "payslips_write_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'payslips' AND (
            public.is_admin_or_hr() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
        )
    );

DROP POLICY IF EXISTS "payslips_modify_policy" ON storage.objects;
CREATE POLICY "payslips_modify_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_admin_or_hr() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
        )
    );

DROP POLICY IF EXISTS "payslips_delete_policy" ON storage.objects;
CREATE POLICY "payslips_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_admin_or_hr() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
        )
    );

DROP POLICY IF EXISTS "documents_resume_read_policy" ON storage.objects;
CREATE POLICY "documents_resume_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' AND (storage.foldername(name))[1] = 'resumes' AND public.is_admin_or_hr()
    );
