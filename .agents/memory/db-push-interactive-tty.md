---
name: DB push hits interactive TTY
description: drizzle-kit push prompts interactively in this environment; how to apply dev DDL non-interactively
---

`pnpm --filter @workspace/db run push` (drizzle-kit push) opens an **interactive
TTY prompt** (e.g. "is this a new column or a rename?") that cannot be answered
from the agent shell — it hangs and times out.

**How to apply:** For additive/dev schema changes, apply the DDL directly via the
code_execution `executeSql` callback (CREATE TABLE / ALTER TABLE ADD COLUMN / ADD
CONSTRAINT / CREATE INDEX), then verify with a follow-up SELECT against
information_schema. Keep the Drizzle schema in `lib/db/src/schema/` as the source
of truth so the table definitions still match.

**Why:** drizzle-kit's interactive disambiguation can't be driven headlessly here.
Note: the `push-force` script (`drizzle-kit push --force`) does **not** help for the
"about to add unique constraint ... truncate table?" prompt — that prompt still
blocks on a TTY and aborts. So `executeSql` DDL is the reliable path.

**Publish/production drift symptom:** the same hand-applied-DDL drift breaks the
Publish flow. Replit syncs prod schema by diffing the **dev** DB against prod at
publish time — it does NOT read `lib/db/src/schema/`. If post-merge `push` silently
fails (it hangs on the TTY prompt), the dev DB never gets the merged schema, so the
published server can crash at startup on a missing table/relation and the port never
opens (health check fails). Fix = reconcile the **dev** DB to match the schema via
idempotent `executeSql` DDL (use Drizzle-style constraint/FK names to avoid future
push diffs), verify the server boots, then tell the user to **re-publish**. Never add
prod DDL, deploy-build migration hooks, or startup-time DDL to "self-heal" prod.

**Drift symptom to watch for:** because DDL is applied by hand, the dev DB can fall
behind `lib/db/src/schema/`. If every authenticated route returns HTTP 500 with
`Error: Failed query: select ... from "users"` (while `/api/healthz` is fine), the
`users` table is missing columns the schema declares (e.g. `is_active`,
`auth_subject`) — `requireAuth` selects them on every request. Reconcile the live
table against the schema via `executeSql` (`ALTER TABLE ... ADD COLUMN IF NOT
EXISTS`), don't just assume the route code is wrong.
