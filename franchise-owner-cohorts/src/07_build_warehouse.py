"""Analysis warehouse builder — roles / persons / cohorts.

Reads data/processed/04_work_history_parsed.csv and emits:
    data/warehouse/roles.parquet      one row per person per job
    data/warehouse/persons.parquet    one row per usable person, career_path derived
    data/warehouse/frandev.duckdb     both tables + every view in sql/cohorts/
                                      + materialized `cohorts` membership
    outputs/07_warehouse_manifest.json

Deterministic and idempotent: same inputs + same config/vocab.yaml => same bytes.
ALL ownership/corporate/cohort vocabulary lives in config/vocab.yaml — never here.
No LLM/API calls.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import duckdb
import pandas as pd
import yaml

import pipeline_lib as lib

WAREHOUSE_DIR = lib.PROJECT_ROOT / "data" / "warehouse"
SQL_COHORTS_DIR = lib.PROJECT_ROOT / "sql" / "cohorts"

USABLE_STATUSES = {"approved_candidate", "caution_candidate"}


# ---------------------------------------------------------------- vocabulary

class Vocab:
    def __init__(self, raw: dict):
        self.raw = raw
        self.ownership = self._compile(raw["ownership"]["patterns"])
        self.ownership_exclude = self._compile(raw["ownership"].get("exclude", []))
        self.corporate = self._compile(raw["corporate"]["patterns"])
        self.flag_sets = {
            "is_clinical_title": ("title", self._compile(raw["clinical_titles"])),
            "is_education_title": ("title", self._compile(raw["education_titles"])),
            "at_education_employer": ("company", self._compile(raw["education_employers"])),
            "is_military_org": ("company", self._compile(raw["military_companies"])),
            "is_sales_bd_leader": ("title", self._compile(raw["sales_bd_leader_titles"])),
            "is_ops_leader": ("title", self._compile(raw["ops_leader_titles"])),
            "is_multisite_mgr": ("title", self._compile(raw["multisite_titles"])),
            "at_restructuring_employer": ("company", self._compile(raw["restructuring_employers"])),
        }
        self.middle_mgmt = self._compile(raw["middle_mgmt_titles"])
        self.senior = self._compile(raw["senior_titles"])
        self.functions = {name: self._compile(pats) for name, pats in raw["functions"].items()}
        self.constants = {
            "recent_start_ym_min": int(raw["recent_start_ym_min"]),
            "tenure_min_months": int(raw["tenure_min_months"]),
            "still_employed_grace_months": int(raw["still_employed_grace_months"]),
        }

    @staticmethod
    def _compile(patterns: list[str]) -> re.Pattern:
        if not patterns:
            return re.compile(r"(?!x)x")  # matches nothing
        return re.compile("|".join(f"(?:{p})" for p in patterns))

    def is_ownership(self, title_norm: str) -> bool:
        return bool(self.ownership.search(title_norm)) and not self.ownership_exclude.search(title_norm)

    def is_corporate(self, title_norm: str, ownership: bool) -> bool:
        return (not ownership) and bool(self.corporate.search(title_norm))

    def is_middle_mgmt(self, title_norm: str) -> bool:
        return bool(self.middle_mgmt.search(title_norm)) and not self.senior.search(title_norm)


def load_vocab(config_dir: Path) -> Vocab:
    with open(config_dir / "vocab.yaml", encoding="utf-8") as f:
        return Vocab(yaml.safe_load(f))


# ------------------------------------------------------------------- parsing

def parse_ym(value: str) -> int | None:
    """'MM/YYYY' | 'YYYY' -> months since year 0. 'Present'/'unknown'/'' -> None.
    Year-only dates anchor to June (month index 5) — documented convention."""
    value = (value or "").strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{4})", value)
    if m:
        month = int(m.group(1))
        if 1 <= month <= 12:
            return int(m.group(2)) * 12 + (month - 1)
        return None
    m = re.fullmatch(r"\d{4}", value)
    if m:
        return int(value) * 12 + 5
    return None


def build_roles_for_person(record: dict, vocab: Vocab) -> list[dict]:
    entries = json.loads(record["prior_history_json"] or "[]")
    rows = []
    for idx, e in enumerate(entries):
        title = e.get("title", "")
        company = e.get("company", "")
        title_norm = " ".join(lib.tokens(title))
        company_norm = " ".join(lib.tokens(company))
        start_ym = parse_ym(e.get("start", ""))
        end_raw = (e.get("end", "") or "").strip()
        end_is_present = end_raw == "Present"
        end_ym = None if end_is_present else parse_ym(end_raw)
        end_before_start = False
        if start_ym is not None and end_ym is not None and end_ym < start_ym:
            # raw data contradiction; derived end is withdrawn, raw stays upstream
            end_before_start = True
            end_ym = None
        ownership = vocab.is_ownership(title_norm)
        row = {
            "record_id": record["record_id"],
            "orig_idx": idx,
            "title": title,
            "company": company,
            "title_norm": title_norm,
            "company_norm": company_norm,
            "start_ym": start_ym,
            "end_ym": end_ym,
            "end_is_present": end_is_present,
            "end_before_start": end_before_start,
            "duration_mo": (end_ym - start_ym) if (start_ym is not None and end_ym is not None) else None,
            "is_franchise_role": bool(e.get("is_franchise_role")),
            "is_ownership": ownership,
            "is_corporate": vocab.is_corporate(title_norm, ownership),
            "is_middle_mgmt": vocab.is_middle_mgmt(title_norm),
        }
        for flag, (field, rx) in vocab.flag_sets.items():
            row[flag] = bool(rx.search(title_norm if field == "title" else company_norm))
        row["fn_list"] = [name for name, rx in vocab.functions.items() if rx.search(title_norm)]
        row["functions"] = ",".join(row["fn_list"])
        rows.append(row)
    # chronological seq: dated roles by start (ties by original order), undated last
    rows.sort(key=lambda r: (r["start_ym"] is None, r["start_ym"] if r["start_ym"] is not None else 0, r["orig_idx"]))
    for seq, row in enumerate(rows):
        row["seq"] = seq
    return rows


# ------------------------------------------------------------------- persons

def derive_person(record: dict, roles: list[dict]) -> tuple[list[dict] | None, dict | None]:
    """-> (pre_franchise_roles, person_row); (None, None) when not usable."""
    dated_fr = [r for r in roles if r["is_franchise_role"] and r["start_ym"] is not None]
    fr_start = min((r["start_ym"] for r in dated_fr), default=None)
    if record["current_ownership_status"] not in USABLE_STATUSES or fr_start is None:
        return None, None
    pre = [r for r in roles if not r["is_franchise_role"] and r["start_ym"] is not None and r["start_ym"] < fr_start]
    if not pre:
        return None, None  # usable requires at least one dated pre-franchise role

    own_pre = [r for r in pre if r["is_ownership"]]
    if not own_pre:
        path, last_own, corp_after = "no_prior_ownership", None, []
    else:
        last_own = max(own_pre, key=lambda r: (r["start_ym"], r["orig_idx"]))
        corp_after = sorted(
            (r for r in pre if r["is_corporate"] and r["start_ym"] > last_own["start_ym"]),
            key=lambda r: (r["start_ym"], r["orig_idx"]),
        )
        path = "owner_then_corporate" if corp_after else "owner_straight_to_franchise"

    own_end = last_own["end_ym"] if last_own else None
    first_return = corp_after[0] if corp_after else None
    return pre, {
        "record_id": record["record_id"],
        "full_name": record["Full Name"],
        "linkedin": record["LinkedIn Profile"],
        "job_title": record["Job Title"],
        "company": record["Company"],
        "canonical_brand": record["canonical_brand"],
        "brand_segment": record["brand_segment"],
        "ownership_confidence": record["ownership_confidence"],
        "fr_start_ym": fr_start,
        "n_roles": len(roles),
        "n_pre_roles": len(pre),
        "career_path": path,
        "n_corp_after": len(corp_after),
        "yrs_between": round((fr_start - own_end) / 12, 2) if (last_own and own_end is not None) else None,
        "last_own_title": last_own["title"] if last_own else "",
        "last_own_company": last_own["company"] if last_own else "",
        "return_title": first_return["title"] if first_return else "",
        "return_company": first_return["company"] if first_return else "",
    }


def build_backgrounds(record_id: str, pre_roles: list[dict], fr_start: int, fn_names) -> tuple[list[dict], int]:
    """Person x function pre-franchise exposure. Months attribution per role:
    explicit end -> min(end, franchise start) - start; stale/true Present ->
    franchise start - start (time in role before buying); no usable end -> the
    role still counts (n_roles_pre) but contributes 0 months. Overlapping roles
    double-count months by design — share_pre is exposure share, not a clock."""
    per = {f: {"n": 0, "mo": 0} for f in fn_names}
    total = 0
    for r in pre_roles:
        end_eff = r["end_ym"] if r["end_ym"] is not None else (fr_start if r["end_is_present"] else None)
        months = max(0, min(end_eff, fr_start) - r["start_ym"]) if end_eff is not None else 0
        total += months
        for f in r["fn_list"]:
            per[f]["n"] += 1
            per[f]["mo"] += months
    rows = []
    for f, d in per.items():
        if d["n"] == 0:
            continue
        share = round(d["mo"] / total, 3) if total else None
        if d["mo"] >= 84 or (share is not None and share >= 0.5 and d["mo"] >= 36):
            tier = 3  # career
        elif d["mo"] >= 36:
            tier = 2  # experienced
        else:
            tier = 1  # touched
        rows.append({"record_id": record_id, "function": f, "n_roles_pre": d["n"],
                     "months_pre": d["mo"], "share_pre": share, "tier": tier})
    return rows, total


# --------------------------------------------------------------------- build

def run(input_path: Path | None = None, config_dir: Path | None = None,
        warehouse_dir: Path | None = None, outputs_dir: Path | None = None,
        sql_dir: Path | None = None) -> dict:
    t0 = time.time()
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    warehouse_dir = Path(warehouse_dir) if warehouse_dir else WAREHOUSE_DIR
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    sql_dir = Path(sql_dir) if sql_dir else SQL_COHORTS_DIR
    input_path = Path(input_path) if input_path else lib.DATA_PROCESSED / "04_work_history_parsed.csv"
    warehouse_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    vocab = load_vocab(config_dir)
    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8")

    all_roles: list[dict] = []
    persons: list[dict] = []
    background_rows: list[dict] = []
    role_fn_rows: list[dict] = []
    for record in df.to_dict("records"):
        roles = build_roles_for_person(record, vocab)
        if not roles:
            continue
        all_roles.extend(roles)
        for r in roles:
            for fn in r["fn_list"]:
                role_fn_rows.append({"record_id": r["record_id"], "seq": r["seq"], "function": fn})
        pre, person = derive_person(record, roles)
        if person:
            bg, total = build_backgrounds(person["record_id"], pre, person["fr_start_ym"], vocab.functions)
            person["pre_months_total"] = total
            background_rows.extend(bg)
            persons.append(person)

    roles_df = pd.DataFrame(all_roles).drop(columns=["fn_list"])
    persons_df = pd.DataFrame(persons)
    int_cols = ["start_ym", "end_ym", "duration_mo"]
    for c in int_cols:
        roles_df[c] = roles_df[c].astype("Int64")
    persons_df["yrs_between"] = persons_df["yrs_between"].astype("Float64")
    for c in ["fr_start_ym", "n_roles", "n_pre_roles", "n_corp_after", "pre_months_total"]:
        persons_df[c] = persons_df[c].astype("Int64")
    backgrounds_df = pd.DataFrame(background_rows)
    backgrounds_df["share_pre"] = backgrounds_df["share_pre"].astype("Float64")
    role_fn_df = pd.DataFrame(role_fn_rows)

    roles_df = roles_df.sort_values(["record_id", "seq"]).reset_index(drop=True)
    persons_df = persons_df.sort_values("record_id").reset_index(drop=True)
    backgrounds_df = backgrounds_df.sort_values(["record_id", "function"]).reset_index(drop=True)
    role_fn_df = role_fn_df.sort_values(["record_id", "seq", "function"]).reset_index(drop=True)
    roles_df.to_parquet(warehouse_dir / "roles.parquet", index=False)
    persons_df.to_parquet(warehouse_dir / "persons.parquet", index=False)
    backgrounds_df.to_parquet(warehouse_dir / "backgrounds.parquet", index=False)
    role_fn_df.to_parquet(warehouse_dir / "role_functions.parquet", index=False)

    db_path = warehouse_dir / "frandev.duckdb"
    if db_path.exists():
        db_path.unlink()
    con = duckdb.connect(str(db_path))
    con.execute(f"CREATE TABLE roles AS SELECT * FROM read_parquet('{warehouse_dir / 'roles.parquet'}')")
    con.execute(f"CREATE TABLE persons AS SELECT * FROM read_parquet('{warehouse_dir / 'persons.parquet'}')")
    con.execute(f"CREATE TABLE backgrounds AS SELECT * FROM read_parquet('{warehouse_dir / 'backgrounds.parquet'}')")
    con.execute(f"CREATE TABLE role_functions AS SELECT * FROM read_parquet('{warehouse_dir / 'role_functions.parquet'}')")
    con.execute("CREATE TABLE vocab_constants(key VARCHAR, value BIGINT)")
    for k, v in vocab.constants.items():
        con.execute("INSERT INTO vocab_constants VALUES (?, ?)", [k, v])

    view_names = []
    for sql_file in sorted(sql_dir.glob("*.sql")):
        con.execute(sql_file.read_text(encoding="utf-8"))
        view_names.append(sql_file.stem)
    if view_names:
        union = " UNION ALL ".join(f"SELECT * FROM {v}" for v in view_names)
        con.execute(f"CREATE TABLE cohorts AS {union}")
    cohort_sizes = {
        row[0]: row[1]
        for row in con.execute(
            "SELECT cohort_id, count(*) FROM cohorts GROUP BY cohort_id ORDER BY cohort_id"
        ).fetchall()
    } if view_names else {}
    con.close()

    dated_starts = int(roles_df["start_ym"].notna().sum())
    path_counts = persons_df["career_path"].value_counts().to_dict()
    manifest = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "input_file": input_path.name,
        "input_sha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "vocab_sha256": hashlib.sha256((config_dir / "vocab.yaml").read_bytes()).hexdigest(),
        "build_seconds": round(time.time() - t0, 1),
        "roles": len(roles_df),
        "persons_with_history": int(roles_df["record_id"].nunique()),
        "start_parse_pct": round(100 * dated_starts / len(roles_df), 1),
        "usable_persons": len(persons_df),
        "career_path_counts": {k: int(v) for k, v in path_counts.items()},
        "end_before_start_rows": int(roles_df["end_before_start"].sum()),
        "cohort_sizes": cohort_sizes,
        "background_headlines": {
            fn: {
                "any": int((backgrounds_df["function"] == fn).sum()),
                "experienced_3y": int(((backgrounds_df["function"] == fn) & (backgrounds_df["tier"] >= 2)).sum()),
                "career": int(((backgrounds_df["function"] == fn) & (backgrounds_df["tier"] == 3)).sum()),
            }
            for fn in sorted(vocab.functions)
        },
    }
    lib.write_json(outputs_dir / "07_warehouse_manifest.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None)
    args = parser.parse_args()
    manifest = run(input_path=args.input)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
