# Franchise Development OS

Multi-user internal web app for franchise development: strategic initiatives, tactics,
tasks, KPI scorecards, and an executive dashboard with Excel export. Includes a CRM
Reporting foundation (Salesforce + HubSpot canonical data, currently mock) and a report
builder. Auth is in-app email/password with invite-link onboarding, role-based
permissions, and Super Admin impersonation.

> **Migration note (read first):** This repo was built on Replit and is being moved to a
> standard environment. Replit-specific coupling still present — clean these up when
> touched, do not assume Replit is the runtime:
> - `artifacts/franchise-dev-os/vite.config.ts` imports `@replit/vite-plugin-runtime-error-modal`
>   (loaded unconditionally) and, behind a `REPL_ID` guard, `@replit/vite-plugin-cartographer`
>   and `@replit/vite-plugin-dev-banner`. Remove the unconditional Replit plugin for
>   non-Replit runs.
> - `pnpm-workspace.yaml` has a large `overrides` block setting every platform binary for
>   esbuild / rollup / tailwindcss-oxide / lightningcss to `'-'` (stripped). Replit patches
>   its own binaries back in; off-Replit this can break `pnpm install` because the native
>   binary for the host platform is removed. Expect to prune these overrides.
> - `vite.config.ts` throws if `PORT` and `BASE_PATH` env vars are unset (Replit injected
>   them). Provide them via `.env` / the environment.
> - `lib/replit-auth-web` — verify whether it is load-bearing; auth is in-app
>   email/password (see below), so it may be a thin web hook that can be simplified.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/api-server run test` — API server tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/scripts run test` — unit tests for utility scripts (DB drift check); no live DB needed
- `pnpm --filter @workspace/scripts run check-db-drift` — compare live Postgres vs Drizzle schema
- `pnpm run build` — typecheck + build all packages
- `pnpm run test` — all package tests
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; see gotcha below — this hangs)
- Seed: `NODE_ENV=development pnpm --filter @workspace/api-server exec tsx src/seed.ts`
- `pnpm --filter @workspace/territory-prospector run dev` — Territory Prospector (standalone Google Maps prospecting tool; see its README)
- **Required env:** `DATABASE_URL` (Postgres), plus `PORT` and `BASE_PATH` for the web app.
  Territory Prospector needs `VITE_GOOGLE_MAPS_API_KEY` (browser key, Maps JS + Places API New);
  the api-server's optional `/crm/territory/search` proxy needs `GOOGLE_MAPS_API_KEY` (server key)
  and returns 503 without it.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Web: React 19 + Vite 7 + Tailwind 4 + shadcn/ui + wouter + TanStack Query
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **DB schema (source of truth):** `lib/db/src/schema/` — `auth.ts`, `app.ts`, `crm.ts`; re-exported from `index.ts`.
  - CRM reporting canonical tables (`crm_connections`, `crm_accounts`, `crm_people`, `crm_opportunities`, `crm_campaigns`, `crm_email_activity`, `crm_sync_events`, `crm_task_links`, `report_definitions`) live in `crm.ts`.
- **API contract (source of truth):** `lib/api-spec/openapi.yaml`. Generated hooks → `lib/api-client-react`; generated Zod → `lib/api-zod`. Regenerate with the codegen command above.
- **Server routes:** `artifacts/api-server/src/routes/` (registered in `routes/index.ts`). CRM seam files: `crm.ts`, `marketing.ts`, `crm-reporting.ts`, `integrations.ts`. Auth seam files: `auth.ts`, `impersonation.ts`, `users.ts`.
- **Auth:** `artifacts/api-server/src/lib/` — `password.ts` (scrypt hash/verify), `permissions.ts` (`buildAppUser`, `requireAuth` w/ impersonation), `superAdminBootstrap.ts`. Web client hook: `lib/replit-auth-web/src/use-auth.ts`.
- **CRM service-adapter layer:** `artifacts/api-server/src/integrations/` — `salesforceAdapter.ts`, `hubspotAdapter.ts` (implement `CrmAdapter`), `canonicalStore.ts`, `reportingService.ts`, `index.ts` (registry).
- **Web app:** `artifacts/franchise-dev-os/` — pages in `src/pages/`, components in `src/components/`.
- **Territory prospecting:** `artifacts/territory-prospector/` — standalone Google Maps prospecting tool
  (Places text search in the browser, lead list in localStorage, CSV export; see its README). Optional
  server seam for a future shared lead list: `crm_territory_leads` table (`lib/db/src/schema/crm.ts`,
  hand-apply DDL in `lib/db/sql/`), `integrations/googlePlaces.ts` (the app's first REAL external
  call — Places API New, server-side `GOOGLE_MAPS_API_KEY`), routes in `routes/territory.ts`.
- **Future-sync stubs (no impl):** `artifacts/api-server/src/workers/` and `artifacts/api-server/src/integrations/auth/`.

## Architecture decisions

