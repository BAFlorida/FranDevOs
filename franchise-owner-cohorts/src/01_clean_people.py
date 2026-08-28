"""Step 3 — deterministic cleaning of the raw Clay export. No LLM/API calls.

Keeps U.S. rows, normalizes comparison fields (originals preserved), dedupes on the
LinkedIn profile URL with full provenance, adds data-quality flags, and writes the
cleaning summary + duplicate report.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

import pipeline_lib as lib

MISSING_FLAGS = [
    ("missing_city", "City"),
    ("missing_state", "State or Province"),
    ("missing_first_name", "First Name"),
    ("missing_last_name", "Last Name"),
]


def enrichment_status(marker: str, work_history: str) -> str:
    if marker.startswith("❌ No Profile"):
        return "no_profile_found"
    if marker.startswith("❌ Blocked"):
        return "blocked"
    if not work_history:
        return "no_work_history"
    return "ok"


def run(
    input_path: Path | None = None,
    processed_dir: Path | None = None,
    outputs_dir: Path | None = None,
) -> pd.DataFrame:
    input_path = Path(input_path) if input_path else lib.newest_raw_export()
    processed_dir = Path(processed_dir) if processed_dir else lib.DATA_PROCESSED
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    processed_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    input_rows = len(df)
    df = df.apply(lambda col: col.str.strip() if col.dtype == object else col)
    df.insert(0, "source_row_id", range(1, len(df) + 1))

    us = df[df["Country"].str.lower() == "united states"].copy()

    us["normalized_company"] = us["Company"].map(lib.normalize_text)
    us["normalized_job_title"] = us["Job Title"].map(lib.normalize_text)
    us["normalized_linkedin"] = us["LinkedIn Profile"].map(lib.normalize_linkedin)
    us["invalid_linkedin_url"] = [not lib.is_valid_person_linkedin(u) for u in us["LinkedIn Profile"]]
    for flag, source_col in MISSING_FLAGS:
        us[flag] = us[source_col] == ""

    if "Enrich person" in us.columns and "Full Work History" in us.columns:
        us["enrichment_status"] = [
            enrichment_status(m, w) for m, w in zip(us["Enrich person"], us["Full Work History"])
        ]
        us["enriched_title_differs"] = [
            bool(t) and lib.normalize_text(t) != lib.normalize_text(j)
            for t, j in zip(us["Title"], us["Job Title"])
        ]
        us["enriched_org_differs"] = [
            bool(o) and lib.normalize_text(o) != lib.normalize_text(c)
            for o, c in zip(us["Org"], us["Company"])
        ]
    else:  # export variant without enrichment columns
        us["enrichment_status"] = "no_work_history"
        us["enriched_title_differs"] = False
        us["enriched_org_differs"] = False

    # Dedupe on normalized LinkedIn URL only. Blank URLs are never merged.
    key = us["normalized_linkedin"].copy()
    blank = key == ""
    key[blank] = "blank-" + us.loc[blank, "source_row_id"].astype(str)
    us["_dedupe_key"] = key
    groups = us.groupby("_dedupe_key", sort=False)["source_row_id"].agg(list)
    first_of_group = {k: ids[0] for k, ids in groups.items()}
    us["duplicate_count"] = us["_dedupe_key"].map(lambda k: len(groups[k]))
    us["duplicate_source_row_ids"] = us["_dedupe_key"].map(
        lambda k: ";".join(str(i) for i in groups[k][1:])
    )
    us["is_canonical"] = us["source_row_id"] == us["_dedupe_key"].map(first_of_group)

    duplicates = us[us["duplicate_count"] > 1].drop(columns=["_dedupe_key"])
    clean = us[us["is_canonical"]].drop(columns=["_dedupe_key", "is_canonical"]).copy()
    clean.insert(0, "record_id", [f"p{i:05d}" for i in clean["source_row_id"]])

    clean.to_csv(processed_dir / "01_people_clean.csv", index=False)
    duplicates.to_csv(outputs_dir / "01_duplicate_records.csv", index=False)

    top_companies = clean["Company"].value_counts().head(100)
    summary = {
        "run_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "input_file": input_path.name,
        "input_sha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "input_rows": input_rows,
        "us_rows": int(len(us)),
        "non_us_rows": int(input_rows - len(us)),
        "unique_people": int(len(clean)),
        "duplicate_groups": int((groups.map(len) > 1).sum()),
        "duplicate_extra_rows": int(len(us) - len(clean)),
        "missing_data_counts": {flag: int(clean[flag].sum()) for flag, _ in MISSING_FLAGS},
        "invalid_linkedin_urls": int(clean["invalid_linkedin_url"].sum()),
        "enrichment_status_counts": clean["enrichment_status"].value_counts().to_dict(),
        "enriched_title_differs": int(clean["enriched_title_differs"].sum()),
        "enriched_org_differs": int(clean["enriched_org_differs"].sum()),
        "top_100_current_companies": [
            {"company": c, "count": int(n)} for c, n in top_companies.items()
        ],
    }
    lib.write_json(outputs_dir / "01_cleaning_summary.json", summary)
    return clean


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None, help="raw Clay CSV (default: newest in data/raw)")
    args = parser.parse_args()
    clean = run(input_path=args.input)
    print(f"01_clean_people: {len(clean)} unique people written to data/processed/01_people_clean.csv")


if __name__ == "__main__":
    main()
