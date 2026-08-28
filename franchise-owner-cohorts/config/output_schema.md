# Output schema

Raw Clay columns pass through every stage unchanged (`First Name`, `Last Name`,
`Full Name`, `Job Title`, `Company`, `City`, `State or Province`, `Country`,
`LinkedIn Profile`, `Enrich person`, `Name`, `Title`, `Org`, `Summary`,
`Full Work History`). Derived columns per stage:

## 01_people_clean.csv (one row per unique person)

| column | type | source / rule |
|---|---|---|
| record_id | str | `p` + zero-padded first source row number; stable join key |
| source_row_id | int | 1-based data-row number in the raw CSV (canonical row) |
| normalized_company | str | `Company` lowercased, unicode punctuation folded, ®™© stripped, whitespace collapsed |
| normalized_job_title | str | same normalization applied to `Job Title` |
| normalized_linkedin | str | lowercase, scheme/host normalized, path only, trailing slash stripped |
| duplicate_count | int | rows sharing normalized_linkedin (>=1) |
| duplicate_source_row_ids | str | `;`-joined source_row_ids of the non-canonical duplicates |
| missing_city / missing_state / missing_first_name / missing_last_name | bool | field empty after strip |
| invalid_linkedin_url | bool | not a linkedin.com/in/ or /pub/ URL |
| enrichment_status | enum | ok / no_profile_found / blocked / no_work_history (from `Enrich person` + `Full Work History`) |
| enriched_title_differs | bool | enriched `Title` non-empty and != `Job Title` (normalized) |
| enriched_org_differs | bool | enriched `Org` non-empty and != `Company` (normalized) |

## 02_people_brand_normalized.csv (adds)

| column | type | rule |
|---|---|---|
| canonical_brand | str | best brand from approved_brands aliases; empty if none |
| matched_alias | str | alias variant that matched |
| match_method | enum | exact / prefix / contains / none |
| brand_match_confidence | enum | high / medium / low / none |
| local_dba_or_operating_entity | bool | matched with a non-empty local remainder (city, "of X", LLC, store #, operator entity) |
| company_exclusion_hit | str | exclusion pattern hit (empty if none) |
| company_exclusion_reason | str | reason from company_exclusions.csv |
| corporate_entity_signal | bool | company string carries franchisor/corporate markers (International Inc, Franchising LLC, Franchise System(s), Industries Inc, …) |
| needs_manual_brand_review | bool | ambiguous bare-name match, multi-brand collision, or exclusion/brand conflict |

## 03_current_ownership_candidates.csv (adds)

| column | type | rule |
|---|---|---|
| title_classification | enum | include / hard_exclude / caution / none |
| title_rule_hit | str | matched pattern(s), `;`-joined |
| multi_unit_signal | bool | any multi_unit-category include pattern matched |
| current_ownership_status | enum | approved_candidate / caution_candidate / excluded / needs_review |
| ownership_confidence | enum | high / medium / low |
| deterministic_reason | str | human-readable rule trace |
| classified_at | ISO timestamp | run timestamp |

Status logic (deterministic, in priority order):
1. hard-exclude title, or `unrelated *` company exclusion → **excluded**
2. `franchisor/corporate` exclusion or corporate_entity_signal: ownership title → **needs_review**, otherwise → **excluded**
3. brand matched + include title → **approved_candidate** (high confidence when brand confidence high and no enriched-org drift; else medium)
4. brand matched + caution title → **caution_candidate**
5. no brand match + include title → **needs_review** (missing alias or independent business)
6. everything else → **needs_review** (low)

## 04_work_history_parsed.csv (adds)

first_franchise_ownership_start, first_franchise_role_title,
last_credible_prior_title, last_credible_prior_employer, last_credible_prior_start,
last_credible_prior_end, prior_history_json, work_history_entry_count,
timeline_conflict (bool), parse_ambiguity (bool), career_date_confidence
(high/medium/low), prior_role_selection_reason.

Dates are `MM/YYYY`, `YYYY`, or `unknown`. `- Present` on stale roles is preserved as
evidence, never converted into an invented end date.

## AI classification responses (`data/staging/*_responses.jsonl`)

One JSON object per record: `record_id`, `response` (the schema in
`prompts/classify_prior_career.md`), `model`, `classified_at`, `work_history_hash`.
Invalid JSON or an archetype outside `config/career_archetypes.csv` routes the record to
needs_review — never silently coerced.

## Cohort exports (Step 11)

`outputs/seed_*.csv`, `approved_owner_master.csv`, `needs_manual_review.csv`,
`rejected_or_excluded.csv`, `cohort_summary.csv` — one row per person with all
source/confidence fields plus `cohort`, `score`, `score_breakdown`. Seed eligibility:
ownership confidence high/medium AND canonical brand non-empty AND career confidence
high/medium AND score >= threshold AND no exclusion flag.
