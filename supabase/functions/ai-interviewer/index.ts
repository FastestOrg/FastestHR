import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, authenticateCaller } from "../_shared/auth.ts";

async function mintEphemeralGeminiToken(apiKey: string): Promise<{ token: string; wsUrl: string; endpointType: 'constrained' } | null> {
  try {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: "models/gemini-2.0-flash-exp",
        },
      }),
    });

    if (!res.ok) {
      console.warn("Failed to mint Gemini ephemeral token:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const tokenName = data.name || data.token;
    if (!tokenName) return null;

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${tokenName}`;
    return { token: tokenName, wsUrl, endpointType: 'constrained' };
  } catch (err) {
    console.warn("Error calling Gemini auth_tokens API:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { action, candidateId, jobId, transcript, hash } = await req.json();

    if (!action) {
      throw new Error('Missing action parameter');
    }

    // 1. Strict Authorization & Session Validation
    if (hash) {
      // Validate candidate session from public link
      const { data: interview, error: interviewError } = await supabaseClient
        .from('ai_interviews')
        .select('id, candidate_id, job_id, expires_at, status, expectations')
        .eq('link_hash', hash)
        .single();

      if (interviewError || !interview) {
        throw new Error('Invalid or non-existent interview link');
      }

      if (candidateId && interview.candidate_id !== candidateId) {
        throw new Error('Unauthorized: Candidate ID mismatch with interview link');
      }

      if (jobId && interview.job_id !== jobId) {
        throw new Error('Unauthorized: Job ID mismatch with interview link');
      }

      if (new Date() > new Date(interview.expires_at)) {
        throw new Error('Interview link has expired');
      }

      if (interview.status === 'completed') {
        throw new Error('Interview has already been completed');
      }

      // Mark status as in_progress when initializing token
      if (action === 'token' && interview.status === 'pending') {
        await supabaseClient
          .from('ai_interviews')
          .update({ status: 'in_progress' })
          .eq('id', interview.id);
      }
    } else {
      // Authenticated Staff flow (HR, Recruiter, Admin)
      const { profile } = await authenticateCaller(req);
      const allowedRoles = ['super_admin', 'company_admin', 'hr_manager', 'recruiter'];
      if (!allowedRoles.includes(profile.platform_role)) {
        throw new Error(`Forbidden: Role '${profile.platform_role}' is not authorized`);
      }

      // Verify tenant boundary for job or candidate
      if (jobId && profile.platform_role !== 'super_admin') {
        const { data: jobRec, error: jobErr } = await supabaseClient
          .from('jobs')
          .select('company_id')
          .eq('id', jobId)
          .single();
        if (jobErr || !jobRec || jobRec.company_id !== profile.company_id) {
          throw new Error('Forbidden: Job does not belong to your company');
        }
      }

      if (candidateId && profile.platform_role !== 'super_admin') {
        const { data: candRec, error: candErr } = await supabaseClient
          .from('candidates')
          .select('company_id')
          .eq('id', candidateId)
          .single();
        if (candErr || !candRec || candRec.company_id !== profile.company_id) {
          throw new Error('Forbidden: Candidate does not belong to your company');
        }
      }
    }

    // 2. Handle Action: token
    if (action === 'token') {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on server.');
      }

      // Attempt to mint short-lived constrained ephemeral token
      const ephemeral = await mintEphemeralGeminiToken(apiKey);
      if (ephemeral) {
        return new Response(JSON.stringify(ephemeral), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Safe fallback for verified sessions if Google ephemeral tokens are unavailable
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      return new Response(JSON.stringify({ 
        token: apiKey, 
        endpointType: 'direct',
        wsUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Handle Action: analyze
    if (action === 'analyze') {
      if (!candidateId || !jobId || !transcript) {
        throw new Error('Missing data for analysis (candidateId, jobId, transcript)');
      }

      // 1. Fetch Job and Interview expectations
      let expectations: any[] = [];
      if (hash) {
        const { data: interview } = await supabaseClient
          .from('ai_interviews')
          .select('expectations')
          .eq('link_hash', hash)
          .single();
        if (interview?.expectations) expectations = interview.expectations;
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
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on server');

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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini analysis API error: ${response.status} ${errText}`);
      }

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
        status: 200,
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('AI Interviewer Error:', error);
    const isAuthError = error.message?.includes('Unauthorized') || error.message?.includes('Forbidden');
    return new Response(JSON.stringify({ error: error.message }), {
      status: isAuthError ? 403 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
