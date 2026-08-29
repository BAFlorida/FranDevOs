"""Cohort Lab — query the owner warehouse over HTTP.

Flask + DuckDB over two parquet files (persons, roles). Every result panel is
derived from one parameterized SQL statement that is also displayed verbatim and
embedded in CSV exports, so a number never travels without its query.

Data: deploy/{persons,roles}.parquet if present (local dev, gitignored);
otherwise the committed deploy/*.parquet.enc are decrypted at boot with
COHORT_DATA_KEY (Fernet). Plaintext people data never lives in git — the
containing repo is public.

Auth: HTTP Basic from COHORT_USER / COHORT_PASSWORD. On Render (RENDER env set)
both are required at startup; locally, unset means auth is off for dev.
"""
from __future__ import annotations

import csv
import hmac
import io
import json
import os
import re
import datetime as dt
from pathlib import Path

import duckdb
from flask import Flask, Response, render_template, request

BASE = Path(__file__).resolve().parent
DEPLOY = BASE / "deploy"
SAMPLE_LIMIT = 25
TOP_TITLES_LIMIT = 15

IS_RENDER = bool(os.environ.get("RENDER"))
AUTH_USER = os.environ.get("COHORT_USER", "")
AUTH_PASS = os.environ.get("COHORT_PASSWORD", "")
if IS_RENDER and not (AUTH_USER and AUTH_PASS):
    raise RuntimeError("COHORT_USER and COHORT_PASSWORD must be set when running on Render")


def _ensure_data() -> Path:
    if (DEPLOY / "persons.parquet").exists() and (DEPLOY / "roles.parquet").exists():
        return DEPLOY
    enc = [DEPLOY / "persons.parquet.enc", DEPLOY / "roles.parquet.enc"]
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
        target = out / path.name.removesuffix(".enc")
        target.write_bytes(fernet.decrypt(path.read_bytes()))
    return out


DATA_DIR = _ensure_data()
_root = duckdb.connect()
_root.execute(f"CREATE VIEW persons AS SELECT * FROM read_parquet('{DATA_DIR / 'persons.parquet'}')")
_root.execute(f"CREATE VIEW roles AS SELECT * FROM read_parquet('{DATA_DIR / 'roles.parquet'}')")

BASE_COUNT = _root.execute("SELECT count(*) FROM persons").fetchone()[0]
SEGMENTS = [r[0] for r in _root.execute(
    "SELECT DISTINCT brand_segment FROM persons WHERE brand_segment <> '' ORDER BY 1").fetchall()]
CAREER_PATHS = [r[0] for r in _root.execute(
    "SELECT DISTINCT career_path FROM persons ORDER BY 1").fetchall()]
YEAR_RANGE = _root.execute(
    "SELECT min(fr_start_ym) // 12, max(fr_start_ym) // 12 FROM persons").fetchone()

app = Flask(__name__)


@app.before_request
def _basic_auth():
    if request.path == "/healthz" or not (AUTH_USER and AUTH_PASS):
        return None
    auth = request.authorization
    ok = (
        auth is not None
        and auth.type == "basic"
        and hmac.compare_digest(auth.username or "", AUTH_USER)
        and hmac.compare_digest(auth.password or "", AUTH_PASS)
    )
    if not ok:
        return Response("authentication required", 401,
                        {"WWW-Authenticate": 'Basic realm="Cohort Lab"'})
    return None


def norm(text: str) -> str:
    """Same token-join normalization the warehouse uses for *_norm columns."""
    return " ".join(re.findall(r"[a-z0-9]+", (text or "").lower()))


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
    """Ordered, cumulative filter steps. Each step contributes either a
    person-level clause or a role-level condition; role conditions live inside
    one correlated EXISTS so title/employer/tenure must hold on the SAME role."""
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
                          sql="p.fr_start_ym >= ?", params=[f["bought_since"] * 12]))
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


def where_for(steps: list[dict], exclude_franchise: bool) -> tuple[str, list]:
    clauses, params = [], []
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
    return (" AND ".join(clauses) if clauses else "TRUE"), params


def role_predicate(steps: list[dict], exclude_franchise: bool) -> tuple[str, list]:
    role_sqls = [s["sql"] for s in steps if s["kind"] == "role"]
    role_params = [p for s in steps if s["kind"] == "role" for p in s["params"]]
    if not role_sqls:
        return "NOT r.is_franchise_role", []
    excl = "NOT r.is_franchise_role AND " if exclude_franchise else ""
    return excl + " AND ".join(role_sqls), role_params


