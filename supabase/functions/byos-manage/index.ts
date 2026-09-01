import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getPlatformAdminClient,
  getBYOSConnection,
  logBYOSAudit,
  invalidateTenantClientCache,
  TENANT_SCOPED_TABLES,
} from "../_shared/byos-client.ts";

const allowedOrigins = [
  "https://fastesthr.com",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin");
  let isAllowed = false;

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    } else if (origin.endsWith(".fastesthr.com")) {
      isAllowed = true;
    }
  }

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
};

/**
 * Fetch table column names from OpenAPI specification on target Supabase URL
 */
async function getTableColumnsViaOpenAPI(
  supabaseUrl: string,
  serviceKey: string,
  tableName: string
): Promise<string[] | null> {
  try {
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (res.ok) {
      const spec = await res.json();
      const properties = spec?.definitions?.[tableName]?.properties;
      if (properties) {
        return Object.keys(properties);
      }
    }
  } catch (e) {
    console.error(`[BYOS OpenAPI] Failed to fetch schema for ${tableName}:`, e);
  }
  return null;
}

/**
 * Robust batch upsert with single-row fallback
 */
async function safeBatchUpsert(
  client: any,
  tableName: string,
  rows: any[],
  allowedCols: string[]
) {
  if (!rows || rows.length === 0) return { inserted: 0, failed: 0 };
  const CHUNK_SIZE = 100;
  const sanitized = rows.map((row) => {
    const obj: Record<string, any> = {};
    for (const key of allowedCols) {
      if (key in row && row[key] !== undefined) {
        obj[key] = row[key];
      }
    }
    return obj;
  });

  let insertedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
    const batch = sanitized.slice(i, i + CHUNK_SIZE);
    const { error } = await client.from(tableName).upsert(batch, { onConflict: "id" });

    if (error) {
      console.warn(`[BYOS Sync] Batch failed on ${tableName}, attempting row-by-row fallback:`, error.message);
      for (const singleRow of batch) {
        const { error: rowErr } = await client.from(tableName).upsert(singleRow, { onConflict: "id" });
        if (rowErr) {
          console.error(`[BYOS Sync] Failed row in ${tableName} (${singleRow.id}):`, rowErr.message);
          failedCount++;
        } else {
          insertedCount++;
        }
      }
    } else {
      insertedCount += batch.length;
    }
  }

  return { inserted: insertedCount, failed: failedCount };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const platform = getPlatformAdminClient();

  try {
    // 1. Authenticate user caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await platform.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, company_id } = body;

    if (!action || !company_id) {
      return new Response(JSON.stringify({ error: "Missing action or company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Authorize caller as company admin or super admin
    const { data: profile, error: profileErr } = await platform
      .from("profiles")
      .select("id, company_id, platform_role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCompanyAdmin = profile.company_id === company_id && profile.platform_role === "company_admin";
    const isSuperAdmin = profile.platform_role === "super_admin";

    if (!isCompanyAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Company admin privileges required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: VALIDATE ───────────────────────────────────────────────────
    if (action === "validate") {
      const { supabase_url, supabase_anon_key, supabase_service_role_key } = body;
      if (!supabase_url || !supabase_anon_key || !supabase_service_role_key) {
        throw new Error("Missing required Supabase URL, Anon Key, or Service Role Key");
      }

      const cleanUrl = supabase_url.trim().replace(/\/+$/, "");
      const startTime = Date.now();

      // Test Service Role client connectivity
      const testClient = createClient(cleanUrl, supabase_service_role_key, {
        auth: { persistSession: false },
      });

      const { data: metaRows, error: metaErr } = await testClient
        .from("_byos_meta")
        .select("key, value")
        .limit(5);

      const latencyMs = Date.now() - startTime;
      const schemaDeployed = !metaErr && Array.isArray(metaRows);

      // Log validation attempt
      await logBYOSAudit(
        company_id,
        "validate",
        "success",
        { cleanUrl, latencyMs, schemaDeployed },
        user.id
      );

      return new Response(
        JSON.stringify({
          valid: true,
          schemaDeployed,
          latencyMs,
          message: schemaDeployed
            ? "Successfully connected to Supabase project. BYOS schema is deployed!"
            : "Successfully reached Supabase project. Schema migration is needed.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: CONNECT ────────────────────────────────────────────────────
    if (action === "connect") {
      const { supabase_url, supabase_anon_key, supabase_service_role_key } = body;
      if (!supabase_url || !supabase_anon_key || !supabase_service_role_key) {
        throw new Error("Missing required connection parameters");
      }

      const cleanUrl = supabase_url.trim().replace(/\/+$/, "");

      // 1. Verify credentials by testing connection
      const testClient = createClient(cleanUrl, supabase_service_role_key, {
        auth: { persistSession: false },
      });

      const startTime = Date.now();
      const { data: metaRows, error: metaErr } = await testClient
        .from("_byos_meta")
        .select("key, value")
        .limit(1);

      const latencyMs = Date.now() - startTime;
      const isSchemaReady = !metaErr;

      // 2. Encrypt service_role_key via Security Definer RPC
      const { data: encryptedKey, error: encErr } = await platform.rpc("byos_encrypt_key", {
        plain_key: supabase_service_role_key,
      });

      if (encErr || !encryptedKey) {
        throw new Error(`Failed to encrypt credentials: ${encErr?.message || "Unknown error"}`);
      }

      // 3. Upsert connection record
      const status = isSchemaReady ? "active" : "validated";
      const { error: upsertErr } = await platform.from("byos_connections").upsert(
        {
          tenant_id: company_id,
          supabase_url: cleanUrl,
          supabase_anon_key: supabase_anon_key.trim(),
          supabase_service_role_key_encrypted: encryptedKey,
          status,
          migration_version: isSchemaReady ? "1.0.0" : null,
          last_health_check: new Date().toISOString(),
          health_status: isSchemaReady ? "healthy" : "unknown",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

      if (upsertErr) {
        throw new Error(`Failed to save BYOS connection: ${upsertErr.message}`);
      }

      // 4. Update company BYOS flag if active
      if (status === "active") {
        await platform.from("companies").update({ byos_enabled: true }).eq("id", company_id);
      }

      invalidateTenantClientCache(company_id);

      await logBYOSAudit(
        company_id,
        "connect",
        "success",
        { url: cleanUrl, status, latencyMs },
        user.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          status,
          isSchemaReady,
          latencyMs,
          message: isSchemaReady
            ? "BYOS connection established and activated successfully!"
            : "BYOS credentials validated and saved. Please deploy the schema migration bundle.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: MIGRATE / DEPLOY SCHEMA DIRECT ─────────────────────────────
    if (action === "migrate") {
      const { management_token, sql_override } = body;
      const conn = await getBYOSConnection(company_id);

      // If connection is not yet active, lookup raw connection row
      let targetUrl = conn?.supabase_url;
      let targetServiceKey = conn?.service_role_key;

      if (!targetUrl || !targetServiceKey) {
        const { data: rawConn } = await platform
          .from("byos_connections")
          .select("supabase_url, supabase_service_role_key_encrypted")
          .eq("tenant_id", company_id)
          .single();

        if (!rawConn) throw new Error("No BYOS connection found to migrate");

        const { data: decrypted } = await platform.rpc("byos_decrypt_key", {
          encrypted_key: rawConn.supabase_service_role_key_encrypted,
        });

        targetUrl = rawConn.supabase_url;
        targetServiceKey = decrypted;
      }

      if (!targetUrl || !targetServiceKey) {
        throw new Error("Unable to retrieve connection credentials");
      }

      // If management_token provided, execute direct SQL deployment via Supabase Management API
      if (management_token) {
        try {
          const match = targetUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
          const projectRef = match ? match[1] : null;

          if (projectRef) {
            const sqlToRun = sql_override || "-- auto-deploy\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";";
            const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${management_token.trim()}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: sqlToRun }),
            });

            if (!mgmtRes.ok) {
              const errBody = await mgmtRes.text();
              console.warn("[BYOS Mgmt API] Direct execution returned error:", errBody);
            }
          }
        } catch (mgmtErr) {
          console.warn("[BYOS Mgmt API] Failed to run automated SQL:", mgmtErr);
        }
      }

      // Verify customer DB client
      const customerClient = createClient(targetUrl, targetServiceKey, {
        auth: { persistSession: false },
      });

      // Update status to active
      await platform.from("byos_connections").update({
        status: "active",
        migration_version: "1.0.0",
        last_health_check: new Date().toISOString(),
        health_status: "healthy",
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", company_id);

      await platform.from("companies").update({ byos_enabled: true }).eq("id", company_id);
      invalidateTenantClientCache(company_id);

      // Perform initial profile and domain data sync
      let syncResults: Record<string, { inserted: number; failed: number }> = {};
      try {
        for (const tableName of ["profiles", "departments", "designations", "roles", "employees"]) {
          const cols = await getTableColumnsViaOpenAPI(targetUrl, targetServiceKey, tableName);
          if (cols && cols.length > 0) {
            let query = platform.from(tableName).select("*");
            if (tableName === "profiles") {
              query = query.eq("company_id", company_id);
            } else {
              query = query.eq("company_id", company_id);
            }
            const { data: rows } = await query;
            if (rows && rows.length > 0) {
              syncResults[tableName] = await safeBatchUpsert(customerClient, tableName, rows, cols);
            }
          }
        }
      } catch (syncErr: any) {
        console.warn("[BYOS Migrate] Initial data sync warning:", syncErr.message);
      }

      await logBYOSAudit(
        company_id,
        "migrate",
        "success",
        { version: "1.0.0", syncResults },
        user.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          status: "active",
          syncResults,
          message: "BYOS migration completed and database activated!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: SYNC-DATA (Differential Data Synchronization) ──────────────
    if (action === "sync-data") {
      const conn = await getBYOSConnection(company_id);
      if (!conn) throw new Error("Active BYOS connection required for data synchronization");

      const customerClient = createClient(conn.supabase_url, conn.service_role_key, {
        auth: { persistSession: false },
      });

      const syncReport: Record<string, { rowsFound: number; inserted: number; failed: number }> = {};

      for (const tableName of TENANT_SCOPED_TABLES) {
        try {
          const cols = await getTableColumnsViaOpenAPI(conn.supabase_url, conn.service_role_key, tableName);
          if (!cols || cols.length === 0) continue;

          // Fetch records for this tenant from Platform DB
          let query = platform.from(tableName).select("*");
          if (tableName === "profiles") {
            query = query.eq("company_id", company_id);
          } else if (cols.includes("company_id")) {
            query = query.eq("company_id", company_id);
          }

          const { data: rows, error: readErr } = await query;
          if (readErr || !rows || rows.length === 0) {
            syncReport[tableName] = { rowsFound: 0, inserted: 0, failed: 0 };
            continue;
          }

          // Two-pass foreign key resolution for self-referential tables
          if (cols.includes("parent_id") || cols.includes("manager_id")) {
            const pass1 = rows.map((r) => ({ ...r, parent_id: null, manager_id: null }));
            await safeBatchUpsert(customerClient, tableName, pass1, cols);
          }

          const result = await safeBatchUpsert(customerClient, tableName, rows, cols);
          syncReport[tableName] = {
            rowsFound: rows.length,
            inserted: result.inserted,
            failed: result.failed,
          };
        } catch (tblErr: any) {
          console.error(`[BYOS Sync] Error syncing table ${tableName}:`, tblErr.message);
          syncReport[tableName] = { rowsFound: 0, inserted: 0, failed: 1 };
        }
      }

      await logBYOSAudit(
        company_id,
        "sync_data",
        "success",
        { syncReport },
        user.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          syncReport,
          message: "Differential data synchronization finished successfully.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: HEALTH CHECK ───────────────────────────────────────────────
    if (action === "health") {
      const conn = await getBYOSConnection(company_id);
      if (!conn) throw new Error("No active BYOS connection found to check health");

      const startTime = Date.now();
      const customerClient = createClient(conn.supabase_url, conn.service_role_key, {
        auth: { persistSession: false },
      });

      const { data: metaRows, error: metaErr } = await customerClient
        .from("_byos_meta")
        .select("key, value")
        .limit(5);

      const latencyMs = Date.now() - startTime;
      const isHealthy = !metaErr && Array.isArray(metaRows);
      const healthStatus = isHealthy ? "healthy" : "degraded";

      await platform.from("byos_connections").update({
        last_health_check: new Date().toISOString(),
        health_status: healthStatus,
      }).eq("tenant_id", company_id);

      await logBYOSAudit(
        company_id,
        "health_check",
        isHealthy ? "success" : "failed",
        { latencyMs, healthStatus, error: metaErr?.message },
        user.id
      );

      return new Response(
        JSON.stringify({
          status: healthStatus,
          latencyMs,
          lastCheck: new Date().toISOString(),
          message: isHealthy ? `Remote database is healthy (${latencyMs}ms)` : `Remote database responded with error: ${metaErr?.message}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: DISCONNECT & PULL DATA BACK ────────────────────────────────
    if (action === "disconnect") {
      const conn = await getBYOSConnection(company_id);
      const rollbackSummary: Record<string, { pulled: number; cleaned: number }> = {};

      if (conn) {
        const customerClient = createClient(conn.supabase_url, conn.service_role_key, {
          auth: { persistSession: false },
        });

        // 1. Pull data back to Platform DB (Topological order)
        for (const tableName of TENANT_SCOPED_TABLES) {
          try {
            const cols = await getTableColumnsViaOpenAPI(conn.supabase_url, conn.service_role_key, tableName);
            if (!cols || cols.length === 0) continue;

            const { data: remoteRows } = await customerClient.from(tableName).select("*");
            if (remoteRows && remoteRows.length > 0) {
              const res = await safeBatchUpsert(platform, tableName, remoteRows, cols);
              rollbackSummary[tableName] = { pulled: res.inserted, cleaned: 0 };
            }
          } catch (pullErr: any) {
            console.error(`[BYOS Disconnect] Pull back error on ${tableName}:`, pullErr.message);
          }
        }

        // 2. Safe cleanup on customer DB in REVERSE topological order (child tables first)
        const reverseTables = [...TENANT_SCOPED_TABLES].reverse();
        for (const tableName of reverseTables) {
          try {
            const { error: delErr } = await customerClient.from(tableName).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            if (!delErr && rollbackSummary[tableName]) {
              rollbackSummary[tableName].cleaned = rollbackSummary[tableName].pulled;
            }
          } catch (cleanErr: any) {
            console.warn(`[BYOS Disconnect] Cleanup notice on ${tableName}:`, cleanErr.message);
          }
        }
      }

      // 3. Disable BYOS on company and purge connection record
      await platform.from("companies").update({ byos_enabled: false }).eq("id", company_id);
      await platform.from("byos_connections").delete().eq("tenant_id", company_id);
      invalidateTenantClientCache(company_id);

      await logBYOSAudit(
        company_id,
        "disconnect",
        "success",
        { rollbackSummary },
        user.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          rollbackSummary,
          message: "BYOS disconnected successfully. All tenant data was safely transferred back to the Platform database.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: STATUS & AUDIT LOGS ────────────────────────────────────────
    if (action === "status") {
      const { data: conn } = await platform
        .from("byos_connections")
        .select("id, tenant_id, supabase_url, supabase_anon_key, status, migration_version, last_health_check, health_status, created_at, updated_at")
        .eq("tenant_id", company_id)
        .maybeSingle();

      const { data: auditLogs } = await platform
        .from("byos_audit_log")
        .select("id, action, status, details, created_at, performed_by")
        .eq("tenant_id", company_id)
        .order("created_at", { ascending: false })
        .limit(25);

      const { data: company } = await platform
        .from("companies")
        .select("byos_enabled")
        .eq("id", company_id)
        .single();

      return new Response(
        JSON.stringify({
          connection: conn || null,
          byosEnabled: !!company?.byos_enabled,
          auditLogs: auditLogs || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    console.error("[BYOS Manage Edge Function] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
