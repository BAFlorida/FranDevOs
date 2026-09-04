# Cohort Lab

Click-to-explore layer over the franchise-owner career warehouse
(`../data/warehouse`, built by `../src/07_build_warehouse.py`; schema in
`../docs/warehouse_schema.md`). Flask + DuckDB in memory. No SQL needed to
answer a question; the SQL behind every number is on screen anyway.

| page | what it does |
|---|---|
| `/` | populations (records → approved → with history → usable; comparison sample loaded or **not**), the three phase-one cohorts with overlap counts, saved questions, starting points |
| `/explore` | query builder over `persons` / `roles` / `employers`: add filters (typed operators per column type), group by up to two columns (numeric bucketing, dates by year), pick a measure (rows, distinct people, avg/sum/median/min/max of a numeric column), sort, limit. One group → ranked bars; two → a pivot with one-hue shading. **Click a bar, a pivot cell, a row label or a text value and it becomes a filter chip** (click × on the chip to drop it). Column headers sort the row listing. CSV export carries the SQL as header comments. |
| `/q/q1…q6` | the six saved questions from `questions/*.sql`, rendered as a matrix or bars whose cells open the people behind them in Explore, with the result table, CSV and SQL |
| `/people` | the seed-list finder: role-level filters that must hold on the same past role, funnel, top titles, 25-row sample, CSV |
| `/sql` | one SELECT at a time against the in-memory tables. File access, ATTACH, COPY and settings are switched off on the connection (`enable_external_access=false`, `lock_configuration=true`), statements are parsed and must be a single SELECT, and a 25 s interrupt timer bounds runaway queries. |
| `/healthz` | unauthenticated row counts |

Saved questions: **Q1** function tier share by population with lift + 95% CI
(comparison columns are empty until a comparison sample is loaded — on
purpose, visibly); **Q2** sector affinity matrix (pre-purchase sector ×
purchased segment, lift, blue above 1 / red below); **Q3** cohort overlap
matrix (a zero is a real zero) + people in exactly 1/2/3 cohorts; **Q4**
purchase year × function tier; **Q5** owner-pool metro / state / career-length
/ dated-roles distributions (the quotas for the Clay comparison search);
**Q6** employer tail, rarest first, the classifier review surface.

`../src/08_query.py --name q1 --file cohort_lab/questions/q1_function_tier_by_population.sql`
runs the same SQL against the DuckDB file and writes the CSV + sidecar.

## Local — one command, no Docker

```bash
cd franchise-owner-cohorts
.venv/bin/python src/07_build_warehouse.py                 # if data/warehouse is stale (~3 min)
cd cohort_lab && ../.venv/bin/python app.py                # http://127.0.0.1:5099
```

The app finds `../data/warehouse/*.parquet` on its own (or set
`COHORT_DATA_DIR`). With `COHORT_USER`/`COHORT_PASSWORD` unset, local runs
skip auth; setting them turns HTTP Basic auth on.

## Deploy (Render)

The repo is **public**, so `deploy/` holds only Fernet-encrypted parquet
(`*.parquet.enc`: persons, roles, employers, cohorts — every column); plaintext
parquet and `.data_key` are gitignored. The app decrypts to /tmp at boot with
`COHORT_DATA_KEY`.

1. Render dashboard → New → **Blueprint** → connect `BAFlorida/FranDevOs`. The
   blueprint (`render.yaml`, repo root) pins the branch and
   rootDir `franchise-owner-cohorts/cohort_lab`.
2. Set three env vars when prompted: `COHORT_USER`, `COHORT_PASSWORD` (your
   login) and `COHORT_DATA_KEY` (contents of `cohort_lab/.data_key`, delivered
   separately — never committed).
3. Deploy. Health check is `/healthz`.

The app refuses to start on Render if the auth vars are missing and cannot
read the data without the key. Access control is basic auth on a web
service — a literal Render "private service" would have no public URL.

### Refreshing data

Rebuild the warehouse, `python cohort_lab/prepare_deploy.py` (same key),
commit the changed `.enc` files, push — Render auto-deploys the branch.

## Why not Metabase

The brief asked for Metabase on the DuckDB file in local Docker. It is
workable — MotherDuck maintains a community DuckDB driver — but it was not
built here because it could not be tested here (this environment has a
Docker client and no daemon), and shipping it untested would be the
half-works outcome the brief ruled out. If you want it anyway, the DuckDB
file is the deliverable and it will work with that driver; the honest
caveats are: the driver JAR must match the Metabase version and be mounted
into `/plugins`; DuckDB is single-writer, so the connection must be
read-only and Metabase stopped (or pointed at a copy) while
`07_build_warehouse.py` rewrites the file; and every rebuild means
re-copying the file to wherever Docker can see it. Cohort Lab gives up
Metabase's dashboard composer and question library UI; it keeps the one
thing the brief cared about — click on a chart to filter it — and runs
with one command.

## Tests

`../tests/test_cohort_lab.py` boots the app on a synthetic warehouse built
from `../tests/fixtures/synthetic_comparison_export.csv` (no real people):
schema-validated identifiers, bound parameters, drill round-trips, SELECT-only
SQL box with the sandbox on, CSV exports carrying their SQL.
