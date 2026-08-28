"""Warehouse tests — the ones that would have caught the 545/480 discrepancy.

The frozen totals below are the calibrated 2026-08-28 build of
04_work_history_parsed.csv (input sha 789f9a43…). A vocabulary or logic change
that moves any of them is a *definition change* and must be made deliberately:
update the constant AND the golden file in the same commit, with a note.
"""
from pathlib import Path

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
    return manifest, roles, persons


def test_frozen_totals(built):
    manifest, _, _ = built
    for key, expected in FROZEN.items():
        assert manifest[key] == expected, (
            f"{key}: expected {expected}, got {manifest[key]} — a vocab/logic change "
            "moved a published figure; update FROZEN + golden file deliberately."
        )


def test_chronology(built):
    _, roles, _ = built
    both = roles.dropna(subset=["start_ym", "end_ym"])
    assert (both["end_ym"] >= both["start_ym"]).all()


def test_seq_contiguous_per_person(built):
    _, roles, _ = built
    bad = roles.groupby("record_id")["seq"].agg(lambda s: sorted(s) != list(range(len(s))))
    assert not bad.any()


def test_ownership_corporate_mutually_exclusive(built):
    _, roles, _ = built
    assert not (roles["is_ownership"] & roles["is_corporate"]).any()


def test_career_path_partitions_exactly_once(built):
    _, _, persons = built
    allowed = set(FROZEN["career_path_counts"])
    assert persons["career_path"].notna().all()
    assert set(persons["career_path"].unique()) <= allowed
    assert persons["career_path"].value_counts().sum() == len(persons)
    assert persons["record_id"].is_unique


def test_present_signal_preserved(built):
    _, roles, _ = built
    present = roles[roles["end_is_present"]]
    assert len(present) > 0
    assert present["end_ym"].isna().all()  # a Present end is never a fabricated date


def test_golden_career_paths(built):
    _, _, persons = built
    golden = pd.read_csv(GOLDEN)
    merged = golden.merge(persons, on="record_id", suffixes=("_gold", ""), how="left")
    assert merged["career_path"].notna().all(), "golden record missing from persons"
    for col in ["career_path", "n_pre_roles", "n_corp_after", "fr_start_ym"]:
        mism = merged[merged[f"{col}_gold"] != merged[col]]
        assert mism.empty, (
            f"golden mismatch on {col} for {list(mism['record_id'])} — "
            "hand-verified paths moved; a vocabulary change did this."
        )


# ------------------------------------------------- unit tests (no data needed)

def test_parse_ym():
    assert lib_mod.parse_ym("09/2004") == 2004 * 12 + 8
    assert lib_mod.parse_ym("2010") == 2010 * 12 + 5
    assert lib_mod.parse_ym("Present") is None
    assert lib_mod.parse_ym("unknown") is None
    assert lib_mod.parse_ym("") is None
    assert lib_mod.parse_ym("13/2010") is None


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
