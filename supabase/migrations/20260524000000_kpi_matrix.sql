-- ============================================================
-- KPI MATRIX — Super Intelligent Performance Scoring System
-- Formula: KPI Score = Manager Points (0-1) - Attendance Score (0-1)
--   Positive = Good, Zero = OK, Negative = Under Consideration
-- ============================================================

-- ── 1. KPI Settings per Company ──────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."kpi_settings" (
  "id"                      uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"              uuid NOT NULL UNIQUE REFERENCES "public"."companies"("id") ON DELETE CASCADE,
  -- Daily score config
  "daily_enabled"           boolean DEFAULT true,
  "manager_max_points"      numeric(4,2) DEFAULT 1.0,   -- max points manager can award (default 1.0)
  "attendance_present_score" numeric(4,2) DEFAULT 1.0,  -- score for being present
  "attendance_halfday_score" numeric(4,2) DEFAULT 0.5,  -- score for half day
  "attendance_absent_score"  numeric(4,2) DEFAULT 0.0,  -- score for absent
  "fill_window_days"        integer DEFAULT 7,           -- how many past days manager can fill
  -- Score band labels & actions (stored as JSONB array)
  -- e.g. [{ "min": -1, "max": 0, "label": "Under Consideration", "action": "...", "color": "red" }, ...]
  "score_bands"             jsonb DEFAULT '[
    {"min": -1.0, "max": -0.01, "label": "Under Consideration", "action": "HR Review Required", "color": "#ef4444"},
    {"min": 0.0,  "max": 0.49,  "label": "Satisfactory",        "action": "No Action",           "color": "#f59e0b"},
    {"min": 0.5,  "max": 0.79,  "label": "Good",                "action": "Appreciation Note",   "color": "#22c55e"},
    {"min": 0.8,  "max": 1.0,   "label": "Excellent",           "action": "Reward Eligible",      "color": "#6366f1"}
  ]'::jsonb,
  -- Monthly / Quarterly config
  "monthly_enabled"         boolean DEFAULT true,
  "monthly_max_score"       numeric(4,2) DEFAULT 10.0,
  "monthly_fill_window_day" integer DEFAULT 5,   -- can enter score between 1st and this day
  "quarterly_enabled"       boolean DEFAULT true,
  "quarterly_max_score"     numeric(4,2) DEFAULT 10.0,
  "created_at"              timestamptz DEFAULT now() NOT NULL,
  "updated_at"              timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."kpi_settings" OWNER TO "postgres";

-- ── 2. Daily KPI Scores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."kpi_daily_scores" (
  "id"                   uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"           uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE CASCADE,
  "employee_id"          uuid NOT NULL REFERENCES "public"."employees"("id") ON DELETE CASCADE,
  "scored_by"            uuid REFERENCES "public"."profiles"("id"),
  "date"                 date NOT NULL,
  -- Inputs
  "manager_points"       numeric(4,2) NOT NULL DEFAULT 0,      -- 0.0 – max (default 1.0)
  -- Auto-calculated from attendance table at time of scoring
  "attendance_score"     numeric(4,2) NOT NULL DEFAULT 0,      -- 1=present, 0.5=halfday, 0=absent
  -- Computed
  "kpi_score"            numeric(5,2) GENERATED ALWAYS AS ("manager_points" - "attendance_score") STORED,
  "notes"                text,
  "locked"               boolean DEFAULT true,  -- locked once saved
  "created_at"           timestamptz DEFAULT now() NOT NULL,
  "updated_at"           timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("company_id", "employee_id", "date")
);

ALTER TABLE "public"."kpi_daily_scores" OWNER TO "postgres";

-- ── 3. Monthly KPI Scores ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."kpi_monthly_scores" (
  "id"          uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"  uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "public"."employees"("id") ON DELETE CASCADE,
  "scored_by"   uuid REFERENCES "public"."profiles"("id"),
  "month"       integer NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "year"        integer NOT NULL,
  "score"       numeric(5,2) NOT NULL,
  "remarks"     text,
  "submitted_at" timestamptz DEFAULT now(),
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  "updated_at"  timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("company_id", "employee_id", "month", "year")
);

