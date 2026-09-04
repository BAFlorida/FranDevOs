"""Cohort Lab query builder: identifiers come from the schema, values are bound,
the SQL box is SELECT-only with external access off — on a synthetic warehouse.
"""
import importlib
import os
import sys
from pathlib import Path

import pandas as pd
import pytest

from conftest import load_script

FIXTURES = Path(__file__).parent / "fixtures"
prep = load_script("09_prepare_comparison")
builder = load_script("07_build_warehouse")


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("lab")
    owners = prep.run(FIXTURES / "synthetic_comparison_export.csv", processed_dir=tmp / "o", outputs_dir=tmp / "oo")
    builder.run(input_path=Path(owners["stage04_file"]), warehouse_dir=tmp / "wh", outputs_dir=tmp / "wo")
    os.environ["COHORT_DATA_DIR"] = str(tmp / "wh")
    os.environ.pop("COHORT_USER", None)
    os.environ.pop("COHORT_PASSWORD", None)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "cohort_lab"))
    app_mod = importlib.import_module("app")
    app_mod.app.config["TESTING"] = True
    return app_mod.app.test_client(), app_mod


def test_pages_render(client):
    c, _ = client
    for url in ["/", "/explore", "/explore?t=roles", "/explore?t=employers", "/people", "/sql",
                "/q/q1", "/q/q2", "/q/q3", "/q/q4", "/q/q5", "/q/q6"]:
        r = c.get(url)
        assert r.status_code == 200, url
        assert 'class="error"' not in r.get_data(as_text=True) or url == "/q/q1", url  # q1 shows the empty-comparison banner


def test_unknown_column_and_operator_are_ignored_not_executed(client):
    c, mod = client
    s = mod.State.from_args(_args({"t": "persons", "fc": ["nope", "record_id"], "fo": ["is", "bogus"], "fv": ["x", "y"]}))
    assert s.filters == [] and len(s.errors) == 2
    r = c.get('/explore?t=persons&fc=record_id"; DROP TABLE persons; --&fo=is&fv=1')
    assert r.status_code == 200
    assert c.get("/explore?t=persons").status_code == 200  # table still there


def test_values_are_bound_parameters(client):
    _, mod = client
    s = mod.State.from_args(_args({"t": "persons", "fc": ["full_name"], "fo": ["is"], "fv": ["x' OR 1=1 --"]}))
    where, params = s.where()
    assert where == '"full_name" = ?' and params == ["x' OR 1=1 --"]
    r = mod.explore_query(s)
    assert r["rows_matching"] == 0
    assert "OR 1=1" in r["sql"]  # display copy inlines it, quoted
    assert "''" in r["sql"]


def test_group_by_and_drill_round_trip(client):
    c, mod = client
    s = mod.State.from_args(_args({"t": "persons", "g": ["screen_status"], "m": "count"}))
    r = mod.explore_query(s)
    assert r["bars"] and sum(b["value"] for b in r["bars"]) == r["rows_matching"]
    href = r["bars"][0]["href"]
    assert "fc=screen_status" in href and "g=" not in href.split("?")[1].replace("gb=", "")  # group dropped
    assert c.get(href).status_code == 200
    two = mod.State.from_args(_args({"t": "persons", "g": ["screen_status", "state"], "m": "count"}))
    r2 = mod.explore_query(two)
    cell = next(cell for row in r2["pivot"]["rows"] for cell in row["cells"] if cell["value"])
    assert cell["href"].count("fc=") == 2
    assert c.get(cell["href"]).status_code == 200


def test_numeric_bucket_and_between(client):
    _, mod = client
    s = mod.State.from_args(_args({"t": "persons", "g": ["years_since_first_job"], "gb": ["5"], "m": "count"}))
    r = mod.explore_query(s)
    assert "floor(" in r["sql"]
    bar = next(b for b in r["bars"] if b["label"] != "(blank)")
    assert "fo=between" in bar["href"]
    bad = mod.State.from_args(_args({"t": "persons", "fc": ["dated_roles"], "fo": ["between"], "fv": ["3"]}))
    with pytest.raises(ValueError):
        mod.explore_query(bad)


def test_sql_box_is_select_only_and_sandboxed(client):
    c, _ = client
    ok = c.post("/sql", data={"sql": "SELECT population, count(*) FROM persons GROUP BY 1"})
    assert ok.status_code == 200 and 'class="error"' not in ok.get_data(as_text=True)
    for bad in ["SELECT 1; SELECT 2", "ATTACH 'x.db'", "COPY persons TO 'x.csv'", "SET threads=1",
                "CREATE TABLE t AS SELECT 1", "SELECT * FROM read_text('/etc/passwd')",
                "SELECT * FROM read_parquet('/etc/passwd')", "INSTALL httpfs"]:
        r = c.post("/sql", data={"sql": bad})
        assert 'class="error"' in r.get_data(as_text=True), bad


def test_csv_exports_carry_their_sql(client):
    c, _ = client
    r = c.get("/explore.csv?t=persons&g=screen_status&m=count")
    text = r.get_data(as_text=True)
    assert text.startswith("# Cohort Lab export") and "# sql:" in text and "GROUP BY" in text
    r = c.get("/q/q3.csv")
    assert "cohort_a" in r.get_data(as_text=True)


def _args(d):
    from werkzeug.datastructures import MultiDict
    items = []
    for k, v in d.items():
        for x in (v if isinstance(v, list) else [v]):
            items.append((k, x))
    return MultiDict(items)
