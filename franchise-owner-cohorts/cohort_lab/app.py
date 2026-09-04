"""Cohort Lab — click-to-explore layer over the owner warehouse.

Flask + DuckDB (in-memory) over the warehouse tables persons / roles /
employers / cohorts. Four ways in, all on the same data:

    /explore   query builder: table, filters, group-by (<=2, with bucketing),
               measure, sort, limit; bars for one group, a pivot for two;
               every bar / cell / text value is a link that ADDS that filter
               (click-to-filter); the generating SQL is on screen; CSV export.
    /q/<id>    saved questions from questions/*.sql, rendered as bars or a
               matrix whose cells drill into /explore; CSV with the SQL.
    /people    the seed-list finder (role-level filters + funnel + sample).
    /sql       a read-only SELECT box for anything the builder can't say.

Every executed statement is parameterized; identifiers are validated against
the live schema; the SQL shown on screen is a display copy. External access
is switched off on the DuckDB connection after the tables load, so the SQL
box cannot read files or attach databases.

Data: COHORT_DATA_DIR (parquet dir) if set; else deploy/*.parquet (local,
gitignored); else ../data/warehouse; else the committed deploy/*.parquet.enc
decrypted at boot with COHORT_DATA_KEY (Fernet). Plaintext people data never
lives in git — the containing repo is public.

Auth: HTTP Basic from COHORT_USER / COHORT_PASSWORD. On Render (RENDER env
set) both are required at startup; locally, unset means auth is off for dev.
"""
from __future__ import annotations

import csv
import datetime as dt
import hmac
import io
import json
import math
import os
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlencode

import duckdb
from flask import Flask, Response, abort, redirect, render_template, request, url_for

BASE = Path(__file__).resolve().parent
DEPLOY = BASE / "deploy"
QUESTIONS_DIR = BASE / "questions"
TABLE_FILES = ("persons", "roles", "employers", "cohorts")
SAMPLE_LIMIT = 25
TOP_TITLES_LIMIT = 15
EXPLORE_DEFAULT_LIMIT = 50
EXPLORE_MAX_LIMIT = 2000
EXPORT_MAX_ROWS = 50000
SQL_MAX_ROWS = 1000
QUERY_TIMEOUT_S = 25

IS_RENDER = bool(os.environ.get("RENDER"))
AUTH_USER = os.environ.get("COHORT_USER", "")
AUTH_PASS = os.environ.get("COHORT_PASSWORD", "")
if IS_RENDER and not (AUTH_USER and AUTH_PASS):
    raise RuntimeError("COHORT_USER and COHORT_PASSWORD must be set when running on Render")


# ------------------------------------------------------------------- data

def _ensure_data() -> Path:
    env = os.environ.get("COHORT_DATA_DIR", "").strip()
    candidates = [Path(env)] if env else [DEPLOY, BASE.parent / "data" / "warehouse"]
    for d in candidates:
        if all((d / f"{t}.parquet").exists() for t in TABLE_FILES):
            return d
    if env:
        raise RuntimeError(f"COHORT_DATA_DIR={env} lacks {', '.join(f'{t}.parquet' for t in TABLE_FILES)}")
    enc = [DEPLOY / f"{t}.parquet.enc" for t in TABLE_FILES]
    if not all(p.exists() for p in enc):
        raise RuntimeError("no deploy data found — run prepare_deploy.py first")
    key = os.environ.get("COHORT_DATA_KEY", "")
    if not key:
        raise RuntimeError("COHORT_DATA_KEY is required to decrypt deploy/*.parquet.enc")
    from cryptography.fernet import Fernet

    fernet = Fernet(key.encode())
    out = Path("/tmp/cohort_lab_data")
    out.mkdir(parents=True, exist_ok=True)
    for path in enc:
        (out / path.name.removesuffix(".enc")).write_bytes(fernet.decrypt(path.read_bytes()))
    return out


DATA_DIR = _ensure_data()
_root = duckdb.connect()
for _t in TABLE_FILES:
    _root.execute(f"CREATE TABLE {_t} AS SELECT * FROM read_parquet('{DATA_DIR / f'{_t}.parquet'}')")
# the tables are in memory now; nothing after this point may touch the filesystem
_root.execute("SET enable_external_access = false")
_root.execute("SET lock_configuration = true")
_root_lock = threading.Lock()


