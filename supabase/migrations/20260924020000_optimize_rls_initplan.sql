-- Migration: 20260924020000_optimize_rls_initplan.sql
-- Description: Optimize 70 RLS policies to eliminate per-row re-evaluation of auth.uid() and auth.role() (0003_auth_rls_initplan)
-- Wrapping auth functions in (select auth.uid()) allows PostgreSQL to evaluate them once as an InitPlan instead of per-row SubPlans.

-- Table: public.profiles | Policy: "Users can update their own profile"
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((id = (select auth.uid())))
;

-- Table: public.profiles | Policy: "Users can insert their own profile"
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((id = (select auth.uid())))
;

-- Table: public.global_employee | Policy: "global_employee_auth_insert"
DROP POLICY IF EXISTS "global_employee_auth_insert" ON public.global_employee;
CREATE POLICY "global_employee_auth_insert"
  ON public.global_employee
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['super_admin'::platform_role, 'company_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.global_employee | Policy: "global_employee_auth_update"
DROP POLICY IF EXISTS "global_employee_auth_update" ON public.global_employee;
CREATE POLICY "global_employee_auth_update"
  ON public.global_employee
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['super_admin'::platform_role, 'company_admin'::platform_role, 'hr_manager'::platform_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['super_admin'::platform_role, 'company_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.employees | Policy: "Employees can update their own record"
DROP POLICY IF EXISTS "Employees can update their own record" ON public.employees;
CREATE POLICY "Employees can update their own record"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
;

-- Table: public.company_storage_integrations | Policy: "company_storage_select_policy"
DROP POLICY IF EXISTS "company_storage_select_policy" ON public.company_storage_integrations;
CREATE POLICY "company_storage_select_policy"
  ON public.company_storage_integrations
  FOR SELECT
  TO authenticated
  USING (((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) OR is_super_admin()))
;

-- Table: public.company_storage_integrations | Policy: "company_storage_admin_manage_policy"
DROP POLICY IF EXISTS "company_storage_admin_manage_policy" ON public.company_storage_integrations;
CREATE POLICY "company_storage_admin_manage_policy"
  ON public.company_storage_integrations
  FOR ALL
  TO authenticated
  USING (((is_company_admin() AND (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))) OR is_super_admin()))
  WITH CHECK (((is_company_admin() AND (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))) OR is_super_admin()))
;

-- Table: public.user_meeting_settings | Policy: "Users can manage their own meeting settings"
DROP POLICY IF EXISTS "Users can manage their own meeting settings" ON public.user_meeting_settings;
CREATE POLICY "Users can manage their own meeting settings"
  ON public.user_meeting_settings
  FOR ALL
  TO authenticated
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.company_id = user_meeting_settings.company_id) AND (p.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role])))))))
  WITH CHECK ((user_id = (select auth.uid())))
;

-- Table: public.meeting_event_types | Policy: "Users can manage their own event types"
DROP POLICY IF EXISTS "Users can manage their own event types" ON public.meeting_event_types;
CREATE POLICY "Users can manage their own event types"
  ON public.meeting_event_types
  FOR ALL
  TO authenticated
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.company_id = meeting_event_types.company_id))))))
  WITH CHECK ((user_id = (select auth.uid())))
;

-- Table: public.leave_balances | Policy: "Employees can view own leave balances"
DROP POLICY IF EXISTS "Employees can view own leave balances" ON public.leave_balances;
CREATE POLICY "Employees can view own leave balances"
  ON public.leave_balances
  FOR SELECT
  TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = leave_balances.employee_id) AND ((e.user_id = (select auth.uid())) OR (e.company_id = get_user_company_id()))))) OR is_super_admin()))
;

-- Table: public.meeting_bookings | Policy: "Users can view and manage their meeting bookings"
DROP POLICY IF EXISTS "Users can view and manage their meeting bookings" ON public.meeting_bookings;
CREATE POLICY "Users can view and manage their meeting bookings"
  ON public.meeting_bookings
  FOR ALL
  TO authenticated
  USING (((host_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.company_id = meeting_bookings.company_id) AND (p.platform_role = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role])))))))
  WITH CHECK (((host_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.company_id = meeting_bookings.company_id) AND (p.platform_role = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role])))))))
;

-- Table: public.employee_login_logs | Policy: "employee_login_logs_insert"
DROP POLICY IF EXISTS "employee_login_logs_insert" ON public.employee_login_logs;
CREATE POLICY "employee_login_logs_insert"
  ON public.employee_login_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = (select auth.uid())) OR ((select auth.uid()) IS NOT NULL)))
;

