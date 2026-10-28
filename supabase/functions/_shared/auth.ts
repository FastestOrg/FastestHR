import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const getCorsHeaders = (req?: Request) => {
  const origin = req?.headers.get('Origin') || '';
  const isAllowed =
    origin === 'https://fastesthr.com' ||
    origin.endsWith('.fastesthr.com') ||
    origin.endsWith('.vercel.app') ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    origin.startsWith('capacitor://');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (origin || '*'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
};

export interface CallerAuthContext {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    platform_role: string;
    company_id: string | null;
    full_name: string | null;
    email?: string | null;
  };
  adminClient: any;
}

/**
 * Authenticates the caller via Supabase Bearer JWT and loads their profile.
 * Throws an Error if unauthorized.
 */
export async function authenticateCaller(req: Request): Promise<CallerAuthContext> {
  let token = '';
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (authHeader) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else {
    try {
      const url = new URL(req.url);
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        token = queryToken.trim();
      }
    } catch {
      // ignore URL parsing error
    }
  }

  if (!token) {
    throw new Error('Unauthorized: Missing Authorization header or token query parameter');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server configuration error: Supabase environment variables missing');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Support internal service_role key invocations (e.g. pg_net cron jobs, database webhooks)
  if (token === serviceRoleKey) {
    return {
      user: { id: 'service_role', email: 'system@internal.fastesthr.com' },
      profile: {
        id: 'service_role',
        platform_role: 'super_admin',
        company_id: null,
        full_name: 'System Internal Service',
        email: 'system@internal.fastesthr.com',
      },
      adminClient,
    };
  }

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    throw new Error(`Unauthorized: ${userError?.message || 'Invalid or expired session'}`);
  }

  // 1. Fetch user profile from public.profiles (omitting 'email' as email is stored on auth.users)
  let { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, platform_role, company_id, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('authenticateCaller: Error querying public.profiles for user', user.id, profileError);
  }

  // 2. Fallback: If profile row is missing in public.profiles, attempt recovery via employees and user_metadata
  if (!profile) {
    console.warn(`authenticateCaller: Profile missing in public.profiles for user ${user.id}. Attempting fallback lookup.`);

    const { data: emp, error: empError } = await adminClient
      .from('employees')
      .select('id, company_id, first_name, last_name, status')
      .or(`user_id.eq.${user.id},work_email.ilike.${user.email || ''}`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (empError) {
      console.warn('authenticateCaller: Fallback employee lookup failed:', empError);
    }

    const metaRole = (user.user_metadata?.platform_role as string) || (emp ? 'hr_manager' : 'user');
    const metaCompanyId = (emp?.company_id as string) || (user.user_metadata?.company_id as string) || null;
    const metaFullName = emp
      ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      : (user.user_metadata?.full_name as string) || (user.email ? user.email.split('@')[0] : 'User');

    if (metaCompanyId) {
      // Auto-heal missing profile row so future lookups are fast and persistent
      const { data: healedProfile, error: upsertError } = await adminClient
        .from('profiles')
        .upsert({
          id: user.id,
          company_id: metaCompanyId,
          full_name: metaFullName,
          platform_role: metaRole,
          is_active: true,
        }, { onConflict: 'id' })
        .select('id, platform_role, company_id, full_name')
        .maybeSingle();

      if (upsertError) {
        console.warn('authenticateCaller: Auto-heal profile upsert failed:', upsertError);
      }

      profile = healedProfile || {
        id: user.id,
        platform_role: metaRole,
        company_id: metaCompanyId,
        full_name: metaFullName,
      };
    }
  }

  // 3. Ensure company_id is populated if previously null
  if (profile && !profile.company_id) {
    const fallbackCompanyId = (user.user_metadata?.company_id as string) || null;
    if (fallbackCompanyId) {
      profile.company_id = fallbackCompanyId;
      await adminClient.from('profiles').update({ company_id: fallbackCompanyId }).eq('id', user.id);
    } else {
      const { data: emp } = await adminClient
        .from('employees')
        .select('company_id')
        .or(`user_id.eq.${user.id},work_email.ilike.${user.email || ''}`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (emp?.company_id) {
        profile.company_id = emp.company_id;
        await adminClient.from('profiles').update({ company_id: emp.company_id }).eq('id', user.id);
      }
    }
  }

  // 4. Ensure platform_role matches elevated role if user was invited/assigned as HR manager or admin
  if (profile && profile.platform_role === 'user') {
    const metaRole = user.user_metadata?.platform_role as string;
    if (metaRole && ['company_admin', 'hr_manager', 'recruiter'].includes(metaRole)) {
      profile.platform_role = metaRole;
      await adminClient.from('profiles').update({ platform_role: metaRole }).eq('id', user.id);
    }
  }

  if (!profile) {
    throw new Error('Unauthorized: User profile not found');
  }

  return {
    user: { id: user.id, email: user.email },
    profile: {
      ...profile,
      email: user.email || null,
    },
    adminClient,
  };
}

/**
 * Ensures caller is authenticated, belongs to authorized staff roles,
 * and matches the target company_id (multi-tenant boundary).
 */
export async function requireCompanyStaff(
  req: Request,
  targetCompanyId?: string | null,
  allowedRoles: string[] = ['super_admin', 'company_admin', 'hr_manager', 'recruiter']
): Promise<CallerAuthContext> {
  const ctx = await authenticateCaller(req);
  const { profile } = ctx;

  // Super admin has global tenant oversight
  if (profile.platform_role === 'super_admin') {
    return ctx;
  }

  // Verify caller possesses an allowed role
  if (!allowedRoles.includes(profile.platform_role)) {
    throw new Error(`Forbidden: Role '${profile.platform_role}' is not authorized for this operation`);
  }

  // Enforce company tenant boundary
  if (targetCompanyId && profile.company_id !== targetCompanyId) {
    throw new Error('Forbidden: Caller does not have access to this company resource');
  }

  return ctx;
}
