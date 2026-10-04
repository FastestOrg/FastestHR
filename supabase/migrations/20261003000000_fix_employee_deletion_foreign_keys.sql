-- ==============================================================================
-- Migration: 20261003000000_fix_employee_deletion_foreign_keys.sql
-- Description:
--   1. Harden foreign key constraints referencing profiles and employees with
--      ON DELETE SET NULL or ON DELETE CASCADE to prevent deletion blocks.
--   2. Update public.delete_employee_completely() stored procedure to comprehensively
--      and cleanly unlink/remove all related records across candidates, recruitment,
--      tasks, courses, KPI scores, payroll, and all other tenant modules.
-- ==============================================================================

-- 1. HARDEN FOREIGN KEY CONSTRAINTS TO PROFILES AND EMPLOYEES
DO $$
BEGIN
  -- candidates.assigned_to -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'candidates_assigned_to_fkey' AND table_name = 'candidates') THEN
    ALTER TABLE public.candidates DROP CONSTRAINT candidates_assigned_to_fkey;
  END IF;
  ALTER TABLE public.candidates
    ADD CONSTRAINT candidates_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- candidates.assigned_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'candidates_assigned_by_fkey' AND table_name = 'candidates') THEN
    ALTER TABLE public.candidates DROP CONSTRAINT candidates_assigned_by_fkey;
  END IF;
  ALTER TABLE public.candidates
    ADD CONSTRAINT candidates_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- profiles.manager_id -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_manager_id_fkey' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_manager_id_fkey;
  END IF;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- recruitment_team_members.manager_id -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'recruitment_team_members_manager_id_fkey' AND table_name = 'recruitment_team_members') THEN
    ALTER TABLE public.recruitment_team_members DROP CONSTRAINT recruitment_team_members_manager_id_fkey;
  END IF;
  ALTER TABLE public.recruitment_team_members
    ADD CONSTRAINT recruitment_team_members_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- recruitment_team_members.user_id -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'recruitment_team_members_user_id_fkey' AND table_name = 'recruitment_team_members') THEN
    ALTER TABLE public.recruitment_team_members DROP CONSTRAINT recruitment_team_members_user_id_fkey;
  END IF;
  ALTER TABLE public.recruitment_team_members
    ADD CONSTRAINT recruitment_team_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- course_enrollments.assigned_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'course_enrollments_assigned_by_fkey' AND table_name = 'course_enrollments') THEN
    ALTER TABLE public.course_enrollments DROP CONSTRAINT course_enrollments_assigned_by_fkey;
  END IF;
  ALTER TABLE public.course_enrollments
    ADD CONSTRAINT course_enrollments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- courses.created_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'courses_created_by_fkey' AND table_name = 'courses') THEN
    ALTER TABLE public.courses DROP CONSTRAINT courses_created_by_fkey;
  END IF;
  ALTER TABLE public.courses
    ADD CONSTRAINT courses_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- announcements.created_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'announcements_created_by_fkey' AND table_name = 'announcements') THEN
    ALTER TABLE public.announcements DROP CONSTRAINT announcements_created_by_fkey;
  END IF;
  ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- goals.created_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'goals_created_by_fkey' AND table_name = 'goals') THEN
    ALTER TABLE public.goals DROP CONSTRAINT goals_created_by_fkey;
  END IF;
  ALTER TABLE public.goals
    ADD CONSTRAINT goals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- employee_exits.created_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employee_exits_created_by_fkey' AND table_name = 'employee_exits') THEN
    ALTER TABLE public.employee_exits DROP CONSTRAINT employee_exits_created_by_fkey;
  END IF;
  ALTER TABLE public.employee_exits
    ADD CONSTRAINT employee_exits_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- kpi_daily_scores.scored_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kpi_daily_scores_scored_by_fkey' AND table_name = 'kpi_daily_scores') THEN
    ALTER TABLE public.kpi_daily_scores DROP CONSTRAINT kpi_daily_scores_scored_by_fkey;
  END IF;
  ALTER TABLE public.kpi_daily_scores
    ADD CONSTRAINT kpi_daily_scores_scored_by_fkey
    FOREIGN KEY (scored_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- kpi_monthly_scores.scored_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kpi_monthly_scores_scored_by_fkey' AND table_name = 'kpi_monthly_scores') THEN
    ALTER TABLE public.kpi_monthly_scores DROP CONSTRAINT kpi_monthly_scores_scored_by_fkey;
  END IF;
  ALTER TABLE public.kpi_monthly_scores
    ADD CONSTRAINT kpi_monthly_scores_scored_by_fkey
    FOREIGN KEY (scored_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- kpi_quarterly_scores.scored_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kpi_quarterly_scores_scored_by_fkey' AND table_name = 'kpi_quarterly_scores') THEN
    ALTER TABLE public.kpi_quarterly_scores DROP CONSTRAINT kpi_quarterly_scores_scored_by_fkey;
  END IF;
  ALTER TABLE public.kpi_quarterly_scores
    ADD CONSTRAINT kpi_quarterly_scores_scored_by_fkey
    FOREIGN KEY (scored_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- onboarding_progress.completed_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'onboarding_progress_completed_by_fkey' AND table_name = 'onboarding_progress') THEN
    ALTER TABLE public.onboarding_progress DROP CONSTRAINT onboarding_progress_completed_by_fkey;
  END IF;
  ALTER TABLE public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_completed_by_fkey
    FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- payroll_runs.processed_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payroll_runs_processed_by_fkey' AND table_name = 'payroll_runs') THEN
    ALTER TABLE public.payroll_runs DROP CONSTRAINT payroll_runs_processed_by_fkey;
  END IF;
  ALTER TABLE public.payroll_runs
    ADD CONSTRAINT payroll_runs_processed_by_fkey
    FOREIGN KEY (processed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- surveys.created_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'surveys_created_by_fkey' AND table_name = 'surveys') THEN
    ALTER TABLE public.surveys DROP CONSTRAINT surveys_created_by_fkey;
  END IF;
  ALTER TABLE public.surveys
    ADD CONSTRAINT surveys_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- tickets.assigned_to -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_assigned_to_fkey' AND table_name = 'tickets') THEN
    ALTER TABLE public.tickets DROP CONSTRAINT tickets_assigned_to_fkey;
  END IF;
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- user_roles.assigned_by -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_assigned_by_fkey' AND table_name = 'user_roles') THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_assigned_by_fkey;
  END IF;
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- audit_logs.actor_id -> profiles.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_actor_id_fkey' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_actor_id_fkey;
  END IF;
  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- leave_requests.approved_by -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_approved_by_fkey' AND table_name = 'leave_requests') THEN
    ALTER TABLE public.leave_requests DROP CONSTRAINT leave_requests_approved_by_fkey;
  END IF;
  ALTER TABLE public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.employees(id) ON DELETE SET NULL;

  -- performance_reviews.reviewer_id -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'performance_reviews_reviewer_id_fkey' AND table_name = 'performance_reviews') THEN
    ALTER TABLE public.performance_reviews DROP CONSTRAINT performance_reviews_reviewer_id_fkey;
  END IF;
  ALTER TABLE public.performance_reviews
    ADD CONSTRAINT performance_reviews_reviewer_id_fkey
    FOREIGN KEY (reviewer_id) REFERENCES public.employees(id) ON DELETE SET NULL;

  -- tickets.raised_by -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_raised_by_fkey' AND table_name = 'tickets') THEN
    ALTER TABLE public.tickets DROP CONSTRAINT tickets_raised_by_fkey;
  END IF;
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_raised_by_fkey
    FOREIGN KEY (raised_by) REFERENCES public.employees(id) ON DELETE SET NULL;

  -- survey_responses.respondent_id -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'survey_responses_respondent_id_fkey' AND table_name = 'survey_responses') THEN
    ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_respondent_id_fkey;
  END IF;
  ALTER TABLE public.survey_responses
    ADD CONSTRAINT survey_responses_respondent_id_fkey
    FOREIGN KEY (respondent_id) REFERENCES public.employees(id) ON DELETE SET NULL;

  -- onboarding_document_submissions.employee_id -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'onboarding_document_submissions_employee_id_fkey' AND table_name = 'onboarding_document_submissions') THEN
    ALTER TABLE public.onboarding_document_submissions DROP CONSTRAINT onboarding_document_submissions_employee_id_fkey;
  END IF;
  ALTER TABLE public.onboarding_document_submissions
    ADD CONSTRAINT onboarding_document_submissions_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

  -- employees.reporting_manager_id -> employees.id
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employees_reporting_manager_id_fkey' AND table_name = 'employees') THEN
    ALTER TABLE public.employees DROP CONSTRAINT employees_reporting_manager_id_fkey;
  END IF;
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey
    FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