-- Table: public.chat_conversations | Policy: "chat_conversations_select_participant"
DROP POLICY IF EXISTS "chat_conversations_select_participant" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_participant"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING ((is_chat_participant(id, (select auth.uid())) OR ((created_by = (select auth.uid())) AND (NOT has_user_left_chat(id, (select auth.uid()))))))
;

-- Table: public.notifications | Policy: "Users can view own notifications"
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())))
;

-- Table: public.notifications | Policy: "Users can update own notifications"
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
;

-- Table: public.byos_connections | Policy: "byos_connections_admin_all"
DROP POLICY IF EXISTS "byos_connections_admin_all" ON public.byos_connections;
CREATE POLICY "byos_connections_admin_all"
  ON public.byos_connections
  FOR ALL
  USING (((tenant_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.platform_role = 'company_admin'::platform_role) OR (profiles.platform_role = 'super_admin'::platform_role))))) OR (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'super_admin'::platform_role) OR ((select auth.role()) = 'service_role'::text)))
  WITH CHECK (((tenant_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.platform_role = 'company_admin'::platform_role) OR (profiles.platform_role = 'super_admin'::platform_role))))) OR (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'super_admin'::platform_role) OR ((select auth.role()) = 'service_role'::text)))
;

-- Table: public.byos_audit_log | Policy: "byos_audit_log_admin_select"
DROP POLICY IF EXISTS "byos_audit_log_admin_select" ON public.byos_audit_log;
CREATE POLICY "byos_audit_log_admin_select"
  ON public.byos_audit_log
  FOR SELECT
  USING (((tenant_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.platform_role = 'company_admin'::platform_role) OR (profiles.platform_role = 'super_admin'::platform_role))))) OR (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'super_admin'::platform_role) OR ((select auth.role()) = 'service_role'::text)))
;

-- Table: public.byos_audit_log | Policy: "byos_audit_log_insert"
DROP POLICY IF EXISTS "byos_audit_log_insert" ON public.byos_audit_log;
CREATE POLICY "byos_audit_log_insert"
  ON public.byos_audit_log
  FOR INSERT
  WITH CHECK ((((select auth.role()) = 'service_role'::text) OR (tenant_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))))
;

-- Table: public.offer_templates | Policy: "Enable insert for team members"
DROP POLICY IF EXISTS "Enable insert for team members" ON public.offer_templates;
CREATE POLICY "Enable insert for team members"
  ON public.offer_templates
  FOR INSERT
  TO authenticated
  WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.offer_templates | Policy: "Enable update for team members"
DROP POLICY IF EXISTS "Enable update for team members" ON public.offer_templates;
CREATE POLICY "Enable update for team members"
  ON public.offer_templates
  FOR UPDATE
  TO authenticated
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.offer_templates | Policy: "Enable delete for team members"
DROP POLICY IF EXISTS "Enable delete for team members" ON public.offer_templates;
CREATE POLICY "Enable delete for team members"
  ON public.offer_templates
  FOR DELETE
  TO authenticated
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.candidate_offers | Policy: "Enable read for team members"
DROP POLICY IF EXISTS "Enable read for team members" ON public.candidate_offers;
CREATE POLICY "Enable read for team members"
  ON public.candidate_offers
  FOR SELECT
  TO authenticated
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.candidate_offers | Policy: "Enable insert for team members"
DROP POLICY IF EXISTS "Enable insert for team members" ON public.candidate_offers;
CREATE POLICY "Enable insert for team members"
  ON public.candidate_offers
  FOR INSERT
  TO authenticated
  WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.offer_templates | Policy: "Enable read for team members"
DROP POLICY IF EXISTS "Enable read for team members" ON public.offer_templates;
CREATE POLICY "Enable read for team members"
  ON public.offer_templates
  FOR SELECT
  TO authenticated
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.company_documents | Policy: "Users can read company documents"
DROP POLICY IF EXISTS "Users can read company documents" ON public.company_documents;
CREATE POLICY "Users can read company documents"
  ON public.company_documents
  FOR SELECT
  USING ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.company_documents | Policy: "Admins can insert company documents"
DROP POLICY IF EXISTS "Admins can insert company documents" ON public.company_documents;
CREATE POLICY "Admins can insert company documents"
  ON public.company_documents
  FOR INSERT
  WITH CHECK (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role])))))))
;

-- Table: public.company_documents | Policy: "Admins can update company documents"
DROP POLICY IF EXISTS "Admins can update company documents" ON public.company_documents;
CREATE POLICY "Admins can update company documents"
  ON public.company_documents
  FOR UPDATE
  USING (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role])))))))
