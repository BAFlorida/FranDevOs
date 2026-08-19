import {
  integer,
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
  boolean,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { tasksTable } from "./app";

// ---------------------------------------------------------------------------
// Canonical CRM reporting schema.
//
// Every canonical record table carries provenance so that, when real
// Salesforce / HubSpot syncs are wired up later, rows can be reconciled to
// their source of truth with zero schema changes:
//   - sourceSystem        which CRM the record came from
//   - sourceRecordId      the id in that CRM (e.g. SF 18-char id / HubSpot id)
//   - rawPayload          untransformed source object (jsonb) for drill-down
//   - externalLastModifiedAt  source-reported last-modified time
//   - syncedAt            when this row was last refreshed from source
//   - connectionId        nullable FK → crm_connections (which connection)
// ---------------------------------------------------------------------------

export type CrmSourceSystem = "salesforce" | "hubspot" | "internal";

// Fixed, ordered canonical pipeline vocabulary. `stageRaw` holds the
// source-specific label (e.g. SF "Negotiation/Review", HubSpot
// "decisionmakerboughtin").
export const CRM_STAGE_VOCABULARY = [
  "Prospecting",
  "Qualification",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
] as const;

export type CrmStageCanonical = (typeof CRM_STAGE_VOCABULARY)[number];

// 1. crm_connections — single connections table (no multi-tenant build-out).
export const crmConnectionsTable = pgTable("crm_connections", {
  id: serial("id").primaryKey(),
  sourceSystem: varchar("source_system", { length: 16 }).notNull(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("connected_mock"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  objectsSynced: jsonb("objects_synced").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. crm_accounts — candidate franchisees.
export const crmAccountsTable = pgTable(
  "crm_accounts",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    name: varchar("name", { length: 256 }).notNull(),
    type: varchar("type", { length: 64 }),
    ownerName: varchar("owner_name", { length: 128 }),
    region: varchar("region", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_accounts_connection").on(t.connectionId),
    index("idx_crm_accounts_source").on(t.sourceSystem),
  ],
);

// 3. crm_people — contacts / leads.
export const crmPeopleTable = pgTable(
  "crm_people",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    email: varchar("email", { length: 256 }),
    title: varchar("title", { length: 128 }),
    accountId: integer("account_id").references(() => crmAccountsTable.id, {
      onDelete: "set null",
    }),
    ownerName: varchar("owner_name", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_people_account").on(t.accountId),
    index("idx_crm_people_connection").on(t.connectionId),
    index("idx_crm_people_source").on(t.sourceSystem),
  ],
);

// 4. crm_opportunities — opportunities + deals unified.
export const crmOpportunitiesTable = pgTable(
  "crm_opportunities",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    name: varchar("name", { length: 256 }).notNull(),
    accountId: integer("account_id").references(() => crmAccountsTable.id, {
      onDelete: "set null",
    }),
    ownerName: varchar("owner_name", { length: 128 }),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    stageCanonical: varchar("stage_canonical", { length: 32 }).notNull(),
    stageRaw: varchar("stage_raw", { length: 128 }),
    closeDate: date("close_date"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_opportunities_account").on(t.accountId),
    index("idx_crm_opportunities_connection").on(t.connectionId),
    index("idx_crm_opportunities_source").on(t.sourceSystem),
    index("idx_crm_opportunities_stage").on(t.stageCanonical),
  ],
);

// 5. crm_campaigns — SF + HubSpot campaigns.
export const crmCampaignsTable = pgTable(
  "crm_campaigns",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    name: varchar("name", { length: 256 }).notNull(),
    channel: varchar("channel", { length: 64 }),
    type: varchar("type", { length: 64 }),
    status: varchar("status", { length: 32 }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    sends: integer("sends").notNull().default(0),
    opens: integer("opens").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    influencedPipeline: numeric("influenced_pipeline", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_campaigns_connection").on(t.connectionId),
    index("idx_crm_campaigns_source").on(t.sourceSystem),
  ],
);

// 6. crm_email_activity — HubSpot marketing emails.
export const crmEmailActivityTable = pgTable(
  "crm_email_activity",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    campaignId: integer("campaign_id").references(() => crmCampaignsTable.id, {
      onDelete: "set null",
    }),
    subject: varchar("subject", { length: 256 }),
    sends: integer("sends").notNull().default(0),
    opens: integer("opens").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_email_activity_campaign").on(t.campaignId),
    index("idx_crm_email_activity_connection").on(t.connectionId),
  ],
);

// 7. crm_sync_events — append-only log of (mock) sync runs.
export const crmSyncEventsTable = pgTable(
  "crm_sync_events",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "cascade",
    }),
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    objectType: varchar("object_type", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    recordsSynced: integer("records_synced").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    message: text("message"),
  },
  (t) => [index("idx_crm_sync_events_connection").on(t.connectionId)],
);

// 8. crm_task_links — link a CRM record to an existing task without modifying
//    the tasks contract.
export const crmTaskLinksTable = pgTable(
  "crm_task_links",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    recordType: varchar("record_type", { length: 32 }).notNull(),
    recordId: integer("record_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_task_links_task").on(t.taskId),
    index("idx_crm_task_links_record").on(t.recordType, t.recordId),
  ],
);

// Fixed territory-lead priority vocabulary (map marker tiers).
export const TERRITORY_TIER_VOCABULARY = ["Tier 1", "Tier 2", "Tier 3"] as const;

export type TerritoryTier = (typeof TERRITORY_TIER_VOCABULARY)[number];

// Where a territory lead originated. `google_places` rows are Google Business
// Profile listings imported through the Google Places API; `manual` rows are
// created in-app (or seeded).
export type TerritoryLeadSource = "google_places" | "manual";

// 9. crm_territory_leads — target-customer / lead list built from Google
// Business Profile listings (Places API) plus manual entries. Carries the same
// provenance shape as the other canonical tables: sourceSystem is
// google_places | manual and sourceRecordId is the Google place id (stable,
// safe to store indefinitely under Google's caching policy) or a manual id.
// rawPayload keeps the untransformed Places response for drill-down.
export const crmTerritoryLeadsTable = pgTable(
  "crm_territory_leads",
  {
    id: serial("id").primaryKey(),
    // provenance
    sourceSystem: varchar("source_system", { length: 16 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 128 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    externalLastModifiedAt: timestamp("external_last_modified_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    connectionId: integer("connection_id").references(() => crmConnectionsTable.id, {
      onDelete: "set null",
    }),
    // fields
    name: varchar("name", { length: 256 }).notNull(),
    category: varchar("category", { length: 128 }),
    address: varchar("address", { length: 512 }),
    phone: varchar("phone", { length: 64 }),
    website: varchar("website", { length: 512 }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    rating: doublePrecision("rating"),
    ratingCount: integer("rating_count"),
    businessStatus: varchar("business_status", { length: 32 }),
    tier: varchar("tier", { length: 16 }).notNull().default("Tier 3"),
    value: numeric("value", { precision: 14, scale: 2 }),
    searchQuery: varchar("search_query", { length: 256 }),
    accountId: integer("account_id").references(() => crmAccountsTable.id, {
      onDelete: "set null",
    }),
    ownerName: varchar("owner_name", { length: 128 }),
    region: varchar("region", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_crm_territory_leads_source").on(t.sourceSystem),
    index("idx_crm_territory_leads_tier").on(t.tier),
    // Import dedup: one row per Google place (or manual id) per source.
    uniqueIndex("crm_territory_leads_source_system_source_record_id_unique").on(
      t.sourceSystem,
      t.sourceRecordId,
    ),
  ],
);

// 10. report_definitions — saved report presets.
export const reportDefinitionsTable = pgTable("report_definitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  spec: jsonb("spec").notNull(),
  isPreset: boolean("is_preset").notNull().default(false),
  createdById: varchar("created_by_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CrmConnection = typeof crmConnectionsTable.$inferSelect;
export type CrmAccount = typeof crmAccountsTable.$inferSelect;
export type CrmPerson = typeof crmPeopleTable.$inferSelect;
export type CrmOpportunity = typeof crmOpportunitiesTable.$inferSelect;
export type CrmCampaign = typeof crmCampaignsTable.$inferSelect;
export type CrmEmailActivity = typeof crmEmailActivityTable.$inferSelect;
export type CrmSyncEvent = typeof crmSyncEventsTable.$inferSelect;
export type CrmTaskLink = typeof crmTaskLinksTable.$inferSelect;
export type CrmTerritoryLead = typeof crmTerritoryLeadsTable.$inferSelect;
export type ReportDefinition = typeof reportDefinitionsTable.$inferSelect;

export type InsertCrmConnection = typeof crmConnectionsTable.$inferInsert;
export type InsertCrmAccount = typeof crmAccountsTable.$inferInsert;
export type InsertCrmPerson = typeof crmPeopleTable.$inferInsert;
export type InsertCrmOpportunity = typeof crmOpportunitiesTable.$inferInsert;
export type InsertCrmCampaign = typeof crmCampaignsTable.$inferInsert;
export type InsertCrmEmailActivity = typeof crmEmailActivityTable.$inferInsert;
export type InsertCrmSyncEvent = typeof crmSyncEventsTable.$inferInsert;
export type InsertCrmTaskLink = typeof crmTaskLinksTable.$inferInsert;
export type InsertCrmTerritoryLead = typeof crmTerritoryLeadsTable.$inferInsert;
export type InsertReportDefinition = typeof reportDefinitionsTable.$inferInsert;
