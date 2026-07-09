# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/scripts run test` — unit tests for utility scripts (e.g. the DB drift check); no live database needed
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/` — `auth.ts`, `app.ts`, `crm.ts`; re-exported from `index.ts`.
  - CRM reporting canonical tables (`crm_connections`, `crm_accounts`, `crm_people`, `crm_opportunities`, `crm_campaigns`, `crm_email_activity`, `crm_sync_events`, `crm_task_links`, `report_definitions`) live in `crm.ts`.
- API contract (source of truth): `lib/api-spec/openapi.yaml`. Generated hooks → `lib/api-client-react`; generated Zod → `lib/api-zod`. Regenerate with `pnpm --filter @workspace/api-spec run codegen`.
- Server routes: `artifacts/api-server/src/routes/` (registered in `routes/index.ts`). CRM seam files: `crm.ts`, `marketing.ts`, `crm-reporting.ts`, `integrations.ts`. Auth seam files: `auth.ts` (login/logout/accept-invite/change-password/`/auth/user`), `impersonation.ts` (start/stop), `users.ts` (reset-password + super_admin guard).
- Auth: `artifacts/api-server/src/lib/` — `password.ts` (scrypt hash/verify), `permissions.ts` (`buildAppUser`, `requireAuth` w/ impersonation), `superAdminBootstrap.ts` (seeds Ryan + one-time invite). Web client hook: `lib/replit-auth-web/src/use-auth.ts`.
- CRM service-adapter layer: `artifacts/api-server/src/integrations/` — `salesforceAdapter.ts`, `hubspotAdapter.ts` (implement `CrmAdapter`), `canonicalStore.ts` (canonical-table reads), `reportingService.ts` (internal aggregation), `index.ts` (registry).
- Future-sync stubs (no impl): `artifacts/api-server/src/workers/` and `artifacts/api-server/src/integrations/auth/`.
- Seed: `artifacts/api-server/src/seed.ts` (run with `NODE_ENV=development pnpm --filter @workspace/api-server exec tsx src/seed.ts`).

## Architecture decisions

- CRM data is modeled as **canonical Postgres tables** with provenance columns (`sourceSystem`, `sourceRecordId`, `rawPayload`, `externalLastModifiedAt`, `syncedAt`, `connectionId`) so rows from Salesforce and HubSpot share one shape and can be reconciled later with zero schema/contract/UI change.
- Opportunity stages use a fixed canonical vocabulary (`CRM_STAGE_VOCABULARY` in `crm.ts`) stored in `stageCanonical`, with the source-specific label preserved in `stageRaw`.
- Adapters today return mock data by reading the canonical tables; the exact external-call seams are marked `// TODO(api): replace with Salesforce REST/Bulk + Pub/Sub | HubSpot 2026-03 REST + webhooks`. No external CRM calls exist; no external CRM auth is implemented.
- Reporting (`/reports/run`) aggregates over canonical tables **internally only** — it never queries an external CRM.
- Routes validate inputs with generated Zod schemas; responses are returned as raw rows (dates serialize to ISO strings), matching existing route conventions.
- **Auth is in-app email/password only** — no Replit OIDC, no self-service signup, no forgot-password email. Passwords are scrypt-hashed (`passwordHash`, `passwordSetAt` on the users table). New users join via one-time invite links that set their name + password (`/invite/<token>`). Admins reset passwords; users change their own.
- **Super Admin** is a role above admin/vp with the exclusive `impersonate_users` permission. "Act as" impersonation stores `impersonatedUserId` in the session; the app renders as the target user with a switch-back banner. Impersonation start/stop is audit-logged to the **real** super admin, not the impersonated user. Only super admins may assign the `super_admin` role.
- First super admin (Ryan@myfieldspec.com) is bootstrapped on startup and sets a password via a one-time invite link logged once at boot — never hardcoded.

## Product

- Franchise Development OS: strategic initiatives, tactics, tasks, KPI scorecards, and an executive dashboard with Excel export. Authentication is in-app email/password with invite-link onboarding, role-based permissions, and Super Admin impersonation.
- CRM Reporting foundation (backend seams): canonical Sales records (accounts, people, opportunities), Marketing records (campaigns, email activity), a report builder (definitions + on-demand runs), and integration status (connections + sync history) — all served from mock data spanning Salesforce and HubSpot.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
