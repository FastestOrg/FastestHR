import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, authenticateCaller } from "../_shared/auth.ts";

/**
 * Gemini Multimodal Live Audio Gateway (Supabase Edge Function)
 * Acts as a secure bi-directional WebSocket proxy connecting candidates
 * directly to Google Gemini Live API without exposing API keys or credentials.
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const hash = url.searchParams.get('hash');
  const token = url.searchParams.get('token');

  // If HTTP GET/POST (non-WebSocket), return health check & protocol capability
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response(
      JSON.stringify({
        status: 'online',
        service: 'Gemini Multimodal Live Audio Gateway',
        protocol: 'WebSocket (RFC 6455)',
        version: '2.0.0',
        capabilities: ['audio/pcm', 'text/streaming', 'ephemeral-session-lock'],
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // 1. Session & Authorization Verification
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

  if (!geminiApiKey) {
    return new Response('Gemini Live Gateway is unconfigured: missing GEMINI_API_KEY', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  let interviewContext: { id: string; candidate_id: string; job_id: string } | null = null;

  if (hash) {
    const { data: interview, error } = await supabase
      .from('ai_interviews')
      .select('id, candidate_id, job_id, expires_at, status')
      .eq('link_hash', hash)
      .maybeSingle();

    if (error || !interview) {
      return new Response('Unauthorized: Invalid or unknown interview hash', { status: 403 });
    }

    if (new Date() > new Date(interview.expires_at)) {
      return new Response('Unauthorized: Interview session has expired', { status: 403 });
    }

    if (interview.status === 'completed') {
      return new Response('Forbidden: Interview has already been finalized', { status: 403 });
    }

    interviewContext = interview;
  } else if (token) {
    // Authenticated staff verification
    try {
      const { profile } = await authenticateCaller(req);
      const allowedRoles = ['super_admin', 'company_admin', 'hr_manager', 'recruiter'];
      if (!allowedRoles.includes(profile.platform_role)) {
        return new Response('Forbidden: Role unauthorized for live gateway', { status: 403 });
      }
    } catch {
      return new Response('Unauthorized: Invalid bearer token', { status: 401 });
    }
  } else {
    return new Response('Unauthorized: Missing hash or authorization token', { status: 401 });
  }

  // 2. Perform WebSocket Upgrade
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  clientSocket.onopen = () => {
    console.info(`[GeminiLiveGateway] Client connected for interview ${interviewContext?.id || 'staff-session'}`);

    // Update interview status to in_progress
    if (interviewContext?.id) {
      supabase
        .from('ai_interviews')
        .update({ status: 'in_progress' })
        .eq('id', interviewContext.id)
        .then(() => {});
    }

    // Connect to Google Gemini Live API upstream
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;

    try {
      const upstreamSocket = new WebSocket(geminiWsUrl);

      upstreamSocket.onopen = () => {
        console.info('[GeminiLiveGateway] Upstream connection to Google Gemini Live established');
        clientSocket.send(JSON.stringify({ type: 'gateway_ready', message: 'Connected to Gemini Live session' }));
      };

      // Upstream -> Client relay
      upstreamSocket.onmessage = (event) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      upstreamSocket.onerror = (err) => {
        console.warn('[GeminiLiveGateway] Upstream error:', err);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'error', message: 'Gemini upstream service error' }));
        }
      };

      upstreamSocket.onclose = () => {
        console.info('[GeminiLiveGateway] Upstream connection closed');
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close();
        }
      };

      // Client -> Upstream relay
      clientSocket.onmessage = (event) => {
        if (upstreamSocket.readyState === WebSocket.OPEN) {
          upstreamSocket.send(event.data);
        }
      };

      clientSocket.onclose = () => {
        console.info('[GeminiLiveGateway] Client disconnected');
        if (upstreamSocket.readyState === WebSocket.OPEN) {
          upstreamSocket.close();
        }
      };
    } catch (err) {
      console.error('[GeminiLiveGateway] Failed to initialize upstream socket:', err);
      clientSocket.send(JSON.stringify({ type: 'error', message: 'Failed to establish upstream audio bridge' }));
      clientSocket.close();
    }
  };

  return response;
});
