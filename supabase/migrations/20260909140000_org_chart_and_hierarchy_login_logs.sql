-- ==============================================================================
-- MIGRATION: Organisational Chart Hierarchy & Hierarchy-Based Login Logs
-- ==============================================================================

-- 1. Fix any self-referencing rows in employees table
UPDATE public.employees
SET reporting_manager_id = NULL
WHERE reporting_manager_id = id;

-- 2. Add safety constraint to prevent self-reporting cycles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_no_self_reporting'
  ) THEN
    ALTER TABLE public.employees 
      ADD CONSTRAINT chk_no_self_reporting 
      CHECK (reporting_manager_id IS NULL OR reporting_manager_id <> id);
  END IF;
END $$;

-- 3. Create employee_login_logs table
CREATE TABLE IF NOT EXISTS public.employee_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT DEFAULT 'desktop',
  browser TEXT,
  os TEXT,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  login_method TEXT DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_login_logs_company_created 
  ON public.employee_login_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_login_logs_employee_created 
  ON public.employee_login_logs(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_login_logs_user_created 
  ON public.employee_login_logs(user_id, created_at DESC);

-- 4. Recursive function to get all subordinate employee IDs for a given manager employee ID
CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(p_employee_id UUID)
RETURNS TABLE (
  subordinate_id UUID,
  depth INT,
  path UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    -- Anchor: direct reports
    SELECT
      e.id AS subordinate_id,
      1 AS depth,
      ARRAY[e.id] AS path
    FROM public.employees e
    WHERE e.reporting_manager_id = p_employee_id
      AND e.id <> p_employee_id
      AND e.deleted_at IS NULL

    UNION ALL

    -- Recursive step: indirect reports
    SELECT
      e.id AS subordinate_id,
      s.depth + 1 AS depth,
      s.path || e.id AS path
    FROM public.employees e
    JOIN subordinates s ON e.reporting_manager_id = s.subordinate_id
    WHERE e.deleted_at IS NULL
      AND NOT (e.id = ANY(s.path)) -- Cycle prevention
  )
  SELECT s.subordinate_id, s.depth, s.path FROM subordinates s;
END;
$$;

-- 5. Helper function to check if caller can view target employee's login logs
CREATE OR REPLACE FUNCTION public.can_view_employee_login_logs(p_target_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_target_company_id UUID;
  v_caller_emp_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get caller profile info
  SELECT platform_role, company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles
  WHERE id = v_user_id;

  -- Super admin has access to all logs
  IF v_caller_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- If target employee is null, check by caller company
  IF p_target_employee_id IS NULL THEN
    RETURN v_caller_role = 'company_admin';
  END IF;

  -- Get target company
  SELECT company_id INTO v_target_company_id
  FROM public.employees
  WHERE id = p_target_employee_id;

  -- Must belong to the same company
  IF v_caller_company_id IS NULL OR v_caller_company_id <> v_target_company_id THEN
    RETURN FALSE;
  END IF;

  -- Company admin has full access to company logs
  IF v_caller_role = 'company_admin' THEN
    RETURN TRUE;
  END IF;

  -- Get caller's employee record
  SELECT id INTO v_caller_emp_id
  FROM public.employees
  WHERE user_id = v_user_id AND company_id = v_caller_company_id AND deleted_at IS NULL
  LIMIT 1;

  -- Target is self
  IF v_caller_emp_id IS NOT NULL AND v_caller_emp_id = p_target_employee_id THEN
    RETURN TRUE;
  END IF;

  -- Target is subordinate of caller
  IF v_caller_emp_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.get_subordinate_employee_ids(v_caller_emp_id)
    WHERE subordinate_id = p_target_employee_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 6. Enable Row Level Security on employee_login_logs
ALTER TABLE public.employee_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_login_logs_select" ON public.employee_login_logs;
CREATE POLICY "employee_login_logs_select"
  ON public.employee_login_logs
  FOR SELECT
  TO authenticated
  USING (public.can_view_employee_login_logs(employee_id));

DROP POLICY IF EXISTS "employee_login_logs_insert" ON public.employee_login_logs;
CREATE POLICY "employee_login_logs_insert"
  ON public.employee_login_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- 7. Safe RPC to record login event
CREATE OR REPLACE FUNCTION public.record_login_log(
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'desktop',
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_login_method TEXT DEFAULT 'password'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_employee_id UUID;
  v_log_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find user profile and company
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No company associated with user');
  END IF;

  -- Find corresponding employee
  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE user_id = v_user_id AND company_id = v_company_id AND deleted_at IS NULL
  LIMIT 1;

  -- Insert log entry
  INSERT INTO public.employee_login_logs (
    company_id,
    employee_id,
    user_id,
    ip_address,
    user_agent,
    device_type,
    browser,
    os,
    city,
    country,
    status,
    login_method,
    created_at
  ) VALUES (
    v_company_id,
    v_employee_id,
    v_user_id,
    p_ip_address,
    p_user_agent,
    COALESCE(p_device_type, 'desktop'),
    p_browser,
    p_os,
    p_city,
    p_country,
    COALESCE(p_status, 'success'),
    COALESCE(p_login_method, 'password'),
    now()
  )
  RETURNING id INTO v_log_id;

  -- Also update last_login_at in profiles
  UPDATE public.profiles
  SET last_login_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$;

-- 8. High performance RPC to retrieve hierarchy login logs with filtering and relative depth
CREATE OR REPLACE FUNCTION public.get_hierarchy_login_logs(
  p_filter_employee_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  employee_id UUID,
  first_name TEXT,
  last_name TEXT,
  employee_code TEXT,
  avatar_url TEXT,
  work_email TEXT,
  designation_title TEXT,
  department_name TEXT,
  manager_name TEXT,
  hierarchy_depth INT,
  hierarchy_relation TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  city TEXT,
  country TEXT,
  status TEXT,
  login_method TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_caller_emp_id UUID;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get caller profile info with explicit table qualification
  SELECT p.platform_role, p.company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_caller_role = 'super_admin' OR v_caller_role = 'company_admin' THEN
    v_is_admin := TRUE;
  END IF;

  -- Get caller's employee ID
  SELECT emp.id INTO v_caller_emp_id
  FROM public.employees emp
  WHERE emp.user_id = v_user_id AND emp.company_id = v_caller_company_id AND emp.deleted_at IS NULL
  LIMIT 1;

  RETURN QUERY
  WITH accessible_scope AS (
    -- Admins can see all employees in company
    SELECT
      emp_scope.id AS target_emp_id,
      CASE
        WHEN emp_scope.id = v_caller_emp_id THEN 0
        ELSE 1
      END AS rel_depth,
      CASE
        WHEN emp_scope.id = v_caller_emp_id THEN 'Self'::TEXT
        ELSE 'Direct / Downline'::TEXT
      END AS rel_label
    FROM public.employees emp_scope
    WHERE v_is_admin = TRUE
      AND emp_scope.company_id = v_caller_company_id
      AND emp_scope.deleted_at IS NULL

    UNION ALL

    -- If not admin, can see self
    SELECT
      v_caller_emp_id AS target_emp_id,
      0 AS rel_depth,
      'Self'::TEXT AS rel_label
    WHERE v_is_admin = FALSE AND v_caller_emp_id IS NOT NULL

    UNION ALL

    -- If not admin, can see recursive subordinates
    SELECT
      sub.subordinate_id AS target_emp_id,
      sub.depth AS rel_depth,
      CASE
        WHEN sub.depth = 1 THEN 'Direct Report'::TEXT
        ELSE ('Level ' || sub.depth::TEXT || ' Subordinate')::TEXT
      END AS rel_label
    FROM public.get_subordinate_employee_ids(v_caller_emp_id) sub
    WHERE v_is_admin = FALSE
  ),
  filtered_logs AS (
    SELECT
      l.id AS out_id,
      l.created_at AS out_created_at,
      l.employee_id AS out_employee_id,
      e.first_name AS out_first_name,
      e.last_name AS out_last_name,
      e.employee_code AS out_employee_code,
      e.avatar_url AS out_avatar_url,
      e.work_email AS out_work_email,
      COALESCE(d.title, 'Team Member') AS out_designation_title,
      COALESCE(dept.name, 'General') AS out_department_name,
      COALESCE(m.first_name || ' ' || m.last_name, 'None (Top Level)') AS out_manager_name,
      scope.rel_depth AS out_hierarchy_depth,
      scope.rel_label AS out_hierarchy_relation,
      l.ip_address AS out_ip_address,
      l.user_agent AS out_user_agent,
      l.device_type AS out_device_type,
      l.browser AS out_browser,
      l.os AS out_os,
      l.city AS out_city,
      l.country AS out_country,
      l.status AS out_status,
      l.login_method AS out_login_method,
      COUNT(*) OVER() AS out_total_count
    FROM public.employee_login_logs l
    JOIN accessible_scope scope ON l.employee_id = scope.target_emp_id
    JOIN public.employees e ON l.employee_id = e.id
    LEFT JOIN public.designations d ON e.designation_id = d.id
    LEFT JOIN public.departments dept ON e.department_id = dept.id
    LEFT JOIN public.employees m ON e.reporting_manager_id = m.id
    WHERE (p_filter_employee_id IS NULL OR l.employee_id = p_filter_employee_id)
      AND (p_status IS NULL OR l.status = p_status)
      AND (p_device_type IS NULL OR l.device_type = p_device_type)
      AND (
        p_search IS NULL OR
        e.first_name ILIKE '%' || p_search || '%' OR
        e.last_name ILIKE '%' || p_search || '%' OR
        e.work_email ILIKE '%' || p_search || '%' OR
        e.employee_code ILIKE '%' || p_search || '%' OR
        l.ip_address ILIKE '%' || p_search || '%' OR
        l.city ILIKE '%' || p_search || '%'
      )
    ORDER BY l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    fl.out_id,
    fl.out_created_at,
    fl.out_employee_id,
    fl.out_first_name,
    fl.out_last_name,
    fl.out_employee_code,
    fl.out_avatar_url,
    fl.out_work_email,
    fl.out_designation_title,
    fl.out_department_name,
    fl.out_manager_name,
    fl.out_hierarchy_depth,
    fl.out_hierarchy_relation,
    fl.out_ip_address,
    fl.out_user_agent,
    fl.out_device_type,
    fl.out_browser,
    fl.out_os,
    fl.out_city,
    fl.out_country,
    fl.out_status,
    fl.out_login_method,
    fl.out_total_count
  FROM filtered_logs fl;
END;
$$;

-- 9. RPC to get hierarchy team members (all direct & indirect reports under the caller)
CREATE OR REPLACE FUNCTION public.get_hierarchy_subordinates(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  employee_code TEXT,
  avatar_url TEXT,
  work_email TEXT,
  designation_title TEXT,
  department_name TEXT,
  reporting_manager_id UUID,
  manager_name TEXT,
  depth INT,
  relation_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_caller_role platform_role;
  v_caller_company_id UUID;
  v_caller_emp_id UUID;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.platform_role, p.company_id INTO v_caller_role, v_caller_company_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_caller_role = 'super_admin' OR v_caller_role = 'company_admin' THEN
    v_is_admin := TRUE;
  END IF;

  SELECT emp.id INTO v_caller_emp_id
  FROM public.employees emp
  WHERE emp.user_id = v_user_id AND emp.company_id = v_caller_company_id AND emp.deleted_at IS NULL
  LIMIT 1;

  RETURN QUERY
  WITH scope AS (
    -- If admin, return all employees in company
    SELECT
      emp_scope.id AS emp_id,
      CASE WHEN emp_scope.id = v_caller_emp_id THEN 0 ELSE 1 END AS out_depth,
      CASE WHEN emp_scope.id = v_caller_emp_id THEN 'Self'::TEXT ELSE 'All Team'::TEXT END AS out_relation_label
    FROM public.employees emp_scope
    WHERE v_is_admin = TRUE
      AND emp_scope.company_id = v_caller_company_id
      AND emp_scope.deleted_at IS NULL

    UNION ALL

    -- If not admin, return self
    SELECT
      v_caller_emp_id AS emp_id,
      0 AS out_depth,
      'Self'::TEXT AS out_relation_label
    WHERE v_is_admin = FALSE AND v_caller_emp_id IS NOT NULL

    UNION ALL

    -- If not admin, return recursive subordinates
    SELECT
      sub.subordinate_id AS emp_id,
      sub.depth AS out_depth,
      CASE
        WHEN sub.depth = 1 THEN 'Direct Report'::TEXT
        ELSE ('Level ' || sub.depth::TEXT || ' Subordinate')::TEXT
      END AS out_relation_label
    FROM public.get_subordinate_employee_ids(v_caller_emp_id) sub
    WHERE v_is_admin = FALSE
  )
  SELECT
    e.id,
    e.first_name,
    e.last_name,
    e.employee_code,
    e.avatar_url,
    e.work_email,
    COALESCE(d.title, 'Team Member') AS designation_title,
    COALESCE(dept.name, 'General') AS department_name,
    e.reporting_manager_id,
    COALESCE(m.first_name || ' ' || m.last_name, 'None (Top Level)') AS manager_name,
    s.out_depth AS depth,
    s.out_relation_label AS relation_label
  FROM scope s
  JOIN public.employees e ON s.emp_id = e.id
  LEFT JOIN public.designations d ON e.designation_id = d.id
  LEFT JOIN public.departments dept ON e.department_id = dept.id
  LEFT JOIN public.employees m ON e.reporting_manager_id = m.id
  ORDER BY s.out_depth ASC, e.first_name ASC;
END;
$$;
