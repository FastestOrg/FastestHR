-- Migration: 20261026000000_optimize_rls_helpers_and_indexes.sql
-- Description:
-- 1. Optimizes RLS helper functions (get_user_company_id, is_admin_or_hr, is_super_admin, get_user_employee_id)
--    to read metadata directly from JWT in-memory first, avoiding 200,000+ sequential scans on public.profiles.
-- 2. Adds targeted index on public.notifications (user_id, created_at DESC) for notification dropdown sorting.
-- 3. Adds partial index on public.attendance (employee_id, clock_in DESC) WHERE clock_out IS NULL for active shift detection.

-- 1. Helper function: get_user_company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'company_id', '')::uuid,
    (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
$$;

-- 2. Helper function: is_admin_or_hr
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN auth.jwt() -> 'user_metadata' ->> 'platform_role' IN ('company_admin', 'hr_manager', 'super_admin') THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) 
        AND platform_role IN ('company_admin', 'hr_manager', 'super_admin')
    )
  END;
$$;

-- 3. Helper function: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN auth.jwt() -> 'user_metadata' ->> 'platform_role' = 'super_admin' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) 
        AND platform_role = 'super_admin'
    )
  END;
$$;

-- 4. Helper function: get_user_employee_id
CREATE OR REPLACE FUNCTION public.get_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL LIMIT 1;
$$;

-- 5. Notifications index for reverse chronological ordering by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications (user_id, created_at DESC);

-- 6. Attendance partial index for open check-ins
CREATE INDEX IF NOT EXISTS idx_attendance_open_checkins 
ON public.attendance (employee_id, clock_in DESC) 
WHERE (clock_out IS NULL);
