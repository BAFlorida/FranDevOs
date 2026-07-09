import type { CrmOpportunity, CrmCampaign, CrmEmailActivity } from "@workspace/db";
import type { CrmAdapter, CrmConnectionCard } from "./types";
import {
  readOpportunities,
  readOpportunityById,
  readCampaigns,
  readEmailActivity,
  readConnectionCard,
  refreshSource,
} from "./canonicalStore";

// HubSpot adapter.
//
// Every method currently returns mock data by reading the canonical tables
// (seeded as if a HubSpot sync had already reconciled them). The TODO markers
// below are the exact seams a future implementation replaces with live HubSpot
// calls — no route, contract, schema or UI change is required.
const SOURCE = "hubspot" as const;

export const hubspotAdapter: CrmAdapter = {
  source: SOURCE,

  async listOpportunities(opts): Promise<CrmOpportunity[]> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    return readOpportunities({ source: SOURCE, stageCanonical: opts?.stageCanonical });
  },

  async getOpportunity(id: number): Promise<CrmOpportunity | null> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    return readOpportunityById(SOURCE, id);
  },

  async listCampaigns(): Promise<CrmCampaign[]> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    return readCampaigns({ source: SOURCE });
  },

  async listEmailActivity(opts): Promise<CrmEmailActivity[]> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    return readEmailActivity({ source: SOURCE, campaignId: opts?.campaignId });
  },

  async getConnectionCard(): Promise<CrmConnectionCard> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    const card = await readConnectionCard(SOURCE);
    if (!card) throw new Error(`No connection configured for ${SOURCE}`);
    return card;
  },

  async refresh(): Promise<CrmConnectionCard> {
    // TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
    const card = await refreshSource(SOURCE);
    if (!card) throw new Error(`No connection configured for ${SOURCE}`);
    return card;
  },
};
