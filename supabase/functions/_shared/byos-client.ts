import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Cache Supabase clients per tenant in memory
const clientCache = new Map<string, SupabaseClient>();

const keepAliveFetch: typeof fetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=60, max=1000",
    },
  });
};

/**
 * Platform Admin Client for Control Plane operations
 */
export function getPlatformAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export interface BYOSConnectionCredentials {
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string;
  status: string;
}

/**
 * Check if a tenant has BYOS active and return decrypted credentials.
 */
export async function getBYOSConnection(tenantId: string): Promise<BYOSConnectionCredentials | null> {
  const platform = getPlatformAdminClient();

  // 1. Verify tenant BYOS flag
  const { data: company, error: companyErr } = await platform
    .from("companies")
    .select("byos_enabled")
    .eq("id", tenantId)
    .single();

  if (companyErr || !company?.byos_enabled) return null;

  // 2. Fetch connection and decrypt service_role_key via RPC
  const { data: conn, error: connErr } = await platform
    .from("byos_connections")
    .select("supabase_url, supabase_anon_key, supabase_service_role_key_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .single();

  if (connErr || !conn) return null;

  const { data: decryptedKey, error: decErr } = await platform.rpc("byos_decrypt_key", {
    encrypted_key: conn.supabase_service_role_key_encrypted,
  });

  if (decErr || !decryptedKey) {
    console.error(`[BYOS] Failed to decrypt key for tenant ${tenantId}:`, decErr);
    return null;
  }

  return {
    supabase_url: conn.supabase_url,
    supabase_anon_key: conn.supabase_anon_key,
    service_role_key: decryptedKey as string,
    status: conn.status,
  };
}

/**
 * Returns the active admin Supabase client for a tenant.
 * Automatically routes to the customer's remote DB if BYOS is enabled.
 */
export async function getTenantAdminClient(tenantId: string): Promise<{
  client: SupabaseClient;
  isBYOS: boolean;
}> {
  const cached = clientCache.get(tenantId);
  if (cached) {
    return { client: cached, isBYOS: true };
  }

  const conn = await getBYOSConnection(tenantId);
  if (!conn) {
    return { client: getPlatformAdminClient(), isBYOS: false };
  }

  const customerClient = createClient(conn.supabase_url, conn.service_role_key, {
    global: { fetch: keepAliveFetch },
    auth: { persistSession: false },
  });

  clientCache.set(tenantId, customerClient);
  return { client: customerClient, isBYOS: true };
}

/**
 * Clear cached client instance (e.g. on disconnect or credential change)
 */
export function invalidateTenantClientCache(tenantId: string): void {
  clientCache.delete(tenantId);
}

/**
 * Writes an event to byos_audit_log
 */
export async function logBYOSAudit(
  tenantId: string,
  action: string,
  status: string,
  details: Record<string, unknown> = {},
  performedBy?: string
) {
  const platform = getPlatformAdminClient();
  await platform.from("byos_audit_log").insert({
    tenant_id: tenantId,
    action,
    status,
    details,
    performed_by: performedBy,
  });
}

/**
 * Tenant scoped domain tables ordered topologically by dependencies
 * (Parent tables first for sync, reverse for deletion)
 */
export const TENANT_SCOPED_TABLES = [
  "profiles",
  "departments",
  "designations",
  "shifts",
  "pay_grades",
  "salary_structures",
  "roles",
  "role_permissions",
  "user_roles",
  "employees",
  "employee_shifts",
  "leave_types",
  "leave_balances",
  "leave_requests",
  "attendance",
  "holidays",
  "payroll_runs",
  "payslips",
  "jobs",
  "candidates",
  "candidate_resume_embeddings",
  "interviews",
  "ai_interviews",
  "offer_templates",
  "candidate_offers",
  "recruitment_team_members",
  "onboarding_steps",
  "onboarding_progress",
  "onboarding_document_requirements",
  "onboarding_document_submissions",
  "onboarding_automations",
  "employee_exits",
  "company_locations",
  "compliance_rules",
  "kudos_board",
  "pulse_logs",
  "review_cycles",
  "performance_reviews",
  "goals",
  "surveys",
  "survey_responses",
  "tickets",
  "ticket_comments",
  "courses",
  "course_enrollments",
  "announcements",
  "announcement_reads",
  "company_documents",
  "senddesk_templates",
  "senddesk_documents",
  "senddesk_emails",
  "sprints",
  "tasks",
  "task_time_logs",
  "daily_reports",
  "workflows",
  "workflow_runs",
  "chat_conversations",
  "chat_participants",
  "chat_messages",
  "chat_presence",
  "notifications",
  "audit_logs"
] as const;
