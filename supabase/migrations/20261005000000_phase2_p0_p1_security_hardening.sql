-- Migration: 20261005000000_phase2_p0_p1_security_hardening.sql
-- Description: Hardens Leave Self-Approval, Attendance Spoofing & Regularization Unblock,
-- Candidate Offers Compensation Privacy, Confidential Employee Exits, HelpDesk POSH Isolation,
-- and Survey Responses RLS, while preserving public access for ID verification, public bookings,
-- job applications, and candidate offer letter signing.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEAVE REQUESTS: Prevent Self-Approval & Enforce Cancellation Only for Employees
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Employees can update own leave requests" ON public.leave_requests
  USING (
    employee_id = public.get_user_employee_id()
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND status = 'cancelled'
  );

CREATE OR REPLACE FUNCTION public.check_leave_approval_authority()
RETURNS TRIGGER AS $$
DECLARE
  v_role platform_role;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    SELECT platform_role INTO v_role
    FROM public.profiles
    WHERE id = (SELECT auth.uid());

    IF v_role NOT IN ('super_admin', 'company_admin', 'hr_manager') THEN
      RAISE EXCEPTION 'Security Violation: Only HR managers and company administrators can approve or reject leave requests';
    END IF;

    IF NEW.employee_id = public.get_user_employee_id() AND v_role NOT IN ('super_admin') THEN
      RAISE EXCEPTION 'Security Violation: Employees and managers cannot self-approve their own leave requests';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE TRIGGER trg_prevent_leave_self_approval
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.check_leave_approval_authority();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATTENDANCE: Prevent Employee Spoofing & Unblock Past-Date Regularization
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Employees can insert own attendance" ON public.attendance
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      employee_id = public.get_user_employee_id()
      OR public.is_admin_or_hr()
      OR public.is_super_admin()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_attendance_tampering()
RETURNS TRIGGER AS $$
DECLARE
  v_role platform_role;
BEGIN
  SELECT platform_role INTO v_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  IF v_role IN ('super_admin', 'company_admin', 'hr_manager') THEN
    RETURN NEW;
  END IF;

  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify employee_id on attendance records';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify company_id on attendance records';
  END IF;

  IF NEW.date IS DISTINCT FROM OLD.date THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot modify the attendance date';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot directly modify attendance status';
  END IF;

  IF NEW.overtime_hours IS DISTINCT FROM OLD.overtime_hours THEN
    RAISE EXCEPTION 'Action Forbidden: You cannot directly modify overtime hours';
  END IF;

  IF OLD.date < CURRENT_DATE THEN
    IF NEW.clock_in IS DISTINCT FROM OLD.clock_in 
       OR NEW.clock_out IS DISTINCT FROM OLD.clock_out 
       OR NEW.total_hours IS DISTINCT FROM OLD.total_hours THEN
      RAISE EXCEPTION 'Action Forbidden: You cannot modify historical attendance clock times directly. Please submit an attendance regularization request.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CANDIDATE OFFERS: Restrict Internal Access to HR/Admins
-- (Public candidate signing is preserved via SECURITY DEFINER get_offer_details_by_token)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Enable read for team members" ON public.candidate_offers
  USING (
    company_id = public.get_user_company_id()
    AND (public.is_admin_or_hr() OR public.is_super_admin())
  );

ALTER POLICY "Enable insert for team members" ON public.candidate_offers
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (public.is_admin_or_hr() OR public.is_super_admin())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EMPLOYEE EXITS: Confidential Exit Interview & FnF Settlement Privacy
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Company members can view employee exits" ON public.employee_exits
  USING (
    company_id = public.get_user_company_id()
    AND (
      employee_id = public.get_user_employee_id()
      OR public.is_admin_or_hr()
      OR public.is_super_admin()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPDESK TICKETS & COMMENTS: POSH & Grievance Ticket Isolation
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Company members can view tickets" ON public.tickets
  USING (
    company_id = public.get_user_company_id()
    AND (
      raised_by = public.get_user_employee_id()
      OR assigned_to = auth.uid()
      OR public.is_admin_or_hr()
      OR public.is_super_admin()
    )
  );

ALTER POLICY "Company members can view ticket comments" ON public.ticket_comments
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.company_id = public.get_user_company_id()
        AND (
          t.raised_by = public.get_user_employee_id()
          OR t.assigned_to = auth.uid()
          OR public.is_admin_or_hr()
          OR public.is_super_admin()
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SURVEY RESPONSES: De-anonymization & Full Table Takeover Prevention
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "Company members can manage survey responses" ON public.survey_responses
  USING (
    (respondent_id = public.get_user_employee_id() OR public.is_admin_or_hr() OR public.is_super_admin())
    AND (EXISTS (SELECT 1 FROM surveys s WHERE s.id = survey_responses.survey_id AND s.company_id = public.get_user_company_id()))
  )
  WITH CHECK (
    (respondent_id = public.get_user_employee_id() OR public.is_admin_or_hr() OR public.is_super_admin())
    AND (EXISTS (SELECT 1 FROM surveys s WHERE s.id = survey_responses.survey_id AND s.company_id = public.get_user_company_id()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RE-VERIFY & GUARANTEE PUBLIC ACCESS PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_public_booking_page(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_by_public_id(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_offer_details_by_token(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_and_sign_offer_by_token(TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_offer_otp_by_token(TEXT) TO anon, authenticated, service_role;
