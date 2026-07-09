import type { CrmAdapter, CrmSource } from "./types";
import { salesforceAdapter } from "./salesforceAdapter";
import { hubspotAdapter } from "./hubspotAdapter";

export * from "./types";
export { salesforceAdapter } from "./salesforceAdapter";
export { hubspotAdapter } from "./hubspotAdapter";
export * as reportingService from "./reportingService";

const ADAPTERS: Record<CrmSource, CrmAdapter> = {
  salesforce: salesforceAdapter,
  hubspot: hubspotAdapter,
};

export function getAdapter(source: CrmSource): CrmAdapter {
  return ADAPTERS[source];
}

// Return one adapter when a source is specified, otherwise all of them (for
// cross-source aggregation in the route layer).
export function getAdapters(source?: CrmSource): CrmAdapter[] {
  return source ? [ADAPTERS[source]] : Object.values(ADAPTERS);
}
