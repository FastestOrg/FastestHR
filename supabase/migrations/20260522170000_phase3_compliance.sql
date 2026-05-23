-- Create compliance_rules table
CREATE TABLE IF NOT EXISTS public.compliance_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    country_code varchar(3) NOT NULL, -- 'USA', 'IND', 'GBR'
    statutory_components jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g., EPF matching rates, standard allowances
    tax_brackets jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unique_comp_country UNIQUE (company_id, country_code)
);

-- Add tax_jurisdiction and tax_declaration to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS tax_jurisdiction varchar(3) DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS tax_declaration jsonb DEFAULT '{}'::jsonb;

-- Owner assignment
ALTER TABLE public.compliance_rules OWNER TO postgres;

-- Enable Row Level Security (RLS)
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

-- Create policies utilizing standard project helpers
CREATE POLICY "Company admins can manage compliance rules" ON public.compliance_rules 
    TO authenticated 
    USING (((company_id = public.get_user_company_id()) AND (public.is_company_admin() OR public.is_super_admin())));

CREATE POLICY "Company members can view compliance rules" ON public.compliance_rules 
    FOR SELECT 
    TO authenticated 
    USING (((company_id = public.get_user_company_id()) OR public.is_super_admin()));

-- Create trigger for handling updated_at timestamp on compliance_rules
CREATE OR REPLACE TRIGGER set_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