ALTER TABLE "public"."kpi_monthly_scores" OWNER TO "postgres";

-- ── 4. Quarterly KPI Scores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."kpi_quarterly_scores" (
  "id"          uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"  uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "public"."employees"("id") ON DELETE CASCADE,
  "scored_by"   uuid REFERENCES "public"."profiles"("id"),
  "quarter"     integer NOT NULL CHECK ("quarter" BETWEEN 1 AND 4),  -- 1=Q1, 2=Q2, 3=Q3, 4=Q4
  "year"        integer NOT NULL,
  "score"       numeric(5,2) NOT NULL,
  "remarks"     text,
  "submitted_at" timestamptz DEFAULT now(),
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  "updated_at"  timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("company_id", "employee_id", "quarter", "year")
);

ALTER TABLE "public"."kpi_quarterly_scores" OWNER TO "postgres";

-- ── 5. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kpi_daily_company_date     ON "public"."kpi_daily_scores"     ("company_id", "date" DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_daily_employee_date    ON "public"."kpi_daily_scores"     ("employee_id", "date" DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_monthly_company        ON "public"."kpi_monthly_scores"   ("company_id", "year", "month");
CREATE INDEX IF NOT EXISTS idx_kpi_quarterly_company      ON "public"."kpi_quarterly_scores" ("company_id", "year", "quarter");

-- ── 6. Updated_at triggers ────────────────────────────────────
CREATE TRIGGER handle_kpi_settings_updated_at    BEFORE UPDATE ON "public"."kpi_settings"       FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER handle_kpi_daily_updated_at       BEFORE UPDATE ON "public"."kpi_daily_scores"   FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER handle_kpi_monthly_updated_at     BEFORE UPDATE ON "public"."kpi_monthly_scores" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER handle_kpi_quarterly_updated_at   BEFORE UPDATE ON "public"."kpi_quarterly_scores" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- ── 7. Row Level Security ─────────────────────────────────────
ALTER TABLE "public"."kpi_settings"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kpi_daily_scores"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kpi_monthly_scores"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kpi_quarterly_scores" ENABLE ROW LEVEL SECURITY;

-- kpi_settings: company members can read, only admins can write
CREATE POLICY "kpi_settings_read" ON "public"."kpi_settings"
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "kpi_settings_admin_write" ON "public"."kpi_settings"
  FOR ALL USING (company_id = get_user_company_id() AND get_user_platform_role() IN ('company_admin', 'super_admin'));

-- kpi_daily_scores: all company members can read, admin/hr can insert/update
CREATE POLICY "kpi_daily_read" ON "public"."kpi_daily_scores"
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "kpi_daily_admin_write" ON "public"."kpi_daily_scores"
  FOR INSERT WITH CHECK (
    company_id = get_user_company_id()
    AND get_user_platform_role() IN ('company_admin', 'super_admin')
  );

CREATE POLICY "kpi_daily_admin_update" ON "public"."kpi_daily_scores"
  FOR UPDATE USING (
    company_id = get_user_company_id()
    AND get_user_platform_role() IN ('company_admin', 'super_admin')
    AND locked = false
  );

-- kpi_monthly_scores
CREATE POLICY "kpi_monthly_read" ON "public"."kpi_monthly_scores"
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "kpi_monthly_admin_write" ON "public"."kpi_monthly_scores"
  FOR ALL USING (
    company_id = get_user_company_id()
    AND get_user_platform_role() IN ('company_admin', 'super_admin')
  );

-- kpi_quarterly_scores
CREATE POLICY "kpi_quarterly_read" ON "public"."kpi_quarterly_scores"
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "kpi_quarterly_admin_write" ON "public"."kpi_quarterly_scores"
  FOR ALL USING (
    company_id = get_user_company_id()
    AND get_user_platform_role() IN ('company_admin', 'super_admin')
  );
