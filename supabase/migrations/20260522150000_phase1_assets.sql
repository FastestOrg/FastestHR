-- Create assets table
CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "company_id" "uuid" NOT NULL REFERENCES "public"."companies"("id") ON DELETE CASCADE,
    "serial_number" "text" UNIQUE NOT NULL,
    "model_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "purchase_date" "date",
    "purchase_value" numeric(12,2),
    "assigned_employee_id" "uuid" REFERENCES "public"."employees"("id") ON DELETE SET NULL,
    "assignment_date" "date",
    "status" "text" DEFAULT 'available'::"text",
    "signature_url" "text",
    "signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Owner assignment
ALTER TABLE "public"."assets" OWNER TO "postgres";

-- Enable Row Level Security (RLS)
ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;

-- Create policies utilizing standard project helpers
CREATE POLICY "Company admins can manage assets" ON "public"."assets" 
    TO "authenticated" 
    USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."is_company_admin"() OR "public"."is_super_admin"())));

CREATE POLICY "Company members can view assets" ON "public"."assets" 
    FOR SELECT 
    TO "authenticated" 
    USING ((("company_id" = "public"."get_user_company_id"()) OR "public"."is_super_admin"()));

-- Create trigger for handling updated_at timestamp
CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."assets" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
