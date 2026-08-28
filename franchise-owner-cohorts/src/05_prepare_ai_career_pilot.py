"""Step 8 prep — build the stratified 250-record AI career-classification pilot.

Deterministic selection only (no LLM here). Emits the pilot CSV plus a JSONL prompt
file containing only the necessary non-sensitive fields (no names, no URLs, no
locations) for the in-session classifier.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

import pipeline_lib as lib

PILOT_SIZE = 250
RANDOM_SEED = 42
ELIGIBLE_STATUSES = {"approved_candidate", "caution_candidate"}


def start_year_bucket(value: str) -> str:
    m = re.search(r"(\d{4})", value or "")
    if not m:
        return "unknown"
    year = int(m.group(1))
    if year < 2010:
        return "pre_2010"
    if year < 2020:
        return "2010s"
    return "2020s"


def build_strata(df: pd.DataFrame) -> pd.Series:
    segment = df["brand_segment"].replace("", "none")
    bucket = df["first_franchise_ownership_start"].map(start_year_bucket)
    prior = (df["last_credible_prior_title"] != "").map({True: "prior", False: "no_prior"})
    return segment + "|" + df["ownership_confidence"] + "|" + bucket + "|" + prior


def allocate(counts: pd.Series, total: int) -> dict[str, int]:
    """Largest-remainder proportional allocation, capped by stratum size."""
    population = counts.sum()
    raw = counts * total / population
    alloc = raw.astype(int)
    remainders = (raw - alloc).sort_values(ascending=False)
    shortfall = total - alloc.sum()
    for stratum in remainders.index:
        if shortfall <= 0:
            break
        if alloc[stratum] < counts[stratum]:
            alloc[stratum] += 1
            shortfall -= 1
    # cap at stratum size and redistribute any leftover to the largest strata
    alloc = alloc.clip(upper=counts)
    leftover = total - alloc.sum()
    for stratum in counts.sort_values(ascending=False).index:
        if leftover <= 0:
            break
        take = min(leftover, counts[stratum] - alloc[stratum])
        alloc[stratum] += take
        leftover -= take
    return alloc.to_dict()


def prompt_fields(row: dict) -> dict:
    return {
        "canonical_brand": row["canonical_brand"],
        "brand_segment": row["brand_segment"],
        "current_title": row["Job Title"],
        "current_company": row["Company"],
        "local_dba_or_operating_entity": row["local_dba_or_operating_entity"],
        "current_ownership_status": row["current_ownership_status"],
        "ownership_confidence": row["ownership_confidence"],
        "first_franchise_ownership_start": row["first_franchise_ownership_start"],
        "first_franchise_role_title": row["first_franchise_role_title"],
        "last_credible_prior_role": {
            "title": row["last_credible_prior_title"],
            "employer": row["last_credible_prior_employer"],
            "start": row["last_credible_prior_start"],
            "end": row["last_credible_prior_end"],
            "selection_reason": row["prior_role_selection_reason"],
        },
        "timeline_conflict": row["timeline_conflict"],
        "career_date_confidence": row["career_date_confidence"],
        "employment_history": json.loads(row["prior_history_json"]),
    }


def run(
    input_path: Path | None = None,
    staging_dir: Path | None = None,
    pilot_size: int = PILOT_SIZE,
) -> pd.DataFrame:
    staging_dir = Path(staging_dir) if staging_dir else lib.DATA_STAGING
    input_path = Path(input_path) if input_path else lib.DATA_PROCESSED / "04_work_history_parsed.csv"
    staging_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8")
    eligible = df[
        df["current_ownership_status"].isin(ELIGIBLE_STATUSES)
        & (df["work_history_entry_count"].astype(int) > 0)
    ].copy()

    strata = build_strata(eligible)
    counts = strata.value_counts()
    alloc = allocate(counts, min(pilot_size, len(eligible)))

    picked_idx: list = []
    for stratum, n in alloc.items():
        if n <= 0:
            continue
        members = eligible[strata == stratum]
        picked_idx.extend(members.sample(n=n, random_state=RANDOM_SEED).index.tolist())
    pilot = eligible.loc[picked_idx].sort_values("record_id")

    pilot.to_csv(staging_dir / "career_classification_pilot_250.csv", index=False)

    strata_summary = (
        pd.DataFrame({"stratum": counts.index, "eligible": counts.values})
        .assign(sampled=lambda t: t["stratum"].map(alloc).fillna(0).astype(int))
        .sort_values("eligible", ascending=False)
    )
    strata_summary.to_csv(staging_dir / "career_classification_pilot_250_strata.csv", index=False)

    with open(staging_dir / "career_classification_pilot_250_prompts.jsonl", "w", encoding="utf-8") as f:
        for row in pilot.to_dict("records"):
            f.write(
                json.dumps(
                    {
                        "record_id": row["record_id"],
                        "work_history_hash": row["work_history_hash"],
                        "fields": prompt_fields(row),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    return pilot


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None)
    parser.add_argument("--size", type=int, default=PILOT_SIZE)
    args = parser.parse_args()
    pilot = run(input_path=args.input, pilot_size=args.size)
    print(f"05_prepare_ai_career_pilot: {len(pilot)} records staged")
    print(pilot["brand_segment"].value_counts().to_string())


if __name__ == "__main__":
    main()
