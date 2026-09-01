-- ==============================================================================
-- Migration: Complete Employee & Account Permanent Deletion Function
-- Function: public.delete_employee_completely(p_employee_id UUID, p_admin_id UUID)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_employee_completely(
  p_employee_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_role platform_role;
  v_admin_company_id UUID;
  v_emp RECORD;
  v_user_id UUID;
  v_company_id UUID;
  v_work_email TEXT;
  v_personal_email TEXT;
  v_avatar_url TEXT;
  v_full_name TEXT;
BEGIN
  -- 1. Verify caller admin role and company
  SELECT platform_role, company_id 
  INTO v_admin_role, v_admin_company_id
  FROM public.profiles 
  WHERE id = p_admin_id;

  IF v_admin_role IS NULL OR (v_admin_role != 'company_admin' AND v_admin_role != 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Company Administrators or Super Administrators can permanently delete an employee.';
  END IF;

  -- 2. Fetch the target employee
  SELECT id, user_id, company_id, work_email, personal_email, avatar_url, first_name, last_name
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee with ID % not found.', p_employee_id;
  END IF;

  v_user_id := v_emp.user_id;
  v_company_id := v_emp.company_id;
  v_work_email := v_emp.work_email;
  v_personal_email := v_emp.personal_email;
  v_avatar_url := v_emp.avatar_url;
  v_full_name := trim(concat(v_emp.first_name, ' ', v_emp.last_name));

  -- 3. Verify tenant isolation (unless super_admin)
  IF v_admin_role != 'super_admin' AND v_company_id != v_admin_company_id THEN
    RAISE EXCEPTION 'Forbidden: Target employee belongs to a different organization.';
  END IF;

  -- 4. Prevent self-deletion
  IF v_user_id IS NOT NULL AND v_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Action Blocked: You cannot delete your own Administrator account. Please transfer ownership or ask another Administrator.';
  END IF;

  -- 5. Unlink references where this employee is a manager/head/actor
  -- Unlink reporting manager in employees table
  UPDATE public.employees 
  SET reporting_manager_id = NULL 
  WHERE reporting_manager_id = p_employee_id;

  -- Unlink department head
  UPDATE public.departments 
  SET head_id = NULL 
  WHERE head_id = p_employee_id;

  -- Unlink assets assigned to this employee (make them available again)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets') THEN
    UPDATE public.assets 
    SET assigned_employee_id = NULL, status = 'available' 
    WHERE assigned_employee_id = p_employee_id;
  END IF;

  -- Unlink tickets raised or assigned
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    UPDATE public.tickets SET raised_by = NULL WHERE raised_by = p_employee_id;
    IF v_user_id IS NOT NULL THEN
      UPDATE public.tickets SET assigned_to = NULL WHERE assigned_to = v_user_id;
    END IF;
  END IF;

  -- Remove from interviewers list in interviews table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interviews') THEN
    UPDATE public.interviews 
    SET interviewers = array_remove(interviewers, p_employee_id) 
    WHERE p_employee_id = ANY(interviewers);
  END IF;

  -- Unlink candidate referrals
  IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'referred_by') THEN
    UPDATE public.candidates SET referred_by = NULL WHERE referred_by = v_user_id;
  END IF;

  -- Unlink job postings
  IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    UPDATE public.jobs SET posted_by = NULL WHERE posted_by = v_user_id;
  END IF;

  -- Unlink reviewer in performance reviews
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_reviews') THEN
    UPDATE public.performance_reviews SET reviewer_id = NULL WHERE reviewer_id = p_employee_id;
  END IF;

  -- 6. Delete child records directly linked to employee_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
    DELETE FROM public.attendance WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_shifts') THEN
    DELETE FROM public.employee_shifts WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    DELETE FROM public.leave_requests WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_balances') THEN
    DELETE FROM public.leave_balances WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payslips') THEN
    DELETE FROM public.payslips WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salary_structures') THEN
    DELETE FROM public.salary_structures WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_reviews') THEN
    DELETE FROM public.performance_reviews WHERE reviewee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'goals') THEN
    DELETE FROM public.goals WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_enrollments') THEN
    DELETE FROM public.course_enrollments WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcement_reads') THEN
    DELETE FROM public.announcement_reads WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'survey_responses') THEN
    DELETE FROM public.survey_responses WHERE respondent_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_exits') THEN
    DELETE FROM public.employee_exits WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_daily_scores') THEN
    DELETE FROM public.kpi_daily_scores WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_monthly_scores') THEN
    DELETE FROM public.kpi_monthly_scores WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_quarterly_scores') THEN
    DELETE FROM public.kpi_quarterly_scores WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kudos_board') THEN
    DELETE FROM public.kudos_board WHERE sender_id = p_employee_id OR receiver_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attrition_predictions') THEN
    DELETE FROM public.attrition_predictions WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_progress') THEN
    DELETE FROM public.onboarding_progress WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_document_submissions') THEN
    DELETE FROM public.onboarding_document_submissions WHERE employee_id = p_employee_id;
  END IF;

  -- 7. Delete records linked to user_id / profile
  IF v_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_comments') THEN
      DELETE FROM public.ticket_comments WHERE author_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_participants') THEN
      DELETE FROM public.chat_participants WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
      DELETE FROM public.chat_messages WHERE sender_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_presence') THEN
      DELETE FROM public.chat_presence WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_conversations') THEN
      DELETE FROM public.chat_conversations WHERE created_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_meeting_settings') THEN
      DELETE FROM public.user_meeting_settings WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_event_types') THEN
      DELETE FROM public.meeting_event_types WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_bookings') THEN
      DELETE FROM public.meeting_bookings WHERE host_user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
      DELETE FROM public.notifications WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      DELETE FROM public.user_roles WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
      UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = v_user_id;
    END IF;
  END IF;

  -- 8. Clean up invitations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
    DELETE FROM public.invitations 
    WHERE (v_work_email IS NOT NULL AND email = v_work_email)
       OR (v_personal_email IS NOT NULL AND email = v_personal_email)
       OR (v_user_id IS NOT NULL AND invited_by = v_user_id);
  END IF;

  -- 9. Delete the employee record itself
  DELETE FROM public.employees WHERE id = p_employee_id;

  -- 10. Delete the profile record if exists
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- 11. Return detailed metadata for caller (and edge function auth/storage cleanup)
  RETURN jsonb_build_object(
    'success', true,
    'deleted_employee_id', p_employee_id,
    'deleted_user_id', v_user_id,
    'company_id', v_company_id,
    'work_email', v_work_email,
    'personal_email', v_personal_email,
    'full_name', v_full_name,
    'avatar_url', v_avatar_url
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.delete_employee_completely(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_employee_completely(UUID, UUID) TO service_role;
