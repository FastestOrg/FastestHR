import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getTenantAdminClient } from "../_shared/byos-client.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const platformUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const platformAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const platformServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Authenticate caller
    const supabaseClient = createClient(platformUrl, platformAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: adminUser },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !adminUser) {
      throw new Error('Unauthorized: Authentication required');
    }

    // 2. Fetch admin profile and check role
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, platform_role, company_id, full_name')
      .eq('id', adminUser.id)
      .single();

    if (
      profileError ||
      !adminProfile ||
      (adminProfile.platform_role !== 'company_admin' && adminProfile.platform_role !== 'super_admin')
    ) {
      throw new Error('Forbidden: Only Company Administrators or Super Administrators can permanently delete an employee');
    }

    const { employee_id } = await req.json();
    if (!employee_id) {
      throw new Error('Missing required parameter: employee_id');
    }

    // 3. Create platform admin client (service_role)
    const adminSupabase = createClient(platformUrl, platformServiceKey, {
      auth: { persistSession: false },
    });

    // 4. Fetch target employee details to verify
    const { data: targetEmployee, error: targetError } = await adminSupabase
      .from('employees')
      .select('id, user_id, company_id, work_email, personal_email, first_name, last_name, avatar_url')
      .eq('id', employee_id)
      .single();

    if (targetError || !targetEmployee) {
      throw new Error(`Target employee not found: ${targetError?.message || 'Invalid ID'}`);
    }

    // 5. Tenant isolation check (unless super_admin)
    if (adminProfile.platform_role !== 'super_admin' && targetEmployee.company_id !== adminProfile.company_id) {
      throw new Error('Forbidden: You cannot delete an employee belonging to another company');
    }

    // 6. Prevent self-deletion
    if (targetEmployee.user_id && targetEmployee.user_id === adminUser.id) {
      throw new Error('Action Blocked: You cannot delete your own Administrator account.');
    }

    const targetUserId = targetEmployee.user_id;
    const targetCompanyId = targetEmployee.company_id;
    const employeeFullName = `${targetEmployee.first_name || ''} ${targetEmployee.last_name || ''}`.trim();

    // 7. If BYOS is active for this tenant, clean up BYOS database first
    try {
      const { client: tenantClient, isBYOS } = await getTenantAdminClient(targetCompanyId);
      if (isBYOS) {
        // Execute cleanup on BYOS database
        await tenantClient.rpc('delete_employee_completely', {
          p_employee_id: employee_id,
          p_admin_id: adminUser.id,
        });
      }
    } catch (byosErr) {
      console.warn('[BYOS Cleanup Warning]:', byosErr);
      // Continue to ensure platform DB and Auth are cleaned up
    }

    // 8. Execute transactional PostgreSQL database cleanup on Platform DB
    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc('delete_employee_completely', {
      p_employee_id: employee_id,
      p_admin_id: adminUser.id,
    });

    if (rpcError) {
      console.error('[RPC Delete Error]:', rpcError);
      throw new Error(`Database cleanup failed: ${rpcError.message}`);
    }

    // 9. Permanently delete Auth account from Supabase Auth if user_id exists
    let authPurged = false;
    if (targetUserId) {
      const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(targetUserId);
      if (authDeleteError) {
        console.warn(`[Auth Delete Warning] Failed to delete auth user ${targetUserId}:`, authDeleteError);
      } else {
        authPurged = true;
      }
    }

    // 10. Clean up storage files (Avatar, payslips, documents if any)
    try {
      if (targetEmployee.avatar_url) {
        // Example URL: .../storage/v1/object/public/avatars/path/to/file.jpg
        const avatarUrl = targetEmployee.avatar_url;
        if (avatarUrl.includes('/avatars/')) {
          const parts = avatarUrl.split('/avatars/');
          if (parts.length > 1) {
            const filePath = decodeURIComponent(parts[1].split('?')[0]);
            await adminSupabase.storage.from('avatars').remove([filePath]);
          }
        }
      }

      // Cleanup payslips directory for this employee
      const { data: payslipFiles } = await adminSupabase.storage
        .from('payslips')
        .list(`${targetCompanyId}/${employee_id}`);
      if (payslipFiles && payslipFiles.length > 0) {
        const paths = payslipFiles.map((f) => `${targetCompanyId}/${employee_id}/${f.name}`);
        await adminSupabase.storage.from('payslips').remove(paths);
      }
    } catch (storageErr) {
      console.warn('[Storage Cleanup Warning]:', storageErr);
    }

    // 11. Log audit action
    try {
      await adminSupabase.from('audit_logs').insert({
        company_id: targetCompanyId,
        actor_id: adminUser.id,
        action: 'DELETE_EMPLOYEE_COMPLETELY',
        entity_type: 'employee',
        entity_id: employee_id,
        before_state: {
          full_name: employeeFullName,
          work_email: targetEmployee.work_email,
          user_id: targetUserId,
        },
        after_state: {
          deleted: true,
          auth_purged: authPurged,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn('[Audit Log Warning]:', auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Employee ${employeeFullName} and all associated data and login account were permanently deleted.`,
        deleted_employee_id: employee_id,
        deleted_user_id: targetUserId,
        auth_purged: authPurged,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Delete Employee Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
