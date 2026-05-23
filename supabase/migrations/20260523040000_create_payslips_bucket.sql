-- Create payslips bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payslips', 'payslips', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for payslips bucket
CREATE POLICY "Enable read for team members on payslips" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'payslips');

CREATE POLICY "Enable insert for team members on payslips" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payslips');

CREATE POLICY "Enable update for team members on payslips" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'payslips');

CREATE POLICY "Enable delete for team members on payslips" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'payslips');