;

-- Table: public.company_documents | Policy: "Admins can delete company documents"
DROP POLICY IF EXISTS "Admins can delete company documents" ON public.company_documents;
CREATE POLICY "Admins can delete company documents"
  ON public.company_documents
  FOR DELETE
  USING (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role])))))))
;

-- Table: public.senddesk_templates | Policy: "Users can view own company templates"
DROP POLICY IF EXISTS "Users can view own company templates" ON public.senddesk_templates;
CREATE POLICY "Users can view own company templates"
  ON public.senddesk_templates
  FOR SELECT
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_templates | Policy: "Users can insert own company templates"
DROP POLICY IF EXISTS "Users can insert own company templates" ON public.senddesk_templates;
CREATE POLICY "Users can insert own company templates"
  ON public.senddesk_templates
  FOR INSERT
  WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_templates | Policy: "Users can update own company templates"
DROP POLICY IF EXISTS "Users can update own company templates" ON public.senddesk_templates;
CREATE POLICY "Users can update own company templates"
  ON public.senddesk_templates
  FOR UPDATE
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_templates | Policy: "Users can delete own company templates"
DROP POLICY IF EXISTS "Users can delete own company templates" ON public.senddesk_templates;
CREATE POLICY "Users can delete own company templates"
  ON public.senddesk_templates
  FOR DELETE
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_documents | Policy: "Users can view own company documents"
DROP POLICY IF EXISTS "Users can view own company documents" ON public.senddesk_documents;
CREATE POLICY "Users can view own company documents"
  ON public.senddesk_documents
  FOR SELECT
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_documents | Policy: "Users can insert own company documents"
DROP POLICY IF EXISTS "Users can insert own company documents" ON public.senddesk_documents;
CREATE POLICY "Users can insert own company documents"
  ON public.senddesk_documents
  FOR INSERT
  WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_documents | Policy: "Users can update own company documents"
DROP POLICY IF EXISTS "Users can update own company documents" ON public.senddesk_documents;
CREATE POLICY "Users can update own company documents"
  ON public.senddesk_documents
  FOR UPDATE
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_documents | Policy: "Users can delete own company documents"
DROP POLICY IF EXISTS "Users can delete own company documents" ON public.senddesk_documents;
CREATE POLICY "Users can delete own company documents"
  ON public.senddesk_documents
  FOR DELETE
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_emails | Policy: "Users can view own company emails"
DROP POLICY IF EXISTS "Users can view own company emails" ON public.senddesk_emails;
CREATE POLICY "Users can view own company emails"
  ON public.senddesk_emails
  FOR SELECT
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_emails | Policy: "Users can insert own company emails"
DROP POLICY IF EXISTS "Users can insert own company emails" ON public.senddesk_emails;
CREATE POLICY "Users can insert own company emails"
  ON public.senddesk_emails
  FOR INSERT
  WITH CHECK ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.senddesk_emails | Policy: "Users can update own company emails"
DROP POLICY IF EXISTS "Users can update own company emails" ON public.senddesk_emails;
CREATE POLICY "Users can update own company emails"
  ON public.senddesk_emails
  FOR UPDATE
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.interviews | Policy: "candidate_reads_own_interviews"
DROP POLICY IF EXISTS "candidate_reads_own_interviews" ON public.interviews;
CREATE POLICY "candidate_reads_own_interviews"
  ON public.interviews
  FOR SELECT
  TO authenticated
  USING ((candidate_id IN ( SELECT candidates.id
   FROM candidates
  WHERE (candidates.candidate_user_id = (select auth.uid())))))
;

-- Table: public.task_time_logs | Policy: "Users can manage their own time logs"
DROP POLICY IF EXISTS "Users can manage their own time logs" ON public.task_time_logs;
CREATE POLICY "Users can manage their own time logs"
  ON public.task_time_logs
  FOR ALL
  USING ((user_id = (select auth.uid())))
;

-- Table: public.daily_reports | Policy: "Users can manage their own daily reports"
DROP POLICY IF EXISTS "Users can manage their own daily reports" ON public.daily_reports;
CREATE POLICY "Users can manage their own daily reports"
  ON public.daily_reports
  FOR ALL
  USING ((user_id = (select auth.uid())))
;

-- Table: public.recruitment_team_members | Policy: "company_members_can_read_team"
DROP POLICY IF EXISTS "company_members_can_read_team" ON public.recruitment_team_members;
CREATE POLICY "company_members_can_read_team"
  ON public.recruitment_team_members
  FOR SELECT
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.recruitment_team_members | Policy: "admins_can_manage_team"
DROP POLICY IF EXISTS "admins_can_manage_team" ON public.recruitment_team_members;
CREATE POLICY "admins_can_manage_team"
  ON public.recruitment_team_members
  FOR ALL
  USING (((( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role])) AND (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))))))
