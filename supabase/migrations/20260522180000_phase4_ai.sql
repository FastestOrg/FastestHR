-- Enable pgvector extension if it exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Candidate resume embeddings for AI screening
CREATE TABLE IF NOT EXISTS public.candidate_resume_embeddings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    summary text,
    skills text[] DEFAULT '{}'::text[],
    embedding vector(1536), -- 1536 dimensions (OpenAI text-embedding-3-small / text-embedding-ada-002 compatible)
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Attrition predictions for passive retention forecasting
CREATE TABLE IF NOT EXISTS public.attrition_predictions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    risk_score numeric(5,2) NOT NULL, -- 0.00% to 100.00%
    risk_factors text[] DEFAULT '{}'::text[],
    trend text DEFAULT 'stable', -- 'improving', 'stable', 'worsening'
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Owner assignment
ALTER TABLE public.candidate_resume_embeddings OWNER TO postgres;
ALTER TABLE public.attrition_predictions OWNER TO postgres;

-- Enable Row Level Security (RLS)
ALTER TABLE public.candidate_resume_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attrition_predictions ENABLE ROW LEVEL SECURITY;

-- Policies utilizing standard company/admin helpers to ensure secure tenant-isolation
CREATE POLICY "Admins have full access to company candidate embeddings" ON public.candidate_resume_embeddings
    FOR ALL TO authenticated
    USING (((company_id = public.get_user_company_id()) AND (public.is_company_admin() OR public.is_super_admin())));

CREATE POLICY "Admins have full access to attrition predictions" ON public.attrition_predictions
    FOR ALL TO authenticated
    USING (((company_id = public.get_user_company_id()) AND (public.is_company_admin() OR public.is_super_admin())));

-- Create RPC function to query top matching candidates by cosine distance
CREATE OR REPLACE FUNCTION public.match_candidates (
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_company_id uuid
)
RETURNS TABLE (
    candidate_id uuid,
    similarity float
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cre.candidate_id,
        1 - (cre.embedding <=> query_embedding) AS similarity
    FROM public.candidate_resume_embeddings cre
    WHERE cre.company_id = filter_company_id
      AND 1 - (cre.embedding <=> query_embedding) > match_threshold
    ORDER BY cre.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
