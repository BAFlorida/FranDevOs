"""Step 5 — deterministic current-ownership classification. No LLM/API calls.

Combines the brand normalization with title rules to produce
current_ownership_status (approved_candidate / caution_candidate / excluded /
needs_review) with a reason, a confidence, and a run timestamp, plus a stratified
QA sample.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

import pipeline_lib as lib

QA_SAMPLE_TARGET = 200
QA_CAP_PER_STRATUM = 5
RANDOM_SEED = 42

REVIEW_COLUMNS = [
    "record_id", "Full Name", "Job Title", "Company", "canonical_brand",
    "brand_match_confidence", "company_exclusion_reason", "corporate_entity_signal",
    "current_ownership_status", "ownership_confidence", "deterministic_reason",
]


def load_title_rules(path: Path):
    rules = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rules.append(
                {
                    "rule_type": row["rule_type"].strip(),
                    "pattern": row["pattern"].strip(),
                    "category": row["category"].strip(),
                    "priority": int(row["priority"]),
                    "pattern_tokens": lib.tokens(row["pattern"]),
                }
            )
    return rules


def classify_title(job_title: str, rules) -> tuple[str, list[str], bool]:
    """Returns (classification, rule_hits, multi_unit_signal). Token-subsequence
    matching so 'President/CEO' still hits 'president' and 'ceo'."""
    title_tokens = lib.tokens(job_title)
    hits = [
        r
        for r in rules
        if r["pattern_tokens"] and lib.find_token_subsequence(r["pattern_tokens"], title_tokens) >= 0
    ]
    hits.sort(key=lambda r: -r["priority"])
    hit_names = [f"{r['rule_type']}:{r['pattern']}" for r in hits]
    multi_unit = any(r["rule_type"] == "include" and r["category"] == "multi_unit" for r in hits)
    if any(r["rule_type"] == "hard_exclude" for r in hits):
        return "hard_exclude", hit_names, multi_unit
    if any(r["rule_type"] == "include" for r in hits):
        return "include", hit_names, multi_unit
    if any(r["rule_type"] == "caution" for r in hits):
        return "caution", hit_names, multi_unit
    return "none", hit_names, multi_unit


def decide_status(row: dict, title_class: str) -> tuple[str, str, str]:
    """Returns (status, confidence, reason). Priority order documented in
    config/output_schema.md."""
    brand = row["canonical_brand"]
    brand_conf = row["brand_match_confidence"]
    exclusion_reason = row["company_exclusion_reason"]
    unrelated = exclusion_reason.lower().startswith("unrelated") if exclusion_reason else False
    franchisor = bool(exclusion_reason) and not unrelated
    corporate = franchisor or row["corporate_entity_signal"]
    brand_note = f"brand={brand or 'NONE'} ({brand_conf})"

    if title_class == "hard_exclude":
        return "excluded", "high", f"{brand_note}; hard-exclude title"
    if unrelated:
        return "excluded", "high", f"company exclusion: {exclusion_reason}"
    if corporate:
        source = exclusion_reason or "corporate-entity naming"
        if title_class == "include":
            return (
                "needs_review",
                "low",
                f"{brand_note}; ownership title at franchisor/corporate entity ({source})",
            )
        return "excluded", "medium", f"franchisor/corporate entity ({source}); no ownership title"
    if row["needs_manual_brand_review"]:
        return "needs_review", "low", f"{brand_note}; ambiguous brand match: {row['brand_review_reason']}"
    if brand:
        if title_class == "include":
            conf = "high" if brand_conf == "high" and not row["enriched_org_differs"] else "medium"
            drift = "; enriched org differs" if row["enriched_org_differs"] else ""
            return "approved_candidate", conf, f"{brand_note}; ownership title{drift}"
        if title_class == "caution":
            conf = "medium" if brand_conf == "high" else "low"
            return "caution_candidate", conf, f"{brand_note}; caution title (leadership, not ownership)"
        return "needs_review", "low", f"{brand_note}; title not classifiable"
    if title_class == "include":
        return "needs_review", "medium", "ownership title but no approved-brand match (possible missing alias)"
    return "excluded", "medium", "no approved-brand match and no ownership title"


def run(
    input_path: Path | None = None,
    processed_dir: Path | None = None,
    outputs_dir: Path | None = None,
    config_dir: Path | None = None,
) -> pd.DataFrame:
    processed_dir = Path(processed_dir) if processed_dir else lib.DATA_PROCESSED
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    input_path = Path(input_path) if input_path else processed_dir / "02_people_brand_normalized.csv"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8")
    for flag in ["corporate_entity_signal", "needs_manual_brand_review", "enriched_org_differs"]:
        df[flag] = df.get(flag, "False").astype(str) == "True" if flag in df.columns else False

    rules = load_title_rules(config_dir / "title_rules.csv")
    run_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    records = []
    for row in df.to_dict("records"):
        title_class, hits, multi_unit = classify_title(row["Job Title"], rules)
        status, confidence, reason = decide_status(row, title_class)
        records.append(
            {
                "title_classification": title_class,
                "title_rule_hit": ";".join(hits),
                "multi_unit_signal": multi_unit,
                "current_ownership_status": status,
                "ownership_confidence": confidence,
                "deterministic_reason": reason,
                "classified_at": run_at,
            }
        )
    out = pd.concat([df.reset_index(drop=True), pd.DataFrame(records)], axis=1)
    out.to_csv(processed_dir / "03_current_ownership_candidates.csv", index=False)

    summary = (
        out.groupby(["current_ownership_status", "ownership_confidence"])
        .size()
        .reset_index(name="people")
        .sort_values(["current_ownership_status", "ownership_confidence"])
    )
    summary.to_csv(outputs_dir / "03_ownership_status_summary.csv", index=False)

    out[out["current_ownership_status"] == "needs_review"][REVIEW_COLUMNS].to_csv(
        outputs_dir / "03_needs_manual_ownership_review.csv", index=False
    )
    out[out["current_ownership_status"] == "excluded"][REVIEW_COLUMNS].to_csv(
        outputs_dir / "03_excluded_records.csv", index=False
    )

    qa = stratified_qa_sample(out)
    qa.to_csv(outputs_dir / "03_qa_sample_200.csv", index=False)
    return out


def stratified_qa_sample(out: pd.DataFrame) -> pd.DataFrame:
    top_brands = set(out[out["canonical_brand"] != ""]["canonical_brand"].value_counts().head(20).index)
    bucket = out["canonical_brand"].map(lambda b: b if b in top_brands else ("OTHER" if b else "NONE"))
    stratum = (
        out["current_ownership_status"] + "|" + out["title_classification"] + "|" + bucket
    )
    picked: list = []
    for _, group in out.groupby(stratum):
        picked.extend(
            group.sample(n=min(len(group), QA_CAP_PER_STRATUM), random_state=RANDOM_SEED).index.tolist()
        )
    sampled = out.loc[picked]
    if len(sampled) > QA_SAMPLE_TARGET:
        sampled = sampled.sample(n=QA_SAMPLE_TARGET, random_state=RANDOM_SEED)
    return sampled.sort_values("record_id")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None)
    args = parser.parse_args()
    out = run(input_path=args.input)
    counts = out["current_ownership_status"].value_counts().to_dict()
    print(f"03_classify_current_ownership: {counts}")


if __name__ == "__main__":
    main()
