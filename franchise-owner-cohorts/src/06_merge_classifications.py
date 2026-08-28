"""Validate + merge AI career classifications back onto parsed records.

Works for the 250-record pilot and for full-run batches alike. Every response is
validated against a Pydantic schema and the allowed-archetype list from
config/career_archetypes.csv; invalid responses route to needs_review — never
silently coerced. Also emits the human audit pack with scorecard columns.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from pydantic import BaseModel, ValidationError, field_validator

import pipeline_lib as lib

SENIORITY_VALUES = {"individual contributor", "manager", "director", "VP", "C-suite", "prior owner", "unknown"}
CONFIDENCE_VALUES = {"high", "medium", "low"}
RANDOM_SEED = 42
AUDIT_MIX = {"high": 10, "medium": 25, "low": 15}

SCORECARD_COLUMNS = [
    "audit_correct_owner_identity", "audit_correct_prior_role", "audit_correct_archetype",
    "audit_correct_seniority", "audit_evidence_adequate", "audit_would_use_in_seed",
    "audit_notes",
]


def allowed_archetypes(config_dir: Path) -> set[str]:
    with open(config_dir / "career_archetypes.csv", newline="", encoding="utf-8") as f:
        return {row["archetype"].strip() for row in csv.DictReader(f)}


class CareerClassification(BaseModel):
    primary_prior_career_archetype: str
    secondary_traits: list[str]
    prior_industry: str
    prior_seniority: str
    sales_background: bool
    operations_background: bool
    p_and_l_or_multi_site_background: bool
    technical_or_trade_background: bool
    entrepreneurship_before_franchise: bool
    career_confidence: str
    career_arc_summary: str
    evidence: str
    needs_manual_review: bool

    @field_validator("prior_seniority")
    @classmethod
    def seniority_allowed(cls, v: str) -> str:
        if v not in SENIORITY_VALUES:
            raise ValueError(f"prior_seniority '{v}' not in {sorted(SENIORITY_VALUES)}")
        return v

    @field_validator("career_confidence")
    @classmethod
    def confidence_allowed(cls, v: str) -> str:
        if v not in CONFIDENCE_VALUES:
            raise ValueError(f"career_confidence '{v}' not allowed")
        return v


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def run(
    prompts_path: Path,
    responses_path: Path,
    parsed_path: Path | None = None,
    out_prefix: Path | None = None,
    config_dir: Path | None = None,
) -> pd.DataFrame:
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    parsed_path = Path(parsed_path) if parsed_path else lib.DATA_PROCESSED / "04_work_history_parsed.csv"
    out_prefix = Path(out_prefix) if out_prefix else prompts_path.with_name(prompts_path.stem.replace("_prompts", ""))
    archetypes = allowed_archetypes(config_dir)

    prompts = {p["record_id"]: p for p in load_jsonl(prompts_path)}
    responses = load_jsonl(responses_path)

    valid_rows: dict[str, dict] = {}
    invalid: list[dict] = []
    for resp in responses:
        record_id = resp.get("record_id", "")
        problems = []
        if record_id not in prompts:
            problems.append("record_id not in prompt file")
        payload = resp.get("response")
        model_used = resp.get("model", "")
        classified_at = resp.get("classified_at", "")
        parsed_obj = None
        if not isinstance(payload, dict):
            problems.append("response is not a JSON object")
        else:
            try:
                parsed_obj = CareerClassification.model_validate(payload)
            except ValidationError as e:
                problems.append(f"schema: {e.errors()[0]['msg']}")
        if parsed_obj and parsed_obj.primary_prior_career_archetype not in archetypes:
            problems.append(
                f"archetype '{parsed_obj.primary_prior_career_archetype}' not in career_archetypes.csv"
            )
        if record_id in prompts and resp.get("work_history_hash") != prompts[record_id].get("work_history_hash"):
            problems.append("work_history_hash mismatch (stale classification)")
        if problems:
            invalid.append({"record_id": record_id, "problems": problems, "raw": resp})
            continue
        valid_rows[record_id] = {
            "record_id": record_id,
            "ai_primary_archetype": parsed_obj.primary_prior_career_archetype,
            "ai_secondary_traits": ";".join(parsed_obj.secondary_traits),
            "ai_prior_industry": parsed_obj.prior_industry,
            "ai_prior_seniority": parsed_obj.prior_seniority,
            "ai_sales_background": parsed_obj.sales_background,
            "ai_operations_background": parsed_obj.operations_background,
            "ai_p_and_l_or_multi_site": parsed_obj.p_and_l_or_multi_site_background,
            "ai_technical_or_trade": parsed_obj.technical_or_trade_background,
            "ai_prior_entrepreneurship": parsed_obj.entrepreneurship_before_franchise,
            "ai_career_confidence": parsed_obj.career_confidence,
            "ai_career_arc_summary": parsed_obj.career_arc_summary,
            "ai_evidence": parsed_obj.evidence,
            "ai_needs_manual_review": parsed_obj.needs_manual_review,
            "ai_model": model_used,
            "ai_classified_at": classified_at,
        }

    missing = [rid for rid in prompts if rid not in valid_rows]

    parsed = pd.read_csv(parsed_path, dtype=str, keep_default_na=False, encoding="utf-8")
    subset = parsed[parsed["record_id"].isin(prompts.keys())].copy()
    ai_df = pd.DataFrame(list(valid_rows.values()))
    merged = subset.merge(ai_df, on="record_id", how="left")
    merged["ai_status"] = merged["record_id"].map(
        lambda r: "classified" if r in valid_rows else "needs_review_invalid_or_missing"
    )
    merged.to_csv(f"{out_prefix}_classified.csv", index=False)

    if invalid:
        with open(f"{out_prefix}_invalid.jsonl", "w", encoding="utf-8") as f:
            for row in invalid:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    dist = (
        merged[merged["ai_status"] == "classified"]
        .groupby(["ai_primary_archetype", "ai_career_confidence"])
        .size()
        .reset_index(name="people")
        .sort_values("people", ascending=False)
    )
    dist.to_csv(f"{out_prefix}_archetype_distribution.csv", index=False)

    audit = build_audit_pack(merged)
    audit.to_csv(f"{out_prefix}_audit_pack.csv", index=False)

    print(
        f"06_merge_classifications: {len(valid_rows)} valid, {len(invalid)} invalid, "
        f"{len(missing)} missing -> {out_prefix}_classified.csv"
    )
    return merged


def build_audit_pack(merged: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "record_id", "Full Name", "LinkedIn Profile", "Job Title", "Company",
        "canonical_brand", "brand_segment", "current_ownership_status",
        "ownership_confidence", "deterministic_reason", "first_franchise_ownership_start",
        "last_credible_prior_title", "last_credible_prior_employer",
        "last_credible_prior_start", "last_credible_prior_end",
        "prior_role_selection_reason", "timeline_conflict", "career_date_confidence",
        "Full Work History",
        "ai_primary_archetype", "ai_prior_seniority", "ai_career_confidence",
        "ai_career_arc_summary", "ai_evidence", "ai_needs_manual_review", "ai_status",
    ]
    audit = merged[[c for c in cols if c in merged.columns]].copy()

    flagged = audit["ai_needs_manual_review"].astype(str).str.lower() == "true"
    subset_ids: set = set(audit[flagged]["record_id"])
    for conf, n in AUDIT_MIX.items():
        pool = audit[(audit["ai_career_confidence"] == conf) & ~audit["record_id"].isin(subset_ids)]
        take = pool.sample(n=min(n, len(pool)), random_state=RANDOM_SEED)
        subset_ids.update(take["record_id"])
    audit["suggested_audit_subset"] = audit["record_id"].isin(subset_ids)

    for col in SCORECARD_COLUMNS:
        audit[col] = ""
    return audit.sort_values(["suggested_audit_subset", "ai_career_confidence", "record_id"], ascending=[False, True, True])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompts", type=Path, required=True)
    parser.add_argument("--responses", type=Path, required=True)
    parser.add_argument("--parsed", type=Path, default=None)
    parser.add_argument("--out-prefix", type=Path, default=None)
    args = parser.parse_args()
    run(args.prompts, args.responses, parsed_path=args.parsed, out_prefix=args.out_prefix)


if __name__ == "__main__":
    main()
