"""Trim the warehouse to app-needed columns and encrypt it for deployment.

Reads  ../data/warehouse/{persons,roles}.parquet   (build with src/07_build_warehouse.py)
Writes deploy/{persons,roles}.parquet              (plaintext — GITIGNORED, local dev)
       deploy/{persons,roles}.parquet.enc          (Fernet ciphertext — committed)

The containing git repository is PUBLIC, so plaintext people data never lands in
git; only the ciphertext does. The Fernet key comes from COHORT_DATA_KEY or, for
local work, .data_key beside this script (generated on first run, gitignored,
0600). Set the same key as COHORT_DATA_KEY on Render so the app can decrypt at
boot. Losing the key just means re-running this script with a new one.
"""
from __future__ import annotations

import hashlib
import os
import stat
from pathlib import Path

import duckdb
from cryptography.fernet import Fernet

BASE = Path(__file__).resolve().parent
WAREHOUSE = BASE.parent / "data" / "warehouse"
DEPLOY = BASE / "deploy"
KEY_FILE = BASE / ".data_key"

PERSON_COLUMNS = [
    "record_id", "full_name", "linkedin", "job_title", "company", "canonical_brand",
    "brand_segment", "ownership_confidence", "fr_start_ym", "n_roles", "n_pre_roles",
    "career_path", "n_corp_after", "yrs_between", "last_own_title", "last_own_company",
    "return_title", "return_company",
]
ROLE_COLUMNS = [
    "record_id", "seq", "title", "company", "title_norm", "company_norm",
    "start_ym", "end_ym", "end_is_present", "duration_mo",
    "is_franchise_role", "is_ownership", "is_corporate",
]


def get_key() -> bytes:
    env = os.environ.get("COHORT_DATA_KEY", "").strip()
    if env:
        return env.encode()
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes().strip()
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key + b"\n")
    KEY_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)
    print(f"generated new data key -> {KEY_FILE} (gitignored; set it as COHORT_DATA_KEY on Render)")
    return key


def main() -> None:
    for name in ("persons", "roles"):
        if not (WAREHOUSE / f"{name}.parquet").exists():
            raise SystemExit(f"missing {WAREHOUSE / f'{name}.parquet'} — run src/07_build_warehouse.py first")
    DEPLOY.mkdir(exist_ok=True)

    con = duckdb.connect()
    for name, cols in (("persons", PERSON_COLUMNS), ("roles", ROLE_COLUMNS)):
        src = WAREHOUSE / f"{name}.parquet"
        dst = DEPLOY / f"{name}.parquet"
        con.execute(
            f"COPY (SELECT {', '.join(cols)} FROM read_parquet('{src}')) "
            f"TO '{dst}' (FORMAT parquet, COMPRESSION zstd)"
        )
        n = con.execute(f"SELECT count(*) FROM read_parquet('{dst}')").fetchone()[0]
        print(f"{name}: {n:,} rows, {len(cols)} columns -> {dst.name} ({dst.stat().st_size:,} bytes)")

    fernet = Fernet(get_key())
    for name in ("persons", "roles"):
        src = DEPLOY / f"{name}.parquet"
        enc = DEPLOY / f"{name}.parquet.enc"
        enc.write_bytes(fernet.encrypt(src.read_bytes()))
        digest = hashlib.sha256(enc.read_bytes()).hexdigest()[:16]
        print(f"{enc.name}: {enc.stat().st_size:,} bytes, sha256 {digest} (safe to commit)")
    print("plaintext deploy/*.parquet stays local (gitignored); commit only the .enc files")


if __name__ == "__main__":
    main()
