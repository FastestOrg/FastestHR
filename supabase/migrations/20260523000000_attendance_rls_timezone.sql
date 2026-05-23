-- PostgreSQL Migration: Tighten Attendance Unique Constraints & Secure Employee Insert RLS Policies

-- 1. Safely deduplicate any existing attendance records before creating unique constraint
-- Keeps the earliest punch (min created_at) for any employee-date pairing
DELETE FROM public.attendance a
WHERE a.id NOT IN (
    SELECT DISTINCT ON (employee_id, date) id
    FROM public.attendance
    ORDER BY employee_id, date, created_at ASC
);

-- 2. Enforce atomic single-punch-per-day database constraint
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS unique_employee_attendance_date;

ALTER TABLE public.attendance 
ADD CONSTRAINT unique_employee_attendance_date UNIQUE (employee_id, date);

-- 3. Restrict Attendance Insertion RLS: Prevent clocking in on behalf of others
DROP POLICY IF EXISTS "Employees can insert own attendance" ON "public"."attendance";

CREATE POLICY "Employees can insert own attendance" ON "public"."attendance" 
FOR INSERT TO "authenticated" 
WITH CHECK (
    "company_id" = "public"."get_user_company_id"() 
    AND "employee_id" = "public"."get_user_employee_id"()
);

-- 4. Restrict Leave Requests Insertion RLS: Prevent requesting leave on behalf of others
DROP POLICY IF EXISTS "Employees can create leave requests" ON "public"."leave_requests";

CREATE POLICY "Employees can create leave requests" ON "public"."leave_requests" 
FOR INSERT TO "authenticated" 
WITH CHECK (
    "company_id" = "public"."get_user_company_id"() 
    AND "employee_id" = "public"."get_user_employee_id"()
);