- CRM data is modeled as **canonical Postgres tables** with provenance columns (`sourceSystem`, `sourceRecordId`, `rawPayload`, `externalLastModifiedAt`, `syncedAt`, `connectionId`) so Salesforce and HubSpot rows share one shape.
- Opportunity stages use a fixed canonical vocabulary (`CRM_STAGE_VOCABULARY` in `crm.ts`) in `stageCanonical`, with the source label preserved in `stageRaw`.
- Adapters today return mock data by reading the canonical tables. Real external-call seams are marked `// TODO(api): ...`. **No external CRM calls or external CRM auth exist yet.** (The only real external call in the codebase is Google Places in `integrations/googlePlaces.ts` — a prospecting source, deliberately NOT a `CrmAdapter`.)
- Reporting (`/reports/run`) aggregates over canonical tables **internally only** — never queries an external CRM.
- Routes validate inputs with generated Zod schemas; responses return raw rows (dates serialize to ISO strings).
- **Auth is in-app email/password only** — no OIDC, no self-service signup, no forgot-password email. Passwords are scrypt-hashed. New users join via one-time invite links (`/invite/<token>`). Admins reset passwords; users change their own.
- **Super Admin** is a role above admin/vp with the exclusive `impersonate_users` permission. "Act as" impersonation stores `impersonatedUserId` in the session; impersonation start/stop is audit-logged to the **real** super admin. Only super admins may assign `super_admin`.
- First super admin is bootstrapped on startup and sets a password via a one-time invite link logged once at boot — never hardcoded.

## Gotchas (hard-won — read before touching the relevant area)

### DB `push` hangs on an interactive prompt
`pnpm --filter @workspace/db run push` (drizzle-kit push) opens an **interactive TTY prompt**
("new column or a rename?") that hangs headless. `push --force` does NOT help — the
"truncate table?" prompt still blocks. **Apply additive/dev DDL directly via SQL**
(`CREATE TABLE` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` / `ADD CONSTRAINT` / `CREATE INDEX`),
then verify with a `SELECT` against `information_schema`. Keep `lib/db/src/schema/` as the
source of truth so definitions still match. Use Drizzle-style constraint/FK names to avoid
future push diffs.

### Schema drift → HTTP 500 on every authenticated route
Because DDL is hand-applied, the live DB can fall behind `lib/db/src/schema/`. Symptom: every
authenticated route returns 500 with `Failed query: select ... from "users"` while
`/api/healthz` is fine — the `users` table is missing columns (`is_active`, `auth_subject`)
that `requireAuth` selects on every request. Fix: reconcile the live table to the schema via
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; don't assume the route code is wrong. Guard against
this with `check-db-drift` after any schema change (introspects `pgTable` vs
`information_schema`; exit 0=match, 1=drift, 2=can't run).

### Orval codegen quirks
- **"Failed to resolve input"** usually means a **duplicate path key** in `openapi.yaml`
  (e.g. two `/users` entries), not bad YAML.
- **201 responses get no generated `<Op>Response` Zod schema** (Orval only emits for 200). Reuse
  a same-shape schema from another operation.
- **Generated hook signatures differ:** mutations are `useXxx({ data })` (`{ id }` for path
  params). GET with query params: `useXxx(params | undefined, { query })` — pass `undefined`
  first or typecheck fails. GET without params: `useXxx({ query })`.

### Permission bootstrap must seed every role
The role→permission mapping falls back to built-in defaults **only when `role_permissions` is
completely empty**. The first admin edit to any role makes the table non-empty and flips the
source to DB rows — any role never seeded then reads as ZERO permissions and silently locks
people out. `ensurePermissionBootstrap()` (idempotent, on startup) must upsert the full
permission catalog into `permissions` AND seed `role_permissions` for **every** role. Changing
defaults won't retro-apply to a DB that already has rows.

### Read-only roles need a hard method block
Many mutating routes are guarded by only `requireAuth` (no `requirePermission`) — e.g. task
POST/PATCH/DELETE, `POST /metric-entries`, `POST /reports/definitions`. An empty permission set
does NOT stop them. Enforce read-only as a hard, method-based block inside `requireAuth`
(`permissions.ts`), keyed on the **acting** role (`READ_ONLY_ROLES`/`isReadOnlyRole`): if the
acting role is read-only and the method is POST/PUT/PATCH/DELETE, return 403 before route logic.
Keyed on acting role so an impersonating super admin is also blocked. Allowlist the mutating
paths a read-only user must still reach: `/auth/change-password` and `/impersonate/stop`. The
`role` column is `varchar(16)` (not a pg enum), so adding a role needs NO DB migration. Frontend
`useReadOnly()` (`franchise-dev-os/src/lib/use-read-only.ts`) mirrors this for UX only — the
server block is the real guard.

### Dev-only auth bypass (review during migration)
`authMiddleware` auto-signs-in requests when there's no valid session, picking the
highest-privilege active user, gated on `NODE_ENV !== "production"`. It existed to skip the login
screen in Replit's cross-site preview iframe. Consequences: an *unauthenticated* request in dev
still returns a populated `req.user` — don't treat "401 in dev" as the unauthenticated baseline;
test auth logic with `NODE_ENV=production`. Production deploys set `NODE_ENV=production` so the
bypass is OFF — **do not weaken that gate.** Off Replit, reconsider whether this bypass is still
wanted at all.

### node-pg array gotcha
`array_agg(attname)` returns Postgres `name[]` (OID 1003) which node-pg does NOT parse — it comes
back as the raw literal `"{id}"` and `.map` blows up. Cast inside the aggregate:
`array_agg(attname::text ORDER BY ...)` → `text[]` (OID 1009), which node-pg parses to a JS array.
