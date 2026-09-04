"""Analysis warehouse builder — roles / persons / employers / cohorts.

Reads data/processed/04_work_history_parsed.csv (owners) and, optionally, a
second stage-04 file for the matched comparison sample, and emits:
    data/warehouse/roles.parquet        one row per person per job (the grain)
    data/warehouse/persons.parquet      one row per person, all records kept,
                                        usability flagged, composition baked in
    data/warehouse/employers.parquet    one row per normalized employer string
    data/warehouse/backgrounds.parquet  person x 16-way function exposure
    data/warehouse/role_functions.parquet
    data/warehouse/frandev.duckdb       every table + every view in sql/cohorts/
                                        + materialized `cohorts` membership
    outputs/07_warehouse_manifest.json

Deterministic and idempotent: same inputs + same config/vocab.yaml => same bytes
(durations to "now" use the as_of_ym constant, never the clock).
ALL ownership/corporate/function/sector vocabulary lives in config/vocab.yaml.
No LLM/API calls.

    .venv/bin/python src/07_build_warehouse.py
    .venv/bin/python src/07_build_warehouse.py --comparison data/processed/comparison/04_work_history_parsed.csv
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import time
from collections import Counter
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import duckdb
import pandas as pd
import yaml

import pipeline_lib as lib

WAREHOUSE_DIR = lib.PROJECT_ROOT / "data" / "warehouse"
SQL_COHORTS_DIR = lib.PROJECT_ROOT / "sql" / "cohorts"

USABLE_STATUSES = {"approved_candidate", "caution_candidate"}
FUNCTION_TAG_ORDER = ["sales", "clinical", "finance", "technical", "gm", "ops", "other"]
UNCLASSIFIED = "unclassified"


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
        # 7-way collapse: ordered {tag: [member functions]}; 'other' is the fallthrough
        self.function_tags = {tag: list(raw["function_tags"].get(tag, [])) for tag in FUNCTION_TAG_ORDER}
        members = [fn for tag in FUNCTION_TAG_ORDER for fn in self.function_tags[tag]]
        unknown = set(members) - set(self.functions)
        if unknown:
            raise ValueError(f"function_tags references unknown functions: {sorted(unknown)}")
        self.function_detail_order = members + [fn for fn in self.functions if fn not in members]
        self.sectors = [
            (s["segment"], self._compile(s.get("employer", [])), self._compile(s.get("title", [])))
            for s in raw["sectors"]
        ]
        self.franchisor = self._compile(raw["franchisor_employers"])
        self.constants = {
            "recent_start_ym_min": int(raw["recent_start_ym_min"]),
            "tenure_min_months": int(raw["tenure_min_months"]),
            "still_employed_grace_months": int(raw["still_employed_grace_months"]),
            "as_of_ym": int(raw["as_of_ym"]),
        }
        self.as_of_ym = self.constants["as_of_ym"]

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

    def function_tag(self, fn_list: list[str]) -> tuple[str, str]:
        """-> (7-way tag, 16-way detail) using the vocab precedence order."""
        present = set(fn_list)
        detail = next((fn for fn in self.function_detail_order if fn in present), "")
        for tag in FUNCTION_TAG_ORDER:
            if any(fn in present for fn in self.function_tags[tag]):
                return tag, detail
        return "other", detail

    def sector(self, company_norm: str, title_norm: str) -> tuple[str, str]:
        """-> (segment, source). Employer patterns first across all sectors in
        order, then title patterns; first hit wins; else unclassified."""
        for segment, employer_rx, _ in self.sectors:
            if company_norm and employer_rx.search(company_norm):
                return segment, "employer"
        for segment, _, title_rx in self.sectors:
            if title_norm and title_rx.search(title_norm):
                return segment, "title"
        return UNCLASSIFIED, ""


def load_vocab(config_dir: Path) -> Vocab:
    with open(config_dir / "vocab.yaml", encoding="utf-8") as f:
        return Vocab(yaml.safe_load(f))


# ------------------------------------------------------------------- parsing

def parse_ym(value: str) -> int | None:
    """'MM/YYYY' | 'YYYY' -> months since year 0. 'Present'/'unknown'/'' -> None.
    Year-only dates anchor to June (month index 5) — see parse_ym_precision."""
    return parse_ym_precision(value)[0]


def parse_ym_precision(value: str) -> tuple[int | None, str | None]:
    """-> (ym, 'month' | 'year' | None). A year-only date is imputed to June and
    flagged 'year' so date_imputed can carry the fact downstream."""
    value = (value or "").strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{4})", value)
    if m:
        month = int(m.group(1))
        if 1 <= month <= 12:
            return int(m.group(2)) * 12 + (month - 1), "month"
        return None, None
    m = re.fullmatch(r"\d{4}", value)
    if m:
        return int(value) * 12 + 5, "year"
    return None, None


def ym_to_date(ym: int | None) -> dt.date | None:
    if ym is None:
        return None
    return dt.date(ym // 12, ym % 12 + 1, 1)


def derive_location(city: str, state: str) -> tuple[str, str, str]:
    """-> (city, state, metro). Clay/LinkedIn location strings come as a plain
    city, a county, 'Greater X Area', 'X Metro', 'Metro X', 'X Metroplex' or the
    junk value 'United States'. Nothing is geocoded; suburbs stay separate."""
    c = (city or "").strip()
    s = (state or "").strip()
    if c.lower() in ("", "united states"):
        c = ""
    if s.lower() in ("", "united states"):
        s = ""
    for pattern in (r"^greater (.+?) area$", r"^(.+?) (?:metro|metropolitan area|area|metroplex)$", r"^metro (.+)$"):
        m = re.match(pattern, c, flags=re.IGNORECASE)
        if m:
            c = m.group(1).strip()
            break
    metro = f"{c}, {s}" if (c and s) else (c or s)
    return c, s, metro


class BrandTagger:
    """Per-role employer -> approved franchise brand, memoized by company string.

    lib.match_brand is the single matcher (same semantics as stages 02/04); the
    alias-token prefilter only skips strings that cannot match — every alias
    match method (exact/prefix/contains) needs all of an alias's tokens present."""

    def __init__(self, brands, exclusions, vocab: Vocab):
        self.brands = brands
        self.exclusions = exclusions
        self.vocab = vocab
        self.alias_sets = [frozenset(tok) for b in brands for _, tok in b.alias_tokens]
        self.exclusion_sets = [frozenset(lib.tokens(e.pattern)) for e in exclusions]

    @lru_cache(maxsize=None)
    def tag(self, company: str) -> tuple[str, str, str, str]:
        """-> (canonical_brand, segment, parent_platform, entity_kind) where
        entity_kind is '' | 'franchisor' | 'excluded_entity'."""
        if not company.strip():
            return "", "", "", ""
        ctoks = frozenset(lib.tokens(company))
        kind = ""
        if any(s <= ctoks for s in self.exclusion_sets):
            exc = lib.match_exclusion(company, self.exclusions)
            if exc is not None and not exc.is_unrelated:
                kind = "excluded_entity"
        if self.vocab.franchisor.search(" ".join(lib.tokens(company))):
            kind = "franchisor"
        if any(s <= ctoks for s in self.alias_sets):
            match = lib.match_brand(company, self.brands)
            if match.canonical_brand and not match.needs_review:
                return match.canonical_brand, match.segment, match.parent_platform, kind
        return "", "", "", kind


