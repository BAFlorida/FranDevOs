"""Warehouse tests — the ones that would have caught the 545/480 discrepancy,
plus the grain/flag contracts of the role spine.

The frozen totals below are the calibrated 2026-08-28 build of
04_work_history_parsed.csv (input sha 789f9a43…). A vocabulary or logic change
that moves any of them is a *definition change* and must be made deliberately:
update the constant AND the golden file in the same commit, with a note.
"""
from pathlib import Path

import duckdb
import pandas as pd
import pytest

from conftest import load_script

lib_mod = load_script("07_build_warehouse")
import pipeline_lib as lib

INPUT = lib.DATA_PROCESSED / "04_work_history_parsed.csv"
GOLDEN = Path(__file__).parent / "golden_career_paths.csv"

FROZEN = {
    "roles": 51319,
    "persons_with_history": 11279,
    "start_parse_pct": 95.0,
    "usable_persons": 7359,
    "career_path_counts": {
        "no_prior_ownership": 5793,
        "owner_straight_to_franchise": 1099,
        "owner_then_corporate": 467,
    },
}

pytestmark = pytest.mark.skipif(not INPUT.exists(), reason="people data not present in this checkout")


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("warehouse")
    manifest = lib_mod.run(warehouse_dir=tmp, outputs_dir=tmp / "outputs")
    roles = pd.read_parquet(tmp / "roles.parquet")
    persons = pd.read_parquet(tmp / "persons.parquet")
    employers = pd.read_parquet(tmp / "employers.parquet")
    return manifest, roles, persons, employers, tmp


def test_frozen_totals(built):
    manifest = built[0]
    for key, expected in FROZEN.items():
        assert manifest[key] == expected, (
            f"{key}: expected {expected}, got {manifest[key]} — a vocab/logic change "
            "moved a published figure; update FROZEN + golden file deliberately."
        )


def test_every_record_kept_and_flagged(built):
    manifest, _, persons, _, _ = built
    owners = persons[persons["population"] == "owner"]
    assert len(owners) == manifest["persons_total"] == 11452
    assert owners["record_id"].is_unique
    assert set(owners["usable_reason"]) == {"usable", "no_dated_pre_role", "no_dated_purchase", "not_approved", "no_history"}
    assert (owners["is_usable"] == (owners["usable_reason"] == "usable")).all()
    assert owners["is_usable"].sum() == FROZEN["usable_persons"]
    # composition is only defined where a tenure basis exists
    assert owners.loc[~owners["is_usable"], "pre_months_total"].isna().all()
    assert owners.loc[owners["is_usable"], "pre_months_total"].notna().all()


def test_grain_one_row_per_person_per_role(built):
    _, roles, _, _, _ = built
    assert not roles.duplicated(["record_id", "seq"]).any()
    bad = roles.groupby("record_id")["seq"].agg(lambda s: sorted(s) != list(range(len(s))))
    assert not bad.any()


