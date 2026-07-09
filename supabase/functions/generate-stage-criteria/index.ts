import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://fastesthr.com',
  'http://localhost:8080'
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin || allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { jobId, stageName, companyId } = await req.json();

    if (!jobId || !stageName || !companyId) {
      throw new Error('Missing required parameters: jobId, stageName, or companyId');
    }

    // 1. Fetch Job and Company details
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('title, description, requirements, min_salary, max_salary')
      .eq('id', jobId)
      .single();

    if (jobError || !job) throw new Error('Job not found');

    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('name, company_culture, about_company, ai_memory')
      .eq('id', companyId)
      .single();

    if (companyError || !company) throw new Error('Company not found');

    const culture = company.company_culture || company.about_company || 'A professional environment focusing on growth and excellence.';
    const memory = company.ai_memory ? `\n      Custom Company Hiring Directives & Guidelines (AI Memory):\n      ${company.ai_memory}` : '';

    // 2. Call Gemini to generate criteria
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const prompt = `
      As an expert HR Recruiter, generate a list of 3-5 specific evaluation criteria (questions or concept checks) for a candidate in the "${stageName}" stage of the recruitment process for the position of "${job.title}".

      Job Context:
      Description: ${job.description}
      Requirements: ${job.requirements}
      Salary/Package: ${job.min_salary} - ${job.max_salary}

      Company Context:
      Company Name: ${company.name}
      Culture & Values: ${culture}${memory}

      Instructions:
      1. Tailor the points strictly to the "${stageName}" stage. (e.g., Screening should be broad/cultural fit, Technical should be deep skills, etc.)
      2. For each point, provide a "Requirement/Concept" and an "Optimal Answer" (internal reference for the AI).
      3. Mark at least one point as "mandatory" (is_mandatory: true) if it's a deal-breaker for this role/stage.
      4. Ensure the criteria reflect the company culture, the specific package/level of the role, and any custom guidelines provided in the custom hiring directives (AI Memory).

      Return ONLY a JSON array of objects with this structure:
      [
        {
          "point": "Short title of the requirement",
          "optimal_answer": "Detailed description of what an ideal candidate should say",
          "is_mandatory": boolean
        }
      ]
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const resultData = await response.json();
    if (!resultData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to generate content from Gemini');
    }

    const generatedCriteria = JSON.parse(resultData.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify({ criteria: generatedCriteria }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
