-- Migration: Add ai_memory column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS ai_memory text DEFAULT null;

-- Grant SELECT access on the new column to authenticated users (so employees can read it through the assistant)
GRANT SELECT (ai_memory) ON public.companies TO authenticated;