def test_chronology(built):
    _, roles, _, _, _ = built
    both = roles.dropna(subset=["start_ym", "end_ym"])
    assert (both["end_ym"] >= both["start_ym"]).all()
    dated = roles.dropna(subset=["start_ym"])
    assert (pd.to_datetime(dated["start_date"]).dt.year == dated["start_ym"] // 12).all()


def test_dates_never_imputed_silently(built):
    _, roles, _, _, _ = built
    undated = roles[roles["start_ym"].isna()]
    assert undated["start_date"].isna().all() and undated["start_precision"].isna().all()
    year_only = roles["start_precision"].eq("year") | roles["end_precision"].eq("year")
    assert (roles["date_imputed"] == year_only).all()
    present = roles[roles["end_is_present"]]
    assert len(present) > 0
    assert present["end_ym"].isna().all()  # a Present end is never a fabricated date
    assert present.dropna(subset=["start_ym"])["months_to_asof"].notna().all()
    assert roles.loc[~roles["end_is_present"], "months_to_asof"].isna().all()


def test_purchase_position_partition(built):
    _, roles, persons, _, _ = built
    usable_ids = set(persons.loc[persons["is_usable"], "record_id"])
    r = roles[roles["record_id"].isin(usable_ids)]
    assert set(r["purchase_position"]) <= {"pre", "post", "purchase", "undated"}
    pre, post = r["is_pre_purchase"].fillna(False), r["is_post_purchase"].fillna(False)
    assert not (pre & post).any()
    assert (r.loc[r["purchase_position"] == "undated", "is_pre_purchase"].isna()).all()
    assert (r.loc[r["purchase_position"] == "purchase", "is_franchise_role"]).all()
    # composition months exist exactly on the pre-purchase basis roles
    assert r.loc[r["purchase_position"] == "pre", "composition_months"].notna().any()
    assert r.loc[r["purchase_position"] != "pre", "composition_months"].isna().all()
    # people without a purchase never get a pre/post call
    no_purchase = roles[~roles["record_id"].isin(set(persons.loc[persons["fr_start_ym"].notna(), "record_id"]))]
    assert no_purchase["is_pre_purchase"].isna().all()


def test_ownership_corporate_mutually_exclusive(built):
    _, roles, _, _, _ = built
    assert not (roles["is_ownership"] & roles["is_corporate"]).any()


def test_function_tags_single_label_with_tiers(built):
    _, roles, persons, _, _ = built
    assert set(roles["function_tag"]) <= set(lib_mod.FUNCTION_TAG_ORDER)
    assert (roles.loc[roles["functions"] == "", "function_tag"] == "other").all()
    # a role's tier is the person's tier in that role's tag, only on basis roles
    tagged = roles[roles["function_tier"].notna()]
    assert (tagged["purchase_position"] == "pre").all() and (tagged["function_tag"] != "other").all()
    merged = tagged.merge(persons[["record_id"] + [f"tier_{t}" for t in lib_mod.FUNCTION_TAG_ORDER if t != "other"]],
                          on="record_id")
    for tag in lib_mod.FUNCTION_TAG_ORDER[:-1]:
        sub = merged[merged["function_tag"] == tag]
        assert (sub["function_tier"] == sub[f"tier_{tag}"]).all()
    usable = persons[persons["is_usable"]]
    shares = usable[[f"share_{t}" for t in lib_mod.FUNCTION_TAG_ORDER]].fillna(0).sum(axis=1)
    assert ((shares - 1).abs() < 0.02)[usable["pre_months_total"] > 0].all()


def test_sector_tags_vocabulary_and_brand_precedence(built):
    _, roles, _, employers, _ = built
    segments = {b.segment for b in lib.load_brands()} | {lib_mod.UNCLASSIFIED}
    assert set(roles["sector_tag"]) <= segments
    at_brand = roles[roles["at_franchise_brand"]]
    assert (at_brand["sector_source"] == "brand").all()
    assert (at_brand["franchise_brand"] != "").all()
    assert set(roles["franchise_role_kind"]) <= {"", "owner", "staff", "franchisor", "excluded_entity"}
    # the review surface covers every employer string exactly once
    assert employers["company_norm"].is_unique
    assert employers["record_count"].sum() == (roles["company_norm"] != "").sum()


def test_cohorts_are_booleans_and_overlap_is_a_count(built):
    manifest, _, persons, _, tmp = built
    con = duckdb.connect(str(tmp / "frandev.duckdb"), read_only=True)
    ids = [r[0] for r in con.execute("SELECT DISTINCT cohort_id FROM cohorts ORDER BY 1").fetchall()]
    assert ids == ["facilities_owners", "green_owners", "restoration_owners"], "phase one is three cohorts"
    for cid in ids:
        members = {r[0] for r in con.execute("SELECT record_id FROM cohorts WHERE cohort_id = ?", [cid]).fetchall()}
        assert set(persons.loc[persons[f"cohort_{cid}"], "record_id"]) == members
        assert manifest["cohort_sizes"][cid] == len(members)
        assert persons.loc[persons[f"cohort_{cid}"], "screen_status"].eq("approved_candidate").all()
    assert (persons["cohort_count"] == persons[[f"cohort_{c}" for c in ids]].sum(axis=1)).all()
    pair = con.execute('SELECT count(*) FROM persons WHERE cohort_facilities_owners AND cohort_restoration_owners').fetchone()[0]
    assert pair == manifest["cohort_overlap"]["facilities_owners&restoration_owners"]
    con.close()


def test_career_path_partitions_usable_exactly_once(built):
    _, _, persons, _, _ = built
    usable = persons[persons["is_usable"]]
    allowed = set(FROZEN["career_path_counts"])
    assert usable["career_path"].notna().all()
    assert set(usable["career_path"].unique()) <= allowed
    assert persons.loc[~persons["is_usable"], "career_path"].isna().all()
    assert (usable["is_reentry"] == (usable["career_path"] == "owner_then_corporate")).all()


def test_golden_career_paths(built):
    _, _, persons, _, _ = built
    golden = pd.read_csv(GOLDEN)
    merged = golden.merge(persons, on="record_id", suffixes=("_gold", ""), how="left")
    assert merged["career_path"].notna().all(), "golden record missing from persons"
    for col in ["career_path", "n_pre_roles", "n_corp_after", "fr_start_ym"]:
        mism = merged[merged[f"{col}_gold"] != merged[col]]
        assert mism.empty, (
            f"golden mismatch on {col} for {list(mism['record_id'])} — "
            "hand-verified paths moved; a vocabulary change did this."
        )


def test_location_and_history_columns(built):
    _, _, persons, _, _ = built
    owners = persons[persons["population"] == "owner"]
    assert (owners["metro"] != "United States").all()
    assert not owners["metro"].str.contains("Greater .* Area", regex=True).any()
    assert (owners["dated_roles"] <= owners["n_roles"]).all()
    with_roles = owners[owners["n_roles"] > 0]
    assert ((with_roles["history_completeness"] >= 0) & (with_roles["history_completeness"] <= 1)).all()
    assert (owners["years_since_first_job"].dropna() >= 0).all()


# ------------------------------------------------- unit tests (no data needed)

def test_parse_ym():
    assert lib_mod.parse_ym("09/2004") == 2004 * 12 + 8
    assert lib_mod.parse_ym("2010") == 2010 * 12 + 5
    assert lib_mod.parse_ym_precision("2010") == (2010 * 12 + 5, "year")
    assert lib_mod.parse_ym_precision("09/2004")[1] == "month"
    assert lib_mod.parse_ym("Present") is None
    assert lib_mod.parse_ym("unknown") is None
    assert lib_mod.parse_ym("") is None
    assert lib_mod.parse_ym("13/2010") is None


def test_derive_location():
    assert lib_mod.derive_location("Greater Tucson Area", "Arizona") == ("Tucson", "Arizona", "Tucson, Arizona")
    assert lib_mod.derive_location("Dallas-Fort Worth Metroplex", "") == ("Dallas-Fort Worth", "", "Dallas-Fort Worth")
    assert lib_mod.derive_location("Metro Jacksonville", "Florida")[2] == "Jacksonville, Florida"
    assert lib_mod.derive_location("United States", "United States") == ("", "", "")
    assert lib_mod.derive_location("Cook County", "Illinois")[2] == "Cook County, Illinois"


def test_function_taxonomy_multilabel():
    vocab = lib_mod.load_vocab(lib.CONFIG_DIR)
    join = lambda t: " ".join(lib.tokens(t))
    tag = lambda t: {n for n, rx in vocab.functions.items() if rx.search(join(t))}
    assert {"sales", "marketing", "general_management"} <= tag("Sales & Marketing General Manager")
    assert "sales" in tag("Territory Sales Manager")
    assert "finance_accounting" not in tag("Owner")
    assert "trades_construction" in tag("Master Plumber")
    assert "software_it" in tag("Senior Software Developer")


def test_function_tag_precedence():
    vocab = lib_mod.load_vocab(lib.CONFIG_DIR)
    join = lambda t: " ".join(lib.tokens(t))
    fns = lambda t: [n for n, rx in vocab.functions.items() if rx.search(join(t))]
    assert vocab.function_tag(fns("VP of Sales"))[0] == "sales"
    assert vocab.function_tag(fns("Chief Financial Officer"))[0] == "finance"
    assert vocab.function_tag(fns("Operations Engineer"))[0] == "technical"
    assert vocab.function_tag(fns("General Manager"))[0] == "gm"
    assert vocab.function_tag(fns("Plant Manager"))[0] == "ops"
    assert vocab.function_tag(fns("Marketing Director"))[0] == "other"
    assert vocab.function_tag(fns("Owner")) == ("other", "")


def test_sector_classifier_examples():
    vocab = lib_mod.load_vocab(lib.CONFIG_DIR)
    join = lambda t: " ".join(lib.tokens(t))
    sec = lambda company, title="": vocab.sector(join(company), join(title))
    assert sec("BrightView Landscapes") == ("lawn_pest_outdoor", "employer")
    assert sec("Cintas") == ("facilities_b2b_services", "employer")
    assert sec("SERVPRO of North Raleigh") == ("restoration_cleaning", "employer")
    assert sec("ServiceMaster Clean") == ("facilities_b2b_services", "employer")
    assert sec("Acme Corp", "Registered Nurse") == ("senior_care_healthcare", "title")
    assert sec("Acme Corp", "Senior Vice President") == (lib_mod.UNCLASSIFIED, "")
    assert sec("Penske Truck Leasing") == (lib_mod.UNCLASSIFIED, "")
    assert sec("U.S. Army Contracting Command") == (lib_mod.UNCLASSIFIED, "")
    assert sec("College Pro") == ("painting_coatings", "employer")
    assert sec("Restore Hyper Wellness") == ("fitness_wellness", "employer")
    assert sec("Dollar Tree") == (lib_mod.UNCLASSIFIED, "")
    assert sec("Acme", "Independent Contractor") == (lib_mod.UNCLASSIFIED, "")


def test_background_tiers():
    fr = 2020 * 12
    mk = lambda start_y, end_y, fns, present=False: {
        "start_ym": start_y * 12, "end_ym": None if present else end_y * 12,
        "end_is_present": present, "fn_list": fns,
    }
    # 10 years of sales -> career; 2 years marketing -> touched-not-experienced
    rows, total = lib_mod.build_backgrounds(
        "x", [mk(2008, 2018, ["sales"]), mk(2018, 2020, ["marketing"])], fr, ["sales", "marketing"])
    by = {r["function"]: r for r in rows}
    assert by["sales"]["tier"] == 3 and by["sales"]["months_pre"] == 120
    assert by["marketing"]["tier"] == 1 and by["marketing"]["months_pre"] == 24
    assert total == 144
    # stale-Present role measured to franchise start; majority share -> career
    rows, total = lib_mod.build_backgrounds(
        "y", [mk(2016, None, ["operations"], present=True)], fr, ["operations"])
    assert rows[0]["months_pre"] == 48 and rows[0]["tier"] == 3


def test_vocab_precedence_and_exclusions():
    vocab = lib_mod.load_vocab(lib.CONFIG_DIR)
    join = lambda t: " ".join(lib.tokens(t))
    own_gm = join("Owner & General Manager")
    assert vocab.is_ownership(own_gm)
    assert not vocab.is_corporate(own_gm, True)  # ownership takes precedence
    assert not vocab.is_ownership(join("Product Owner"))
    assert not vocab.is_ownership(join("HR Business Partner"))
    assert not vocab.is_ownership(join("President"))  # the 545-vs-480 line in the sand
    assert vocab.is_corporate(join("President"), False)
    assert vocab.is_ownership(join("Managing Partner"))
    assert vocab.is_middle_mgmt(join("District Manager"))
    assert not vocab.is_middle_mgmt(join("Vice President & General Manager"))
