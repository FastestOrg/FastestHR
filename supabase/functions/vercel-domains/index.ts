import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERCEL_TOKEN = Deno.env.get("VERCEL_API_TOKEN") || Deno.env.get("VERCEL_TOKEN") || "";
const VERCEL_TEAM_ID = Deno.env.get("VERCEL_TEAM_ID") || "team_xfZlqEvDqHPUyAK28HchmSxA";
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID") || "prj_31kRA3C1gScvpNcNWGwfkW4vBIhJ";
const BASE_DOMAIN = Deno.env.get("BASE_DOMAIN") || "fastesthr.com";

async function vercelFetch(path: string, options: RequestInit = {}) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${VERCEL_TEAM_ID}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || JSON.stringify(body));
  }
  return body;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");

  const userId = data.claims.sub as string;

  // Get profile to verify company_admin
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("company_id, platform_role")
    .eq("id", userId)
    .single();

  if (!profile || profile.platform_role !== "company_admin") {
    throw new Error("Only company admins can manage domains");
  }

  return { userId, companyId: profile.company_id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const { companyId } = await authenticate(req);
    const admin = getSupabaseAdmin();

    // Get company data
    const { data: company } = await admin
      .from("companies")
      .select("slug, custom_domain, domain_verified, domain_config")
      .eq("id", companyId)
      .single();

    if (!company) throw new Error("Company not found");

    switch (action) {
      case "get_status": {
        return new Response(
          JSON.stringify({
            slug: company.slug,
            subdomain: `${company.slug}.${BASE_DOMAIN}`,
            custom_domain: company.custom_domain,
            domain_verified: company.domain_verified,
            domain_config: company.domain_config,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_slug": {
        const { slug } = params;
        if (!slug || typeof slug !== "string") {
          throw new Error("Slug is required");
        }
        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (cleanSlug.length < 3) {
          throw new Error("Slug must be at least 3 characters");
        }
        if (["www", "app", "api", "admin", "mail", "ftp", "cdn"].includes(cleanSlug)) {
          throw new Error("This slug is reserved");
        }

        // Check availability
        const { data: existing } = await admin
          .from("companies")
          .select("id")
          .eq("slug", cleanSlug)
          .neq("id", companyId)
          .maybeSingle();
        if (existing) throw new Error("Slug already taken");

        // Remove old subdomain from Vercel
        const oldDomain = `${company.slug}.${BASE_DOMAIN}`;
        try {
          await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${oldDomain}`, { method: "DELETE" });
        } catch (_e) { /* might not exist */ }

        // Add new subdomain to Vercel
        const newDomain = `${cleanSlug}.${BASE_DOMAIN}`;
        try {
          await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
            method: "POST",
            body: JSON.stringify({ name: newDomain }),
          });
        } catch (e: any) {
          if (!e.message?.includes("already")) throw e;
        }

        // Update database
        await admin.from("companies").update({ slug: cleanSlug }).eq("id", companyId);

        return new Response(
          JSON.stringify({ success: true, slug: cleanSlug, subdomain: newDomain }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "add_subdomain": {
        // Add slug.fastesthr.com to Vercel project
        const domain = `${company.slug}.${BASE_DOMAIN}`;
        try {
          await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
            method: "POST",
            body: JSON.stringify({ name: domain }),
          });
        } catch (e: any) {
          // Domain might already exist, that's ok
          if (!e.message?.includes("already")) throw e;
        }
        return new Response(
          JSON.stringify({ success: true, domain }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "add_custom_domain": {
        const { domain } = params;
        if (!domain || typeof domain !== "string") {
          throw new Error("Domain is required");
        }

        const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

        // Add domain to Vercel project
        const result = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
          method: "POST",
          body: JSON.stringify({ name: cleanDomain }),
        });

        // Get domain config from Vercel to show DNS requirements
        const domainInfo = await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${cleanDomain}`);

        // Build the config to show user
        const config: any = {
          domain: cleanDomain,
          verified: domainInfo.verified || false,
          records: [],
        };

        // Compute correct CNAME host: for hr.weskill.org → "hr", for example.com → "@"
        const domainParts = cleanDomain.split('.');
        const cnameHost = domainParts.length > 2 ? domainParts.slice(0, domainParts.length - 2).join('.') : '@';

        config.records.push({
          type: "CNAME",
          host: cnameHost,
          value: `cname.${BASE_DOMAIN}`,
        });

        // Get verification records if not verified
        if (!domainInfo.verified) {
          try {
            const verifyInfo = await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${cleanDomain}/verify`, {
              method: "POST",
            });
            if (verifyInfo.verification) {
              for (const v of verifyInfo.verification) {
                config.records.push({
                  type: v.type,
                  host: v.domain || '_vercel',
                  value: v.value,
                });
              }
            }
            config.verified = verifyInfo.verified || false;
          } catch (_e) {
            // verification might fail, that's ok - we'll show what we have
          }
        }

        // Save to database
        await admin
          .from("companies")
          .update({
            custom_domain: cleanDomain,
            domain_verified: config.verified,
            domain_config: config,
          })
          .eq("id", companyId);

        return new Response(
          JSON.stringify({ success: true, config }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify_domain": {
        if (!company.custom_domain) {
          throw new Error("No custom domain configured");
        }

        // Verify the domain with Vercel
        const verifyResult = await vercelFetch(
          `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}/verify`,
          { method: "POST" }
        );

        const verified = verifyResult.verified || false;
        const config = company.domain_config || {};

        // Compute correct CNAME host
        const domainParts = company.custom_domain.split('.');
        const cnameHost = domainParts.length > 2 ? domainParts.slice(0, domainParts.length - 2).join('.') : '@';

        // Update verification records
        const updatedConfig: any = {
          ...config,
          verified,
          records: [],
        };

        updatedConfig.records.push({
          type: "CNAME",
          host: cnameHost,
          value: `cname.${BASE_DOMAIN}`,
        });

        if (verifyResult.verification) {
          for (const v of verifyResult.verification) {
            updatedConfig.records.push({
              type: v.type,
              host: v.domain || '_vercel',
              value: v.value,
            });
          }
        }

        await admin
          .from("companies")
          .update({
            domain_verified: verified,
            domain_config: updatedConfig,
          })
          .eq("id", companyId);

        return new Response(
          JSON.stringify({ success: true, verified, config: updatedConfig }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "remove_domain": {
        if (!company.custom_domain) {
          throw new Error("No custom domain configured");
        }

        // Remove from Vercel
        try {
          await vercelFetch(
            `/v9/projects/${VERCEL_PROJECT_ID}/domains/${company.custom_domain}`,
            { method: "DELETE" }
          );
        } catch (_e) {
          // Domain might not exist on Vercel, that's ok
        }

        // Clear from database
        await admin
          .from("companies")
          .update({
            custom_domain: null,
            domain_verified: false,
            domain_config: null,
          })
          .eq("id", companyId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
