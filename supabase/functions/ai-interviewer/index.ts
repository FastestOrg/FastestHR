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

    const { action, candidateId, jobId, transcript, hash } = await req.json();

    // Validate Authorization
    if (hash) {
      // If a hash is provided (public link), verify it is valid, not expired, and not completed
      const { data: interview, error: interviewError } = await supabaseClient
        .from('ai_interviews')
        .select('expires_at, status')
        .eq('link_hash', hash)
        .single();

      if (interviewError || !interview) {
        throw new Error('Invalid interview link');
      }

      if (new Date() > new Date(interview.expires_at)) {
        throw new Error('Interview link has expired');
      }

      if (interview.status === 'completed') {
        throw new Error('Interview is already completed');
      }
    } else {
      // If no hash is provided, verify the Authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing Authorization header');
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);

      if (authError || !userData.user) {
        throw new Error('Unauthorized');
      }
    }

    if (action === 'token') {
      // In a real scenario, you'd mint an ephemeral token or just return the API Key if server-side.
      // But for Gemini Live BidiGenerateContent, the client needs the API key if connecting directly,
      // or we proxy it.
      // For this project, we store the GEMINI_API_KEY in Supabase secrets.
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');

      return new Response(JSON.stringify({ token: apiKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'analyze') {
      if (!candidateId || !jobId || !transcript) {
        throw new Error('Missing data for analysis');
      }

      // 1. Fetch Job and Interview expectations
      let expectations = [];
      if (hash) {
        const { data: interview } = await supabaseClient
          .from('ai_interviews')
          .select('expectations')
          .eq('link_hash', hash)
          .single();
        if (interview) expectations = interview.expectations || [];
      }

      const { data: job } = await supabaseClient
        .from('jobs')
        .select('title, requirements, company_id')
        .eq('id', jobId)
        .single();

      let memory = '';
      if (job?.company_id) {
        const { data: company } = await supabaseClient
          .from('companies')
          .select('ai_memory')
          .eq('id', job.company_id)
          .single();
        if (company?.ai_memory) {
          memory = `\nCustom Company Hiring Guidelines (AI Memory):\n${company.ai_memory}`;
        }
      }

      // 2. Call Gemini to analyze the transcript
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this interview transcript for the position of ${job?.title}.
              
              Requirements: ${job?.requirements}
              HR Expectations: ${JSON.stringify(expectations)}${memory}
              
              Transcript:
              ${transcript.map((t: any) => `${t.role}: ${t.text}`).join('\n')}
              
              Provide a JSON result with:
              1. ai_score (0-10)
              2. summary (short 1-2 sentence overview)
              3. pros (array of strings)
              4. cons (array of strings)
              5. mandatory_check (boolean - true if all mandatory HR expectations were met and company guidelines were respected)
              
              Return ONLY the JSON.`
            }]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      const resultData = await response.json();
      const analysisResult = JSON.parse(resultData.candidates[0].content.parts[0].text);

      // 3. Update AI Interview record if hash exists
      if (hash) {
        await supabaseClient
          .from('ai_interviews')
          .update({
            status: 'completed',
            transcript,
            score: analysisResult.ai_score,
            feedback: analysisResult.summary
          })
          .eq('link_hash', hash);
      }

      // 4. Update Candidate record
      await supabaseClient
        .from('candidates')
        .update({
          ai_interview_result: {
            ...analysisResult,
            completed_at: new Date().toISOString()
          },
          score: (analysisResult.ai_score + 7) / 2 // Blend AI score with default
        })
        .eq('id', candidateId);

      return new Response(JSON.stringify({ result: analysisResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
