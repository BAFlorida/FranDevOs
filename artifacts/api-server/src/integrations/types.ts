import type {
  CrmOpportunity,
  CrmCampaign,
  CrmEmailActivity,
  CrmConnection,
  CrmSyncEvent,
} from "@workspace/db";

// A real CRM source. `internal` is reserved for records that originate inside
// this app rather than an external system, and is therefore not an adapter.
export type CrmSource = "salesforce" | "hubspot";

// A CRM record type that a follow-up task can be linked to.
export type CrmLinkRecordType = "opportunity" | "campaign";

// One stage's worth of pipeline rollup.
export interface CrmPipelineStage {
  stage: string;
  value: number;
  count: number;
}

// Connection status card: the connection plus its most recent sync events.
export interface CrmConnectionCard {
  connection: CrmConnection;
  recentEvents: CrmSyncEvent[];
}

// The seam every future real integration must satisfy. Today every method is
// fulfilled by reading the canonical tables (mock data seeded as if a sync had
// already run). When a real Salesforce / HubSpot integration is built, the
// method bodies are swapped to call the live API + reconcile into the canonical
// store — the signatures, the route layer, the contracts and the UI never
// change.
export interface CrmAdapter {
  readonly source: CrmSource;
  listOpportunities(opts?: { stageCanonical?: string }): Promise<CrmOpportunity[]>;
  // The single "fetch live from source" seam — the only future live-API call site.
  getOpportunity(id: number): Promise<CrmOpportunity | null>;
  listCampaigns(): Promise<CrmCampaign[]>;
  listEmailActivity(opts?: { campaignId?: number }): Promise<CrmEmailActivity[]>;
  getConnectionCard(): Promise<CrmConnectionCard>;
  // Mock "refresh from source": bumps syncedAt/lastSyncAt and writes a sync event.
  refresh(): Promise<CrmConnectionCard>;
}
