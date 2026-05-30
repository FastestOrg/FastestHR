import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read secure secrets set via 'supabase secrets set'
    const token = Deno.env.get("POSTHOG_PROJECT_TOKEN")
    const host = "https://us.i.posthog.com"

    if (!token) {
      console.error("POSTHOG_PROJECT_TOKEN is not set in Deno.env secrets.");
      return new Response(
        JSON.stringify({ error: "PostHog Project Token is not configured in Supabase Edge Secrets." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ token, host }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error("Error in get-posthog-config:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