def build_roles_for_person(record: dict, vocab: Vocab, tagger: BrandTagger | None = None,
                           population: str = "owner") -> list[dict]:
    entries = json.loads(record["prior_history_json"] or "[]")
    rows = []
    for idx, e in enumerate(entries):
        title = e.get("title", "")
        company = e.get("company", "")
        title_norm = " ".join(lib.tokens(title))
        company_norm = " ".join(lib.tokens(company))
        start_ym, start_prec = parse_ym_precision(e.get("start", ""))
        end_raw = (e.get("end", "") or "").strip()
        end_is_present = end_raw == "Present"
        end_ym, end_prec = (None, None) if end_is_present else parse_ym_precision(end_raw)
        end_before_start = False
        if start_ym is not None and end_ym is not None and end_ym < start_ym:
            # raw data contradiction; derived end is withdrawn, raw stays upstream
            end_before_start = True
            end_ym, end_prec = None, None
        ownership = vocab.is_ownership(title_norm)
        is_fr = bool(e.get("is_franchise_role"))
        brand, brand_segment, brand_family, entity_kind = (tagger.tag(company) if tagger else ("", "", "", ""))
        if not brand and is_fr:
            # stage 04 tied this role to the person's own franchise (DBA / current
            # company overlap) even though the string matches no alias
            brand, brand_segment, brand_family = (
                record.get("canonical_brand", ""), record.get("brand_segment", ""),
                record.get("brand_parent_platform", ""))
        at_brand = bool(brand)
        if at_brand:
            sector, sector_source = (brand_segment or UNCLASSIFIED), "brand"
        else:
            sector, sector_source = vocab.sector(company_norm, title_norm)
        if entity_kind and not is_fr:
            role_kind = entity_kind
        elif at_brand:
            role_kind = "owner" if (ownership or is_fr) else "staff"
        else:
            role_kind = ""
        fn_list = [name for name, rx in vocab.functions.items() if rx.search(title_norm)]
        tag, detail = vocab.function_tag(fn_list)
        row = {
            "record_id": record["record_id"],
            "population": population,
            "orig_idx": idx,
            "title": title,
            "company": company,
            "title_norm": title_norm,
            "company_norm": company_norm,
            "start_ym": start_ym,
            "end_ym": end_ym,
            "start_date": ym_to_date(start_ym),
            "end_date": ym_to_date(end_ym),
            "start_precision": start_prec,
            "end_precision": end_prec,
            "date_imputed": (start_prec == "year") or (end_prec == "year"),
            "end_is_present": end_is_present,
            "end_before_start": end_before_start,
            "duration_mo": (end_ym - start_ym) if (start_ym is not None and end_ym is not None) else None,
            "months_to_asof": (vocab.as_of_ym - start_ym) if (end_is_present and start_ym is not None) else None,
            "is_franchise_role": is_fr,
            "at_franchise_brand": at_brand,
            "franchise_brand": brand,
            "franchise_brand_segment": brand_segment,
            "franchise_brand_family": brand_family,
            "franchise_role_kind": role_kind,
            "is_ownership": ownership,
            "is_corporate": vocab.is_corporate(title_norm, ownership),
            "is_middle_mgmt": vocab.is_middle_mgmt(title_norm),
            "sector_tag": sector,
            "sector_source": sector_source,
        }
        for flag, (field, rx) in vocab.flag_sets.items():
            row[flag] = bool(rx.search(title_norm if field == "title" else company_norm))
        row["fn_list"] = fn_list
        row["functions"] = ",".join(fn_list)
        row["function_detail"] = detail
        row["function_tag"] = tag
        rows.append(row)
    # chronological seq: dated roles by start (ties by original order), undated last
    rows.sort(key=lambda r: (r["start_ym"] is None, r["start_ym"] if r["start_ym"] is not None else 0, r["orig_idx"]))
    for seq, row in enumerate(rows):
        row["seq"] = seq
    return rows


