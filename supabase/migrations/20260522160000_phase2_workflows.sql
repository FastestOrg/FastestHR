-- Create workflow triggers enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_trigger') THEN
        CREATE TYPE public.workflow_trigger AS ENUM (
            'candidate_stage_updated',
            'leave_created',
            'leave_updated',
            'employee_created',
            'ticket_created'
        );
    END IF;
END $$;

-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    trigger_event public.workflow_trigger NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb,
    actions jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create workflow_runs table
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    record_id uuid NOT NULL,
    status text DEFAULT 'pending',
    execution_log jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Owner assignment
ALTER TABLE public.workflows OWNER TO postgres;
ALTER TABLE public.workflow_runs OWNER TO postgres;

-- Enable Row Level Security (RLS)
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- Create policies utilizing standard project helpers
CREATE POLICY "Company admins can manage workflows" ON public.workflows 
    TO authenticated 
    USING (((company_id = public.get_user_company_id()) AND (public.is_company_admin() OR public.is_super_admin())));

CREATE POLICY "Company members can view workflows" ON public.workflows 
    FOR SELECT 
    TO authenticated 
    USING (((company_id = public.get_user_company_id()) OR public.is_super_admin()));

CREATE POLICY "Company admins can view workflow runs" ON public.workflow_runs 
    TO authenticated 
    USING ((workflow_id IN (
        SELECT id FROM public.workflows WHERE company_id = public.get_user_company_id()
    ) AND (public.is_company_admin() OR public.is_super_admin())));

-- Create trigger for handling updated_at timestamp on workflows
CREATE OR REPLACE TRIGGER set_workflows_updated_at BEFORE UPDATE ON public.workflows 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