def inline_sql(sql: str, params: list) -> str:
    """Display/export copy of the executed statement, parameters inlined.
    Execution always uses bound parameters; this string is never executed."""
    out, i = [], 0
    for ch in sql:
        if ch == "?" and i < len(params):
            v = params[i]
            i += 1
            out.append(str(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'")
        else:
            out.append(ch)
    return "".join(out)


PERSON_COLUMNS = (
    "p.record_id, p.full_name, p.linkedin, p.job_title, p.company, p.canonical_brand, "
    "p.brand_segment, p.ownership_confidence, p.career_path, p.fr_start_ym, p.n_pre_roles, "
    "p.n_corp_after, p.yrs_between, p.last_own_title, p.last_own_company, p.return_title, p.return_company"
)


def run_query(f: dict):
    con = _root.cursor()
    steps = build_steps(f)
    funnel = [{"label": f"all usable owners ({BASE_COUNT:,})", "count": BASE_COUNT}]
    for i in range(1, len(steps) + 1):
        where, params = where_for(steps[:i], f["exclude_franchise"])
        n = con.execute(f"SELECT count(*) FROM persons p WHERE {where}", params).fetchone()[0]
        funnel.append({"label": steps[i - 1]["label"], "count": n})
    where, where_params = where_for(steps, f["exclude_franchise"])
    pred, pred_params = role_predicate(steps, f["exclude_franchise"])
    total = funnel[-1]["count"]

    order_limit = f"ORDER BY p.fr_start_ym DESC NULLS LAST, p.record_id\nLIMIT {SAMPLE_LIMIT}"
    matched = ("(SELECT string_agg(DISTINCT r.title, ' | ') FROM roles r "
               f"WHERE r.record_id = p.record_id AND {pred}) AS matched_roles")
    sample_sql = f"SELECT {PERSON_COLUMNS},\n       {matched}\nFROM persons p\nWHERE {where}\n{order_limit}"
    sample_params = pred_params + where_params
    cur = con.execute(sample_sql, sample_params)
    cols = [d[0] for d in cur.description]
    sample = [dict(zip(cols, row)) for row in cur.fetchall()]

    titles_sql = ("SELECT r.title_norm AS title, count(DISTINCT r.record_id) AS people\n"
                  "FROM roles r JOIN persons p ON r.record_id = p.record_id\n"
                  f"WHERE ({where}) AND ({pred})\n"
                  f"GROUP BY 1 ORDER BY people DESC, title LIMIT {TOP_TITLES_LIMIT}")
    top_titles = con.execute(titles_sql, where_params + pred_params).fetchall()

    return {
        "funnel": funnel,
        "total": total,
        "pct": round(100 * total / BASE_COUNT, 1) if BASE_COUNT else 0,
        "sample": sample,
        "top_titles": top_titles,
        "top_titles_max": max((n for _, n in top_titles), default=0),
        "sql": inline_sql(sample_sql, sample_params),
        "steps_active": bool(steps),
    }


def fmt_ym(v):
    if v is None:
        return ""
    v = int(v)
    return f"{v // 12}-{v % 12 + 1:02d}"


app.jinja_env.filters["ym"] = fmt_ym


@app.get("/healthz")
def healthz():
    return {"ok": True, "persons": BASE_COUNT}


@app.get("/")
def index():
    f = parse_filters(request.args)
    results = run_query(f)
    return render_template(
        "index.html", f=f, r=results, segments=SEGMENTS, career_paths=CAREER_PATHS,
        base_count=BASE_COUNT, year_range=YEAR_RANGE,
        export_qs=request.query_string.decode(),
    )


@app.get("/export.csv")
def export_csv():
    f = parse_filters(request.args)
    steps = build_steps(f)
    where, where_params = where_for(steps, f["exclude_franchise"])
    pred, pred_params = role_predicate(steps, f["exclude_franchise"])
    matched = ("(SELECT string_agg(DISTINCT r.title, ' | ') FROM roles r "
               f"WHERE r.record_id = p.record_id AND {pred}) AS matched_roles")
    sql = (f"SELECT {PERSON_COLUMNS},\n       {matched}\nFROM persons p\nWHERE {where}\n"
           "ORDER BY p.fr_start_ym DESC NULLS LAST, p.record_id")
    params = pred_params + where_params
    cur = _root.cursor().execute(sql, params)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()

    buf = io.StringIO()
    buf.write("# Cohort Lab export\n")
    buf.write(f"# generated: {dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}\n")
    buf.write(f"# rows: {len(rows)}\n")
    filters_note = {k: v for k, v in f.items() if v and k not in ("title_terms", "employer_terms")}
    buf.write(f"# filters: {json.dumps(filters_note, ensure_ascii=False)}\n")
    buf.write("# sql:\n")
    for line in inline_sql(sql, params).splitlines():
        buf.write(f"#   {line}\n")
    writer = csv.writer(buf)
    writer.writerow(cols)
    writer.writerows(rows)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=cohort_lab_{stamp}.csv"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5099)), debug=False)
