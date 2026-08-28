"""Step 7 — deterministic parse of Clay's `Full Work History` text. No LLM/API calls.

Format observed in the export:
    "Title at Company (MM/YYYY - MM/YYYY); Title at Company (MM/YYYY - Present); ..."

Identifies the first franchise-ownership experience, selects the last credible prior
(non-franchise) role, and preserves conflicting evidence instead of resolving it:
stale "Present" end dates lower confidence, they are never rewritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

import pipeline_lib as lib

ENTRY_RE = re.compile(r"\s*(?P<body>.+?)\s*\((?P<dates>[^()]*)\)\s*(?:;|$)")
DATE_RE = re.compile(r"^(?:(?P<month>\d{1,2})/)?(?P<year>\d{4})$")
OWNER_TITLE_TOKENS = {"owner", "franchisee", "franchise", "proprietor"}

PRESENT = "Present"


def parse_date(raw: str):
    """-> (year, month) | 'Present' | None. Never invents a value."""
    raw = raw.strip()
    if not raw:
        return None
    if raw.lower() == "present":
        return PRESENT
    m = DATE_RE.match(raw)
    if not m:
        return None
    month = int(m.group("month")) if m.group("month") else None
    return (int(m.group("year")), month)


def date_key(d):
    """Sortable key for a parsed (year, month) date; None/'Present' handled by callers."""
    year, month = d
    return year * 100 + (month or 6)  # missing month sorts mid-year


def fmt_date(d) -> str:
    if d is None:
        return "unknown"
    if d == PRESENT:
        return "Present"
    year, month = d
    return f"{month:02d}/{year}" if month else str(year)


def parse_entries(work_history: str) -> tuple[list[dict], bool]:
    """-> (entries, parse_ambiguity). Title/company split on the FIRST ' at ' so company
    names containing ' at ' (e.g. 'Right at Home') survive."""
    entries = []
    ambiguity = False
    consumed = 0
    for m in ENTRY_RE.finditer(work_history):
        if work_history[consumed : m.start()].strip():
            ambiguity = True  # text the entry grammar could not account for
        consumed = m.end()
        body = m.group("body")
        if " at " in body:
            title, company = body.split(" at ", 1)
        else:
            title, company = body, ""
        dates = m.group("dates")
        if "-" in dates:
            start_raw, end_raw = dates.split("-", 1)
        else:
            start_raw, end_raw = dates, ""
        entries.append(
            {
                "title": title.strip(),
                "company": company.strip(),
                "start": parse_date(start_raw),
                "end": parse_date(end_raw),
                "multi_at": body.count(" at ") > 1,
                "raw": m.group(0).strip().rstrip(";").strip(),
            }
        )
    if work_history[consumed:].strip():
        ambiguity = True
    return entries, ambiguity


def is_franchise_entry(entry: dict, canonical_brand: str, current_company: str, brands) -> bool:
    company_tokens = lib.tokens(entry["company"])
    if canonical_brand:
        brand_tokens = lib.tokens(canonical_brand)
        if lib.find_token_subsequence(brand_tokens, company_tokens) >= 0:
            return True
    current_tokens = lib.tokens(current_company)
    if company_tokens and current_tokens:
        if (
            lib.find_token_subsequence(company_tokens, current_tokens) >= 0
            or lib.find_token_subsequence(current_tokens, company_tokens) >= 0
        ):
            return True
    title_tokens = set(lib.tokens(entry["title"]))
    if title_tokens & OWNER_TITLE_TOKENS:
        match = lib.match_brand(entry["company"], brands)
        if match.canonical_brand and not match.needs_review:
            return True
    return False


def analyze_history(work_history: str, canonical_brand: str, current_company: str, brands) -> dict:
    entries, ambiguity = parse_entries(work_history)
    presents = [e for e in entries if e["end"] == PRESENT]
    franchise_entries = [
        e for e in entries if is_franchise_entry(e, canonical_brand, current_company, brands)
    ]
    # a multi-" at " entry is only truly ambiguous when the split-off company is neither
    # the person's franchise nor any recognizable brand ("Owner at Right at Home" is fine)
    ambiguity = ambiguity or any(
        e["multi_at"]
        and e not in franchise_entries
        and lib.match_brand(e["company"], brands).canonical_brand == ""
        for e in entries
    )
    prior_entries = [e for e in entries if e not in franchise_entries]

    dated_franchise = [e for e in franchise_entries if isinstance(e["start"], tuple)]
    first_franchise = min(dated_franchise, key=lambda e: date_key(e["start"])) if dated_franchise else None
    franchise_start = first_franchise["start"] if first_franchise else None
    if first_franchise is None and franchise_entries:
        first_franchise = franchise_entries[0]

    timeline_conflict = len(presents) > 1 or any(
        isinstance(e["start"], tuple) and isinstance(e["end"], tuple) and date_key(e["end"]) < date_key(e["start"])
        for e in entries
    )

    prior, reason = select_prior_role(prior_entries, franchise_start)

    if franchise_start and prior and isinstance(prior["end"], tuple) and not timeline_conflict:
        date_confidence = "high"
    elif franchise_start and prior:
        date_confidence = "medium"
    else:
        date_confidence = "low"
    if "(low confidence)" in reason:
        date_confidence = "low"

    return {
        "work_history_entry_count": len(entries),
        "parse_ambiguity": ambiguity,
        "stale_present_count": len(presents),
        "timeline_conflict": timeline_conflict,
        "first_franchise_ownership_start": fmt_date(franchise_start),
        "first_franchise_role_title": first_franchise["title"] if first_franchise else "",
        "first_franchise_role_company": first_franchise["company"] if first_franchise else "",
        "last_credible_prior_title": prior["title"] if prior else "",
        "last_credible_prior_employer": prior["company"] if prior else "",
        "last_credible_prior_start": fmt_date(prior["start"]) if prior else "unknown",
        "last_credible_prior_end": fmt_date(prior["end"]) if prior else "unknown",
        "prior_role_selection_reason": reason,
        "career_date_confidence": date_confidence,
        "prior_history_json": json.dumps(
            [
                {
                    "title": e["title"],
                    "company": e["company"],
                    "start": fmt_date(e["start"]),
                    "end": fmt_date(e["end"]),
                    "is_franchise_role": e in franchise_entries,
                }
                for e in entries
            ],
            ensure_ascii=False,
        ),
    }


def select_prior_role(prior_entries: list[dict], franchise_start):
    """Plan hierarchy: explicit end before franchise start > latest start plausibly
    preceding ownership > strongest remaining role at low confidence."""
    if not prior_entries:
        return None, "no non-franchise history entries"

    if franchise_start:
        fk = date_key(franchise_start)
        explicit = [
            e
            for e in prior_entries
            if isinstance(e["end"], tuple) and date_key(e["end"]) <= fk + 100  # ends within a year
        ]
        if explicit:
            best = max(explicit, key=lambda e: date_key(e["end"]))
            return best, "explicit end date at/before franchise-ownership start"
        preceding = [
            e for e in prior_entries if isinstance(e["start"], tuple) and date_key(e["start"]) < fk
        ]
        if preceding:
            best = max(preceding, key=lambda e: date_key(e["start"]))
            return best, "latest start preceding franchise start (end dates conflict/stale)"

    dated = [e for e in prior_entries if isinstance(e["start"], tuple)]
    if dated:
        best = max(dated, key=lambda e: date_key(e["start"]))
        if franchise_start:
            return best, "no prior role precedes franchise start; latest-start non-franchise role (low confidence)"
        return best, "no reliable franchise start; latest-start non-franchise role (low confidence)"
    return prior_entries[0], "no reliable dates anywhere; first listed non-franchise role (low confidence)"


def run(
    input_path: Path | None = None,
    processed_dir: Path | None = None,
    outputs_dir: Path | None = None,
    config_dir: Path | None = None,
) -> pd.DataFrame:
    processed_dir = Path(processed_dir) if processed_dir else lib.DATA_PROCESSED
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    input_path = Path(input_path) if input_path else processed_dir / "03_current_ownership_candidates.csv"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False, encoding="utf-8")
    brands = lib.load_brands(config_dir / "approved_brands.csv")

    results = []
    for row in df.to_dict("records"):
        wh = row.get("Full Work History", "")
        if wh:
            analysis = analyze_history(wh, row["canonical_brand"], row["Company"], brands)
        else:
            analysis = {
                "work_history_entry_count": 0,
                "parse_ambiguity": False,
                "stale_present_count": 0,
                "timeline_conflict": False,
                "first_franchise_ownership_start": "unknown",
                "first_franchise_role_title": "",
                "first_franchise_role_company": "",
                "last_credible_prior_title": "",
                "last_credible_prior_employer": "",
                "last_credible_prior_start": "unknown",
                "last_credible_prior_end": "unknown",
                "prior_role_selection_reason": "no work history available",
                "career_date_confidence": "low",
                "prior_history_json": "[]",
            }
        analysis["work_history_hash"] = hashlib.sha256(wh.encode("utf-8")).hexdigest()[:16]
        results.append(analysis)

    out = pd.concat([df.reset_index(drop=True), pd.DataFrame(results)], axis=1)
    out.to_csv(processed_dir / "04_work_history_parsed.csv", index=False)

    conflicts = out[out["timeline_conflict"].astype(str) == "True"][
        [
            "record_id", "Full Name", "canonical_brand", "work_history_entry_count",
            "stale_present_count", "first_franchise_ownership_start",
            "last_credible_prior_title", "last_credible_prior_employer",
            "career_date_confidence", "prior_role_selection_reason",
        ]
    ]
    conflicts.to_csv(outputs_dir / "04_timeline_conflict_report.csv", index=False)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None)
    args = parser.parse_args()
    out = run(input_path=args.input)
    with_history = (out["work_history_entry_count"].astype(int) > 0).sum()
    conflicts = (out["timeline_conflict"].astype(str) == "True").sum()
    prior_found = (out["last_credible_prior_title"] != "").sum()
    print(
        f"04_parse_work_history: {with_history}/{len(out)} with history; "
        f"{prior_found} with a credible prior role; {conflicts} timeline conflicts"
    )


if __name__ == "__main__":
    main()
