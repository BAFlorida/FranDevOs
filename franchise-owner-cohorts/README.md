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
