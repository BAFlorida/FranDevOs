import csv

import pandas as pd

from conftest import load_script

normalize = load_script("02_normalize_brand_affiliation")
ownership = load_script("03_classify_current_ownership")

import pipeline_lib as lib

RULES = ownership.load_title_rules(lib.CONFIG_DIR / "title_rules.csv")


def title_class(title):
    return ownership.classify_title(title, RULES)[0]


def test_title_classification():
    assert title_class("Owner") == "include"
    assert title_class("Franchise Owner") == "include"
    assert title_class("President/CEO") == "include"
    assert title_class("Owner/Operator") == "include"
    assert title_class("General Manager") == "caution"
    assert title_class("Director of Operations") == "caution"
    assert title_class("VP of Franchise Development") == "hard_exclude"
    assert title_class("Senior Recruiter") == "hard_exclude"
    assert title_class("HR Business Partner") == "hard_exclude"
    assert title_class("Managing Partner") == "include"
    assert title_class("Marketing Coordinator") == "none"


def test_multi_unit_signal():
    cls, _, multi = ownership.classify_title("Multi-Unit Franchise Owner", RULES)
    assert cls == "include" and multi is True
    cls, _, multi = ownership.classify_title("Area Developer", RULES)
    assert cls == "include" and multi is True
    _, _, multi = ownership.classify_title("Owner", RULES)
    assert multi is False


CLEAN_COLUMNS = [
    "record_id", "source_row_id", "Full Name", "Job Title", "Company",
    "normalized_company", "normalized_job_title", "enriched_org_differs",
]

CASES = [
    # (record_id, title, company, expected_status, expected_confidence)
    ("p00001", "Owner", "SERVPRO of North Raleigh", "approved_candidate", "high"),
    ("p00002", "General Manager", "FASTSIGNS of Orlando", "caution_candidate", "medium"),
    ("p00003", "Director of Franchise Development", "FASTSIGNS International, Inc.", "excluded", "high"),
    ("p00004", "Owner", "Servpro Industries, Inc.", "needs_review", "low"),
    ("p00005", "Owner", "Midas", "needs_review", "low"),
    ("p00006", "Owner", "Joe's Totally Independent Plumbing LLC", "needs_review", "medium"),
    ("p00007", "Senior Recruiter", "Unrelated Staffing Co", "excluded", "high"),
    ("p00008", "Multi-Unit Owner", "The UPS Store", "approved_candidate", "high"),
    ("p00009", "Owner", "Midas Consulting", "excluded", "high"),
]


def test_status_pipeline_integration(tmp_path):
    processed = tmp_path / "processed"
    outputs = tmp_path / "outputs"
    processed.mkdir()
    rows = []
    for rid, title, company, _, _ in CASES:
        rows.append(
            {
                "record_id": rid,
                "source_row_id": rid.lstrip("p").lstrip("0") or "0",
                "Full Name": "Test Person",
                "Job Title": title,
                "Company": company,
                "normalized_company": lib.normalize_text(company),
                "normalized_job_title": lib.normalize_text(title),
                "enriched_org_differs": "False",
            }
        )
    with open(processed / "01_people_clean.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CLEAN_COLUMNS)
        w.writeheader()
        w.writerows(rows)

    normalize.run(processed_dir=processed, outputs_dir=outputs)
    out = ownership.run(processed_dir=processed, outputs_dir=outputs)
    by_id = {r["record_id"]: r for r in out.to_dict("records")}

    for rid, title, company, expected_status, expected_conf in CASES:
        got = by_id[rid]
        assert got["current_ownership_status"] == expected_status, (
            f"{rid} ({title} @ {company}): expected {expected_status}, "
            f"got {got['current_ownership_status']} — {got['deterministic_reason']}"
        )
        assert got["ownership_confidence"] == expected_conf, (
            f"{rid}: expected confidence {expected_conf}, got {got['ownership_confidence']}"
        )
        assert got["deterministic_reason"], f"{rid}: reason must never be empty"
        assert got["classified_at"], f"{rid}: timestamp must never be empty"

    assert by_id["p00008"]["multi_unit_signal"] in (True, "True")
    review = pd.read_csv(outputs / "03_needs_manual_ownership_review.csv")
    assert set(review["record_id"]) == {"p00004", "p00005", "p00006"}
    excluded = pd.read_csv(outputs / "03_excluded_records.csv")
    assert {"p00003", "p00007", "p00009"} <= set(excluded["record_id"])
