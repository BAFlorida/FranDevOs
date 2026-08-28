import sys

import pytest

from conftest import load_script, SRC

sys.path.insert(0, str(SRC))
import pipeline_lib as lib

normalize = load_script("02_normalize_brand_affiliation")

BRANDS = lib.load_brands()
EXCLUSIONS = lib.load_exclusions()


def classify(company: str) -> dict:
    return normalize.classify_company(company, BRANDS, EXCLUSIONS)


@pytest.mark.parametrize(
    "company,expected_brand,expected_method",
    [
        ("SERVPRO of North Raleigh", "SERVPRO", "prefix"),
        ("Servpro Fire & Water Cleanup & Restoration", "SERVPRO", "prefix"),
        ("Mr. Rooter Plumbing of Westchester NY", "Mr. Rooter Plumbing", "prefix"),
        ("U.S. Lawns Miami North", "U.S. Lawns", "prefix"),
        ("US Lawns - Nassau County NY", "U.S. Lawns", "prefix"),
        ("FASTSIGNS of Orlando", "FASTSIGNS", "prefix"),
        ("Fastsigns", "FASTSIGNS", "exact"),
        ("The UPS Store, 4699", "The UPS Store", "prefix"),
        ("the ups store", "The UPS Store", "exact"),
        ("1-800-GOT-JUNK?", "1-800-GOT-JUNK?", "exact"),
        ("Two Men & A Truck of Charlotte", "Two Men and a Truck", "prefix"),
        ("Midas Auto Service Experts", "Midas", "prefix"),
    ],
)
def test_valid_dba_matches(company, expected_brand, expected_method):
    result = classify(company)
    assert result["canonical_brand"] == expected_brand
    assert result["match_method"] == expected_method
    assert result["needs_manual_brand_review"] is False
    assert result["company_exclusion_hit"] == ""


def test_local_dba_detected():
    assert classify("SERVPRO of North Raleigh")["local_dba_or_operating_entity"] is True
    assert classify("Deptford Signarama")["local_dba_or_operating_entity"] is True
    assert classify("Signarama")["local_dba_or_operating_entity"] is False


def test_operator_entity_prefix_is_contains_match():
    result = classify("Deptford Signarama")
    assert result["canonical_brand"] == "Signarama"
    assert result["match_method"] == "contains"


@pytest.mark.parametrize(
    "company",
    ["Midas Consulting", "Midas Safety", "Midas Financial Company", "MiDAS Foods International"],
)
def test_unrelated_midas_entities_never_match(company):
    result = classify(company)
    assert result["canonical_brand"] == ""
    assert result["company_exclusion_reason"].startswith("unrelated")


def test_bare_midas_needs_review():
    result = classify("Midas")
    assert result["canonical_brand"] == "Midas"
    assert result["needs_manual_brand_review"] is True
    assert result["brand_match_confidence"] == "low"


def test_right_at_home_realty_excluded_but_brand_ok():
    excluded = classify("Right at Home Realty")
    assert excluded["canonical_brand"] == ""
    assert excluded["company_exclusion_reason"].startswith("unrelated")
    ok = classify("Right at Home - South Shore")
    assert ok["canonical_brand"] == "Right at Home"
    assert ok["local_dba_or_operating_entity"] is True


def test_franchisor_entity_keeps_brand_at_low_confidence():
    result = classify("Servpro Industries, Inc.")
    assert result["company_exclusion_reason"] == "franchisor/corporate entity"
    assert result["canonical_brand"] == "SERVPRO"
    assert result["brand_match_confidence"] == "low"


def test_franchisee_written_franchisor_style_name_still_matches():
    result = classify("Kitchen Tune-Up Franchise System")
    assert result["canonical_brand"] == "Kitchen Tune-Up"
    assert result["company_exclusion_hit"] == ""
    assert result["corporate_entity_signal"] is False


def test_corporate_marker_detection():
    assert classify("FASTSIGNS International, Inc.")["company_exclusion_reason"] == "franchisor/corporate entity"
    assert classify("Synergy HomeCare Franchising, LLC")["corporate_entity_signal"] is True


def test_generic_brand_name_contained_in_unrelated_company_needs_review():
    result = classify("Bianchi Realty & Property Management Inc.")
    assert result["needs_manual_brand_review"] is True
    exact = classify("Property Management Inc.")
    assert exact["needs_manual_brand_review"] is True


def test_unmatched_company_returns_none():
    result = classify("Joe's Totally Independent Plumbing LLC")
    assert result["canonical_brand"] == ""
    assert result["match_method"] == "none"
