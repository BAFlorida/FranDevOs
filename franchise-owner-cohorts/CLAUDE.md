# franchise-owner-cohorts — project rules

Turn the Clay export of U.S. service-franchise owners/executives into a clean, auditable
dataset identifying each person's likely pre-franchise career archetype, then export
separate cohort seed files for Meta/LinkedIn targeting.

## Non-negotiable rules

- U.S.-based people only.
- Preserve every raw source row unchanged. Never overwrite raw files or manually edited
  review outputs.
- Deduplicate on LinkedIn Profile URL only; retain provenance (`duplicate_count`,
  `duplicate_source_row_ids`). Never dedupe on name, employer, or location.
- Never treat a franchisor, parent-company, corporate-office, franchise-development,
  broker, recruiter, consultant, vendor, or support employee as a local franchise owner.
- A local DBA is valid ("FASTSIGNS of Orlando", "SERVPRO of North Raleigh", "U.S. Lawns
  Miami North"). Never exclude a real owner because their employer string is a DBA, LLC,
  operating group, city variation, or punctuation/spelling variant.
- Low-cost cleaning-unit/subfranchise models stay out of the strict investment cohort
  (`strict_150k_status = subfranchise_excluded`); they remain in the reference table only.
- Do not infer exact employment dates from contradictory overlapping "Present" jobs.
  Preserve evidence, set `timeline_conflict`, lower confidence.
- Every classification needs: source data, a reason, a confidence, and a run timestamp.
- Steps 01–05 and 07 are deterministic — no LLM/API calls in those scripts, ever.

## Environment adaptations (differs from the original plan doc)

- The raw export already contains Clay person-enrichment columns (`Name`, `Title`, `Org`,
  `Summary`, `Full Work History`), so the plan's separate "return to Clay for work-history
  enrichment" phase is already satisfied. `04_parse_work_history.py` reads the embedded
  `Full Work History` (format: `Title at Company (MM/YYYY - MM/YYYY|Present); ...`).
- AI classification runs **in-session** (Claude Code acts as the classifier): script 05
  emits `data/staging/*_prompts.jsonl`; the session writes matching `*_responses.jsonl`
  entries (one JSON object per record: `record_id`, `response`, `model`, `classified_at`).
  The prompt is `prompts/classify_prior_career.md`. Do not hardcode model names in code.
- This git repository is **public**: `data/` and `outputs/` are gitignored. People data is
  synced to the Google Drive project folder instead. Test fixtures must be synthetic —
  never commit rows about real people.

## Gotchas

- The Clay CSV's first column is the view name with empty values; enrichment status column
  `Enrich person` contains junk plus `❌ No Profile Found` / `❌ Blocked data` markers.
- Work-history entries split on `"); "`; parse title with the FIRST " at " (company names
  like "Right at Home" contain " at "). Entries with 2+ " at " get `parse_ambiguity`.
- Stale LinkedIn roles show `- Present` end dates; many profiles have several concurrent
  "Present" jobs. Use start-date ordering, set `timeline_conflict`, don't invent ends.
- `Midas` alone is ambiguous (Midas Capital/Fabric/Productions/etc. are unrelated); bare
  brand equality for `bare_name_ambiguous` brands routes to manual review, qualified
  aliases ("Midas Auto…", "Midas of …") match normally.
- Franchisor-entity company strings ("Kitchen Tune-Up Franchise System") are often just
  franchisees writing the franchisor name: `franchisor/corporate` exclusions with an
  ownership title go to `needs_manual_ownership_review`, not hard exclusion.

## Analysis warehouse rules

- `src/07_build_warehouse.py` builds `data/warehouse/{roles,persons,employers,cohorts}.parquet`
  + `frandev.duckdb` (schema: `docs/warehouse_schema.md`). Grain = one row per
  person per job; every derived column is baked at build time. Answer
  cohort/career questions by querying these — never by re-parsing
  `prior_history_json` with ad-hoc regex (that is how the same question once
  returned both 545 and 480).
- Names that work are kept: `roles` / `persons` / `record_id` / `seq` /
  `fr_start_ym`. Do not rename a working spine to match a brief.
- Every record stays in `persons` with `is_usable` / `usable_reason`; rows with
  missing dates stay in `roles` with NULLs. Nothing is dropped or imputed
  silently (`date_imputed`, `start_precision`, `months_to_asof` carry the facts).
- `population` ∈ {owner, comparison}. Until a matched comparison sample is
  loaded (`src/09_prepare_comparison.py` then `--comparison`), **every share is
  a share of owners, never a finding**. Write it that way in every output.
- Ownership/corporate/function/sector vocabulary lives ONLY in `config/vocab.yaml`.
  Canonical calls: bare president/ceo/partner/principal are NOT ownership.
  Fix a bad sector or brand tag by editing the vocab / `approved_brands.csv`
  and rebuilding — never by editing output. `employers` (rarest first) is the
  review surface.
- Phase one is THREE cohorts (`sql/cohorts/green_owners|facilities_owners|restoration_owners.sql`,
  purchase-act definitions). Do not add a fourth without a decision; the 17
  earlier views live in `sql/cohorts/archive/` and are not built.
- Every published figure runs through `src/08_query.py` (or the app) so it
  lands next to its SQL. The saved questions are `cohort_lab/questions/*.sql`.
- `tests/test_build_warehouse.py` freezes totals + 25 golden career paths; a
  vocab change that moves them must update both, in the same commit, on purpose.
- Rebuilds are deterministic: durations "to now" use `as_of_ym` (export month),
  never the clock.

## Commands

- Run pipeline: `.venv/bin/python src/01_clean_people.py` (then 02, 03, 04, 05)
- Build warehouse: `.venv/bin/python src/07_build_warehouse.py` (~3 min; add `--comparison <stage04 csv>` once the sample exists)
- Comparison sample: `.venv/bin/python src/09_prepare_comparison.py --input data/raw/comparison/<export>.csv`
- Query with sidecar: `.venv/bin/python src/08_query.py --name q1 --file cohort_lab/questions/q1_function_tier_by_population.sql`
- Cohort Lab locally: `cd cohort_lab && ../.venv/bin/python app.py` (http://127.0.0.1:5099); deploy data: `.venv/bin/python cohort_lab/prepare_deploy.py`
- Tests: `.venv/bin/pytest`