# ------------------------------------------------------------------- persons

def role_basis_months(r: dict, cap: int) -> int | None:
    """Months of a role that count toward a person's composition, measured to
    `cap` (franchise start for owners, as_of for the comparison sample):
    explicit end -> min(end, cap) - start; Present -> cap - start; no usable
    end -> None (the role still counts as touched, contributes 0 months)."""
    if r["start_ym"] is None:
        return None
    end_eff = r["end_ym"] if r["end_ym"] is not None else (cap if r["end_is_present"] else None)
    if end_eff is None:
        return None
    return max(0, min(end_eff, cap) - r["start_ym"])


def tier_for(months: int, share: float | None) -> int:
    if months >= 84 or (share is not None and share >= 0.5 and months >= 36):
        return 3  # career
    if months >= 36:
        return 2  # experienced
    return 1  # touched


def derive_person(record: dict, roles: list[dict], vocab: Vocab, population: str = "owner") -> tuple[list[dict] | None, dict]:
    """-> (basis_roles | None, person_row). Every record yields a row; the basis
    roles (pre-purchase for owners, all dated roles for the comparison sample)
    are None when the person is not usable for career analysis."""
    status = record["current_ownership_status"]
    dated_fr = [r for r in roles if r["is_franchise_role"] and r["start_ym"] is not None]
    fr_start = min((r["start_ym"] for r in dated_fr), default=None)
    dated = [r for r in roles if r["start_ym"] is not None]
    city, state, metro = derive_location(record.get("City", ""), record.get("State or Province", ""))
    first_job_year = min((r["start_ym"] for r in dated), default=None)
    first_job_year = first_job_year // 12 if first_job_year is not None else None

    person = {
        "record_id": record["record_id"],
        "population": population,
        "screen_status": status,
        "full_name": record.get("Full Name", ""),
        "linkedin": record.get("LinkedIn Profile", ""),
        "job_title": record.get("Job Title", ""),
        "company": record.get("Company", ""),
        "canonical_brand": record.get("canonical_brand", ""),
        "brand_segment": record.get("brand_segment", ""),
        "brand_family": record.get("brand_parent_platform", ""),
        "ownership_confidence": record.get("ownership_confidence", ""),
        "is_multi_unit": str(record.get("multi_unit_signal", "")) == "True",
        "city": city,
        "state": state,
        "metro": metro,
        "first_job_year": first_job_year,
        "years_since_first_job": (vocab.as_of_ym // 12 - first_job_year) if first_job_year is not None else None,
        "n_roles": len(roles),
        "dated_roles": len(dated),
        "history_completeness": round(len(dated) / len(roles), 3) if roles else None,
        "fr_start_ym": fr_start,
        "franchise_purchase_year": fr_start // 12 if fr_start is not None else None,
    }

    if population == "owner":
        if status not in USABLE_STATUSES:
            basis, reason = None, "not_approved"
        elif not roles:
            basis, reason = None, "no_history"
        elif fr_start is None:
            basis, reason = None, "no_dated_purchase"
        else:
            basis = [r for r in roles if not r["is_franchise_role"] and r["start_ym"] is not None and r["start_ym"] < fr_start]
            reason = "usable" if basis else "no_dated_pre_role"
            if not basis:
                basis = None
        cap = fr_start
    else:
        if status in USABLE_STATUSES:
            basis, reason = None, "screened_as_owner"  # contaminant: looks like a franchise owner
        elif not dated:
            basis, reason = None, "no_history" if not roles else "no_dated_role"
        else:
            basis, reason = list(dated), "usable"
        cap = vocab.as_of_ym

    person["is_usable"] = basis is not None
    person["usable_reason"] = reason

    # ---- role positions relative to the purchase (owners) --------------------
    for r in roles:
        r["composition_months"] = None
        if population != "owner" or fr_start is None:
            pos = "no_purchase" if population != "owner" or fr_start is None else "undated"
            if population == "owner" and fr_start is None:
                pos = "no_purchase"
            pre = post = None
        elif r["is_franchise_role"]:
            pos, pre, post = "purchase", False, False
        elif r["start_ym"] is None:
            pos, pre, post = "undated", None, None
        elif r["start_ym"] < fr_start:
            pos, pre, post = "pre", True, False
        else:
            pos, pre, post = "post", False, True
        r["purchase_position"], r["is_pre_purchase"], r["is_post_purchase"] = pos, pre, post
    if basis:
        for r in basis:
            r["composition_months"] = role_basis_months(r, cap)

    # ---- career path (owners only; unchanged canonical logic) ---------------
    path, last_own, corp_after = None, None, []
    if population == "owner" and basis:
        own_pre = [r for r in basis if r["is_ownership"]]
        if not own_pre:
            path = "no_prior_ownership"
        else:
            last_own = max(own_pre, key=lambda r: (r["start_ym"], r["orig_idx"]))
            corp_after = sorted(
                (r for r in basis if r["is_corporate"] and r["start_ym"] > last_own["start_ym"]),
                key=lambda r: (r["start_ym"], r["orig_idx"]),
            )
            path = "owner_then_corporate" if corp_after else "owner_straight_to_franchise"
    own_end = last_own["end_ym"] if last_own else None
    first_return = corp_after[0] if corp_after else None
    person.update({
        "n_pre_roles": len(basis) if basis is not None else None,
        "career_path": path,
        "is_reentry": (path == "owner_then_corporate") if path else None,
        "had_prior_ownership": (path != "no_prior_ownership") if path else None,
        "n_corp_after": len(corp_after) if path else None,
        "yrs_between": round((fr_start - own_end) / 12, 2) if (last_own and own_end is not None) else None,
        "last_own_title": last_own["title"] if last_own else "",
        "last_own_company": last_own["company"] if last_own else "",
        "return_title": first_return["title"] if first_return else "",
        "return_company": first_return["company"] if first_return else "",
    })

    # ---- composition, longest role, sector affinity (baked at build) --------
    comp = {tag: {"n": 0, "mo": 0} for tag in FUNCTION_TAG_ORDER}
    sector_months: Counter = Counter()
    sectors_touched: list[str] = []
    total = 0
    longest = None
    if basis:
        for r in basis:
            months = r["composition_months"] or 0
            total += months
            comp[r["function_tag"]]["n"] += 1
            comp[r["function_tag"]]["mo"] += months
            if r["sector_tag"] != UNCLASSIFIED:
                sector_months[r["sector_tag"]] += months
                if r["sector_tag"] not in sectors_touched:
                    sectors_touched.append(r["sector_tag"])
            if r["composition_months"] is not None and (longest is None or months > (longest["composition_months"] or 0)):
                longest = r
    person["pre_months_total"] = total if basis else None
    tiers = {}
    for tag in FUNCTION_TAG_ORDER:
        d = comp[tag]
        if basis is None:
            person[f"months_{tag}"] = None
            person[f"share_{tag}"] = None
        else:
            person[f"months_{tag}"] = d["mo"]
            person[f"share_{tag}"] = round(d["mo"] / total, 3) if total else None
        if tag != "other":
            if basis is None:
                tiers[tag] = None
            elif d["n"] == 0:
                tiers[tag] = 0
            else:
                tiers[tag] = tier_for(d["mo"], person[f"share_{tag}"])
            person[f"tier_{tag}"] = tiers[tag]
    for r in roles:
        r["function_tier"] = (
            tiers.get(r["function_tag"]) if (basis and r in basis and r["function_tag"] != "other") else None
        )
    top_sector = sector_months.most_common(1)[0][0] if sector_months else ""
    brand_segment = person["brand_segment"]
    affinity_role = next((r for r in (basis or []) if r["sector_tag"] == brand_segment), None) if brand_segment else None
    person.update({
        "longest_pre_title": longest["title"] if longest else "",
        "longest_pre_employer": longest["company"] if longest else "",
        "longest_pre_months": longest["composition_months"] if longest else None,
        "longest_pre_function": longest["function_tag"] if longest else "",
        "longest_pre_sector": longest["sector_tag"] if longest else "",
        "pre_sectors": ",".join(sectors_touched),
        "top_pre_sector": top_sector,
        "sector_affinity": (affinity_role is not None) if (basis and population == "owner" and brand_segment) else None,
        "affinity_role_title": affinity_role["title"] if affinity_role else "",
    })
    return basis, person


def build_backgrounds(record_id: str, pre_roles: list[dict], fr_start: int, fn_names) -> tuple[list[dict], int]:
    """Person x function (16-way) exposure over the basis roles, measured to
    fr_start (or as_of for the comparison sample). Overlapping roles
    double-count months by design — share_pre is exposure share, not a clock."""
    per = {f: {"n": 0, "mo": 0} for f in fn_names}
    total = 0
    for r in pre_roles:
        months = role_basis_months(r, fr_start) or 0
        total += months
        for f in r["fn_list"]:
            per[f]["n"] += 1
            per[f]["mo"] += months
    rows = []
    for f, d in per.items():
        if d["n"] == 0:
            continue
        share = round(d["mo"] / total, 3) if total else None
        rows.append({"record_id": record_id, "function": f, "n_roles_pre": d["n"],
                     "months_pre": d["mo"], "share_pre": share, "tier": tier_for(d["mo"], share)})
    return rows, total


# ----------------------------------------------------------------- employers

def build_employers(roles_df: pd.DataFrame) -> pd.DataFrame:
    """One row per normalized employer string across every role of every
    population — the review surface for the sector and brand classifiers."""
    r = roles_df[roles_df["company_norm"] != ""]
    g = r.groupby("company_norm", sort=True)

    def mode(s: pd.Series) -> str:
        vc = s[s != ""].value_counts()
        return str(vc.index[0]) if len(vc) else ""

    out = pd.DataFrame({
        "company": g["company"].agg(mode),
        "record_count": g.size(),
        "person_count": g["record_id"].nunique(),
        "sector_tag": g["sector_tag"].agg(mode),
        "sector_source": g["sector_source"].agg(mode),
        "is_franchise_brand": g["at_franchise_brand"].any(),
        "franchise_brand": g["franchise_brand"].agg(mode),
        "brand_family": g["franchise_brand_family"].agg(mode),
        "brand_segment": g["franchise_brand_segment"].agg(mode),
        "ownership_role_share": g["is_ownership"].mean().round(3),
        "entity_kind": g["franchise_role_kind"].agg(
            lambda s: next((k for k in ("franchisor", "excluded_entity") if (s == k).any()), "")),
        "top_titles": g["title_norm"].agg(lambda s: " | ".join(t for t, _ in Counter(x for x in s if x).most_common(3))),
        "owner_records": g["population"].agg(lambda s: int((s == "owner").sum())),
        "comparison_records": g["population"].agg(lambda s: int((s == "comparison").sum())),
    }).reset_index()
    return out.sort_values(["record_count", "company_norm"], ascending=[False, True]).reset_index(drop=True)


# --------------------------------------------------------------------- build

def _load_population(path: Path, vocab: Vocab, tagger: BrandTagger, population: str):
    df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
    all_roles, persons, background_rows, role_fn_rows = [], [], [], []
    for record in df.to_dict("records"):
        roles = build_roles_for_person(record, vocab, tagger, population)
        basis, person = derive_person(record, roles, vocab, population)
        all_roles.extend(roles)
        for r in roles:
            for fn in r["fn_list"]:
                role_fn_rows.append({"record_id": r["record_id"], "seq": r["seq"], "function": fn})
        if basis:
            cap = person["fr_start_ym"] if population == "owner" else vocab.as_of_ym
            bg, _ = build_backgrounds(person["record_id"], basis, cap, vocab.functions)
            background_rows.extend(bg)
        persons.append(person)
    return all_roles, persons, background_rows, role_fn_rows


def run(input_path: Path | None = None, config_dir: Path | None = None,
        warehouse_dir: Path | None = None, outputs_dir: Path | None = None,
        sql_dir: Path | None = None, comparison_path: Path | None = None) -> dict:
    t0 = time.time()
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    warehouse_dir = Path(warehouse_dir) if warehouse_dir else WAREHOUSE_DIR
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    sql_dir = Path(sql_dir) if sql_dir else SQL_COHORTS_DIR
    input_path = Path(input_path) if input_path else lib.DATA_PROCESSED / "04_work_history_parsed.csv"
    comparison_path = Path(comparison_path) if comparison_path else None
    warehouse_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    vocab = load_vocab(config_dir)
    tagger = BrandTagger(lib.load_brands(config_dir / "approved_brands.csv"),
                         lib.load_exclusions(config_dir / "company_exclusions.csv"), vocab)

    all_roles, persons, background_rows, role_fn_rows = _load_population(input_path, vocab, tagger, "owner")
    if comparison_path is not None:
        cr, cp, cb, cf = _load_population(comparison_path, vocab, tagger, "comparison")
        all_roles += cr
        persons += cp
        background_rows += cb
        role_fn_rows += cf

    roles_df = pd.DataFrame(all_roles).drop(columns=["fn_list"])
    persons_df = pd.DataFrame(persons)
    for c in ["start_ym", "end_ym", "duration_mo", "months_to_asof", "composition_months", "function_tier"]:
        roles_df[c] = roles_df[c].astype("Int64")
    for c in ["is_pre_purchase", "is_post_purchase"]:
        roles_df[c] = roles_df[c].astype("boolean")
    for c in ["first_job_year", "years_since_first_job", "n_roles", "dated_roles", "fr_start_ym",
              "franchise_purchase_year", "n_pre_roles", "n_corp_after", "pre_months_total",
              "longest_pre_months"] + [f"months_{t}" for t in FUNCTION_TAG_ORDER] \
             + [f"tier_{t}" for t in FUNCTION_TAG_ORDER if t != "other"]:
        persons_df[c] = persons_df[c].astype("Int64")
    for c in ["history_completeness", "yrs_between"] + [f"share_{t}" for t in FUNCTION_TAG_ORDER]:
        persons_df[c] = persons_df[c].astype("Float64")
    for c in ["is_reentry", "had_prior_ownership", "sector_affinity"]:
        persons_df[c] = persons_df[c].astype("boolean")
    backgrounds_df = pd.DataFrame(background_rows, columns=["record_id", "function", "n_roles_pre", "months_pre", "share_pre", "tier"])
    backgrounds_df["share_pre"] = backgrounds_df["share_pre"].astype("Float64")
    role_fn_df = pd.DataFrame(role_fn_rows, columns=["record_id", "seq", "function"])

    roles_df = roles_df.sort_values(["record_id", "seq"]).reset_index(drop=True)
    persons_df = persons_df.sort_values("record_id").reset_index(drop=True)
    backgrounds_df = backgrounds_df.sort_values(["record_id", "function"]).reset_index(drop=True)
    role_fn_df = role_fn_df.sort_values(["record_id", "seq", "function"]).reset_index(drop=True)
    employers_df = build_employers(roles_df)

    roles_df.to_parquet(warehouse_dir / "roles.parquet", index=False)
    backgrounds_df.to_parquet(warehouse_dir / "backgrounds.parquet", index=False)
    role_fn_df.to_parquet(warehouse_dir / "role_functions.parquet", index=False)
    employers_df.to_parquet(warehouse_dir / "employers.parquet", index=False)
    persons_df.to_parquet(warehouse_dir / "persons.parquet", index=False)

    db_path = warehouse_dir / "frandev.duckdb"
    if db_path.exists():
        db_path.unlink()
    con = duckdb.connect(str(db_path))
    for name in ("roles", "persons", "backgrounds", "role_functions", "employers"):
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM read_parquet('{warehouse_dir / f'{name}.parquet'}')")
    con.execute("CREATE TABLE vocab_constants(key VARCHAR, value BIGINT)")
    for k, v in vocab.constants.items():
        con.execute("INSERT INTO vocab_constants VALUES (?, ?)", [k, v])

    def install_views() -> list[str]:
        names = []
        for sql_file in sorted(sql_dir.glob("*.sql")):
            con.execute(sql_file.read_text(encoding="utf-8"))
            names.append(sql_file.stem)
        return names

    view_names = install_views()
    cohort_ids: list[str] = []
    if view_names:
        union = " UNION ALL ".join(f"SELECT * FROM {v}" for v in view_names)
        con.execute(f"CREATE OR REPLACE TABLE cohorts AS {union}")
        cohort_ids = [r[0] for r in con.execute("SELECT DISTINCT cohort_id FROM cohorts ORDER BY 1").fetchall()]
        membership = dict(con.execute(
            "SELECT record_id, list(DISTINCT cohort_id ORDER BY cohort_id) FROM cohorts GROUP BY 1").fetchall())
    else:
        con.execute("CREATE TABLE cohorts(cohort_id VARCHAR, record_id VARCHAR, matched_on VARCHAR, confidence VARCHAR)")
        membership = {}
    # bake membership onto persons: one boolean per cohort, so overlap is a COUNT
    flags = persons_df["record_id"].map(lambda rid: membership.get(rid, []))
    for cid in cohort_ids:
        persons_df[f"cohort_{cid}"] = flags.map(lambda lst, c=cid: c in lst)
    persons_df["cohort_flags"] = flags.map(",".join)
    persons_df["cohort_count"] = flags.map(len).astype("Int64")
    persons_df.to_parquet(warehouse_dir / "persons.parquet", index=False)
    for v in view_names:
        con.execute(f"DROP VIEW IF EXISTS {v}")
    con.execute(f"CREATE OR REPLACE TABLE persons AS SELECT * FROM read_parquet('{warehouse_dir / 'persons.parquet'}')")
    install_views()
    con.execute(f"COPY (SELECT * FROM cohorts ORDER BY cohort_id, record_id) TO '{warehouse_dir / 'cohorts.parquet'}' "
                "(FORMAT parquet)")

    cohort_sizes = {
        row[0]: row[1]
        for row in con.execute("SELECT cohort_id, count(*) FROM cohorts GROUP BY cohort_id ORDER BY cohort_id").fetchall()
    }
    overlap = {}
    for a in cohort_ids:
        for b in cohort_ids:
            if a < b:
                overlap[f"{a}&{b}"] = int(con.execute(
                    f'SELECT count(*) FROM persons WHERE "cohort_{a}" AND "cohort_{b}"').fetchone()[0])
    con.close()

    owners = persons_df[persons_df["population"] == "owner"]
    usable = owners[owners["is_usable"]]
    owner_roles = roles_df[roles_df["population"] == "owner"]
    dated_starts = int(owner_roles["start_ym"].notna().sum())
    path_counts = usable["career_path"].value_counts().to_dict()
    pre_roles = owner_roles[owner_roles["is_pre_purchase"].fillna(False)]
    manifest = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "input_file": input_path.name,
        "input_sha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "comparison_file": comparison_path.name if comparison_path else None,
        "vocab_sha256": hashlib.sha256((config_dir / "vocab.yaml").read_bytes()).hexdigest(),
        "as_of_ym": vocab.as_of_ym,
        "build_seconds": round(time.time() - t0, 1),
        "roles": len(owner_roles),
        "roles_all_populations": len(roles_df),
        "persons_total": len(owners),
        "persons_with_history": int(owner_roles["record_id"].nunique()),
        "start_parse_pct": round(100 * dated_starts / len(owner_roles), 1) if len(owner_roles) else 0.0,
        "usable_persons": len(usable),
        "usable_reasons": {k: int(v) for k, v in owners["usable_reason"].value_counts().items()},
        "comparison_persons": int((persons_df["population"] == "comparison").sum()),
        "comparison_usable": int(((persons_df["population"] == "comparison") & persons_df["is_usable"]).sum()),
        "career_path_counts": {k: int(v) for k, v in path_counts.items()},
        "end_before_start_rows": int(roles_df["end_before_start"].sum()),
        "date_imputed_rows": int(roles_df["date_imputed"].sum()),
        "employers": len(employers_df),
        "employers_seen_once": int((employers_df["record_count"] == 1).sum()),
        "pre_roles_sector_classified_pct": round(
            100 * float((pre_roles["sector_tag"] != UNCLASSIFIED).mean()), 1) if len(pre_roles) else 0.0,
        "roles_at_franchise_brand": int(roles_df["at_franchise_brand"].sum()),
        "cohort_sizes": cohort_sizes,
        "cohort_overlap": overlap,
        "function_tag_headlines": {
            tag: {
                "touched": int((usable[f"tier_{tag}"] >= 1).sum()),
                "experienced_3y": int((usable[f"tier_{tag}"] >= 2).sum()),
                "career": int((usable[f"tier_{tag}"] == 3).sum()),
            }
            for tag in FUNCTION_TAG_ORDER if tag != "other"
        },
        "sector_affinity_rate": round(float(usable["sector_affinity"].mean()), 3) if len(usable) else None,
    }
    lib.write_json(outputs_dir / "07_warehouse_manifest.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, default=None, help="owners stage-04 CSV")
    parser.add_argument("--comparison", type=Path, default=None,
                        help="stage-04 CSV of the matched comparison sample (loads as population='comparison')")
    args = parser.parse_args()
    manifest = run(input_path=args.input, comparison_path=args.comparison)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