;

-- Table: public.candidates | Policy: "role_scoped_candidate_visibility"
DROP POLICY IF EXISTS "role_scoped_candidate_visibility" ON public.candidates;
CREATE POLICY "role_scoped_candidate_visibility"
  ON public.candidates
  FOR SELECT
  USING (((( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = ANY (ARRAY['super_admin'::platform_role, 'company_admin'::platform_role])) OR ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND ((( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'hr_manager'::platform_role) OR ((( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'recruiter'::platform_role) AND ((assigned_to = (select auth.uid())) OR (assigned_to IS NULL))) OR (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'user'::platform_role)))))
;

-- Table: public.candidates | Policy: "company_members_can_insert_candidates"
DROP POLICY IF EXISTS "company_members_can_insert_candidates" ON public.candidates;
CREATE POLICY "company_members_can_insert_candidates"
  ON public.candidates
  FOR INSERT
  WITH CHECK (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'recruiter'::platform_role, 'super_admin'::platform_role]))))
;

-- Table: public.onboarding_steps | Policy: "Users can view their company's onboarding steps"
DROP POLICY IF EXISTS "Users can view their company's onboarding steps" ON public.onboarding_steps;
CREATE POLICY "Users can view their company's onboarding steps"
  ON public.onboarding_steps
  FOR SELECT
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))
;

-- Table: public.candidates | Policy: "company_members_can_update_candidates"
DROP POLICY IF EXISTS "company_members_can_update_candidates" ON public.candidates;
CREATE POLICY "company_members_can_update_candidates"
  ON public.candidates
  FOR UPDATE
  USING (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND ((( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role])) OR (assigned_to = (select auth.uid())))))
;

-- Table: public.candidates | Policy: "admins_can_delete_candidates"
DROP POLICY IF EXISTS "admins_can_delete_candidates" ON public.candidates;
CREATE POLICY "admins_can_delete_candidates"
  ON public.candidates
  FOR DELETE
  USING (((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (( SELECT profiles.platform_role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role]))))
;

-- Table: public.ai_interviews | Policy: "Company members can view their AI interviews"
DROP POLICY IF EXISTS "Company members can view their AI interviews" ON public.ai_interviews;
CREATE POLICY "Company members can view their AI interviews"
  ON public.ai_interviews
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM jobs j
  WHERE ((j.id = ai_interviews.job_id) AND (j.company_id = ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = (select auth.uid()))))))))
;

-- Table: public.tasks | Policy: "Users can manage their own self-tasks or tasks assigned to them"
DROP POLICY IF EXISTS "Users can manage their own self-tasks or tasks assigned to them" ON public.tasks;
CREATE POLICY "Users can manage their own self-tasks or tasks assigned to them"
  ON public.tasks
  FOR ALL
  USING (((assigned_to = (select auth.uid())) OR is_company_admin() OR (get_user_platform_role() = 'hr_manager'::platform_role)))
;

-- Table: public.onboarding_steps | Policy: "Admins can manage onboarding steps"
DROP POLICY IF EXISTS "Admins can manage onboarding steps" ON public.onboarding_steps;
CREATE POLICY "Admins can manage onboarding steps"
  ON public.onboarding_steps
  FOR ALL
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.onboarding_progress | Policy: "Users can view their company's onboarding progress"
DROP POLICY IF EXISTS "Users can view their company's onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users can view their company's onboarding progress"
  ON public.onboarding_progress
  FOR SELECT
  USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.company_id IN ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = (select auth.uid())))))))
;

-- Table: public.onboarding_progress | Policy: "Admins can manage onboarding progress"
DROP POLICY IF EXISTS "Admins can manage onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Admins can manage onboarding progress"
  ON public.onboarding_progress
  FOR ALL
  USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.company_id IN ( SELECT profiles.company_id
           FROM profiles
          WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role]))))))))
;

-- Table: public.onboarding_automations | Policy: "Admins can manage onboarding automations"
DROP POLICY IF EXISTS "Admins can manage onboarding automations" ON public.onboarding_automations;
CREATE POLICY "Admins can manage onboarding automations"
  ON public.onboarding_automations
  FOR ALL
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'super_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.onboarding_document_requirements | Policy: "Users can view their own company requirements"
DROP POLICY IF EXISTS "Users can view their own company requirements" ON public.onboarding_document_requirements;
CREATE POLICY "Users can view their own company requirements"
  ON public.onboarding_document_requirements
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.company_id = onboarding_document_requirements.company_id)))))
;

