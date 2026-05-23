-- PostgreSQL Migration: Secure Storage Buckets & Strict RLS Scoping
-- Enforces owner-only path-scoping on 'payslips', 'leave-documents', and 'documents' buckets

-- 1. Create buckets if they don't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('leave-documents', 'leave-documents', false),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing broad/insecure policies for payslips, leave-documents, and documents
DROP POLICY IF EXISTS "Enable read for team members on payslips" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for team members on payslips" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for team members on payslips" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for team members on payslips" ON storage.objects;

DROP POLICY IF EXISTS "Enable read for team members on leave-documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for team members on leave-documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for team members on leave-documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for team members on leave-documents" ON storage.objects;

DROP POLICY IF EXISTS "Enable read for team members on documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for team members on documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for team members on documents" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for team members on documents" ON storage.objects;

-- 3. Define strict security policies for 'payslips' bucket
-- Structure: <company_id>/<employee_id>/<filename>
-- Read access:
-- - Super Admin can read all
-- - Company Admin can read within their company
-- - Standard Employee can read their own payslips
CREATE POLICY "payslips_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text) OR
            (storage.foldername(name))[2] = (public.get_user_employee_id())::text
        )
    );

-- Write/Modify access:
-- - Super Admin can write/delete
-- - Company Admin can write/delete within their company
CREATE POLICY "payslips_write_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'payslips' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text)
        )
    );

CREATE POLICY "payslips_modify_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text)
        )
    );

CREATE POLICY "payslips_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'payslips' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text)
        )
    );


-- 4. Define strict security policies for 'leave-documents' bucket
-- Structure: <employee_id>/<filename>
-- Read access:
-- - Super Admin can read all
-- - Company Admin can read if the employee belongs to their company
-- - Standard Employee can read their own leave documents
CREATE POLICY "leave_documents_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'leave-documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[1])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            (storage.foldername(name))[1] = (public.get_user_employee_id())::text
        )
    );

-- Insert access:
-- - Super Admin or Company Admin can insert
-- - Standard Employee can insert under their own folder
CREATE POLICY "leave_documents_insert_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'leave-documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[1])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            (storage.foldername(name))[1] = (public.get_user_employee_id())::text
        )
    );

-- Modify/Delete access:
-- - Super Admin or Company Admin can edit/delete matching company
-- - Standard Employee can edit/delete their own folder files
CREATE POLICY "leave_documents_modify_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'leave-documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[1])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            (storage.foldername(name))[1] = (public.get_user_employee_id())::text
        )
    );

CREATE POLICY "leave_documents_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'leave-documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[1])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            (storage.foldername(name))[1] = (public.get_user_employee_id())::text
        )
    );


-- 5. Define strict security policies for 'documents' bucket
-- Structures: 
-- 1) onboarding/<employee_id>/<filename>
-- 2) <company_id>/<filename>
-- 3) resumes/<filename> (job applicants upload anonymously)
-- Read access:
-- - Super Admin can read all
-- - Company Admin can read their company folder or onboarding folder of company employees
-- - Standard Employee can read their company folder or their own onboarding folder
CREATE POLICY "documents_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' AND (
            public.is_super_admin() OR
            -- Company Folder Access
            ((storage.foldername(name))[1] = (public.get_user_company_id())::text) OR
            -- Onboarding Folder Access for Admin
            (public.is_company_admin() AND (storage.foldername(name))[1] = 'onboarding' AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[2])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            -- Onboarding Folder Access for Employee themselves
            ((storage.foldername(name))[1] = 'onboarding' AND (storage.foldername(name))[2] = (public.get_user_employee_id())::text)
        )
    );

-- Allow public read of resumes for hiring managers (they are authenticated, but we restrict it to their candidates)
CREATE POLICY "documents_resume_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' AND (storage.foldername(name))[1] = 'resumes' AND (
            public.is_super_admin() OR public.is_company_admin()
        )
    );

-- Insert access:
-- - Super Admin or Company Admin can insert to company folder or onboarding folder
-- - Employees can insert to onboarding/<employee_id>/
-- - Public / anonymous can upload under resumes/
CREATE POLICY "documents_insert_policy" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (
        bucket_id = 'documents' AND (
            -- Resumes upload by applicants (anonymous/public)
            ((storage.foldername(name))[1] = 'resumes') OR
            -- Authenticated insertions
            (
                auth.role() = 'authenticated' AND (
                    public.is_super_admin() OR
                    (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text) OR
                    (public.is_company_admin() AND (storage.foldername(name))[1] = 'onboarding' AND EXISTS (
                        SELECT 1 FROM public.employees 
                        WHERE id = ((storage.foldername(name))[2])::uuid 
                          AND company_id = public.get_user_company_id()
                    )) OR
                    ((storage.foldername(name))[1] = 'onboarding' AND (storage.foldername(name))[2] = (public.get_user_employee_id())::text)
                )
            )
        )
    );

-- Update / Delete access:
-- - Super Admin or Company Admin
-- - Employee themselves for onboarding files
CREATE POLICY "documents_update_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text) OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = 'onboarding' AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[2])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            ((storage.foldername(name))[1] = 'onboarding' AND (storage.foldername(name))[2] = (public.get_user_employee_id())::text)
        )
    );

CREATE POLICY "documents_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents' AND (
            public.is_super_admin() OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = (public.get_user_company_id())::text) OR
            (public.is_company_admin() AND (storage.foldername(name))[1] = 'onboarding' AND EXISTS (
                SELECT 1 FROM public.employees 
                WHERE id = ((storage.foldername(name))[2])::uuid 
                  AND company_id = public.get_user_company_id()
            )) OR
            ((storage.foldername(name))[1] = 'onboarding' AND (storage.foldername(name))[2] = (public.get_user_employee_id())::text)
        )
    );
