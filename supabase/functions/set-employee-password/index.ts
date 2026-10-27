import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the admin user who is making the request
    const {
      data: { user: adminUser },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !adminUser) {
      throw new Error('Unauthorized');
    }

    // Check if the caller is a company_admin or super_admin
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('platform_role, company_id')
      .eq('id', adminUser.id)
      .single();

    if (
      profileError ||
      !adminProfile ||
      (adminProfile.platform_role !== 'company_admin' && adminProfile.platform_role !== 'super_admin')
    ) {
      throw new Error('Forbidden: Only company admins or super admins can perform this action');
    }

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      throw new Error('Missing target_user_id or new_password');
    }

    if (typeof new_password !== 'string' || new_password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Verify target user
    const { data: targetProfile, error: targetProfileError } = await supabaseClient
      .from('profiles')
      .select('company_id, platform_role')
      .eq('id', target_user_id)
      .single();

    if (targetProfileError || !targetProfile) {
      throw new Error('Target user not found');
    }

    if (adminProfile.platform_role !== 'super_admin') {
      if (targetProfile.company_id !== adminProfile.company_id) {
        throw new Error('Forbidden: Target user belongs to a different company');
      }
      // Security Guard: Company admins cannot reset passwords of peer company admins or super admins!
      if (targetProfile.platform_role === 'super_admin' || (targetProfile.platform_role === 'company_admin' && target_user_id !== adminUser.id)) {
        throw new Error('Forbidden: You cannot modify passwords of administrative accounts');
      }
    }

    // Initialize admin client to update password
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error: updateError } = await adminSupabase.auth.admin.updateUserById(
      target_user_id,
      { password: new_password }
    );

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Set Password Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
