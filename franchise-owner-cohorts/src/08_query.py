"""Run a SQL query against the warehouse; write the result CSV plus a sidecar.

Every published figure carries its query: the sidecar (<name>.sidecar.json)
records the exact SQL, the row count, the warehouse manifest hash, and the
timestamp. No number goes in a deck without one of these next to it.

    .venv/bin/python src/08_query.py --name owner_returners \
        --sql "SELECT career_path, count(*) FROM persons GROUP BY 1"
    .venv/bin/python src/08_query.py --name cohort_sizes --file sql/figures/cohort_sizes.sql
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import duckdb

import pipeline_lib as lib

DB_PATH = lib.PROJECT_ROOT / "data" / "warehouse" / "frandev.duckdb"
ANALYSIS_DIR = lib.OUTPUTS_DIR / "analysis"


def run_query(name: str, sql: str, db_path: Path = DB_PATH, out_dir: Path = ANALYSIS_DIR) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(db_path), read_only=True)
    df = con.execute(sql).df()
    con.close()
    out_csv = out_dir / f"{name}.csv"
    df.to_csv(out_csv, index=False)
    sidecar = {
        "name": name,
        "sql": sql,
        "rows": len(df),
        "columns": list(df.columns),
        "warehouse": str(db_path),
        "warehouse_sha256": hashlib.sha256(db_path.read_bytes()).hexdigest()[:16],
        "run_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }
    lib.write_json(out_dir / f"{name}.sidecar.json", sidecar)
    print(f"{name}: {len(df)} rows -> {out_csv}")
    return out_csv


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="output basename")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--sql", help="inline SQL")
    src.add_argument("--file", type=Path, help="path to a .sql file")
    args = parser.parse_args()
    sql = args.sql if args.sql else args.file.read_text(encoding="utf-8")
    run_query(args.name, sql)


if __name__ == "__main__":
    main()
