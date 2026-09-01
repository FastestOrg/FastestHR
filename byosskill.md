# BYOS (Bring Your Own Supabase / Backend) — Universal Production Implementation Skill

> **Target Audience**: AI Coding Assistants & Senior Engineers  
> **Objective**: Transform **any** standard multi-tenant web application into a hybrid **BYOS (Bring Your Own Supabase / Backend)** architecture, enabling organizations/tenants to connect their own dedicated database while preserving centralized authentication, licensing, and shared serverless functions.

---

## 📑 Table of Contents

1. [Architecture & System Design](#1-architecture--system-design)
2. [Project Discovery & Parameter Mapping](#2-project-discovery--parameter-mapping)
3. [Database Layer: Control Plane (Main Database)](#3-database-layer-control-plane-main-database)
4. [Database Layer: Data Plane (Customer Database & Migration Bundle)](#4-database-layer-data-plane-customer-database--migration-bundle)
5. [Backend / Edge Gateway (`_shared/byos-client.ts` & `byos-manage`)](#5-backend--edge-gateway-_sharedbyos-clientts--byos-manage)
6. [Frontend Client Factory & Singleton Architecture](#6-frontend-client-factory--singleton-architecture)
7. [Frontend State Management (`BYOSContext` & `useOrgClient`)](#7-frontend-state-management-byoscontext--useorgclient)
8. [Query Optimization & Dual-Engine Query Pattern](#8-query-optimization--dual-engine-query-pattern)
9. [Dynamic Schema Resilience & 404 Cache](#9-dynamic-schema-resilience--404-cache)
10. [Data Migration, Sync & Disconnect Engine](#10-data-migration-sync--disconnect-engine)
11. [UI/UX Component (`BYOSSettings.tsx`)](#11-uiux-component-byossettingstsx)
12. [Public Endpoints & Webhook Routing](#12-public-endpoints--webhook-routing)
13. [Step-by-Step AI Implementation Checklist](#13-step-by-step-ai-implementation-checklist)

---

## 1. Architecture & System Design

### 1.1 The Hybrid Multi-Tenant / Single-Tenant Model

In a standard SaaS application, all tenant data is stored in a single PostgreSQL database partitioned by a tenant foreign key (e.g. `tenant_id`, `org_id`, `company_id`, `workspace_id`).

**BYOS decouples the Control Plane from the Data Plane**:

```
                              ┌─────────────────────────────────────────┐
                              │               USER CLIENT               │
                              │           (Browser / Mobile)            │
                              └────────────────────┬────────────────────┘
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        │                                                     │
         [Auth / Licensing / BYOS Config]                             [Tenant-Scoped Data]
                        │                                                     │
                        ▼                                                     ▼
     ┌─────────────────────────────────────┐               ┌─────────────────────────────────────┐
     │      CONTROL PLANE (MAIN DB)        │               │       DATA PLANE (BYOS DB)          │
     │      - auth.users & sessions        │               │   (Single-tenant customer project)  │
     │      - tenants/orgs & subscriptions │               │  - Business domain records          │
     │      - byos_connections (encrypted) │               │  - Orders, items, records, documents│
     │      - profiles & roles (global)    │               │  - Tasks, forms, audit logs         │
     │      - billing & platform settings  │               │  - Custom domain entities           │
     └─────────────────────────────────────┘               └─────────────────────────────────────┘
                        ▲                                                     ▲
                        │                                                     │
                        └──────────────────┬──────────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │       HOSTED EDGE FUNCTIONS         │
                        │    (Dynamically injects remote DB   │
                        │    client via getTenantAdminClient) │
                        └─────────────────────────────────────┘
```

### 1.2 Core Architectural Principles

1. **Zero Edge Function Deployment on Customer Project**:
   - Customers **never** need to install Deno runtimes, edge functions, or server workers on their Supabase project.
   - All serverless logic remains hosted centrally on your platform gateway.
   - Serverless functions dynamically instantiate a remote `SupabaseClient` pointing to the customer's Supabase URL using decrypted Service Role keys (`getTenantAdminClient(tenantId)`).

2. **Strict Credential Isolation**:
   - Customer `service_role_key` is encrypted at rest using PostgreSQL `pgcrypto` (`pgp_sym_encrypt`) on the Control Plane.
   - The `service_role_key` is **NEVER** exposed to the frontend browser client.
   - Frontend only receives the customer's `supabase_url` and `supabase_anon_key` via authenticated RPC (`get_byos_connection`).

3. **Zero-Breakage Fallback**:
   - If a tenant has BYOS disabled (`byos_enabled = false`), 100% of data reads and writes execute against the Main Database without any code or schema divergence.

---

## 2. Project Discovery & Parameter Mapping

Before writing code or running migrations, the AI agent **must inspect the target codebase** and identify the following 5 parameters:

| Variable | Description | Typical Examples |
| :--- | :--- | :--- |
| `<TENANT_TABLE>` | The table representing the organization or tenant | `organizations`, `companies`, `workspaces`, `teams`, `accounts`, `tenants` |
| `<TENANT_ID_COL>` | The foreign key column used to scope business tables | `organization_id`, `company_id`, `workspace_id`, `team_id`, `tenant_id` |
| `<TENANT_ADMIN_CHECK>` | The SQL condition that checks if `auth.uid()` is an admin/owner | `<TENANT_TABLE>.owner_id = auth.uid()` or via a membership table check |
| `<TENANT_CONTEXT_HOOK>` | The frontend hook or context providing the current tenant ID | `useTenant()`, `useOrg()`, `useWorkspace()`, `useCompany()`, `useAuth()` |
| `<DOMAIN_TABLES>` | All tables containing tenant-scoped business data to migrate | e.g. `projects`, `items`, `invoices`, `contacts`, `tasks`, `documents` |

### 2.1 Discovery Checklist for the AI Agent:
1. Search schema / migrations for the root tenant entity (e.g. `grep "CREATE TABLE" supabase/migrations/` or inspect `src/integrations/supabase/types.ts`).
2. Identify how admin permissions are enforced in RLS policies on the tenant table.
3. Categorize tables into:
   - **Control Plane Tables** (Stay on Main DB): `auth.*`, `<TENANT_TABLE>`, `subscriptions`, `plans`, `byos_*`, `platform_settings`.
   - **Data Plane Tables** (Mirrored to Customer BYOS DB): All tables referencing `<TENANT_ID_COL>`.

---

## 3. Database Layer: Control Plane (Main Database)

Execute these migrations on the **Main Platform Database**. Substitute `<TENANT_TABLE>`, `<TENANT_ID_COL>`, and `<TENANT_ADMIN_CHECK>` with your project's specific identifiers.

### 3.1 Enable Encryption & Setup GUC Settings

```sql
-- 1. Enable pgcrypto extension with explicit schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Safely initialize session configuration parameter
DO $$
BEGIN
  PERFORM set_config('app.settings.byos_encryption_key', 'byos-default-key-change-in-production', false);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
```

### 3.2 Create `byos_connections` and `byos_audit_log`

```sql
-- 1. BYOS Connections Table
CREATE TABLE IF NOT EXISTS public.byos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.<TENANT_TABLE>(id) ON DELETE CASCADE,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  -- Encrypted at rest via pgcrypto
  supabase_service_role_key_encrypted BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN (
      'pending_validation', 'validating', 'validated',
      'migration_running', 'migration_failed',
      'active', 'disconnecting', 'migrating_back', 'error'
    )),
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 2. Add BYOS flag to your tenant table
ALTER TABLE public.<TENANT_TABLE> ADD COLUMN IF NOT EXISTS byos_enabled BOOLEAN NOT NULL DEFAULT false;

-- 3. BYOS Audit Log Table
CREATE TABLE IF NOT EXISTS public.byos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.<TENANT_TABLE>(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'connect', 'validate', 'migrate', 'health_check',
      'disconnect', 'migrate_back', 'error'
    )),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  details JSONB DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.byos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.byos_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Only tenant admins can manage their connection
-- Adapt the subquery condition to match your tenant admin authorization pattern
CREATE POLICY "byos_connections_admin_all"
  ON public.byos_connections FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM public.<TENANT_TABLE> WHERE <TENANT_ADMIN_CHECK>
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.<TENANT_TABLE> WHERE <TENANT_ADMIN_CHECK>
    )
  );

CREATE POLICY "byos_audit_log_admin_select"
  ON public.byos_audit_log FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.<TENANT_TABLE> WHERE <TENANT_ADMIN_CHECK>
    )
  );

CREATE POLICY "byos_audit_log_service_insert"
  ON public.byos_audit_log FOR INSERT
  WITH CHECK (true);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_byos_connections_tenant_id ON public.byos_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_byos_connections_status ON public.byos_connections(status);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_tenant_id ON public.byos_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_created_at ON public.byos_audit_log(created_at DESC);
```

### 3.3 Key Encryption / Decryption Helper Functions

```sql
-- Encryption Function (Accessible to service definers)
CREATE OR REPLACE FUNCTION public.byos_encrypt_key(plain_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN extensions.pgp_sym_encrypt(plain_key, passphrase);
END;
$$;

-- Decryption Function (Accessible only to backend service_role / security definers)
CREATE OR REPLACE FUNCTION public.byos_decrypt_key(encrypted_key BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN extensions.pgp_sym_decrypt(encrypted_key, passphrase);
END;
$$;
```

### 3.4 Safe Frontend RPC Endpoint

```sql
-- Secure RPC to retrieve connection details for the frontend
-- Note: Service role key is STRICTLY EXCLUDED from this return payload
CREATE OR REPLACE FUNCTION public.get_byos_connection(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  supabase_url TEXT,
  supabase_anon_key TEXT,
  status TEXT,
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT,
  byos_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.supabase_url,
    bc.supabase_anon_key,
    bc.status,
    bc.migration_version,
    bc.last_health_check,
    bc.health_status,
    t.byos_enabled
  FROM public.byos_connections bc
  JOIN public.<TENANT_TABLE> t ON t.id = bc.tenant_id
  WHERE bc.tenant_id = p_tenant_id
    AND (
      -- Verify caller is admin or service_role
      t.id IN (SELECT id FROM public.<TENANT_TABLE> WHERE <TENANT_ADMIN_CHECK>)
      OR auth.role() = 'service_role'
    );
END;
$$;
```

---

## 4. Database Layer: Data Plane (Customer Database & Migration Bundle)

The customer's Supabase project needs all business tables, custom enums, extensions, and single-tenant RLS policies.

Create a bundled SQL string file `byos-migration-bundle.ts` (and a `.sql` companion for manual copying in the UI):

```sql
-- ============================================================================
-- Customer BYOS Migration Bundle (Data Plane)
-- ============================================================================

-- 1. Metadata Tracking Table
CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public._byos_meta (key, value)
VALUES ('migration_version', '1.0.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 3. Mirrored Domain Tables
-- [AI Agent: Insert your project's domain tables schema here]
-- Example generic profile table:
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  <TENANT_ID_COL> UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. High-Performance Single-Tenant RLS Policies (USING true)
-- On a dedicated single-tenant customer database instance:
-- Eliminate multi-tenant subqueries to maximize PostgREST throughput.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_profiles_all" ON public.profiles;
CREATE POLICY "byos_profiles_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Repeat for each domain table:
-- ALTER TABLE public.<DOMAIN_TABLE> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "byos_<DOMAIN_TABLE>_all" ON public.<DOMAIN_TABLE> FOR ALL USING (true) WITH CHECK (true);

-- 5. Direct Column Indexes
-- Composite (tenant_id, created_at) indexes can be replaced with direct single-column indexes:
CREATE INDEX IF NOT EXISTS idx_byos_profiles_created_at ON public.profiles(created_at DESC);
```

---

## 5. Backend / Edge Gateway (`_shared/byos-client.ts` & `byos-manage`)

### 5.1 Remote Dynamic Client Provider (`_shared/byos-client.ts`)

```typescript
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

export function getPlatformAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

/**
 * Check if a tenant has BYOS active and return connection credentials.
 */
export async function getBYOSConnection(tenantId: string): Promise<{
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string;
  status: string;
} | null> {
  const platform = getPlatformAdminClient();

  // 1. Verify tenant BYOS flag
  const { data: tenant } = await platform
    .from("<TENANT_TABLE>")
    .select("byos_enabled")
    .eq("id", tenantId)
    .single();

  if (!tenant?.byos_enabled) return null;

  // 2. Fetch connection and decrypt service_role_key via RPC
  const { data: conn } = await platform
    .from("byos_connections")
    .select("supabase_url, supabase_anon_key, supabase_service_role_key_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .single();

  if (!conn) return null;

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

// AI Agent: Populate this array with all tenant-scoped domain tables in your project
export const TENANT_SCOPED_TABLES = [
  // e.g. "profiles", "projects", "tasks", "items", "documents"
] as const;
```

### 5.2 Management Edge Function (`byos-manage/index.ts`)

Create a Deno Edge Function at `supabase/functions/byos-manage/index.ts` supporting the following actions:
- `validate`: Tests connectivity and authorization using the provided Anon & Service Role keys.
- `connect`: Validates credentials, encrypts the Service Role key via `byos_encrypt_key`, and saves the record in `byos_connections`.
- `migrate`: Provisions schema (if Supabase Management token is provided) or validates schema, syncs profiles and copies tenant rows from Platform DB to Customer DB.
- `sync-data`: Re-runs differential data synchronization without altering connection status.
- `health`: Executes a ping query (`SELECT count(*) FROM _byos_meta`) to verify health.
- `disconnect`: Performs a safe pull-back of all rows from Customer DB to Platform DB, resets `byos_enabled = false`, and purges the connection record.
- `status`: Fetches connection stats, last health check timestamp, and audit trail.

---

## 6. Frontend Client Factory & Singleton Architecture

In your frontend Supabase integration client file (e.g. `src/integrations/supabase/client.ts` or `src/lib/supabase.ts`):

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const DIRECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Default platform client for Auth, Subscriptions & Control Plane
export const supabase = createClient<Database>(DIRECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
  },
});

// ─── BYOS Client Factory & Singleton Cache ──────────────────────────────────
// Maps cacheKey: `${url}|${anonKey}` -> SupabaseClient instance
const byosClientCache = new Map<string, SupabaseClient<Database>>();

export function createTenantSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  const cacheKey = `${url}|${anonKey}`;
  const cached = byosClientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-byos-${url.slice(-8)}`,
    },
  });

  byosClientCache.set(cacheKey, client);
  return client;
}

export function clearBYOSClientCache(): void {
  byosClientCache.clear();
}
```

---

## 7. Frontend State Management (`BYOSContext` & `useOrgClient`)

### 7.1 `BYOSContext.tsx`

```tsx
import { createContext, useContext, useMemo, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase, createTenantSupabaseClient } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// AI Agent: Import your project's Auth and Tenant hooks here
// e.g. import { useAuth } from '@/hooks/useAuth';
// e.g. import { useTenant } from '@/hooks/useTenant';

export interface BYOSConnection {
  id: string;
  supabase_url: string;
  supabase_anon_key: string;
  status: string;
  migration_version: string | null;
  last_health_check: string | null;
  health_status: string;
  byos_enabled: boolean;
}

interface BYOSContextType {
  orgClient: SupabaseClient<Database>;
  isBYOS: boolean;
  byosStatus: string | null;
  healthStatus: string | null;
  isLoading: boolean;
  byosUrl: string | null;
}

const BYOSContext = createContext<BYOSContextType>({
  orgClient: supabase,
  isBYOS: false,
  byosStatus: null,
  healthStatus: null,
  isLoading: false,
  byosUrl: null,
});

export function BYOSProvider({ 
  children, 
  tenantId, 
  byosEnabled = false 
}: { 
  children: ReactNode;
  tenantId?: string | null;
  byosEnabled?: boolean;
}) {
  const { data: byosConn, isLoading } = useQuery({
    queryKey: ['byos-connection', tenantId],
    queryFn: async (): Promise<BYOSConnection | null> => {
      if (!tenantId || !byosEnabled) return null;

      const { data, error } = await supabase.rpc('get_byos_connection', {
        p_tenant_id: tenantId,
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return row as BYOSConnection;
    },
    enabled: !!tenantId && byosEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  const orgClient = useMemo(() => {
    if (
      byosConn &&
      byosConn.byos_enabled &&
      byosConn.status === 'active' &&
      byosConn.supabase_url &&
      byosConn.supabase_anon_key
    ) {
      return createTenantSupabaseClient(byosConn.supabase_url, byosConn.supabase_anon_key);
    }
    return supabase;
  }, [byosConn]);

  const contextValue = useMemo<BYOSContextType>(
    () => ({
      orgClient,
      isBYOS: !!byosConn?.byos_enabled && byosConn?.status === 'active',
      byosStatus: byosConn?.status || null,
      healthStatus: byosConn?.health_status || null,
      isLoading,
      byosUrl: byosConn?.supabase_url || null,
    }),
    [orgClient, byosConn, isLoading]
  );

  return <BYOSContext.Provider value={contextValue}>{children}</BYOSContext.Provider>;
}

export function useBYOS() {
  return useContext(BYOSContext);
}
```

### 7.2 `useOrgClient.ts`

```typescript
import { useBYOS } from '@/contexts/BYOSContext';

export function useOrgClient() {
  const { orgClient, isBYOS, byosStatus, healthStatus, isLoading, byosUrl } = useBYOS();

  return {
    orgClient,
    isBYOS,
    byosStatus,
    healthStatus,
    isBYOSLoading: isLoading,
    byosUrl,
  };
}
```

---

## 8. Query Optimization & Dual-Engine Query Pattern

### 8.1 React Query Cache Key Partitioning

Always include the active `hostUrl` inside your React Query keys:

```typescript
const { orgClient, isBYOS, isBYOSLoading } = useOrgClient();
const hostUrl = (orgClient as any)?.supabaseUrl || 'default';

// Include hostUrl to avoid cache collisions when switching between Platform DB and BYOS DB
const queryKey = ['<DOMAIN_TABLE>', hostUrl, tenantId, filters];
```

### 8.2 Dual-Engine Query Logic: Read Filtering vs Write Preservation

```typescript
// ─── READ (SELECT) ──────────────────────────────────────────────────────────
let query = orgClient
  .from('<DOMAIN_TABLE>')
  .select('*', { count: 'planned' })
  .order('created_at', { ascending: false });

// Only filter by tenant ID when on the shared multi-tenant Platform DB.
// On single-tenant BYOS databases, 100% of rows belong to one tenant:
// 1. Eliminates redundant WHERE clauses
// 2. Leverages direct single-column indexes
// 3. Shortens PostgREST URL lengths
if (!isBYOS) {
  query = query.eq('<TENANT_ID_COL>', tenantId);
}

// ─── WRITE (INSERT / UPDATE / UPSERT) ───────────────────────────────────────
// CRITICAL INVARIANT: All INSERT and UPDATE payloads MUST STILL INCLUDE <TENANT_ID_COL>.
// This ensures 100% clean data integrity if data is ever migrated back to the platform.
await orgClient.from('<DOMAIN_TABLE>').insert({
  ...recordData,
  <TENANT_ID_COL>: tenantId, // MUST ALWAYS BE INCLUDED
});
```

---

## 9. Dynamic Schema Resilience & 404 Cache

When migrating or transitioning schema versions, avoid repeated 404 roundtrips using an in-memory missing table / column cache:

```typescript
const missingTablesCache = new Set<string>();

export async function fetchWithFallback(
  orgClient: any, 
  targetUrl: string, 
  primaryTable: string, 
  fallbackTable: string,
  tenantId: string
) {
  const cacheKey = `${targetUrl}_missing_${primaryTable}`;

  if (!missingTablesCache.has(cacheKey)) {
    const { data, error } = await orgClient
      .from(primaryTable)
      .select('*')
      .eq('<TENANT_ID_COL>', tenantId);

    if (!error && data) return data;
    if (error) missingTablesCache.add(cacheKey);
  }

  // Execute against fallback table
  const { data: fallbackData } = await orgClient
    .from(fallbackTable)
    .select('*')
    .eq('<TENANT_ID_COL>', tenantId);

  return fallbackData || [];
}
```

---

## 10. Data Migration, Sync & Disconnect Engine

### 10.1 OpenAPI Runtime Column Introspection

To prevent migration failures caused by slight schema differences between database versions, dynamically fetch the OpenAPI schema from PostgREST (`/rest/v1/`) to sanitize keys before upserting:

```typescript
async function getTableColumnsViaOpenAPI(
  supabaseUrl: string, 
  serviceKey: string, 
  tableName: string
): Promise<string[] | null> {
  try {
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
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
    console.error(`Failed to fetch schema for ${tableName}:`, e);
  }
  return null;
}
```

### 10.2 Foreign Key Dependency Resolution (Two-Pass Upsert)

When migrating tables with self-referencing foreign keys (e.g. `parent_id`, `manager_id`, `parent_task_id`):

```typescript
// Pass 1: Upsert rows with nullable self-references set to null
const pass1Rows = sanitizedRows.map(r => ({ ...r, parent_id: null }));
await customerAdmin.from(tableName).upsert(pass1Rows, { onConflict: "id" });

// Pass 2: Upsert full rows with parent references now that all parent IDs exist
await customerAdmin.from(tableName).upsert(sanitizedRows, { onConflict: "id" });
```

### 10.3 Batch Chunking with Single-Row Resilient Fallback

```typescript
async function safeBatchUpsert(
  client: any, 
  tableName: string, 
  rows: any[], 
  allowedCols: string[]
) {
  const CHUNK_SIZE = 100;
  const sanitized = rows.map(row => {
    const obj: Record<string, any> = {};
    for (const key of allowedCols) {
      if (key in row) obj[key] = row[key];
    }
    return obj;
  });

  for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
    const batch = sanitized.slice(i, i + CHUNK_SIZE);
    const { error } = await client
      .from(tableName)
      .upsert(batch, { onConflict: "id" });

    // Fallback: If batch fails, attempt row-by-row to isolate offending record
    if (error) {
      console.warn(`Batch failed on ${tableName}, attempting row-by-row fallback...`);
      for (const singleRow of batch) {
        const { error: rowErr } = await client
          .from(tableName)
          .upsert(singleRow, { onConflict: "id" });
        if (rowErr) console.error(`Failed row ${singleRow.id}:`, rowErr.message);
      }
    }
  }
}
```

### 10.4 Disconnect & Reverse Topological Cleanup

When disconnecting BYOS and pulling data back to the platform:
1. Fetch all records from the customer's remote DB.
2. Upsert all records back into the Platform DB.
3. Delete records from the customer's database in **reverse topological order** (child tables first, parent tables last) to avoid foreign-key constraint violations.
4. Set `<TENANT_TABLE>.byos_enabled = false` and delete the `byos_connections` record on the Control Plane.

---

## 11. UI/UX Component (`BYOSSettings.tsx`)

Build an admin settings interface in your frontend settings view providing:

1. **Credentials Input Form**:
   - `Supabase URL` (e.g. `https://xyzcompany.supabase.co`)
   - `Anon Key` (Public API Key)
   - `Service Role Key` (Secret Key — encrypted immediately)
   - *(Optional)* `Personal Access Token` for 1-click automated SQL migration execution via Supabase Management API.
2. **Lifecycle Status Badge**: Visual indicator (`Active`, `Validating`, `Ready to Migrate`, `Healthy`, `Unreachable`, `Error`).
3. **Copy Migration SQL**: Clipboard action allowing users to copy the bundled SQL script to paste into their Supabase SQL Editor.
4. **Data Sync Trigger**: Button to trigger manual differential data synchronization.
5. **Health Check Trigger**: Button to ping the remote instance and inspect latency/status.
6. **Disconnect Modal**: Confirmation dialog detailing the automated rollback of data to the Platform DB before disconnection.
7. **Audit Log History**: Interactive table displaying past connect, sync, and migration events.

---

## 12. Public Endpoints & Webhook Routing

For unauthenticated public endpoints or incoming webhooks that resolve records by token or ID across multiple databases:

```typescript
// 1. Attempt to resolve record on Main Platform Database
let { data: record } = await platformAdmin
  .from("<DOMAIN_TABLE>")
  .select("*")
  .eq("id", recordId)
  .single();

// 2. If not found on Platform DB, scan active BYOS connections
if (!record) {
  const { data: activeConnections } = await platformAdmin
    .from("byos_connections")
    .select("tenant_id, supabase_url, supabase_anon_key")
    .eq("status", "active");

  if (activeConnections) {
    for (const conn of activeConnections) {
      const res = await fetch(`${conn.supabase_url}/rest/v1/<DOMAIN_TABLE>?id=eq.${recordId}&select=*`, {
        headers: {
          apikey: conn.supabase_anon_key,
          Authorization: `Bearer ${conn.supabase_anon_key}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          record = rows[0];
          break;
        }
      }
    }
  }
}
```

---

## 13. Step-by-Step AI Implementation Checklist

Follow this workflow when converting any web application to BYOS:

- [ ] **Phase 0: Project Discovery**
  - Identify `<TENANT_TABLE>`, `<TENANT_ID_COL>`, `<TENANT_ADMIN_CHECK>`, `<TENANT_CONTEXT_HOOK>`, and all `<DOMAIN_TABLES>`.
  
- [ ] **Phase 1: Control Plane Database Setup**
  - Run the SQL in [Section 3](#3-database-layer-control-plane-main-database) on your platform Supabase instance.
  - Set the encryption passphrase secret in PostgreSQL (`app.settings.byos_encryption_key`) or Supabase secrets.

- [ ] **Phase 2: Customer Migration Bundle**
  - Generate `byos-migration-bundle.ts` containing the schema for all discovered `<DOMAIN_TABLES>`.
  - Add single-tenant RLS policies (`FOR ALL USING (true) WITH CHECK (true)`).

- [ ] **Phase 3: Edge Gateway Functions**
  - Create `_shared/byos-client.ts` with `getTenantAdminClient(tenantId)` and `TENANT_SCOPED_TABLES`.
  - Create the `byos-manage` Edge Function handling `validate`, `connect`, `migrate`, `sync-data`, `health`, `disconnect`, and `status`.

- [ ] **Phase 4: Frontend Client Factory & Context**
  - Update your Supabase client utility file with `createTenantSupabaseClient` and singleton Map caching.
  - Create `BYOSContext.tsx` and `useOrgClient.ts` (or `useTenantClient.ts`).
  - Mount `<BYOSProvider>` in your root application tree (e.g. `App.tsx`) wrapped inside your Auth and Tenant providers.

- [ ] **Phase 5: Data Hooks Migration**
  - In all domain data hooks, replace direct `supabase.from('<DOMAIN_TABLE>')` with `orgClient.from('<DOMAIN_TABLE>')`.
  - Add the client's host URL to all React Query cache keys (`queryKey: ['entity', hostUrl, tenantId, ...]`).
  - Apply conditional `tenant_id` filtering on `SELECT` queries (`if (!isBYOS) query = query.eq('<TENANT_ID_COL>', tenantId)`).

- [ ] **Phase 6: Serverless Functions Injection**
  - In existing Edge Functions / API routes that process tenant data, replace direct platform client instantiation with `const { client } = await getTenantAdminClient(tenantId)`.

- [ ] **Phase 7: BYOS Settings UI**
  - Build `BYOSSettings.tsx` and add it to your Organization / Tenant Settings navigation.

- [ ] **Phase 8: End-to-End Verification**
  1. Connect a fresh test Supabase project via the BYOS Settings UI.
  2. Verify migration and data sync execution.
  3. Create/update records in the UI and confirm they persist directly to the customer's remote Supabase database.
  4. Test the Health Check trigger.
  5. Test Disconnect and verify that all data is cleanly pulled back into the Main Platform Database.
