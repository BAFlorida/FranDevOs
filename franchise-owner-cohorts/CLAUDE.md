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

- `src/07_build_warehouse.py` builds `data/warehouse/{roles,persons}.parquet` +
  `frandev.duckdb`. Answer cohort/career questions by querying these — never by
  re-parsing `prior_history_json` with ad-hoc regex (that is how the same
  question once returned both 545 and 480).
- Ownership/corporate/cohort vocabulary lives ONLY in `config/vocab.yaml`.
  Canonical calls: bare president/ceo/partner/principal are NOT ownership.
- Every published figure runs through `src/08_query.py` so it lands next to a
  sidecar carrying its SQL and row count.
- `tests/test_build_warehouse.py` freezes totals + 25 golden career paths; a
  vocab change that moves them must update both, in the same commit, on purpose.
- Cohort 9 (three-year tenure) usable subset = explicit-end qualifiers only;
  Present-flagged qualifiers are stale-risk (see outputs/analysis/cohort9_*).

## Commands

- Run pipeline: `.venv/bin/python src/01_clean_people.py` (then 02, 03, 04, 05)
- Build warehouse: `.venv/bin/python src/07_build_warehouse.py`
- Query with sidecar: `.venv/bin/python src/08_query.py --name x --file sql/figures/x.sql`
- Tests: `.venv/bin/pytest`
