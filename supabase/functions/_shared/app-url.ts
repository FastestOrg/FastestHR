/**
 * Resolves the canonical public web application base URL.
 * Ensures that external links sent in emails to candidates, employees, and clients
 * NEVER contain localhost, 127.0.0.1, or capacitor:// addresses.
 */
export function getPublicAppUrl(
  req?: Request,
  company?: {
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    slug?: string | null;
  } | null,
  bodyUrl?: string | null
): string {
  const isLocalOrInternal = (url: string | null | undefined): boolean => {
    if (!url) return true;
    const lower = url.toLowerCase().trim();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower.startsWith('capacitor://') ||
      lower.startsWith('ionic://') ||
      lower.startsWith('file://')
    );
  };

  const sanitizeUrl = (url: string): string => {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  };

  // 1. Explicit valid public URL from request body (if provided and non-local)
  if (bodyUrl && !isLocalOrInternal(bodyUrl)) {
    return sanitizeUrl(bodyUrl);
  }

  // 2. Request Origin header (if non-local public web URL)
  const origin = req?.headers.get('origin');
  if (origin && !isLocalOrInternal(origin)) {
    return sanitizeUrl(origin);
  }

  // 3. Request Referer header (if non-local public web URL)
  const referer = req?.headers.get('referer');
  if (referer && !isLocalOrInternal(referer)) {
    try {
      const refUrl = new URL(referer);
      if (!isLocalOrInternal(refUrl.origin)) {
        return sanitizeUrl(refUrl.origin);
      }
    } catch {
      // ignore malformed referer
    }
  }

  // 4. Environment variable configured in Supabase (APP_URL or PUBLIC_APP_URL or SITE_URL)
  const envUrl = (globalThis as any).Deno?.env?.get('APP_URL') ||
                 (globalThis as any).Deno?.env?.get('PUBLIC_APP_URL') ||
                 (globalThis as any).Deno?.env?.get('SITE_URL');
  if (envUrl && !isLocalOrInternal(envUrl)) {
    return sanitizeUrl(envUrl);
  }

  // 5. Company custom domain (if verified)
  if (company?.custom_domain && company?.domain_verified && !isLocalOrInternal(company.custom_domain)) {
    return sanitizeUrl(company.custom_domain);
  }

  // 6. Default canonical platform URL
  return 'https://fastesthr.com';
}

/**
 * Standard CORS headers that allow local development environments (e.g. Vite on 5173/8080)
 * to communicate with Supabase edge functions without throwing CORS errors,
 * while ensuring sensitive production origins remain secured.
 */
export const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  const isAllowed =
    origin === 'https://fastesthr.com' ||
    origin.endsWith('.fastesthr.com') ||
    origin.endsWith('.vercel.app') ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    origin.startsWith('capacitor://');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://fastesthr.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};
