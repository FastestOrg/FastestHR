-- Kudos board for peer appreciations
CREATE TABLE IF NOT EXISTS public.kudos_board (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    badge_type text NOT NULL, -- 'excellence', 'integrity', 'collaboration', 'leadership'
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Pulse scores for employee satisfaction metrics
CREATE TABLE IF NOT EXISTS public.pulse_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    score integer CHECK (score >= 1 AND score <= 5) NOT NULL,
    feedback_text text,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL, -- Keeping responses anonymous
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Owner assignment
ALTER TABLE public.kudos_board OWNER TO postgres;
ALTER TABLE public.pulse_logs OWNER TO postgres;

-- Enable Row Level Security (RLS)
ALTER TABLE public.kudos_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_logs ENABLE ROW LEVEL SECURITY;

-- Policies utilizing standard company helpers for complete tenant-isolation and peer collaboration
CREATE POLICY "Company members can view kudos" ON public.kudos_board
    FOR SELECT TO authenticated
    USING (((company_id = public.get_user_company_id()) OR public.is_super_admin()));

CREATE POLICY "Company members can insert kudos for peers" ON public.kudos_board
    FOR INSERT TO authenticated
    WITH CHECK (((company_id = public.get_user_company_id()) OR public.is_super_admin()));

CREATE POLICY "Company members can view pulse scores anonymously" ON public.pulse_logs
    FOR SELECT TO authenticated
    USING (((company_id = public.get_user_company_id()) OR public.is_super_admin()));

CREATE POLICY "Company members can log pulse" ON public.pulse_logs
    FOR INSERT TO authenticated
    WITH CHECK (((company_id = public.get_user_company_id()) OR public.is_super_admin()));
