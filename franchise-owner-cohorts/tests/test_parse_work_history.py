from conftest import load_script

import pipeline_lib as lib

parser = load_script("04_parse_work_history")

BRANDS = lib.load_brands()


def analyze(history, brand="1-800-GOT-JUNK?", company="1-800-GOT-JUNK?"):
    return parser.analyze_history(history, brand, company, BRANDS)


def test_entry_parsing_first_at_rule():
    entries, ambiguity = parser.parse_entries(
        "Owner at Right at Home - South Shore (01/2010 - Present); "
        "Regional Sales Manager at Cole National/Lenscrafters (04/1993 - 06/2004)"
    )
    assert entries[0]["title"] == "Owner"
    assert entries[0]["company"] == "Right at Home - South Shore"
    assert entries[1]["end"] == (2004, 6)
    assert ambiguity is False


def test_date_variants():
    assert parser.parse_date("09/2004") == (2004, 9)
    assert parser.parse_date("2010") == (2010, None)
    assert parser.parse_date("Present") == parser.PRESENT
    assert parser.parse_date("") is None
    assert parser.parse_date("garbage") is None


def test_explicit_end_before_franchise_start_selected():
    result = analyze(
        "Franchise Owner at 1-800-Got-Junk? (09/2004 - Present); "
        "Regional Sales Manager at Cole National/Lenscrafters (04/1993 - 06/2004); "
        "Lab Director at Eye Master (01/1986 - 12/1992)"
    )
    assert result["first_franchise_ownership_start"] == "09/2004"
    assert result["last_credible_prior_title"] == "Regional Sales Manager"
    assert result["last_credible_prior_employer"] == "Cole National/Lenscrafters"
    assert result["prior_role_selection_reason"].startswith("explicit end date")
    assert result["timeline_conflict"] is False
    assert result["career_date_confidence"] == "high"


def test_stale_present_roles_lower_confidence_not_discarded():
    # every role claims "Present" — classic scraped-LinkedIn artifact
    result = analyze(
        "Owner at 1-800-GOT-JUNK? (01/2005 - Present); "
        "Corporate Vice President, Consumer Mktg. at Health Net, Inc (01/2003 - Present); "
        "Sr Director of Marketing at McDonald's Corporation (01/1998 - Present); "
        "Brand Management at Procter & Gamble (01/1989 - Present)"
    )
    assert result["first_franchise_ownership_start"] == "01/2005"
    assert result["timeline_conflict"] is True
    assert result["last_credible_prior_employer"] == "Health Net, Inc"
    assert result["prior_role_selection_reason"].startswith("latest start preceding")
    assert result["career_date_confidence"] == "medium"
    assert result["stale_present_count"] == 4


def test_franchise_entry_detection_by_brand_and_owner_title():
    result = analyze(
        "Owner at GSG, Inc. dba AAMCO (01/2015 - Present); "
        "Service Manager at Some Auto Shop (01/2010 - 12/2014)",
        brand="AAMCO",
        company="GSG, Inc. dba AAMCO",
    )
    assert result["first_franchise_ownership_start"] == "01/2015"
    assert result["last_credible_prior_title"] == "Service Manager"


def test_prior_owner_role_at_other_company_stays_prior():
    # a prior non-franchise business is prior-career evidence, not a franchise entry
    result = analyze(
        "Owner at SERVPRO of Testville (03/2018 - Present); "
        "Owner at Joe's Landscaping LLC (01/2008 - 12/2017)",
        brand="SERVPRO",
        company="SERVPRO of Testville",
    )
    assert result["first_franchise_ownership_start"] == "03/2018"
    assert result["last_credible_prior_employer"] == "Joe's Landscaping LLC"


def test_no_history():
    result = analyze("", brand="SERVPRO", company="SERVPRO of X")
    assert result["work_history_entry_count"] == 0
    assert result["first_franchise_ownership_start"] == "unknown"
    assert result["career_date_confidence"] == "low"


def test_prior_history_json_marks_franchise_roles():
    import json

    result = analyze(
        "Owner at SERVPRO of Testville (03/2018 - Present); "
        "Plant Manager at Acme Manufacturing (01/2000 - 02/2018)",
        brand="SERVPRO",
        company="SERVPRO of Testville",
    )
    parsed = json.loads(result["prior_history_json"])
    assert parsed[0]["is_franchise_role"] is True
    assert parsed[1]["is_franchise_role"] is False
