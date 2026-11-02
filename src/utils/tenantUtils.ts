/**
 * Multi-tenant routing utilities for company career pages.
 * Supports: {slug}.fastesthr.com, custom domains, and path-based /company/{slug}
 */

export function getCompanySlugFromHost(): string | null {
  const host = window.location.hostname;

  // Local development — no subdomain detection
  if (host === 'localhost' || host === '127.0.0.1') return null;

  // {slug}.fastesthr.com
  const subdomainMatch = host.match(/^([^.]+)\.fastesthr\.com$/);
  if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'app') {
    return subdomainMatch[1];
  }

  // Custom domain — we'll query the DB for this later
  // For now, if it's not fastesthr.com, return the full hostname as a potential custom domain
  if (!host.includes('fastesthr.com') && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('pages.dev') && !host.includes('vercel.app') && !host.includes('lovable.app') && !host.includes('lovableproject.com')) {
    return host; // will be resolved as custom_domain in the career page
  }

  return null;
}

/**
 * Generates a URL-safe slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
