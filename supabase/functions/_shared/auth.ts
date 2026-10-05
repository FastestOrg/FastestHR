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

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, platform_role, company_id, full_name, email')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Unauthorized: User profile not found');
  }

  return {
    user: { id: user.id, email: user.email },
    profile,
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
