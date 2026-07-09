import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://fastesthr.com',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
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

    // Verify Authorization Header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !userData.user) {
      throw new Error('Unauthorized');
    }

    const { query, history = [], companyId } = await req.json();

    if (!query || !companyId) {
      throw new Error('Missing query or companyId');
    }

    // 1. Fetch Company Information including AI Memory, Culture, etc.
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('name, about_company, company_culture, ai_memory')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // 2. Fetch Employee Profile details for personalization
    const { data: employee } = await supabaseClient
      .from('employees')
      .select('first_name, last_name, work_email, employment_type')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const employeeContext = employee 
      ? `Employee context:
         - Name: ${employee.first_name} ${employee.last_name}
         - Work Email: ${employee.work_email}
         - Type: ${employee.employment_type}`
      : `Employee context: Profile not fully complete.`;

    const companyName = company.name || 'our company';
    const culture = company.company_culture || company.about_company || 'A collaborative professional environment.';
    const memory = company.ai_memory || 'No custom guidelines set yet. Answer standard, helpful HR procedures.';

    // 3. Construct Gemini system instruction prompt
    const systemPrompt = `You are "FastestAI", the advanced and premium AI HR assistant for "${companyName}".
    
    Here is the company culture context:
    ${culture}
    
    CRITICAL: Managers have fed specific rules and guidelines into your AI Memory. You MUST strictly prioritize and adhere to these directives above standard rules.
    
    FastestAI Memory:
    ${memory}
    
    ${employeeContext}
    
    Instructions:
    - Respond directly, clearly, and supportively. Use clean, markdown formatting with bullets where appropriate.
    - If the employee asks about a policy (like shift timing, remote work limits, dress codes, or leave reporting) that is specified in the FastestAI Memory, answer strictly using that policy.
    - If the query is about a policy not covered in the FastestAI Memory, provide a professional generic HR guideline, and suggest they raise a ticket in the Helpdesk.
    - Refuse to answer non-HR/work related questions (e.g. trivia, coding unrelated to work, generic chat). Keep it professional.
    - Refer to yourself ONLY as "FastestAI".`;

    // 4. Format conversation history for Gemini API
    // Gemini expects an array of content objects: { role: 'user'|'model', parts: [{ text: string }] }
    const contents = [];
    
    // Add history if present
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Add current query
    contents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.3, // Lower temp for factual policy adherence
          maxOutputTokens: 800,
        }
      })
    });

    const resultData = await response.json();
    
    if (!resultData.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Gemini error response:', JSON.stringify(resultData));
      throw new Error('Failed to retrieve content from FastestAI generator');
    }

    const textResponse = resultData.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ response: textResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
