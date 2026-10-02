-- Migration: 20260924010000_harden_security_advisors.sql
-- Description: Fix mutable search paths and restrict anonymous/public PostgREST RPC execution on sensitive database functions

-- ============================================================================
-- PART 1: FIX FUNCTION SEARCH PATH MUTABLE (0011_function_search_path_mutable)
-- ============================================================================

ALTER FUNCTION public.process_payroll_run(uuid, date, date, uuid) SET search_path = 'public';
ALTER FUNCTION public.update_global_employee_updated_at() SET search_path = 'public';
ALTER FUNCTION public.generate_global_employee_verification_link(uuid) SET search_path = 'public';
ALTER FUNCTION public.on_employee_created_initialize_leaves() SET search_path = 'public';
ALTER FUNCTION public.sync_leave_balances_on_request_change() SET search_path = 'public';
ALTER FUNCTION public.initialize_employee_leave_balances(uuid) SET search_path = 'public';
ALTER FUNCTION public.calculate_geofence_distance(double precision, double precision, double precision, double precision) SET search_path = 'public';
ALTER FUNCTION public.evaluate_workflow_condition(jsonb, jsonb) SET search_path = 'public';
ALTER FUNCTION public.verify_attendance_geofence() SET search_path = 'public';
ALTER FUNCTION public.interpolate_workflow_template(text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.process_workflow_trigger(text, uuid, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.handle_workflow_trigger_by_db() SET search_path = 'public';
ALTER FUNCTION public.calculate_attendance_metrics() SET search_path = 'public';
ALTER FUNCTION public.validate_offer_variables() SET search_path = 'public';
ALTER FUNCTION public.process_year_end_leave_rollover(uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.verify_leave_request_safeguards() SET search_path = 'public';
ALTER FUNCTION public.process_auto_clock_outs(uuid) SET search_path = 'public';
ALTER FUNCTION public.check_and_process_absconding(uuid) SET search_path = 'public';
ALTER FUNCTION public.add_global_employee_feedback(uuid, text, text, text, numeric, text) SET search_path = 'public';
ALTER FUNCTION public.create_public_booking(text, text, uuid, text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, text) SET search_path = 'public';
ALTER FUNCTION public.cancel_public_booking(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.get_public_booking_page(text, text) SET search_path = 'public';
ALTER FUNCTION public.search_global_employees(text) SET search_path = 'public';

-- ============================================================================
-- PART 2: RESTRICT PUBLIC (ANON) EXECUTION ON SENSITIVE SECURITY DEFINER FUNCTIONS
-- (0028_anon_security_definer_function_executable)
-- ============================================================================

-- 1. BYOS Credentials & Config Management
REVOKE EXECUTE ON FUNCTION public.byos_encrypt_key(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.byos_encrypt_key(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.byos_decrypt_key(bytea) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.byos_decrypt_key(bytea) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_byos_connection(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_byos_connection(uuid) TO authenticated, service_role;

-- 2. Sensitive Employee & Admin Operations
REVOKE EXECUTE ON FUNCTION public.delete_employee_completely(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_employee_completely(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_payroll_run(uuid, date, date, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_payroll_run(uuid, date, date, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_global_employee_verification_link(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_global_employee_verification_link(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_global_employees(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_global_employees(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.add_global_employee_feedback(uuid, text, text, text, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_global_employee_feedback(uuid, text, text, text, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.add_global_employee_structured_attestation(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_global_employee_structured_attestation(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, text, text) TO authenticated, service_role;

-- 3. Storage Integration Management
REVOKE EXECUTE ON FUNCTION public.save_company_storage_integration(uuid, text, text, text, text, text, text, text, jsonb, text, timestamp with time zone, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_company_storage_integration(uuid, text, text, text, text, text, text, text, jsonb, text, timestamp with time zone, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_company_storage_integration(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_company_storage_integration(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.disconnect_company_storage(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.disconnect_company_storage(uuid) TO authenticated, service_role;

-- 4. Chat System Operations
REVOKE EXECUTE ON FUNCTION public.chat_upsert_presence(uuid, uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_upsert_presence(uuid, uuid, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_chat_group(text, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_chat_group(text, uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_or_get_dm(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_or_get_dm(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_insert_chat_participant(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_insert_chat_participant(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_user_left_chat(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_user_left_chat(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_chat_group_admin(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_chat_group_admin(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated, service_role;

-- 5. Attendance & Leave Execution
REVOKE EXECUTE ON FUNCTION public.calculate_attendance_metrics() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.calculate_attendance_metrics() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_and_process_absconding(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_and_process_absconding(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_auto_clock_outs(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_auto_clock_outs(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_year_end_leave_rollover(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_year_end_leave_rollover(uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.initialize_employee_leave_balances(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.initialize_employee_leave_balances(uuid) TO authenticated, service_role;

-- 6. Hierarchy, Auth, and Audit Logs
REVOKE EXECUTE ON FUNCTION public.can_view_employee_login_logs(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_employee_login_logs(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_hierarchy_login_logs(uuid, text, text, text, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_hierarchy_login_logs(uuid, text, text, text, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_hierarchy_subordinates(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_hierarchy_subordinates(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_subordinate_employee_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_subordinate_employee_ids(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_login_log(text, text, text, text, text, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_login_log(text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- 7. Role Checking and AI Candidate Matching
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_hr_manager() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_hr_manager() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.match_candidates(vector, double precision, integer, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_candidates(vector, double precision, integer, uuid) TO authenticated, service_role;

-- 8. Trigger Functions (Revoked from anon and authenticated; restricted to service_role)
REVOKE EXECUTE ON FUNCTION public.chat_update_conversation_timestamp() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.chat_update_conversation_timestamp() TO service_role;

REVOKE EXECUTE ON FUNCTION public.on_employee_created_initialize_leaves() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.on_employee_created_initialize_leaves() TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_leave_balances_on_request_change() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.sync_leave_balances_on_request_change() TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_offer_variables() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.validate_offer_variables() TO service_role;

REVOKE EXECUTE ON FUNCTION public.verify_attendance_geofence() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_attendance_geofence() TO service_role;

REVOKE EXECUTE ON FUNCTION public.verify_leave_request_safeguards() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_leave_request_safeguards() TO service_role;

-- ============================================================================
-- PART 3: CONFIRM INTENTIONAL PUBLIC (ANON) FLOWS
-- ============================================================================
-- The following functions are intentionally callable by the anonymous role for public workflows:
-- - Public Booking: create_public_booking, cancel_public_booking, get_public_booking_page
-- - Candidate Offer Portal: get_offer_details_by_token, get_offer_by_token, generate_offer_otp_by_token, verify_and_sign_offer_by_token, sign_offer_by_token
-- - Candidate Self-Verification & Passport: get_employee_by_public_id, submit_global_employee_self_verification, file_global_employee_dispute, request_global_employee_consent

GRANT EXECUTE ON FUNCTION public.create_public_booking(text, text, uuid, text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_public_booking(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_booking_page(text, text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_offer_details_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_offer_otp_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_and_sign_offer_by_token(text, text, jsonb, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_offer_by_token(text, jsonb) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_employee_by_public_id(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_global_employee_self_verification(text, text, text, text, text, text, text, text, text, text, text[], jsonb, text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.file_global_employee_dispute(uuid, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_global_employee_consent(uuid, text, text, text, text) TO anon, authenticated, service_role;
