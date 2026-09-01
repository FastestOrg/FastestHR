import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

const allowedOrigins = [
  'https://fastesthr.com',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
};

function generateFallbackMeetRoom(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const r = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.google.com/${r(3)}-${r(4)}-${r(3)}`;
}

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

    const body = await req.json();
    const { action } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: Exchange Auth Code for Permanent Refresh Token + Access Token
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      const { code, user_id, redirect_uri } = body;
      if (!code || !user_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing code or user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange code with Google OAuth token endpoint
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirect_uri || 'postmessage',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('Google token exchange error:', errText);
        return new Response(
          JSON.stringify({ success: false, error: `Google OAuth exchange failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3599;
      const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Fetch user profile info from Google
      let email = 'connected-calendar@google.com';
      let name = 'Google User';
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          email = userData.email || email;
          name = userData.name || name;
        }
      } catch (profileErr) {
        console.warn('Could not fetch user profile:', profileErr);
      }

      // Update user_meeting_settings with permanent refresh token + access token
      const updatePayload: any = {
        google_calendar_connected: true,
        google_calendar_email: email,
        google_access_token: accessToken,
        google_token_expiry: expiryDate,
        google_calendar_id: 'primary',
      };

      if (refreshToken) {
        updatePayload.google_refresh_token = refreshToken;
      }

      const { error: dbError } = await supabaseClient
        .from('user_meeting_settings')
        .update(updatePayload)
        .eq('user_id', user_id);

      if (dbError) {
        console.error('DB update error:', dbError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          email,
          name,
          accessToken,
          hasRefreshToken: !!refreshToken,
          expiresIn,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: Get Valid Token (Silently Refreshes 24/7 in Background)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'get_valid_token') {
      const { user_id, company_slug, booking_slug } = body;

      let query = supabaseClient.from('user_meeting_settings').select('*');
      if (user_id) {
        query = query.eq('user_id', user_id);
      } else if (company_slug && booking_slug) {
        // Lookup by company_slug and booking_slug
        const { data: comp } = await supabaseClient
          .from('companies')
          .select('id')
          .ilike('slug', company_slug)
          .maybeSingle();

        if (!comp) {
          return new Response(
            JSON.stringify({ success: false, error: 'Company not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        query = query.eq('company_id', comp.id).ilike('booking_slug', booking_slug);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing identification parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings, error: fetchErr } = await query.maybeSingle();
      if (fetchErr || !settings) {
        return new Response(
          JSON.stringify({ success: false, error: 'Meeting settings not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!settings.google_calendar_connected) {
        return new Response(
          JSON.stringify({ success: false, error: 'Google Calendar is not connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = Date.now();
      const expiry = settings.google_token_expiry ? new Date(settings.google_token_expiry).getTime() : 0;
      const isTokenValid = settings.google_access_token && expiry > (now + 3 * 60 * 1000); // 3-min buffer

      // If token is still valid, return it immediately
      if (isTokenValid) {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: settings.google_access_token,
            email: settings.google_calendar_email,
            refreshed: false,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If token is expired, refresh it using permanent google_refresh_token
      if (!settings.google_refresh_token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Token expired and no refresh token available. Reconnection required.',
            accessToken: settings.google_access_token,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Perform background refresh with Google OAuth
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: settings.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshRes.ok) {
        const errText = await refreshRes.text();
        console.error('Google token refresh failed:', errText);
        return new Response(
          JSON.stringify({ success: false, error: `Google refresh error: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.access_token;
      const newExpiresIn = refreshData.expires_in || 3599;
      const newExpiryDate = new Date(Date.now() + newExpiresIn * 1000).toISOString();

      // Update database with fresh access token
      await supabaseClient
        .from('user_meeting_settings')
        .update({
          google_access_token: newAccessToken,
          google_token_expiry: newExpiryDate,
        })
        .eq('id', settings.id);

      return new Response(
        JSON.stringify({
          success: true,
          accessToken: newAccessToken,
          email: settings.google_calendar_email,
          refreshed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 3: Create Calendar Event with Google Meet (Full Server-Side Flow)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'create_calendar_event') {
      const {
        company_slug,
        booking_slug,
        title,
        description,
        guest_name,
        guest_email,
        guest_phone,
        guest_linkedin,
        start_iso,
        end_iso,
        timezone,
        auto_google_meet = true,
      } = body;

      // 1. Fetch settings by company_slug and booking_slug
      const { data: comp } = await supabaseClient
        .from('companies')
        .select('id')
        .ilike('slug', company_slug)
        .maybeSingle();

      if (!comp) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings } = await supabaseClient
        .from('user_meeting_settings')
        .select('*')
        .eq('company_id', comp.id)
        .ilike('booking_slug', booking_slug)
        .maybeSingle();

      if (!settings || !settings.google_calendar_connected) {
        const fallbackRoom = generateFallbackMeetRoom();
        return new Response(
          JSON.stringify({
            success: true,
            eventId: null,
            meetingLink: fallbackRoom,
            htmlLink: null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Obtain valid Access Token (auto-refreshed if needed)
      let validAccessToken = settings.google_access_token;
      const now = Date.now();
      const expiry = settings.google_token_expiry ? new Date(settings.google_token_expiry).getTime() : 0;

      if (!validAccessToken || expiry <= (now + 2 * 60 * 1000)) {
        if (settings.google_refresh_token) {
          try {
            const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: settings.google_refresh_token,
                grant_type: 'refresh_token',
              }),
            });

            if (refreshRes.ok) {
              const rData = await refreshRes.json();
              validAccessToken = rData.access_token;
              const newExpiry = new Date(Date.now() + (rData.expires_in || 3599) * 1000).toISOString();
              await supabaseClient
                .from('user_meeting_settings')
                .update({
                  google_access_token: validAccessToken,
                  google_token_expiry: newExpiry,
                })
                .eq('id', settings.id);
            }
          } catch (rErr) {
            console.error('Refresh in create_calendar_event failed:', rErr);
          }
        }
      }

      if (!validAccessToken) {
        const fallbackRoom = generateFallbackMeetRoom();
        return new Response(
          JSON.stringify({
            success: true,
            eventId: null,
            meetingLink: fallbackRoom,
            htmlLink: null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Create Event in Google Calendar
      const requestId = 'meet-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      let fullDescription = description || '';
      fullDescription += `\n\n--- Attendee Details ---\n`;
      fullDescription += `Guest: ${guest_name}\n`;
      fullDescription += `Email: ${guest_email}\n`;
      if (guest_phone) fullDescription += `Phone: ${guest_phone}\n`;
      if (guest_linkedin) fullDescription += `LinkedIn: ${guest_linkedin}\n`;
      fullDescription += `Scheduled via FastestHR Scheduler`;

      const requestBody: any = {
        summary: title,
        description: fullDescription,
        start: {
          dateTime: start_iso,
          timeZone: timezone || 'UTC',
        },
        end: {
          dateTime: end_iso,
          timeZone: timezone || 'UTC',
        },
        attendees: [
          { email: guest_email, displayName: guest_name },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      if (auto_google_meet) {
        requestBody.conferenceData = {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;
      const gcalRes = await fetch(gcalUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!gcalRes.ok) {
        const errText = await gcalRes.text();
        console.error('Failed to create GCal event:', errText);
        const fallbackRoom = generateFallbackMeetRoom();
        return new Response(
          JSON.stringify({
            success: true,
            eventId: null,
            meetingLink: fallbackRoom,
            htmlLink: null,
            warning: errText,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const eventData = await gcalRes.json();
      const meetingLink =
        eventData.hangoutLink ||
        eventData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
        eventData.conferenceData?.entryPoints?.[0]?.uri ||
        generateFallbackMeetRoom();

      return new Response(
        JSON.stringify({
          success: true,
          eventId: eventData.id,
          meetingLink,
          htmlLink: eventData.htmlLink,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
