"""The comparison population loads as a GROUP BY, not a rebuild.

A synthetic seven-person Clay export (no real people) runs through the same
stages 01-04 as the owners, then the builder loads it with
population='comparison' next to a tiny synthetic owner file. Checks: the
enum, the tenure basis (all dated roles, measured to as_of), contaminant
handling (an approved-owner lookalike is kept but excluded from every
basis), and that the population column reaches every table.
"""
from pathlib import Path

import duckdb
import pandas as pd
import pytest

from conftest import load_script

FIXTURES = Path(__file__).parent / "fixtures"
EXPORT = FIXTURES / "synthetic_comparison_export.csv"

prep = load_script("09_prepare_comparison")
builder = load_script("07_build_warehouse")


@pytest.fixture(scope="module")
def warehouse(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("cmp")
    # the same synthetic file plays both roles: as "owners" it yields one approved
    # owner (Delta) and, as the comparison sample, everyone but Delta is usable
    owners = prep.run(EXPORT, processed_dir=tmp / "owners", outputs_dir=tmp / "owners_out")
    cmp = prep.run(EXPORT, processed_dir=tmp / "cmp", outputs_dir=tmp / "cmp_out")
    manifest = builder.run(
        input_path=Path(owners["stage04_file"]), comparison_path=Path(cmp["stage04_file"]),
        warehouse_dir=tmp / "wh", outputs_dir=tmp / "wh_out")
    persons = pd.read_parquet(tmp / "wh" / "persons.parquet")
    roles = pd.read_parquet(tmp / "wh" / "roles.parquet")
    return manifest, persons, roles, tmp / "wh"


def test_stage_pipeline_screens_the_lookalike(warehouse):
    manifest, persons, _, _ = warehouse
    # Golf is Canada -> dropped by stage 01; six US people remain per population
    assert manifest["persons_total"] == 6 and manifest["comparison_persons"] == 6
    cmp = persons[persons["population"] == "comparison"].set_index("full_name")
    assert cmp.loc["Test Delta", "usable_reason"] == "screened_as_owner"
    assert not cmp.loc["Test Delta", "is_usable"]
    assert cmp.loc["Test Alpha", "is_usable"] and cmp.loc["Test Bravo", "is_usable"]
    assert cmp.loc["Test Echo", "usable_reason"] == "no_history"
    assert manifest["comparison_usable"] == 4


def test_population_enum_everywhere(warehouse):
    _, persons, roles, wh = warehouse
    assert set(persons["population"]) == {"owner", "comparison"}
    assert set(roles["population"]) == {"owner", "comparison"}
    con = duckdb.connect(str(wh / "frandev.duckdb"), read_only=True)
    by_pop = dict(con.execute("SELECT population, count(*) FROM persons WHERE is_usable GROUP BY 1").fetchall())
    assert by_pop == {"owner": 1, "comparison": 4}
    # cohorts are owners-only by definition
    assert con.execute("SELECT count(*) FROM cohorts c JOIN persons p USING (record_id) "
                       "WHERE p.population = 'comparison'").fetchone()[0] == 0
    con.close()


def test_comparison_tenure_basis_is_the_whole_career(warehouse):
    _, persons, roles, _ = warehouse
    cmp_roles = roles[roles["population"] == "comparison"]
    assert (cmp_roles["purchase_position"] == "no_purchase").all()
    assert cmp_roles["is_pre_purchase"].isna().all()
    alpha = persons[(persons["population"] == "comparison") & (persons["full_name"] == "Test Alpha")].iloc[0]
    # 2006(June)-2009/12 + 2010/01-2016/02 + 2016/03-as_of(2026/08): all sales
    assert alpha["tier_sales"] == 3 and alpha["share_sales"] == 1.0
    a_roles = cmp_roles[cmp_roles["record_id"] == alpha["record_id"]]
    assert a_roles["composition_months"].notna().all()
    assert a_roles.loc[a_roles["end_is_present"], "composition_months"].iloc[0] == 24319 - (2016 * 12 + 2)
    assert a_roles["date_imputed"].sum() == 1  # the year-only 2006 start
    assert alpha["metro"] == "Tucson, Arizona"


def test_owner_side_unchanged_by_comparison_load(warehouse):
    _, persons, _, _ = warehouse
    own = persons[persons["population"] == "owner"].set_index("full_name")
    assert own.loc["Test Delta", "is_usable"] and own.loc["Test Delta", "career_path"] == "no_prior_ownership"
    assert own.loc["Test Delta", "brand_segment"] == "residential_cleaning"
    assert own.loc["Test Alpha", "usable_reason"] == "not_approved"
