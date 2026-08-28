import csv
import json

import pandas as pd

from conftest import load_script

clean_people = load_script("01_clean_people")

HEADER = [
    "US Franchise Owners and Executives", "First Name", "Last Name", "Full Name",
    "Job Title", "Company", "City", "State or Province", "Country",
    "LinkedIn Profile", "Enrich person", "Name", "Title", "Org", "Summary",
    "Full Work History",
]


def make_row(**overrides):
    row = {h: "" for h in HEADER}
    row.update(
        {
            "First Name": "Alex", "Last Name": "Rivera", "Full Name": "Alex Rivera",
            "Job Title": "Owner", "Company": "SERVPRO of Testville", "City": "Testville",
            "State or Province": "Ohio", "Country": "United States",
            "LinkedIn Profile": "https://www.linkedin.com/in/alex-rivera-1/",
            "Enrich person": "Alex Rivera", "Name": "Alex Rivera", "Title": "Owner",
            "Org": "SERVPRO of Testville",
            "Full Work History": "Owner at SERVPRO of Testville (01/2015 - Present)",
        }
    )
    row.update(overrides)
    return row


def write_fixture(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        w.writerows(rows)


def run_fixture(tmp_path, rows):
    raw = tmp_path / "US-Franchise-Owners-and-Executives-test.csv"
    write_fixture(raw, rows)
    processed = tmp_path / "processed"
    outputs = tmp_path / "outputs"
    clean = clean_people.run(input_path=raw, processed_dir=processed, outputs_dir=outputs)
    return clean, processed, outputs


def test_us_filter_case_insensitive(tmp_path):
    rows = [
        make_row(),
        make_row(Country="Canada", **{"LinkedIn Profile": "https://linkedin.com/in/ca-person"}),
        make_row(Country="UNITED STATES", **{"LinkedIn Profile": "https://linkedin.com/in/us-caps"}),
    ]
    clean, _, outputs = run_fixture(tmp_path, rows)
    assert len(clean) == 2
    summary = json.loads((outputs / "01_cleaning_summary.json").read_text())
    assert summary["non_us_rows"] == 1


def test_linkedin_dedupe_with_provenance(tmp_path):
    url_variants = [
        "https://www.linkedin.com/in/same-person/",
        "http://linkedin.com/in/same-person",
        "https://www.linkedin.com/in/same-person?utm_source=x",
    ]
    rows = [make_row(**{"LinkedIn Profile": u}) for u in url_variants]
    rows.append(make_row(**{"LinkedIn Profile": "https://linkedin.com/in/different-person"}))
    clean, _, outputs = run_fixture(tmp_path, rows)
    assert len(clean) == 2
    canonical = clean[clean["normalized_linkedin"] == "linkedin.com/in/same-person"].iloc[0]
    assert canonical["duplicate_count"] == 3
    assert canonical["duplicate_source_row_ids"] == "2;3"
    assert canonical["source_row_id"] == 1
    dup_report = pd.read_csv(outputs / "01_duplicate_records.csv")
    assert len(dup_report) == 3  # every member of the duplicated group is retained


def test_no_dedupe_on_name_or_company(tmp_path):
    rows = [
        make_row(**{"LinkedIn Profile": "https://linkedin.com/in/person-a"}),
        make_row(**{"LinkedIn Profile": "https://linkedin.com/in/person-b"}),
    ]
    clean, _, _ = run_fixture(tmp_path, rows)
    assert len(clean) == 2  # same name+company, different URLs -> two people


def test_raw_columns_preserved(tmp_path):
    weird = 'FASTSIGNS® of Orlando — "The Best", LLC'
    rows = [make_row(Company=weird)]
    clean, processed, _ = run_fixture(tmp_path, rows)
    on_disk = pd.read_csv(processed / "01_people_clean.csv", dtype=str, keep_default_na=False)
    assert on_disk.iloc[0]["Company"] == weird
    assert on_disk.iloc[0]["normalized_company"] == 'fastsigns of orlando - "the best", llc'


def test_quality_flags_and_enrichment_status(tmp_path):
    rows = [
        make_row(City="", **{"Enrich person": "❌ No Profile Found", "Full Work History": ""}),
        make_row(
            **{
                "LinkedIn Profile": "https://example.com/not-linkedin",
                "Full Work History": "",
                "Enrich person": "x",
            }
        ),
    ]
    clean, _, _ = run_fixture(tmp_path, rows)
    first = clean.iloc[0]
    assert bool(first["missing_city"]) is True
    assert first["enrichment_status"] == "no_profile_found"
    second = clean.iloc[1]
    assert bool(second["invalid_linkedin_url"]) is True
    assert second["enrichment_status"] == "no_work_history"