def _kind(data_type: str) -> str:
    t = data_type.upper()
    if t == "BOOLEAN":
        return "bool"
    if t in ("DATE", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE"):
        return "date"
    if any(k in t for k in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "num"
    return "text"


@dataclass
class Table:
    name: str
    label: str
    blurb: str
    default_cols: list[str]
    default_sort: str
    people_expr: str
    people_label: str
    columns: dict[str, str] = field(default_factory=dict)  # name -> kind


TABLES: dict[str, Table] = {
    "persons": Table(
        "persons", "People", "one row per person; every record kept, is_usable flags who has a "
        "computable pre-purchase career; composition, longest role, affinity and cohort flags baked in",
        ["record_id", "population", "full_name", "job_title", "canonical_brand", "brand_segment", "metro",
         "franchise_purchase_year", "career_path", "is_usable", "longest_pre_function", "longest_pre_sector",
         "sector_affinity", "cohort_flags"],
        "record_id", 'count(*)', "people"),
    "roles": Table(
        "roles", "Roles", "one row per person per job — the grain; dates preserved (nulls kept), "
        "function_tag / sector_tag / brand tags, position relative to the purchase",
        ["record_id", "seq", "title", "company", "start_date", "end_date", "end_is_present", "duration_mo",
         "function_tag", "sector_tag", "is_ownership", "at_franchise_brand", "franchise_brand", "purchase_position"],
        "record_id", 'count(DISTINCT "record_id")', "people (distinct)"),
    "employers": Table(
        "employers", "Employers", "one row per normalized employer string — the classifier review surface; "
        "sort ascending by record_count to read the tail",
        ["company", "record_count", "person_count", "sector_tag", "sector_source", "is_franchise_brand",
         "franchise_brand", "brand_segment", "entity_kind", "top_titles"],
        "record_count", 'sum("person_count")', "people (sum of per-employer counts)"),
}
for _tbl in TABLES.values():
    _tbl.columns = {
        name: _kind(dtype) for name, dtype in _root.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position",
            [_tbl.name]).fetchall()
    }
    _tbl.default_cols = [c for c in _tbl.default_cols if c in _tbl.columns]

COUNTS = {
    "records": _root.execute("SELECT count(*) FROM persons WHERE population = 'owner'").fetchone()[0],
    "approved": _root.execute(
        "SELECT count(*) FROM persons WHERE population = 'owner' AND screen_status = 'approved_candidate'").fetchone()[0],
    "with_history": _root.execute("SELECT count(*) FROM persons WHERE population = 'owner' AND n_roles > 0").fetchone()[0],
    "usable": _root.execute("SELECT count(*) FROM persons WHERE population = 'owner' AND is_usable").fetchone()[0],
    "comparison": _root.execute("SELECT count(*) FROM persons WHERE population = 'comparison'").fetchone()[0],
    "comparison_usable": _root.execute(
        "SELECT count(*) FROM persons WHERE population = 'comparison' AND is_usable").fetchone()[0],
    "roles": _root.execute("SELECT count(*) FROM roles").fetchone()[0],
    "employers": _root.execute("SELECT count(*) FROM employers").fetchone()[0],
}
BASE_COUNT = COUNTS["usable"]
COHORT_COLS = [c for c in TABLES["persons"].columns if c.startswith("cohort_") and c not in ("cohort_flags", "cohort_count")]
SEGMENTS = [r[0] for r in _root.execute(
    "SELECT DISTINCT brand_segment FROM persons WHERE brand_segment <> '' ORDER BY 1").fetchall()]
CAREER_PATHS = [r[0] for r in _root.execute(
    "SELECT DISTINCT career_path FROM persons WHERE career_path IS NOT NULL ORDER BY 1").fetchall()]
YEAR_RANGE = _root.execute(
    "SELECT min(franchise_purchase_year), max(franchise_purchase_year) FROM persons WHERE is_usable").fetchone()

app = Flask(__name__)


@app.before_request
def _basic_auth():
    if request.path == "/healthz" or not (AUTH_USER and AUTH_PASS):
        return None
    auth = request.authorization
    ok = (
        auth is not None
        and auth.type == "basic"
        and hmac.compare_digest((auth.username or "").encode("utf-8", "replace"), AUTH_USER.encode())
        and hmac.compare_digest((auth.password or "").encode("utf-8", "replace"), AUTH_PASS.encode())
    )
    if not ok:
        return Response("authentication required", 401, {"WWW-Authenticate": 'Basic realm="Cohort Lab"'})
    return None


# ---------------------------------------------------------------- helpers

def run_sql(sql: str, params: list | None = None, timeout: float = QUERY_TIMEOUT_S):
    """Execute on a cursor with an interrupt timer. -> (columns, rows)."""
    cur = _root.cursor()
    timer = threading.Timer(timeout, cur.interrupt)
    timer.start()
    try:
        res = cur.execute(sql, params or [])
        cols = [d[0] for d in res.description]
        rows = res.fetchall()
    finally:
        timer.cancel()
        cur.close()
    return cols, rows


def inline_sql(sql: str, params: list) -> str:
    """Display/export copy of the executed statement, parameters inlined.
    Execution always uses bound parameters; this string is never executed."""
    out, i = [], 0
    for ch in sql:
        if ch == "?" and i < len(params):
            v = params[i]
            i += 1
            if isinstance(v, bool):
                out.append("TRUE" if v else "FALSE")
            elif isinstance(v, (int, float)):
                out.append(str(v))
            elif isinstance(v, (dt.date, dt.datetime)):
                out.append(f"DATE '{v.isoformat()}'")
            else:
                out.append("'" + str(v).replace("'", "''") + "'")
        else:
            out.append(ch)
    return "".join(out)


def norm(text: str) -> str:
    """Same token-join normalization the warehouse uses for *_norm columns."""
    return " ".join(re.findall(r"[a-z0-9]+", (text or "").lower()))


def csv_response(cols, rows, sql_text: str, name: str, note: dict | None = None) -> Response:
    buf = io.StringIO()
    buf.write("# Cohort Lab export\n")
    buf.write(f"# generated: {dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}\n")
    buf.write(f"# rows: {len(rows)}\n")
    if note:
        buf.write(f"# context: {json.dumps(note, ensure_ascii=False, default=str)}\n")
    buf.write("# sql:\n")
    for line in sql_text.splitlines():
        buf.write(f"#   {line}\n")

    def cell(v):
        # neutralize spreadsheet formula auto-execution in third-party-authored text
        if isinstance(v, str) and v[:1] in ("=", "+", "-", "@"):
            return "'" + v
        return v

    writer = csv.writer(buf)
    writer.writerow(cols)
    writer.writerows([[cell(v) for v in row] for row in rows])
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={name}_{stamp}.csv"})


def fmt_ym(v):
    if v is None:
        return ""
    v = int(v)
    return f"{v // 12}-{v % 12 + 1:02d}"


def fmt_num(v):
    if v is None:
        return "—"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return f"{v:,}"
    if isinstance(v, float):
        if math.isnan(v):
            return "—"
        return f"{v:,.2f}".rstrip("0").rstrip(".") if abs(v) < 1e6 else f"{v:,.0f}"
    return str(v)


app.jinja_env.filters["ym"] = fmt_ym
app.jinja_env.filters["num"] = fmt_num


# ---------------------------------------------------------------- explore

OPS = {
    "text": {
        "is": ('"{c}" = ?', 1, "is"), "is_not": ('"{c}" <> ?', 1, "is not"),
        "contains": ('contains(lower("{c}"), lower(?))', 1, "contains"),
        "not_contains": ('NOT contains(lower("{c}"), lower(?))', 1, "does not contain"),
        "starts": ('starts_with(lower("{c}"), lower(?))', 1, "starts with"),
        "in": ('"{c}" IN ({ph})', "list", "is one of (comma-separated)"),
        "empty": ('("{c}" IS NULL OR "{c}" = \'\')', 0, "is empty"),
        "not_empty": ('("{c}" IS NOT NULL AND "{c}" <> \'\')', 0, "is not empty"),
    },
    "num": {
        "eq": ('"{c}" = ?', 1, "="), "ne": ('"{c}" <> ?', 1, "≠"), "ge": ('"{c}" >= ?', 1, "≥"),
        "gt": ('"{c}" > ?', 1, ">"), "le": ('"{c}" <= ?', 1, "≤"), "lt": ('"{c}" < ?', 1, "<"),
        "between": ('"{c}" BETWEEN ? AND ?', 2, "between (a,b)"),
        "null": ('"{c}" IS NULL', 0, "is blank"), "not_null": ('"{c}" IS NOT NULL', 0, "is not blank"),
    },
    "bool": {
        "true": ('"{c}" = TRUE', 0, "is true"), "false": ('"{c}" = FALSE', 0, "is false"),
        "null": ('"{c}" IS NULL', 0, "is blank"),
    },
}
OPS["date"] = OPS["num"]
MEASURES = ["count", "people", "avg", "sum", "median", "min", "max"]
SORTS = {"value_desc": "value, high to low", "value_asc": "value, low to high",
         "group_asc": "group, A→Z", "group_desc": "group, Z→A"}
BUCKETS = ["", "1", "2", "5", "10", "12", "25", "100", "1000"]


def _parse_value(kind: str, raw: str):
    raw = (raw or "").strip()
    if kind == "num":
        try:
            f = float(raw)
        except ValueError:
            raise ValueError(f"'{raw}' is not a number")
        return int(f) if f.is_integer() else f
    if kind == "date":
        try:
            return dt.date.fromisoformat(raw)
        except ValueError:
            raise ValueError(f"'{raw}' is not a date (YYYY-MM-DD)")
    return raw


@dataclass
class Filter:
    col: str
    op: str
    val: str

    def clause(self, kind: str) -> tuple[str, list]:
        template, arity, _ = OPS[kind][self.op]
        if arity == 0:
            return template.format(c=self.col), []
        if arity == "list":
            items = [x.strip() for x in self.val.split(",") if x.strip()]
            if not items:
                raise ValueError(f"{self.col}: give at least one value")
            return template.format(c=self.col, ph=", ".join("?" for _ in items)), [_parse_value(kind, x) for x in items]
        if arity == 2:
            parts = [x.strip() for x in self.val.split(",")]
            if len(parts) != 2:
                raise ValueError(f"{self.col}: 'between' needs two values, e.g. 2015,2020")
            return template.format(c=self.col), [_parse_value(kind, parts[0]), _parse_value(kind, parts[1])]
        return template.format(c=self.col), [_parse_value(kind, self.val)]

    def label(self, kind: str) -> str:
        _, arity, words = OPS[kind][self.op]
        return f"{self.col} {words}" if arity == 0 else f"{self.col} {words} {self.val}"


@dataclass
class Group:
    col: str
    bucket: str = ""

    def expr(self, kind: str) -> str:
        if kind == "num" and self.bucket:
            b = int(self.bucket)
            return f'(floor("{self.col}" / {b}) * {b})::BIGINT'
        if kind == "date":
            return f'year("{self.col}")'
        return f'"{self.col}"'

    def label(self, kind: str) -> str:
        if kind == "num" and self.bucket:
            return f"{self.col} (buckets of {self.bucket})"
        if kind == "date":
            return f"{self.col} (year)"
        return self.col


@dataclass
class State:
    table: str = "persons"
    filters: list[Filter] = field(default_factory=list)
    groups: list[Group] = field(default_factory=list)
    measure: str = "count"
    measure_col: str = ""
    sort: str = "value_desc"
    limit: int = EXPLORE_DEFAULT_LIMIT
    order_by: str = ""
    order_dir: str = "asc"
    all_cols: bool = False
    errors: list[str] = field(default_factory=list)

    @property
    def t(self) -> Table:
        return TABLES[self.table]

    # ---- (de)serialization: everything lives in the URL -----------------
    @classmethod
    def from_args(cls, args) -> "State":
        s = cls()
        s.table = args.get("t") if args.get("t") in TABLES else "persons"
        cols = s.t.columns
        for c, o, v in zip(args.getlist("fc"), args.getlist("fo"), args.getlist("fv")):
            if c in cols and o in OPS[cols[c]]:
                s.filters.append(Filter(c, o, v))
            elif c:
                s.errors.append(f"ignored filter on unknown column/operator: {c} {o}")
        for c, b in zip(args.getlist("g"), args.getlist("gb") + ["", ""]):
            if c in cols and len(s.groups) < 2 and c not in [g.col for g in s.groups]:
                s.groups.append(Group(c, b if b in BUCKETS else ""))
        m = args.get("m", "count")
        s.measure = m if m in MEASURES else "count"
        mc = args.get("mc", "")
        s.measure_col = mc if (mc in cols and cols[mc] == "num") else ""
        if s.measure not in ("count", "people") and not s.measure_col:
            s.measure = "count"
        s.sort = args.get("s") if args.get("s") in SORTS else "value_desc"
        try:
            s.limit = max(1, min(EXPLORE_MAX_LIMIT, int(args.get("n", EXPLORE_DEFAULT_LIMIT))))
        except ValueError:
            s.limit = EXPLORE_DEFAULT_LIMIT
        ob = args.get("ob", "")
        s.order_by = ob if ob in cols else ""
        s.order_dir = "desc" if args.get("od") == "desc" else "asc"
        s.all_cols = args.get("all") == "1"
        return s

    def params(self, **over) -> list[tuple[str, str]]:
        p = [("t", self.table)]
        for f in self.filters:
            p += [("fc", f.col), ("fo", f.op), ("fv", f.val)]
        for g in self.groups:
            p += [("g", g.col), ("gb", g.bucket)]
        p += [("m", self.measure)]
        if self.measure_col:
            p.append(("mc", self.measure_col))
        p += [("s", self.sort), ("n", str(self.limit))]
        if self.order_by:
            p += [("ob", self.order_by), ("od", self.order_dir)]
        if self.all_cols:
            p.append(("all", "1"))
        for k, v in over.items():
            p = [kv for kv in p if kv[0] != k]
            if v is not None:
                p.append((k, v))
        return p

    def url(self, endpoint: str = "explore", **over) -> str:
        path = {"explore": "/explore", "explore_csv": "/explore.csv"}[endpoint]
        return path + "?" + urlencode(self.params(**over))

    def _copy(self, filters=None, groups=None) -> "State":
        return State(self.table, list(self.filters) if filters is None else filters,
                     list(self.groups) if groups is None else groups, self.measure, self.measure_col,
                     self.sort, self.limit, self.order_by, self.order_dir, self.all_cols)

    def added(self, col: str, op: str, val, drop_group: str | None = None) -> "State":
        s = self._copy(groups=[g for g in self.groups if g.col != drop_group])
        s.filters.append(Filter(col, op, "" if val is None else str(val)))
        return s

    def with_filter(self, col: str, op: str, val, drop_group: str | None = None) -> str:
        return self.added(col, op, val, drop_group).url()

    def without_filter(self, idx: int) -> str:
        return self._copy(filters=[f for i, f in enumerate(self.filters) if i != idx]).url()

    def without_group(self, col: str) -> str:
        return self._copy(groups=[g for g in self.groups if g.col != col]).url()

    def drilled(self, group: Group, value) -> "State":
        """Click on a bar/cell: add the filter that reproduces it and drop that group."""
        kind = self.t.columns[group.col]
        if value is None:
            return self.added(group.col, "null", "", drop_group=group.col)
        if kind == "num" and group.bucket:
            b = int(group.bucket)
            hi = int(value) + b - 1 if b > 1 else int(value)
            return self.added(group.col, "between", f"{int(value)},{hi}", drop_group=group.col)
        if kind == "bool":
            return self.added(group.col, "true" if value else "false", "", drop_group=group.col)
        if kind == "date":
            return self.added(group.col, "between", f"{int(value)}-01-01,{int(value)}-12-31", drop_group=group.col)
        return self.added(group.col, "eq" if kind == "num" else "is", value, drop_group=group.col)

    def drill(self, group: Group, value) -> str:
        return self.drilled(group, value).url()

    # ---- SQL ----------------------------------------------------------------
    def where(self) -> tuple[str, list]:
        clauses, params = [], []
        for f in self.filters:
            sql, p = f.clause(self.t.columns[f.col])
            clauses.append(sql)
            params.extend(p)
        return (" AND ".join(clauses) if clauses else "TRUE"), params

    def measure_expr(self) -> tuple[str, str]:
        if self.measure == "count":
            return "count(*)", "rows"
        if self.measure == "people":
            return self.t.people_expr, self.t.people_label
        return f'{self.measure}("{self.measure_col}")', f"{self.measure} of {self.measure_col}"

    def filter_labels(self) -> list[str]:
        return [f.label(self.t.columns[f.col]) for f in self.filters]


def explore_query(s: State) -> dict:
    where, params = s.where()
    mexpr, mlabel = s.measure_expr()
    out: dict = {"measure_label": mlabel, "errors": list(s.errors)}
    total_cols, total_rows = run_sql(f'SELECT count(*), {s.t.people_expr} FROM {s.table} WHERE {where}', params)
    out["rows_matching"], out["people_matching"] = total_rows[0]
    if s.groups:
        gexprs = [g.expr(s.t.columns[g.col]) for g in s.groups]
        gsel = ", ".join(f"{e} AS g{i + 1}" for i, e in enumerate(gexprs))
        order = {"value_desc": "value DESC NULLS LAST", "value_asc": "value ASC NULLS LAST",
                 "group_asc": "g1 ASC NULLS LAST" + (", g2 ASC NULLS LAST" if len(s.groups) > 1 else ""),
                 "group_desc": "g1 DESC NULLS LAST" + (", g2 DESC NULLS LAST" if len(s.groups) > 1 else "")}[s.sort]
        sql = (f"SELECT {gsel}, {mexpr} AS value\nFROM {s.table}\nWHERE {where}\n"
               f"GROUP BY {', '.join(str(i + 1) for i in range(len(s.groups)))}\nORDER BY {order}\nLIMIT {s.limit}")
        cols, rows = run_sql(sql, params)
        tcols, trows = run_sql(f"SELECT {mexpr} FROM {s.table} WHERE {where}", params)
        base_total = trows[0][0] or 0
        out.update(sql=inline_sql(sql, params), columns=cols, rows=rows, base_total=base_total,
                   pct_meaningful=s.measure in ("count", "people"))
        if len(s.groups) == 1:
            vals = [r[1] for r in rows if r[1] is not None]
            vmax = max(vals) if vals else 0
            out["bars"] = [{
                "label": "(blank)" if r[0] is None else str(r[0]), "value": r[1],
                "width": (100.0 * r[1] / vmax) if (vmax and r[1] is not None and r[1] > 0) else 0,
                "pct": (100.0 * r[1] / base_total) if (base_total and r[1] is not None and out["pct_meaningful"]) else None,
                "href": s.drill(s.groups[0], r[0]),
            } for r in rows]
        else:
            row_keys, col_keys, cells = [], {}, {}
            row_tot, col_tot = {}, {}
            for g1, g2, v in rows:
                cells[(g1, g2)] = v
                row_tot[g1] = row_tot.get(g1, 0) + (v or 0)
                col_tot[g2] = col_tot.get(g2, 0) + (v or 0)
            row_keys = sorted(row_tot, key=lambda k: -row_tot[k])[:40] if s.sort.startswith("value") else \
                sorted(row_tot, key=lambda k: (k is None, k))
            col_keys = sorted(col_tot, key=lambda k: -col_tot[k])[:12] if s.sort.startswith("value") else \
                sorted(col_tot, key=lambda k: (k is None, k))[:12]
            vmax = max((v for v in cells.values() if v is not None), default=0)
            out["pivot"] = {
                "cols": [("(blank)" if c is None else str(c)) for c in col_keys],
                "rows": [{
                    "label": "(blank)" if r is None else str(r),
                    "href": s.drill(s.groups[0], r),
                    "total": row_tot[r],
                    "cells": [{
                        "value": cells.get((r, c)),
                        "alpha": (0.08 + 0.72 * (cells[(r, c)] / vmax)) if (vmax and cells.get((r, c))) else 0,
                        "href": s.drilled(s.groups[0], r).drilled(s.groups[1], c).url(),
                    } for c in col_keys],
                } for r in row_keys],
                "truncated": len(col_tot) > len(col_keys) or len(row_tot) > len(row_keys),
            }
    else:
        cols_shown = list(s.t.columns) if s.all_cols else s.t.default_cols
        ob = s.order_by or s.t.default_sort
        sql = (f'SELECT {", ".join(chr(34) + c + chr(34) for c in cols_shown)}\nFROM {s.table}\nWHERE {where}\n'
               f'ORDER BY "{ob}" {s.order_dir.upper()} NULLS LAST\nLIMIT {s.limit}')
        cols, rows = run_sql(sql, params)
        out.update(sql=inline_sql(sql, params), columns=cols, rows=rows, kinds=[s.t.columns[c] for c in cols],
                   order_by=ob)
    return out


@app.get("/explore")
def explore():
    s = State.from_args(request.args)
    try:
        r = explore_query(s)
    except ValueError as e:
        r = {"errors": s.errors + [str(e)], "rows_matching": None, "people_matching": None,
             "columns": [], "rows": [], "sql": "", "measure_label": ""}
    except duckdb.Error as e:
        r = {"errors": s.errors + [f"query failed: {e}"], "rows_matching": None, "people_matching": None,
             "columns": [], "rows": [], "sql": "", "measure_label": ""}
    return render_template("explore.html", s=s, r=r, tables=TABLES, ops=OPS, measures=MEASURES,
                           sorts=SORTS, buckets=BUCKETS, filter_labels=s.filter_labels())


@app.get("/explore.csv")
def explore_csv():
    s = State.from_args(request.args)
    s.limit = EXPORT_MAX_ROWS
    try:
        r = explore_query(s)
    except (ValueError, duckdb.Error) as e:
        abort(400, str(e))
    return csv_response(r["columns"], r["rows"], r["sql"], f"explore_{s.table}",
                        {"table": s.table, "filters": s.filter_labels(), "groups": [g.col for g in s.groups],
                         "measure": r["measure_label"]})


# -------------------------------------------------------------- questions

def _load_questions() -> dict:
    qs = {}
    for path in sorted(QUESTIONS_DIR.glob("q*.sql")):
        text = path.read_text(encoding="utf-8")
        title, desc = path.stem, []
        for line in text.splitlines():
            if not line.startswith("--"):
                break
            body = line[2:].strip()
            if body.startswith("title:"):
                title = body[6:].strip()
            elif body:
                desc.append(body)
        qid = path.stem.split("_")[0]
        qs[qid] = {"id": qid, "file": path.name, "title": title, "description": " ".join(desc), "sql": text}
    return qs


QUESTIONS = _load_questions()


def _explore_url(table: str, filters: list[tuple[str, str, str]], groups: list[str] | None = None,
                 measure: str = "count", order_by: str = "", order_dir: str = "asc", limit: int = 50) -> str:
    s = State(table, [Filter(*f) for f in filters], [Group(g) for g in (groups or [])], measure)
    s.order_by, s.order_dir, s.limit = order_by, order_dir, limit
    return s.url()


def _matrix(rows, row_key, col_key, val_key, mode="seq", label_key=None, drill=None, row_order=None, col_order=None):
    """Long rows -> matrix spec for the template. mode: 'seq' (single-hue
    magnitude) or 'lift' (diverging around 1.0, blue above, red below)."""
    rk, ck, cells, labels = [], [], {}, {}
    for r in rows:
        a, b, v = r[row_key], r[col_key], r[val_key]
        if a not in rk:
            rk.append(a)
        if b not in ck:
            ck.append(b)
        cells[(a, b)] = v
        if label_key:
            labels[(a, b)] = r[label_key]
    if row_order:
        rk = sorted(rk, key=row_order)
    if col_order:
        ck = sorted(ck, key=col_order)
    vals = [v for v in cells.values() if v is not None]
    vmax = max(vals) if vals else 0

    def alpha(v):
        if v is None:
            return 0
        if mode == "lift":
            return min(0.85, 0.1 + 0.75 * abs(math.log(max(v, 1e-9))) / math.log(4))
        return 0.08 + 0.72 * (v / vmax) if vmax else 0

    return {
        "cols": [str(c) for c in ck],
        "rows": [{
            "label": str(a),
            "cells": [{
                "value": cells.get((a, b)), "sub": labels.get((a, b)),
                "alpha": alpha(cells.get((a, b))),
                "tone": ("neg" if (mode == "lift" and cells.get((a, b)) is not None and cells[(a, b)] < 1) else "pos"),
                "href": drill(a, b) if (drill and cells.get((a, b)) is not None) else None,
            } for b in ck],
        } for a in rk],
    }


def render_question(qid: str) -> tuple[dict, list[str], list[tuple]]:
    q = QUESTIONS[qid]
    cols, rows = run_sql(q["sql"])
    recs = [dict(zip(cols, r)) for r in rows]
    view: dict = {"kind": "table"}
    if qid == "q1":
        view = {"kind": "table", "comparison_loaded": COUNTS["comparison_usable"] > 0,
                "matrix": _matrix(recs, "function_tag", "tier_label", "owners_pct", "seq",
                                  drill=lambda fn, tl: _explore_url("persons", [
                                      ("population", "is", "owner"), ("is_usable", "true", ""),
                                      (f"tier_{fn}", "ge", str({"touched (any role)": 1, "experienced (3y+)": 2,
                                                               "career (7y+ or majority)": 3}[tl]))]))}
    elif qid == "q2":
        view = {"kind": "matrix", "matrix": _matrix(
            recs, "pre_purchase_sector", "purchased_segment", "lift", "lift", label_key="people",
            drill=lambda sec, seg: _explore_url("persons", [
                ("population", "is", "owner"), ("is_usable", "true", ""),
                ("pre_sectors", "contains", sec), ("brand_segment", "is", seg)]),
            row_order=lambda k: k, col_order=lambda k: k)}
    elif qid == "q3":
        pairs = [r for r in recs if r["kind"] in ("size", "overlap")]
        view = {"kind": "matrix", "matrix": _matrix(
            pairs, "cohort_a", "cohort_b", "people", "seq",
            drill=lambda a, b: _explore_url("persons", sorted({(f"cohort_{a}", "true", ""), (f"cohort_{b}", "true", "")})),
            row_order=lambda k: k, col_order=lambda k: k),
            "multiplicity": [r for r in recs if r["kind"] == "multiplicity"]}
    elif qid == "q4":
        view = {"kind": "matrix", "matrix": _matrix(
            recs, "purchase_year", "function_tag", "pct_experienced_3y", "seq", label_key="experienced_3y",
            drill=lambda y, fn: _explore_url("persons", [
                ("population", "is", "owner"), ("is_usable", "true", ""),
                ("franchise_purchase_year", "eq", str(y)), (f"tier_{fn}", "ge", "2")]),
            row_order=lambda k: k)}
    elif qid == "q5":
        dims = {d: [] for d in ("metro", "state", "years_since_first_job", "dated_roles")}
        for r in recs:
            dims.setdefault(r["dimension"], []).append(r)
        dims = {d: items for d, items in dims.items() if items}
        col_for = {"metro": "metro", "state": "state"}
        bars = {}
        for dim, items in dims.items():
            ordered = items if dim in ("metro", "state") else sorted(items, key=lambda r: r["value"])
            vmax = max(r["people"] for r in items)
            bars[dim] = [{
                "label": r["value"], "value": r["people"], "pct": r["pct_of_owners"],
                "width": 100.0 * r["people"] / vmax,
                "href": _explore_url("persons", [("population", "is", "owner"),
                                                 ("screen_status", "is", "approved_candidate"),
                                                 (col_for[dim], "is", r["value"])]) if dim in col_for else None,
            } for r in ordered[: (25 if dim in ("metro", "state") else 40)]]
        view = {"kind": "bars", "bars": bars, "denominator": COUNTS["approved"]}
    elif qid == "q6":
        view = {"kind": "table", "explore_href": _explore_url(
            "employers", [], order_by="record_count", order_dir="asc", limit=200)}
        rows = rows[:500]
    return view, cols, rows


@app.get("/q/<qid>")
def question(qid: str):
    if qid not in QUESTIONS:
        abort(404)
    view, cols, rows = render_question(qid)
    return render_template("question.html", q=QUESTIONS[qid], view=view, columns=cols, rows=rows,
                           questions=QUESTIONS, counts=COUNTS)


@app.get("/q/<qid>.csv")
def question_csv(qid: str):
    if qid not in QUESTIONS:
        abort(404)
    q = QUESTIONS[qid]
    cols, rows = run_sql(q["sql"])
    return csv_response(cols, rows, q["sql"], qid, {"question": q["title"]})


# -------------------------------------------------------------------- sql

def _validate_select(sql: str) -> str:
    text = sql.strip().rstrip(";").strip()
    if not text:
        raise ValueError("empty query")
    try:
        statements = duckdb.extract_statements(text)
    except duckdb.Error as e:
        raise ValueError(f"could not parse: {e}")
    if len(statements) != 1:
        raise ValueError("one statement at a time")
    if statements[0].type != duckdb.StatementType.SELECT:
        raise ValueError("SELECT statements only (WITH ... SELECT is fine)")
    return text


@app.route("/sql", methods=["GET", "POST"])
def sql_box():
    sql = request.form.get("sql", "") if request.method == "POST" else ""
    result = None
    if request.method == "POST":
        try:
            text = _validate_select(sql)
            cols, rows = run_sql(f"SELECT * FROM ({text}) AS q LIMIT {SQL_MAX_ROWS + 1}")
            result = {"columns": cols, "rows": rows[:SQL_MAX_ROWS], "truncated": len(rows) > SQL_MAX_ROWS}
        except (ValueError, duckdb.Error) as e:
            result = {"error": str(e)}
    return render_template("sql.html", sql=sql, result=result, tables=TABLES, max_rows=SQL_MAX_ROWS)


@app.post("/sql.csv")
def sql_csv():
    try:
        text = _validate_select(request.form.get("sql", ""))
        cols, rows = run_sql(f"SELECT * FROM ({text}) AS q LIMIT {EXPORT_MAX_ROWS}")
    except (ValueError, duckdb.Error) as e:
        abort(400, str(e))
    return csv_response(cols, rows, text, "sql")


# ----------------------------------------------------------------- people

def parse_filters(args) -> dict:
    def year(name):
        raw = (args.get(name) or "").strip()
        if re.fullmatch(r"\d{4}", raw) and 1950 <= int(raw) <= 2035:
            return int(raw)
        return None

    tenure_raw = (args.get("min_tenure") or "").strip()
    try:
        tenure_yrs = float(tenure_raw) if tenure_raw else None
        if tenure_yrs is not None and not (0 < tenure_yrs <= 60):
            tenure_yrs = None
    except ValueError:
        tenure_yrs = None

    return {
        "title_raw": (args.get("title") or "").strip(),
        "title_terms": [t for t in (norm(t) for t in re.split(r"[,\s]+", args.get("title") or "")) if t],
        "employer_raw": (args.get("employer") or "").strip(),
        "employer_terms": [t for t in (norm(t) for t in (args.get("employer") or "").split(",")) if t],
        "min_tenure_yrs": tenure_yrs,
        "career_path": [p for p in args.getlist("career_path") if p in CAREER_PATHS],
        "brand_segment": [s for s in args.getlist("brand_segment") if s in SEGMENTS],
        "bought_since": year("bought_since"),
        "exclude_franchise": args.get("exclude_franchise") == "on",
    }


def build_steps(f: dict) -> list[dict]:
    """Ordered, cumulative filter steps. Role conditions live inside one
    correlated EXISTS so title/employer/tenure must hold on the SAME role."""
    steps = []
    if f["career_path"]:
        ph = ", ".join("?" for _ in f["career_path"])
        steps.append(dict(kind="person", label="career path ∈ {" + ", ".join(f["career_path"]) + "}",
                          sql=f"p.career_path IN ({ph})", params=list(f["career_path"])))
    if f["brand_segment"]:
        ph = ", ".join("?" for _ in f["brand_segment"])
        steps.append(dict(kind="person", label="segment ∈ {" + ", ".join(f["brand_segment"]) + "}",
                          sql=f"p.brand_segment IN ({ph})", params=list(f["brand_segment"])))
    if f["bought_since"]:
        steps.append(dict(kind="person", label=f"bought since {f['bought_since']}",
                          sql="p.franchise_purchase_year >= ?", params=[f["bought_since"]]))
    for term in f["title_terms"]:
        steps.append(dict(kind="role", label=f"role title contains “{term}”",
                          sql="contains(r.title_norm, ?)", params=[term]))
    if f["employer_terms"]:
        ors = " OR ".join("contains(r.company_norm, ?)" for _ in f["employer_terms"])
        steps.append(dict(kind="role", label="employer contains any of: " + ", ".join(f["employer_terms"]),
                          sql=f"({ors})", params=list(f["employer_terms"])))
    if f["min_tenure_yrs"] is not None:
        months = int(round(f["min_tenure_yrs"] * 12))
        steps.append(dict(
            kind="role",
            label=f"role tenure ≥ {f['min_tenure_yrs']:g} yrs (Present-ended roles measured to franchise start)",
            sql="coalesce(r.duration_mo, CASE WHEN r.end_is_present AND r.start_ym IS NOT NULL "
                "THEN p.fr_start_ym - r.start_ym END) >= ?",
            params=[months]))
    return steps


PEOPLE_BASE = "p.population = 'owner' AND p.is_usable"


def where_for(steps: list[dict], exclude_franchise: bool) -> tuple[str, list]:
    clauses, params = [PEOPLE_BASE], []
    role_sqls, role_params = [], []
    for s in steps:
        if s["kind"] == "person":
            clauses.append(s["sql"])
            params.extend(s["params"])
        else:
            role_sqls.append(s["sql"])
            role_params.extend(s["params"])
    if role_sqls:
        excl = "NOT r.is_franchise_role AND " if exclude_franchise else ""
        clauses.append("EXISTS (SELECT 1 FROM roles r WHERE r.record_id = p.record_id AND "
                       + excl + " AND ".join(role_sqls) + ")")
        params.extend(role_params)
    return " AND ".join(clauses), params


def role_predicate(steps: list[dict], exclude_franchise: bool) -> tuple[str, list]:
    role_sqls = [s["sql"] for s in steps if s["kind"] == "role"]
    role_params = [p for s in steps if s["kind"] == "role" for p in s["params"]]
    if not role_sqls:
        return "NOT r.is_franchise_role", []
    excl = "NOT r.is_franchise_role AND " if exclude_franchise else ""
    return excl + " AND ".join(role_sqls), role_params


PERSON_COLUMNS = (
    "p.record_id, p.full_name, p.linkedin, p.job_title, p.company, p.canonical_brand, "
    "p.brand_segment, p.ownership_confidence, p.career_path, p.fr_start_ym, p.franchise_purchase_year, "
    "p.metro, p.n_pre_roles, p.n_corp_after, p.yrs_between, p.last_own_title, p.last_own_company, "
    "p.return_title, p.return_company, p.longest_pre_function, p.longest_pre_sector, p.cohort_flags"
)


def run_people_query(f: dict):
    steps = build_steps(f)
    funnel = [{"label": f"all usable owners ({BASE_COUNT:,})", "count": BASE_COUNT}]
    for i in range(1, len(steps) + 1):
        where, params = where_for(steps[:i], f["exclude_franchise"])
        n = run_sql(f"SELECT count(*) FROM persons p WHERE {where}", params)[1][0][0]
        funnel.append({"label": steps[i - 1]["label"], "count": n})
    where, where_params = where_for(steps, f["exclude_franchise"])
    pred, pred_params = role_predicate(steps, f["exclude_franchise"])
    total = funnel[-1]["count"]

    order_limit = f"ORDER BY p.fr_start_ym DESC NULLS LAST, p.record_id\nLIMIT {SAMPLE_LIMIT}"
    matched = ("(SELECT string_agg(DISTINCT r.title, ' | ') FROM roles r "
               f"WHERE r.record_id = p.record_id AND {pred}) AS matched_roles")
    sample_sql = f"SELECT {PERSON_COLUMNS},\n       {matched}\nFROM persons p\nWHERE {where}\n{order_limit}"
    sample_params = pred_params + where_params
    cols, rows = run_sql(sample_sql, sample_params)
    sample = [dict(zip(cols, row)) for row in rows]

    titles_sql = ("SELECT r.title_norm AS title, count(DISTINCT r.record_id) AS people\n"
                  "FROM roles r JOIN persons p ON r.record_id = p.record_id\n"
                  f"WHERE ({where}) AND ({pred})\n"
                  f"GROUP BY 1 ORDER BY people DESC, title LIMIT {TOP_TITLES_LIMIT}")
    top_titles = run_sql(titles_sql, where_params + pred_params)[1]
    return {
        "funnel": funnel, "total": total,
        "pct": round(100 * total / BASE_COUNT, 1) if BASE_COUNT else 0,
        "sample": sample, "top_titles": top_titles,
        "top_titles_max": max((n for _, n in top_titles), default=0),
        "sql": inline_sql(sample_sql, sample_params), "steps_active": bool(steps),
    }


@app.get("/people")
def people():
    f = parse_filters(request.args)
    r = run_people_query(f)
    return render_template("people.html", f=f, r=r, segments=SEGMENTS, career_paths=CAREER_PATHS,
                           base_count=BASE_COUNT, year_range=YEAR_RANGE)


@app.get("/people.csv")
def people_csv():
    f = parse_filters(request.args)
    steps = build_steps(f)
    where, where_params = where_for(steps, f["exclude_franchise"])
    pred, pred_params = role_predicate(steps, f["exclude_franchise"])
    matched = ("(SELECT string_agg(DISTINCT r.title, ' | ') FROM roles r "
               f"WHERE r.record_id = p.record_id AND {pred}) AS matched_roles")
    sql = (f"SELECT {PERSON_COLUMNS},\n       {matched}\nFROM persons p\nWHERE {where}\n"
           "ORDER BY p.fr_start_ym DESC NULLS LAST, p.record_id")
    params = pred_params + where_params
    cols, rows = run_sql(sql, params)
    note = {k: v for k, v in f.items() if v and k not in ("title_terms", "employer_terms")}
    return csv_response(cols, rows, inline_sql(sql, params), "people", note)


# ------------------------------------------------------------------- home

@app.get("/healthz")
def healthz():
    return {"ok": True, "persons": COUNTS["usable"], "comparison": COUNTS["comparison"]}


@app.get("/")
def home():
    cohort_rows = run_sql(
        "SELECT cohort_id, count(*) AS people, count(*) FILTER (WHERE p.franchise_purchase_year >= 2020) AS bought_2020s "
        "FROM cohorts c JOIN persons p USING (record_id) GROUP BY 1 ORDER BY 1")[1]
    overlap = run_sql("SELECT cohort_count, count(*) FROM persons WHERE cohort_count > 0 GROUP BY 1 ORDER BY 1")[1]
    starters = [
        ("People by brand segment", _explore_url("persons", [("population", "is", "owner"), ("is_usable", "true", "")],
                                                 ["brand_segment"])),
        ("Longest pre-purchase function × brand segment",
         _explore_url("persons", [("population", "is", "owner"), ("is_usable", "true", "")],
                      ["longest_pre_function", "brand_segment"])),
        ("Pre-purchase roles by sector", _explore_url("roles", [("is_pre_purchase", "true", "")], ["sector_tag"])),
        ("Purchase year × career path", _explore_url("persons", [("is_usable", "true", "")],
                                                    ["franchise_purchase_year", "career_path"])),
        ("Employer tail (rarest first)", _explore_url("employers", [], order_by="record_count", order_dir="asc")),
        ("Roles at a franchise brand that are not the person's own purchase",
         _explore_url("roles", [("at_franchise_brand", "true", ""), ("is_franchise_role", "false", "")],
                      ["franchise_role_kind"])),
    ]
    return render_template("home.html", counts=COUNTS, cohorts=cohort_rows, overlap=overlap,
                           questions=QUESTIONS, starters=starters, tables=TABLES, data_dir=str(DATA_DIR))


@app.get("/index")
def legacy_index():
    return redirect(url_for("people"))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5099)), debug=False)