-- Table: public.onboarding_document_requirements | Policy: "Admins can manage requirements"
DROP POLICY IF EXISTS "Admins can manage requirements" ON public.onboarding_document_requirements;
CREATE POLICY "Admins can manage requirements"
  ON public.onboarding_document_requirements
  FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.company_id = onboarding_document_requirements.company_id) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.onboarding_document_submissions | Policy: "Employees can view their own submissions"
DROP POLICY IF EXISTS "Employees can view their own submissions" ON public.onboarding_document_submissions;
CREATE POLICY "Employees can view their own submissions"
  ON public.onboarding_document_submissions
  FOR SELECT
  USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.user_id = (select auth.uid())))))
;

-- Table: public.onboarding_document_submissions | Policy: "Employees can insert their own submissions"
DROP POLICY IF EXISTS "Employees can insert their own submissions" ON public.onboarding_document_submissions;
CREATE POLICY "Employees can insert their own submissions"
  ON public.onboarding_document_submissions
  FOR INSERT
  WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.user_id = (select auth.uid())))))
;

-- Table: public.onboarding_document_submissions | Policy: "Admins can view all submissions for their company"
DROP POLICY IF EXISTS "Admins can view all submissions for their company" ON public.onboarding_document_submissions;
CREATE POLICY "Admins can view all submissions for their company"
  ON public.onboarding_document_submissions
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role])) AND (EXISTS ( SELECT 1
           FROM employees
          WHERE ((employees.id = onboarding_document_submissions.employee_id) AND (employees.company_id = profiles.company_id))))))))
;

-- Table: public.onboarding_document_submissions | Policy: "Admins can update submissions (e.g. status)"
DROP POLICY IF EXISTS "Admins can update submissions (e.g. status)" ON public.onboarding_document_submissions;
CREATE POLICY "Admins can update submissions (e.g. status)"
  ON public.onboarding_document_submissions
  FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role]))))))
;

-- Table: public.profiles | Policy: "Admins can update profiles in company"
DROP POLICY IF EXISTS "Admins can update profiles in company" ON public.profiles;
CREATE POLICY "Admins can update profiles in company"
  ON public.profiles
  FOR UPDATE
  USING (((company_id = get_user_company_id()) AND (( SELECT profiles_1.platform_role
   FROM profiles profiles_1
  WHERE (profiles_1.id = (select auth.uid()))) = ANY (ARRAY['company_admin'::platform_role, 'hr_manager'::platform_role, 'super_admin'::platform_role]))))
;

-- Table: public.chat_conversations | Policy: "chat_conversations_insert"
DROP POLICY IF EXISTS "chat_conversations_insert" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert"
  ON public.chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (((company_id = get_user_company_id()) AND (created_by = (select auth.uid()))))
;

-- Table: public.chat_participants | Policy: "chat_participants_update_self"
DROP POLICY IF EXISTS "chat_participants_update_self" ON public.chat_participants;
CREATE POLICY "chat_participants_update_self"
  ON public.chat_participants
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())))
;

-- Table: public.chat_presence | Policy: "chat_presence_insert"
DROP POLICY IF EXISTS "chat_presence_insert" ON public.chat_presence;
CREATE POLICY "chat_presence_insert"
  ON public.chat_presence
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (select auth.uid())))
;

-- Table: public.chat_presence | Policy: "chat_presence_update"
DROP POLICY IF EXISTS "chat_presence_update" ON public.chat_presence;
CREATE POLICY "chat_presence_update"
  ON public.chat_presence
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())))
;

-- Table: public.chat_participants | Policy: "chat_participants_select"
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
CREATE POLICY "chat_participants_select"
  ON public.chat_participants
  FOR SELECT
  TO authenticated
  USING (is_chat_participant(conversation_id, (select auth.uid())))
;

-- Table: public.chat_participants | Policy: "chat_participants_update_admin"
DROP POLICY IF EXISTS "chat_participants_update_admin" ON public.chat_participants;
CREATE POLICY "chat_participants_update_admin"
  ON public.chat_participants
  FOR UPDATE
  TO authenticated
  USING (is_chat_group_admin(conversation_id, (select auth.uid())))
;

-- Table: public.chat_messages | Policy: "chat_messages_select"
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (is_chat_participant(conversation_id, (select auth.uid())))
;

-- Table: public.chat_messages | Policy: "chat_messages_insert"
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND is_chat_participant(conversation_id, (select auth.uid()))))
;

