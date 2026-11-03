import { requireCompanyStaff, getCorsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_user_id, new_password, company_id } = await req.json();

    if (!target_user_id || !new_password) {
      throw new Error('Missing target_user_id or new_password');
    }

    if (typeof new_password !== 'string' || new_password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Authenticate caller as company staff (super_admin, company_admin, hr_manager)
    // adminClient uses service_role key to safely query and modify users without RLS restrictions
    const { profile: adminProfile, adminClient } = await requireCompanyStaff(req, company_id || null, [
      'super_admin',
      'company_admin',
      'hr_manager',
    ]);

    // Verify target user profile using adminClient (service role bypasses RLS)
    let { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id, company_id, platform_role')
      .eq('id', target_user_id)
      .maybeSingle();

    if (targetProfileError) {
      console.warn('set-employee-password: error querying profile:', targetProfileError);
    }

    // Fallback: If profile row is missing, check employee record by user_id
    if (!targetProfile) {
      const { data: empRecord } = await adminClient
        .from('employees')
        .select('id, company_id, first_name, last_name')
        .eq('user_id', target_user_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (empRecord) {
        targetProfile = {
          id: target_user_id,
          company_id: empRecord.company_id,
          platform_role: 'user',
        };

        // Auto-heal missing profile row
        await adminClient.from('profiles').upsert({
          id: target_user_id,
          company_id: empRecord.company_id,
          full_name: `${empRecord.first_name || ''} ${empRecord.last_name || ''}`.trim() || 'User',
          platform_role: 'user',
          is_active: true,
        }, { onConflict: 'id' });
      }
    }

    if (!targetProfile) {
      throw new Error('Target user not found');
    }

    // Multi-tenant authorization checks
    if (adminProfile.platform_role !== 'super_admin') {
      if (targetProfile.company_id && adminProfile.company_id && targetProfile.company_id !== adminProfile.company_id) {
        throw new Error('Forbidden: Target user belongs to a different company');
      }
      // Security Guard: Cannot modify passwords of super admins or peer company admins
      if (targetProfile.platform_role === 'super_admin' || (targetProfile.platform_role === 'company_admin' && target_user_id !== adminProfile.id)) {
        throw new Error('Forbidden: You cannot modify passwords of administrative accounts');
      }
      if (adminProfile.platform_role === 'hr_manager' && targetProfile.platform_role === 'hr_manager' && target_user_id !== adminProfile.id) {
        throw new Error('Forbidden: HR managers cannot modify passwords of peer HR managers');
      }
    }

    // Update password in Supabase Auth
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      target_user_id,
      { 
        password: new_password,
        email_confirm: true,
      }
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
