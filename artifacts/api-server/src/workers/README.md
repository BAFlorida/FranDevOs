# CRM sync workers (stub)

Named-but-empty placeholder for the future background sync layer that will keep
the canonical CRM tables (`crm_*`) reconciled with external systems.

Nothing here is implemented yet — there are **no external CRM calls** in this
codebase. This directory only marks the seam so that wiring a real sync later
requires no schema, contract, or UI changes.

## Planned workers

- `salesforceSyncWorker` — poll/stream Salesforce and upsert into canonical tables.
  - TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
- `hubspotSyncWorker` — poll/webhook HubSpot and upsert into canonical tables.
  - TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks

Each worker will:

1. Authenticate via `../integrations/auth` (also stubbed).
2. Fetch changed records since the last `crm_sync_events.finished_at`.
3. Map source payloads → canonical rows (preserving provenance columns).
4. Upsert canonical rows and append a `crm_sync_events` row.
