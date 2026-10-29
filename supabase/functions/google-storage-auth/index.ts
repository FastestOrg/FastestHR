import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateCaller, getCorsHeaders } from "../_shared/auth.ts";

const DEFAULT_GOOGLE_CLIENT_ID = "1033874890501-66h08rultd6tho444rdmj1l71kccfp8k.apps.googleusercontent.com";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || DEFAULT_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Authenticate caller
    let caller: any;
    try {
      caller = await authenticateCaller(req);
    } catch (authErr: any) {
      return new Response(
        JSON.stringify({ success: false, error: authErr.message || 'Unauthorized: Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, company_id } = body;

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization guard: caller must belong to the company or be super_admin
    const isSuperAdmin = caller.profile.platform_role === 'super_admin';
    const isCompanyUser = caller.profile.company_id === company_id;

    if (!isSuperAdmin && !isCompanyUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: You do not have access to this company storage' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: Exchange Auth Code for Permanent Refresh Token + Access Token
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      const isCompanyAdmin = ['admin', 'owner', 'super_admin'].includes(caller.profile.platform_role) || isSuperAdmin;
      if (!isCompanyAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden: Only company administrators can connect Google Drive storage' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { code, redirect_uri, client_id: customClientId } = body;
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing authorization code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const effectiveClientId = customClientId || GOOGLE_CLIENT_ID;

      // Exchange authorization code with Google OAuth endpoint
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: effectiveClientId,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirect_uri || 'postmessage',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('[GoogleStorageAuth] Google token exchange error:', errText);
        return new Response(
          JSON.stringify({ success: false, error: `Google OAuth exchange failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3599;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Fetch user profile from Google
      let email = 'connected-user@google.com';
      let name = 'Google Drive Account';
      let picture: string | null = null;

      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          email = userData.email || email;
          name = userData.name || userData.email || name;
          picture = userData.picture || null;
        }
      } catch (profileErr) {
        console.warn('[GoogleStorageAuth] Could not fetch Google user profile:', profileErr);
      }

      // Check for existing integration record
      const { data: existing } = await supabaseClient
        .from('company_storage_integrations')
        .select('id, refresh_token, root_folder_id')
        .eq('company_id', company_id)
        .maybeSingle();

      const effectiveRefreshToken = refreshToken || existing?.refresh_token || null;

      const payload: Record<string, any> = {
        company_id,
        provider: 'google_drive',
        is_active: true,
        connected_email: email,
        account_name: name,
        account_avatar: picture,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        client_id: effectiveClientId,
        status: 'connected',
        error_message: null,
        updated_at: new Date().toISOString(),
      };

      if (effectiveRefreshToken) {
        payload.refresh_token = effectiveRefreshToken;
      }

      if (existing) {
        const { error: updateErr } = await supabaseClient
          .from('company_storage_integrations')
          .update(payload)
          .eq('company_id', company_id);

        if (updateErr) {
          console.error('[GoogleStorageAuth] DB update error:', updateErr);
          throw new Error(`Failed to update storage integration: ${updateErr.message}`);
        }
      } else {
        const { error: insertErr } = await supabaseClient
          .from('company_storage_integrations')
          .insert({
            ...payload,
            root_folder_id: '',
            root_folder_name: 'FastestHR',
            subfolders: {
              documents: { id: '', name: 'Documents' },
              payslips: { id: '', name: 'Payslips' },
              offer_letters: { id: '', name: 'Offer Letters' },
              onboarding: { id: '', name: 'Onboarding' },
              senddesk: { id: '', name: 'SendDesk' },
            },
          });

        if (insertErr) {
          console.error('[GoogleStorageAuth] DB insert error:', insertErr);
          throw new Error(`Failed to insert storage integration: ${insertErr.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          accessToken,
          expiresIn,
          tokenExpiresAt,
          hasRefreshToken: !!effectiveRefreshToken,
          user: {
            email,
            name,
            picture,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: Refresh Token / Get Valid Token (Silent Background Refresh)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'refresh_token' || action === 'get_valid_token') {
      const { force_refresh, refresh_token: overrideRefreshToken } = body;

      const { data: config, error: fetchErr } = await supabaseClient
        .from('company_storage_integrations')
        .select('*')
        .eq('company_id', company_id)
        .maybeSingle();

      if (fetchErr || !config) {
        return new Response(
          JSON.stringify({ success: false, error: 'Storage integration not found for this company' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (config.provider !== 'google_drive' || !config.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Google Drive is not currently active for this company' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = Date.now();
      const expiry = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
      // If token is valid for more than 5 minutes and force_refresh is false, return immediately
      const isTokenValid = !force_refresh && config.access_token && expiry > (now + 5 * 60 * 1000);

      if (isTokenValid) {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: config.access_token,
            tokenExpiresAt: config.token_expires_at,
            refreshed: false,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Token needs refresh
      const effectiveRefreshToken = overrideRefreshToken || config.refresh_token;

      if (!effectiveRefreshToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Google Drive token expired and no refresh token available. Re-connection in Storage Settings required.',
            accessToken: config.access_token,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const effectiveClientId = config.client_id || GOOGLE_CLIENT_ID;

      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: effectiveClientId,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: effectiveRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshRes.ok) {
        const errText = await refreshRes.text();
        console.error('[GoogleStorageAuth] Token refresh error:', errText);
        return new Response(
          JSON.stringify({ success: false, error: `Google OAuth refresh failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.access_token;
      const newExpiresIn = refreshData.expires_in || 3599;
      const newExpiryDate = new Date(Date.now() + newExpiresIn * 1000).toISOString();

      await supabaseClient
        .from('company_storage_integrations')
        .update({
          access_token: newAccessToken,
          token_expires_at: newExpiryDate,
          status: 'connected',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', company_id);

      return new Response(
        JSON.stringify({
          success: true,
          accessToken: newAccessToken,
          tokenExpiresAt: newExpiryDate,
          expiresIn: newExpiresIn,
          refreshed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[GoogleStorageAuth] Unhandled error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