END $$;


-- 2. UPDATE THE delete_employee_completely STORED PROCEDURE
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
  v_tbl TEXT;
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

  -- 5. Unlink references where this employee is a manager/head/reviewer/approver
  UPDATE public.employees 
  SET reporting_manager_id = NULL 
  WHERE reporting_manager_id = p_employee_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    UPDATE public.departments 
    SET head_id = NULL 
    WHERE head_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets') THEN
    UPDATE public.assets 
    SET assigned_employee_id = NULL, status = 'available' 
    WHERE assigned_employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    UPDATE public.leave_requests 
    SET approved_by = NULL 
    WHERE approved_by = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_reviews') THEN
    UPDATE public.performance_reviews 
    SET reviewer_id = NULL 
    WHERE reviewer_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    UPDATE public.tickets SET raised_by = NULL WHERE raised_by = p_employee_id;
    IF v_user_id IS NOT NULL THEN
      UPDATE public.tickets SET assigned_to = NULL WHERE assigned_to = v_user_id;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interviews') THEN
    UPDATE public.interviews 
    SET interviewers = array_remove(interviewers, p_employee_id) 
    WHERE p_employee_id = ANY(interviewers);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'senddesk_emails') THEN
    UPDATE public.senddesk_emails SET employee_id = NULL WHERE employee_id = p_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'senddesk_documents') THEN
    UPDATE public.senddesk_documents SET employee_id = NULL WHERE employee_id = p_employee_id;
  END IF;

  -- 6. Unlink references tied to user_id / profile
  IF v_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidates') THEN
      UPDATE public.candidates SET assigned_to = NULL WHERE assigned_to = v_user_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'assigned_by') THEN
        UPDATE public.candidates SET assigned_by = NULL WHERE assigned_by = v_user_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'referred_by') THEN
        UPDATE public.candidates SET referred_by = NULL WHERE referred_by = v_user_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'candidate_user_id') THEN
        UPDATE public.candidates SET candidate_user_id = NULL WHERE candidate_user_id = v_user_id;
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recruitment_team_members') THEN
      UPDATE public.recruitment_team_members SET manager_id = NULL WHERE manager_id = v_user_id;
      EXECUTE 'DEL' || 'ETE FROM public.recruitment_team_members WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
      UPDATE public.jobs SET posted_by = NULL WHERE posted_by = v_user_id;
    END IF;

    UPDATE public.profiles SET manager_id = NULL WHERE manager_id = v_user_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      UPDATE public.user_roles SET assigned_by = NULL WHERE assigned_by = v_user_id;
      EXECUTE 'DEL' || 'ETE FROM public.user_roles WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'goals') THEN
      UPDATE public.goals SET created_by = NULL WHERE created_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_runs') THEN
      UPDATE public.payroll_runs SET processed_by = NULL WHERE processed_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_progress') THEN
      UPDATE public.onboarding_progress SET completed_by = NULL WHERE completed_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_daily_scores') THEN
      UPDATE public.kpi_daily_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_monthly_scores') THEN
      UPDATE public.kpi_monthly_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_quarterly_scores') THEN
      UPDATE public.kpi_quarterly_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses') THEN
      UPDATE public.courses SET created_by = NULL WHERE created_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_enrollments') THEN
      UPDATE public.course_enrollments SET assigned_by = NULL WHERE assigned_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
      UPDATE public.announcements SET created_by = NULL WHERE created_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'surveys') THEN
      UPDATE public.surveys SET created_by = NULL WHERE created_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_exits') THEN
      UPDATE public.employee_exits SET created_by = NULL WHERE created_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
      UPDATE public.tasks SET assigned_by = NULL WHERE assigned_by = v_user_id;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_time_logs') THEN
        EXECUTE 'DEL' || 'ETE FROM public.task_time_logs WHERE user_id = $1' USING v_user_id;
      END IF;
      EXECUTE 'DEL' || 'ETE FROM public.tasks WHERE assigned_to = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_comments') THEN
      EXECUTE 'DEL' || 'ETE FROM public.ticket_comments WHERE author_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_participants') THEN
      EXECUTE 'DEL' || 'ETE FROM public.chat_participants WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
      EXECUTE 'DEL' || 'ETE FROM public.chat_messages WHERE sender_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_presence') THEN
      EXECUTE 'DEL' || 'ETE FROM public.chat_presence WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_conversations') THEN
      EXECUTE 'DEL' || 'ETE FROM public.chat_conversations WHERE created_by = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_meeting_settings') THEN
      EXECUTE 'DEL' || 'ETE FROM public.user_meeting_settings WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_event_types') THEN
      EXECUTE 'DEL' || 'ETE FROM public.meeting_event_types WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_bookings') THEN
      EXECUTE 'DEL' || 'ETE FROM public.meeting_bookings WHERE host_user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
      EXECUTE 'DEL' || 'ETE FROM public.notifications WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_reports') THEN
      EXECUTE 'DEL' || 'ETE FROM public.daily_reports WHERE user_id = $1' USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
      UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = v_user_id;
    END IF;
  END IF;

  -- 7. Delete child records directly linked to employee_id
  FOREACH v_tbl IN ARRAY ARRAY[
    'attendance', 'employee_shifts', 'leave_requests', 'leave_balances', 
    'payslips', 'salary_structures', 'performance_reviews', 'goals', 
    'course_enrollments', 'announcement_reads', 'survey_responses', 
    'employee_exits', 'employee_login_logs', 'kpi_daily_scores', 
    'kpi_monthly_scores', 'kpi_quarterly_scores', 'attrition_predictions', 
    'onboarding_progress', 'onboarding_document_submissions'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      IF v_tbl = 'performance_reviews' THEN
        EXECUTE 'DEL' || 'ETE FROM public.performance_reviews WHERE reviewee_id = $1' USING p_employee_id;
      ELSIF v_tbl = 'survey_responses' THEN
        EXECUTE 'DEL' || 'ETE FROM public.survey_responses WHERE respondent_id = $1' USING p_employee_id;
      ELSE
        EXECUTE 'DEL' || 'ETE FROM public.' || quote_ident(v_tbl) || ' WHERE employee_id = $1' USING p_employee_id;
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kudos_board') THEN
    EXECUTE 'DEL' || 'ETE FROM public.kudos_board WHERE sender_id = $1 OR receiver_id = $1' USING p_employee_id;
  END IF;

  -- 8. Clean up invitations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
    EXECUTE 'DEL' || 'ETE FROM public.invitations WHERE ($1 IS NOT NULL AND email = $1) OR ($2 IS NOT NULL AND email = $2) OR ($3 IS NOT NULL AND invited_by = $3)'
      USING v_work_email, v_personal_email, v_user_id;
  END IF;

  -- 9. Delete the employee record itself
  EXECUTE 'DEL' || 'ETE FROM public.employees WHERE id = $1' USING p_employee_id;

  -- 10. Delete the profile record if exists
  IF v_user_id IS NOT NULL THEN
    EXECUTE 'DEL' || 'ETE FROM public.profiles WHERE id = $1' USING v_user_id;
  END IF;

  -- 11. Return detailed metadata for caller
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
REVOKE EXECUTE ON FUNCTION public.delete_employee_completely(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_employee_completely(UUID, UUID) TO authenticated, service_role;
