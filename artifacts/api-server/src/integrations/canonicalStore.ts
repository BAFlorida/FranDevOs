import {
  db,
  crmAccountsTable,
  crmPeopleTable,
  crmOpportunitiesTable,
  crmCampaignsTable,
  crmEmailActivityTable,
  crmConnectionsTable,
  crmSyncEventsTable,
} from "@workspace/db";
import { and, eq, desc, type SQL } from "drizzle-orm";
import type { CrmSource, CrmConnectionCard } from "./types";

// Pure reads (and the mock "refresh" write) over the canonical CRM tables.
// These represent the canonical store *after* a sync has populated it. Adapters
// delegate here for their mock bodies; the reporting service and routes also use
// these for cross-source aggregation. No external CRM calls happen here.

const RECENT_EVENTS_LIMIT = 10;

function whereAnd(...parts: (SQL | undefined)[]): SQL | undefined {
  const present = parts.filter((p): p is SQL => p != null);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return and(...present);
}

export async function readAccounts(filter: { source?: CrmSource } = {}) {
  return db
    .select()
    .from(crmAccountsTable)
    .where(filter.source ? eq(crmAccountsTable.sourceSystem, filter.source) : undefined);
}

export async function readPeople(
  filter: { source?: CrmSource; accountId?: number } = {},
) {
  return db
    .select()
    .from(crmPeopleTable)
    .where(
      whereAnd(
        filter.source ? eq(crmPeopleTable.sourceSystem, filter.source) : undefined,
        filter.accountId != null ? eq(crmPeopleTable.accountId, filter.accountId) : undefined,
      ),
    );
}

export async function readOpportunities(
  filter: { source?: CrmSource; stageCanonical?: string } = {},
) {
  return db
    .select()
    .from(crmOpportunitiesTable)
    .where(
      whereAnd(
        filter.source ? eq(crmOpportunitiesTable.sourceSystem, filter.source) : undefined,
        filter.stageCanonical
          ? eq(crmOpportunitiesTable.stageCanonical, filter.stageCanonical)
          : undefined,
      ),
    );
}

// Drill-down read for a single opportunity, scoped to its source. This is the
// canonical-store call that the adapter's `getOpportunity` seam wraps.
export async function readOpportunityById(source: CrmSource, id: number) {
  const [row] = await db
    .select()
    .from(crmOpportunitiesTable)
    .where(
      and(eq(crmOpportunitiesTable.id, id), eq(crmOpportunitiesTable.sourceSystem, source)),
    );
  return row ?? null;
}

export async function readCampaignById(source: CrmSource, id: number) {
  const [row] = await db
    .select()
    .from(crmCampaignsTable)
    .where(and(eq(crmCampaignsTable.id, id), eq(crmCampaignsTable.sourceSystem, source)));
  return row ?? null;
}

export async function readCampaigns(filter: { source?: CrmSource } = {}) {
  return db
    .select()
    .from(crmCampaignsTable)
    .where(filter.source ? eq(crmCampaignsTable.sourceSystem, filter.source) : undefined);
}

export async function readEmailActivity(
  filter: { source?: CrmSource; campaignId?: number } = {},
) {
  return db
    .select()
    .from(crmEmailActivityTable)
    .where(
      whereAnd(
        filter.source ? eq(crmEmailActivityTable.sourceSystem, filter.source) : undefined,
        filter.campaignId != null
          ? eq(crmEmailActivityTable.campaignId, filter.campaignId)
          : undefined,
      ),
    );
}

// Validate that a CRM record a follow-up task is being linked to actually
// exists in the canonical store. `source` is the raw string from the request
// (salesforce | hubspot | internal).
export async function linkedRecordExists(
  source: string,
  recordType: "opportunity" | "campaign",
  id: number,
): Promise<boolean> {
  if (recordType === "opportunity") {
    const [row] = await db
      .select({ id: crmOpportunitiesTable.id })
      .from(crmOpportunitiesTable)
      .where(
        and(
          eq(crmOpportunitiesTable.id, id),
          eq(crmOpportunitiesTable.sourceSystem, source),
        ),
      );
    return row != null;
  }
  const [row] = await db
    .select({ id: crmCampaignsTable.id })
    .from(crmCampaignsTable)
    .where(
      and(eq(crmCampaignsTable.id, id), eq(crmCampaignsTable.sourceSystem, source)),
    );
  return row != null;
}

export async function readConnection(source: CrmSource) {
  const [row] = await db
    .select()
    .from(crmConnectionsTable)
    .where(eq(crmConnectionsTable.sourceSystem, source));
  return row ?? null;
}

export async function readConnections() {
  return db.select().from(crmConnectionsTable);
}

export async function readSyncEvents(
  filter: { source?: CrmSource; connectionId?: number } = {},
): Promise<CrmConnectionCard["recentEvents"]> {
  return db
    .select()
    .from(crmSyncEventsTable)
    .where(
      whereAnd(
        filter.source ? eq(crmSyncEventsTable.sourceSystem, filter.source) : undefined,
        filter.connectionId != null
          ? eq(crmSyncEventsTable.connectionId, filter.connectionId)
          : undefined,
      ),
    )
    .orderBy(desc(crmSyncEventsTable.startedAt))
    .limit(RECENT_EVENTS_LIMIT);
}

// Build a connection status card for one source: the connection plus its most
// recent sync events.
export async function readConnectionCard(
  source: CrmSource,
): Promise<CrmConnectionCard | null> {
  const connection = await readConnection(source);
  if (!connection) return null;
  const recentEvents = await readSyncEvents({ connectionId: connection.id });
  return { connection, recentEvents };
}

// Mock "refresh from source". No external CRM call: bumps the connection's
// lastSyncAt, bumps syncedAt on that source's canonical rows, and appends a
// crm_sync_events row. This is the exact write seam a future real sync replaces.
export async function refreshSource(
  source: CrmSource,
): Promise<CrmConnectionCard | null> {
  // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
  const connection = await readConnection(source);
  if (!connection) return null;

  const now = new Date();

  const [oppCount, campaignCount, emailCount] = await Promise.all([
    db
      .update(crmOpportunitiesTable)
      .set({ syncedAt: now })
      .where(eq(crmOpportunitiesTable.sourceSystem, source))
      .returning({ id: crmOpportunitiesTable.id }),
    db
      .update(crmCampaignsTable)
      .set({ syncedAt: now })
      .where(eq(crmCampaignsTable.sourceSystem, source))
      .returning({ id: crmCampaignsTable.id }),
    db
      .update(crmEmailActivityTable)
      .set({ syncedAt: now })
      .where(eq(crmEmailActivityTable.sourceSystem, source))
      .returning({ id: crmEmailActivityTable.id }),
  ]);
  await Promise.all([
    db
      .update(crmAccountsTable)
      .set({ syncedAt: now })
      .where(eq(crmAccountsTable.sourceSystem, source)),
    db
      .update(crmPeopleTable)
      .set({ syncedAt: now })
      .where(eq(crmPeopleTable.sourceSystem, source)),
  ]);

  const recordsSynced =
    oppCount.length + campaignCount.length + emailCount.length;

  await db
    .update(crmConnectionsTable)
    .set({ lastSyncAt: now, status: "connected" })
    .where(eq(crmConnectionsTable.id, connection.id));

  await db.insert(crmSyncEventsTable).values({
    connectionId: connection.id,
    sourceSystem: source,
    objectType: "all",
    status: "success",
    recordsSynced,
    startedAt: now,
    finishedAt: now,
    message: `Manual refresh synced ${recordsSynced} records`,
  });

  return readConnectionCard(source);
}
