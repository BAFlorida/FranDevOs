# Cohort Lab

Flask + DuckDB query UI over the owner warehouse: role-level filters (title
contains ALL / employer contains ANY / min tenure / career path / segment /
bought-since / exclude-franchise-roles), a per-filter funnel, top matched
titles, a 25-row sample, the generating SQL on screen, and CSV export with the
SQL as header comments.

## Local

```bash
cd franchise-owner-cohorts
.venv/bin/python src/07_build_warehouse.py        # if data/warehouse is stale
.venv/bin/python cohort_lab/prepare_deploy.py     # trims + encrypts deploy data
cd cohort_lab && ../.venv/bin/python app.py       # http://127.0.0.1:5099
```

With `COHORT_USER`/`COHORT_PASSWORD` unset, local runs skip auth. Setting them
turns HTTP Basic auth on.

## Deploy (Render)

The repo is **public**, so `deploy/` holds only Fernet-encrypted parquet
(`*.parquet.enc`); plaintext parquet and `.data_key` are gitignored. The app
decrypts to /tmp at boot using `COHORT_DATA_KEY`.

1. Render dashboard → New → **Blueprint** → connect `BAFlorida/FranDevOs`.
   The blueprint (`render.yaml`, repo root) pins branch
   `claude/franchise-owner-cohorts-jjvqgy` and rootDir `franchise-owner-cohorts/cohort_lab`.
2. When prompted, set three env vars: `COHORT_USER`, `COHORT_PASSWORD` (your
   choice — these become the login), and `COHORT_DATA_KEY` (contents of
   `cohort_lab/.data_key`, delivered separately — never committed).
3. Deploy. Health check is `/healthz` (unauthenticated, returns row count only).

The app refuses to start on Render if the auth vars are missing, and cannot
read the data at all without the key. Note: access control here is basic auth
on a web service — a literal Render "private service" has no public URL, which
would make the UI unreachable from a browser.

## Refreshing data

Rebuild the warehouse, rerun `prepare_deploy.py` (same key), commit the changed
`.enc` files, push — Render auto-deploys the branch.
