-- crm_territory_leads — territory prospecting lead list (Google Places imports
-- + manual rows). Hand-apply DDL: drizzle-kit push hangs on an interactive
-- prompt when run headless (see CLAUDE.md gotcha), so additive DDL is applied
-- directly. lib/db/src/schema/crm.ts remains the source of truth; verify with:
--   pnpm --filter @workspace/scripts run check-db-drift
-- Constraint/index names follow Drizzle conventions to avoid future push diffs.

CREATE TABLE IF NOT EXISTS "crm_territory_leads" (
  "id" serial PRIMARY KEY,
  "source_system" varchar(16) NOT NULL,
  "source_record_id" varchar(128) NOT NULL,
  "raw_payload" jsonb,
  "external_last_modified_at" timestamp with time zone,
  "synced_at" timestamp with time zone NOT NULL DEFAULT now(),
  "connection_id" integer,
  "name" varchar(256) NOT NULL,
  "category" varchar(128),
  "address" varchar(512),
  "phone" varchar(64),
  "website" varchar(512),
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "rating" double precision,
  "rating_count" integer,
  "business_status" varchar(32),
  "tier" varchar(16) NOT NULL DEFAULT 'Tier 3',
  "value" numeric(14, 2),
  "search_query" varchar(256),
  "account_id" integer,
  "owner_name" varchar(128),
  "region" varchar(64),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "crm_territory_leads_connection_id_crm_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "crm_connections"("id") ON DELETE SET NULL,
  CONSTRAINT "crm_territory_leads_account_id_crm_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_crm_territory_leads_source"
  ON "crm_territory_leads" ("source_system");
CREATE INDEX IF NOT EXISTS "idx_crm_territory_leads_tier"
  ON "crm_territory_leads" ("tier");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_territory_leads_source_system_source_record_id_unique"
  ON "crm_territory_leads" ("source_system", "source_record_id");
