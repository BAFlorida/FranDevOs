"""Step 4 — deterministic brand/DBA normalization. No LLM/API calls.

Maps each person's company string to a canonical brand via the editable alias
dictionary, applying company exclusions first, detecting local DBA/operating entities,
and routing ambiguous matches to manual review.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

import pipeline_lib as lib


def classify_company(company: str, brands, exclusions) -> dict:
    exclusion = lib.match_exclusion(company, exclusions)
    corporate_signal = lib.has_corporate_marker(company)

    result = {
        "canonical_brand": "",
        "matched_alias": "",
        "match_method": "none",
        "brand_match_confidence": "none",
        "brand_segment": "",
        "brand_parent_platform": "",
        "strict_150k_status": "",
        "local_dba_or_operating_entity": False,
        "company_exclusion_hit": exclusion.pattern if exclusion else "",
        "company_exclusion_reason": exclusion.reason if exclusion else "",
        "corporate_entity_signal": corporate_signal,
        "needs_manual_brand_review": False,
        "brand_review_reason": "",
    }

    if exclusion and exclusion.is_unrelated:
        return result  # unrelated same-name entity: no brand claim at all

    match = lib.match_brand(company, brands)
    result.update(
        {
            "canonical_brand": match.canonical_brand,
            "matched_alias": match.matched_alias,
            "match_method": match.match_method,
            "brand_match_confidence": match.confidence,
            "brand_segment": match.segment,
            "brand_parent_platform": match.parent_platform,
            "strict_150k_status": match.strict_150k_status,
            "local_dba_or_operating_entity": match.local_dba,
            "needs_manual_brand_review": match.needs_review,
            "brand_review_reason": match.review_reason,
        }
    )
    if exclusion and match.canonical_brand:
        # franchisor/corporate entity that still names a brand (e.g. Servpro Industries)
        result["brand_match_confidence"] = "low"
    return result


def run(
    input_path: Path | None = None,
    processed_dir: Path | None = None,
    outputs_dir: Path | None = None,
    config_dir: Path | None = None,
) -> pd.DataFrame:
    processed_dir = Path(processed_dir) if processed_dir else lib.DATA_PROCESSED
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    input_path = Path(input_path) if input_path else processed_dir / "01_people_clean.csv"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8")
    brands = lib.load_brands(config_dir / "approved_brands.csv")
    exclusions = lib.load_exclusions(config_dir / "company_exclusions.csv")

    cache: dict[str, dict] = {}
    results = []
    for company in df["Company"]:
        if company not in cache:
            cache[company] = classify_company(company, brands, exclusions)
        results.append(cache[company])
    out = pd.concat([df.reset_index(drop=True), pd.DataFrame(results)], axis=1)
    out.to_csv(processed_dir / "02_people_brand_normalized.csv", index=False)

    matched = out[out["canonical_brand"] != ""]
    summary = (
        matched.groupby(["canonical_brand", "brand_segment"], sort=True)
        .agg(
            people=("record_id", "count"),
            exact=("match_method", lambda s: int((s == "exact").sum())),
            prefix=("match_method", lambda s: int((s == "prefix").sum())),
            contains=("match_method", lambda s: int((s == "contains").sum())),
            high_confidence=("brand_match_confidence", lambda s: int((s == "high").sum())),
            needs_review=("needs_manual_brand_review", lambda s: int(pd.Series(s).astype(str).eq("True").sum())),
            local_dba=("local_dba_or_operating_entity", lambda s: int(pd.Series(s).astype(str).eq("True").sum())),
        )
        .reset_index()
        .sort_values("people", ascending=False)
    )
    summary.to_csv(outputs_dir / "02_brand_match_summary.csv", index=False)

    unmatched = out[(out["canonical_brand"] == "") & (out["company_exclusion_hit"] == "")]
    unmatched_counts = (
        unmatched.groupby("Company").size().reset_index(name="count").sort_values("count", ascending=False)
    )
    unmatched_counts.to_csv(outputs_dir / "02_unmatched_company_strings.csv", index=False)

    ambiguous = out[out["needs_manual_brand_review"].astype(str) == "True"][
        [
            "record_id", "Full Name", "Job Title", "Company", "canonical_brand",
            "matched_alias", "match_method", "brand_match_confidence", "brand_review_reason",
        ]
    ]
    ambiguous.to_csv(outputs_dir / "02_ambiguous_company_matches.csv", index=False)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None)
    args = parser.parse_args()
    out = run(input_path=args.input)
    matched = (out["canonical_brand"] != "").sum()
    print(
        f"02_normalize_brand_affiliation: {matched}/{len(out)} matched to a canonical brand; "
        f"{(out['needs_manual_brand_review'].astype(str) == 'True').sum()} flagged for manual brand review"
    )


if __name__ == "__main__":
    main()
