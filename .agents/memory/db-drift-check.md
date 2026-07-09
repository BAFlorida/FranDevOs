---
name: DB schema drift check
description: How drift between the live Postgres DB and the Drizzle schema is guarded against.
---
# DB schema drift check

`scripts/src/check-db-drift.ts` (npm: `pnpm --filter @workspace/scripts run check-db-drift`,
registered as the `db-drift` validation step) introspects every `pgTable` exported from
`@workspace/db/schema` via `getTableConfig` and compares against `information_schema.columns`
in the live DB. Exits 0=match, 1=drift (lists missing tables, missing columns, extra columns),
2=cannot run (no DATABASE_URL / connection error).

**Why:** the live DB repeatedly fell out of sync with the schema after hand-applied DDL,
causing 500s on the task list / dashboard. This catches that class of drift before users hit it.

**How to apply:** run it after any schema change. It checks table/column presence AND per-column
data type, nullability, and default. Drizzle `getSQLType()` is canonicalized to match
`information_schema` (`serial`→`integer`+nextval, `varchar(n)`→`character varying(n)`,
`numeric(p, s)`→`numeric(p,s)`, bare `timestamp`→`timestamp without time zone`). Default *presence*
is checked for all (expected = serial OR static default; `$default`/`$onUpdate` are app-level and
create no DB default). Default *value* is compared only for literals (string/number/bool/json) —
SQL-expression defaults (`now()`, `gen_random_uuid()`, `interval`) are presence-only because
Postgres rewrites their serialized form (e.g. `interval '7 days'`→`'7 days'::interval`).

**Extras (reverse comparison):** extra tables/indexes/unique-constraints/FKs present in the live DB
but not in the schema are reported as a distinct WARNING section that does NOT fail the check (exit 0)
unless `--strict-extras` is passed (then exit 1). Extra *columns* remain a hard failure (pre-existing).
Backing indexes for `*_pkey` and unique constraints are excluded via `bool_or(con.oid IS NOT NULL)`
(pg_constraint.conindid) so they aren't flagged as noise; the matching unique constraint is still
reported once via contype 'u'. Extra objects on an extra table aren't double-reported (table covers it).

**Relational guardrails (indexes / unique constraints / FKs):** also compared, matched by the
*name Drizzle generates* (declared-vs-live by name; extras handled separately above). Sources from
`getTableConfig`: indexes = `config.indexes` (`.config.name/.unique/.columns`); unique constraints =
column `.unique()` surfaces as `column.isUnique`+`column.uniqueName` (NOT in `config.uniqueConstraints`,
which only holds table-level `unique(...)`); FKs = `config.foreignKeys` (`fk.getName()`, `fk.reference()`,
`fk.onDelete/onUpdate` default to "no action" when unset). Live side: `pg_index`, `pg_constraint`
contype 'u' / 'f'. FK action codes confdeltype/confupdtype: a=no action, r=restrict, c=cascade,
n=set null, d=set default.

**node-pg gotcha:** `array_agg(attname)` returns Postgres `name[]` (OID 1003) which node-pg does NOT
parse — it comes back as the raw literal string `"{id}"`, so `.map` blows up. Cast to text inside the
aggregate: `array_agg(attname::text ORDER BY ...)` → `text[]` (OID 1009) which node-pg parses to a JS array.
