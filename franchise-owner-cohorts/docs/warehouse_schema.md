# Warehouse schema

Built by `src/07_build_warehouse.py` into `data/warehouse/` (gitignored — people
data). One DuckDB file, `frandev.duckdb`, plus the same tables as parquet.
Grain: **one row per person per job**. Nothing is aggregated away; every
derived column is baked at build time so a question is a filter or a GROUP
BY, never a reconstruction.

Rebuild after any classifier change:

    .venv/bin/python src/07_build_warehouse.py
    .venv/bin/python src/07_build_warehouse.py --comparison data/processed/comparison/04_work_history_parsed.csv

Names that already worked were kept (`roles`, `persons`, `record_id`, `seq`,
`fr_start_ym`, …); the brief's `fct_person_role` / `dim_person` /
`dim_employer` are `roles` / `persons` / `employers`. Months-since-year-0
integers (`*_ym`, `2020-01 = 24240`) sit next to real `DATE` columns.

## `roles` — the spine

| column | meaning |
|---|---|
| `record_id` | person key (stable hash from stage 01); joins everything |
| `population` | `owner` \| `comparison` |
| `seq` | 0..n-1, chronological within the person (dated roles by start, undated last) |
| `orig_idx` | position in the raw LinkedIn history (most recent first) |
| `title`, `company` | as written |
| `title_norm`, `company_norm` | token-joined lowercase (`"Co-Owner / G.M."` → `co owner g m`) |
| `start_ym`, `end_ym` | months since year 0; **NULL preserved** for unknown / Present |
| `start_date`, `end_date` | the same as `DATE` (first of month); NULL preserved |
| `start_precision`, `end_precision` | `month` \| `year` \| NULL — a year-only date is placed at June |
| `date_imputed` | true when either date was year-only (0 rows in this export; the flag exists for future loads) |
| `end_is_present` | LinkedIn "Present" — often stale; never converted to a date |
| `end_before_start` | raw contradiction: the derived end was withdrawn (6 rows) |
| `duration_mo` | end − start when both are dated; NULL otherwise — never imputed |
| `months_to_asof` | for Present roles with a dated start: months to `as_of_ym` (export month, 2026-08) |
| `is_franchise_role` | the person's own franchise unit (stage 04: matches their brand / current company / owner title at an approved brand) |
| `at_franchise_brand` | employer string matches an approved brand alias (any title) |
| `franchise_brand`, `franchise_brand_segment`, `franchise_brand_family` | that brand, its segment, its parent platform |
| `franchise_role_kind` | `owner` (ownership title or the person's own unit) \| `staff` (employee at a brand) \| `franchisor` (employer is the franchisor / development org) \| `excluded_entity` (company_exclusions.csv hit) \| `''` |
| `is_ownership` | canonical ownership title (owner, founder, proprietor, franchisee, managing partner/member, self employed). **Bare president / CEO / partner / principal are NOT ownership** — the deliberate call behind the 467 second-attempt figure |
| `is_corporate` | employment title (manager, director, VP, analyst, …); never true when `is_ownership` |
| `is_middle_mgmt`, `is_clinical_title`, `is_education_title`, `at_education_employer`, `is_military_org`, `is_sales_bd_leader`, `is_ops_leader`, `is_multisite_mgr`, `at_restructuring_employer` | the legacy cohort flags, kept |
| `functions` | comma list of all 16-way functions the title matched (multi-label) |
| `function_detail` | the single most specific 16-way function (vocab precedence) |
| `function_tag` | 7-way: `sales` \| `clinical` \| `finance` \| `technical` \| `gm` \| `ops` \| `other` (first match in `function_tags` order) |
| `function_tier` | the person's tier (1 touched / 2 experienced 3y+ / 3 career) in this role's tag; only on basis roles, NULL for `other` |
| `sector_tag` | industry sector in the **brand-segment vocabulary** (17 values) or `unclassified` |
| `sector_source` | `brand` (authoritative: role at an approved brand) \| `employer` \| `title` \| `''` |
| `purchase_position` | `pre` \| `purchase` \| `post` \| `undated` (owners with a dated purchase); `no_purchase` otherwise |
| `is_pre_purchase`, `is_post_purchase` | nullable booleans; NULL when the position is undecidable |
| `composition_months` | months this role contributes to the person's composition: `min(end, cap) − start`, Present → `cap − start`; `cap` = franchise start (owners) or `as_of_ym` (comparison); NULL off the basis |

## `persons` — one row per person, every record kept

| column | meaning |
|---|---|
| `record_id`, `population` | as above |
| `screen_status` | stage 03: `approved_candidate` \| `needs_review` \| `excluded` |
| `is_usable`, `usable_reason` | owners: `usable` needs approved + dated purchase + ≥1 dated pre-purchase role; else `not_approved` / `no_history` / `no_dated_purchase` / `no_dated_pre_role`. Comparison: `usable` needs ≥1 dated role; `screened_as_owner` marks a contaminant (kept, excluded from every basis) |
| `full_name`, `linkedin`, `job_title`, `company` | identity + current role |
| `canonical_brand`, `brand_segment`, `brand_family`, `ownership_confidence`, `is_multi_unit` | current franchise (multi-unit is a title signal only: 22 people) |
| `city`, `state`, `metro` | from the export; `metro` = "City, State" after stripping "Greater … Area" / "Metro …" / "… Metroplex"; not geocoded, suburbs stay separate |
| `first_job_year`, `years_since_first_job` | earliest dated start; years to `as_of_ym` |
| `n_roles`, `dated_roles`, `history_completeness` | total roles, roles with a dated start, ratio |
| `fr_start_ym`, `franchise_purchase_year` | first dated franchise role |
| `n_pre_roles`, `career_path`, `is_reentry`, `had_prior_ownership`, `n_corp_after`, `yrs_between`, `last_own_*`, `return_*` | the canonical career-path partition (`no_prior_ownership` / `owner_straight_to_franchise` / `owner_then_corporate` = re-entry) |
| `pre_months_total` | sum of `composition_months` over the basis |
| `months_<tag>`, `share_<tag>` | for the 7 tags: months and share of the basis in that tag (overlapping roles double-count by design — exposure share, not a clock) |
| `tier_<tag>` | for the 6 real tags: 0 none / 1 touched / 2 experienced (≥36 mo) / 3 career (≥84 mo, or ≥50% share with ≥36 mo) |
| `longest_pre_title`, `longest_pre_employer`, `longest_pre_months`, `longest_pre_function`, `longest_pre_sector` | the longest basis role |
| `pre_sectors` | comma list of distinct classified sectors across basis roles |
| `top_pre_sector` | sector with the most basis months |
| `sector_affinity`, `affinity_role_title` | any basis role's sector == `brand_segment` (the affinity flag) |
| `cohort_green_owners`, `cohort_facilities_owners`, `cohort_restoration_owners` | phase-one cohort booleans (from `sql/cohorts/*.sql`) |
| `cohort_flags`, `cohort_count` | comma list / count — overlap is a COUNT |

## `employers` — the classifier review surface

One row per `company_norm` across every role of every population:
`company` (most common raw spelling), `record_count`, `person_count`,
`sector_tag`, `sector_source`, `is_franchise_brand`, `franchise_brand`,
`brand_family`, `brand_segment`, `ownership_role_share`, `entity_kind`,
`top_titles`, `owner_records`, `comparison_records`. Sort ascending by
`record_count` to read the tail (26,844 of 32,109 employers appear once).

## `cohorts`, `backgrounds`, `role_functions`, `vocab_constants`

`cohorts(cohort_id, record_id, matched_on, confidence)` is the long form of
the three booleans. `backgrounds` is the 16-way person × function exposure
table (kept for the finer taxonomy); `role_functions` its role-level long
form. `vocab_constants` carries `as_of_ym`, `recent_start_ym_min`,
`tenure_min_months`, `still_employed_grace_months`.

## Populations and what a share means

`population = 'owner'` is the Clay export of LinkedIn-visible franchise
owners. Until a matched non-owner sample is loaded as
`population = 'comparison'`, **every share in every output is a share of
owners** — a description of what résumés in this pool look like, not
evidence that a background buys franchises. Question 1 in Cohort Lab shows
the comparison side empty on purpose.

The comparison sample is prepared with `src/09_prepare_comparison.py`
(stages 01–04, identical code and vocabulary) and loaded with
`--comparison`; its tenure basis is the whole dated career measured to
`as_of_ym`. Anyone in it whom stage 03 screens as a franchise owner stays in
`persons` flagged `screened_as_owner` and is excluded from every basis.
