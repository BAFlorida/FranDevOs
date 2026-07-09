# CRM integration auth (stub)

Named-but-empty placeholder for the future external CRM authentication layer
(OAuth 2.0 / connected apps / private app tokens).

**No authentication is implemented here and no external CRM calls are made.**
This directory only marks the seam. The app's own session auth lives in
`../../lib/permissions.ts` and is unrelated to this.

## Planned

- `salesforceAuth` — OAuth 2.0 web server / JWT bearer flow; token refresh.
  - TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks
- `hubspotAuth` — OAuth 2.0 app install / private app token; token refresh.
  - TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks

Credentials will be resolved per `crm_connections` row and stored via the
platform secrets mechanism — never committed to the repo.
