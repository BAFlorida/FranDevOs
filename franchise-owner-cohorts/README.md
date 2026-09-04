# franchise-owner-cohorts

Cleans a Clay export of U.S. franchise-owner candidates, normalizes franchise brands and
DBAs, parses enriched LinkedIn employment histories, classifies pre-franchise career
archetypes, and exports segmented audience cohorts (Meta seed files + matched-contact
lists).

## Pipeline

| Stage | Script | AI? | Output |
|---|---|---|---|
| Clean + dedupe | `src/01_clean_people.py` | no | `data/processed/01_people_clean.csv` |
| Brand/DBA normalization | `src/02_normalize_brand_affiliation.py` | no | `data/processed/02_people_brand_normalized.csv` |
| Current-ownership screen | `src/03_classify_current_ownership.py` | no | `data/processed/03_current_ownership_candidates.csv` |
| Work-history parse | `src/04_parse_work_history.py` | no | `data/processed/04_work_history_parsed.csv` |
| AI pilot prep (250) | `src/05_prepare_ai_career_pilot.py` | no | `data/staging/career_classification_pilot_250.csv` + prompts JSONL |
| AI classification | in-session Claude (see CLAUDE.md) | yes | `data/staging/*_responses.jsonl` |
| Score + cohort export | `src/07_score_and_export_cohorts.py` | no | `outputs/seed_*.csv` |

Deterministic stages never call an LLM. Every classification carries source data, a
reason, a confidence, and a run timestamp.

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python src/01_clean_people.py
.venv/bin/python src/02_normalize_brand_affiliation.py
.venv/bin/python src/03_classify_current_ownership.py
.venv/bin/python src/04_parse_work_history.py
.venv/bin/python src/05_prepare_ai_career_pilot.py
.venv/bin/pytest
```

## Analysis layer — the warehouse and Cohort Lab

Cohort questions are answered as queries (or clicks), not as bespoke scripts.
Grain: **one row per person per job**. Schema: `docs/warehouse_schema.md`.

- `src/07_build_warehouse.py` → `data/warehouse/roles.parquet` (51,319 rows, one
  per person per job; dates preserved, function / sector / brand tags, position
  relative to the purchase), `persons.parquet` (every record, `is_usable`
  flagged, composition + longest role + sector affinity + cohort booleans baked
  in), `employers.parquet` (the classifier review surface), `frandev.duckdb`
  (all tables + the phase-one cohort views + materialized `cohorts`).
  Deterministic; ~3 min. `--comparison <stage-04 csv>` loads the matched
  non-owner sample as `population = 'comparison'`
  (`src/09_prepare_comparison.py` prepares it with the same stages 01–04).
- **All vocabulary lives in `config/vocab.yaml`** — ownership, corporate, the
  16 functions and their 7-way collapse, the 17 sectors (brand-segment
  vocabulary), franchisor entities. Inline regex in analysis code is a bug.
- `sql/cohorts/*.sql` — the three phase-one cohorts (purchase-act:
  green / facilities / restoration owners). Earlier views are archived, not built.
- `cohort_lab/` — the click-to-explore app (Explore builder with
  click-to-filter, six saved questions, people finder, SELECT-only SQL box);
  `cohort_lab/questions/*.sql` are the saved questions and can also be run with
  `src/08_query.py … --file` for a CSV + sidecar (SQL, row count, warehouse hash).
- `tests/test_build_warehouse.py` freezes the published totals and 25
  hand-verified golden career paths (`tests/golden_career_paths.csv`). Changing
  vocabulary moves those tests: update the constants and goldens in the same
  commit, deliberately, with a note.
- **Every share is a share of owners until the comparison sample is loaded.**
  Known sensitivity: "prior ownership" counts 1,566 people under the canonical
  strict vocabulary; admitting bare `partner`/`ceo`/`principal` titles raises it
  to ~1,714. The strict definition is canonical.

The warehouse files live under `data/` and are **never committed** (public
repo); rebuild them from the processed CSV any time.

## Data policy

The containing git repository is **public**. `data/` and `outputs/` are gitignored and
must never be committed — they contain personal data. The durable data home is the
project's Google Drive folder; only code, tests, config dictionaries, prompts, and docs
are versioned here. The raw Clay export is preserved unchanged in `data/raw/`.

## Config dictionaries (editable, reviewed by humans)

- `config/approved_brands.csv` — canonical brands, parent platforms, segments, aliases.
  Bootstrapped from the export's own company distribution; correct and extend over time.
- `config/company_exclusions.csv` — unrelated same-name entities and franchisor/corporate
  entities. `reason` starting with `unrelated` is a hard exclusion; `franchisor/corporate`
  excludes unless the person's title asserts ownership (those route to manual review).
- `config/title_rules.csv` — include / hard-exclude / caution title patterns.
- `config/career_archetypes.csv` — the fixed 18-archetype taxonomy for prior careers.
