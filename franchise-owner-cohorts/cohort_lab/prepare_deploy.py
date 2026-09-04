"""Copy the warehouse tables the app serves and encrypt them for deployment.

Reads  ../data/warehouse/{persons,roles,employers,cohorts}.parquet  (src/07_build_warehouse.py)
Writes deploy/<table>.parquet       (plaintext — GITIGNORED, local dev)
       deploy/<table>.parquet.enc   (Fernet ciphertext — committed)

Every column ships (the grain is the deliverable); only the internal
`backgrounds` / `role_functions` helper tables stay behind. The containing git
repository is PUBLIC, so plaintext people data never lands in git; only the
ciphertext does. The Fernet key comes from COHORT_DATA_KEY or, for local work,
.data_key beside this script (generated on first run, gitignored, 0600). Set
the same key as COHORT_DATA_KEY on Render so the app can decrypt at boot.
Losing the key just means re-running this script with a new one.
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
TABLES = ("persons", "roles", "employers", "cohorts")


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
    db = WAREHOUSE / "frandev.duckdb"
    if not db.exists():
        raise SystemExit(f"missing {db} — run src/07_build_warehouse.py first")
    DEPLOY.mkdir(exist_ok=True)
    for stale in DEPLOY.glob("*.parquet*"):
        if stale.name.split(".")[0] not in TABLES:
            stale.unlink()
            print(f"removed stale {stale.name}")

    con = duckdb.connect(str(db), read_only=True)
    for name in TABLES:
        dst = DEPLOY / f"{name}.parquet"
        con.execute(f"COPY (SELECT * FROM {name}) TO '{dst}' (FORMAT parquet, COMPRESSION zstd)")
        n, ncol = con.execute(f"SELECT count(*), (SELECT count(*) FROM information_schema.columns "
                              f"WHERE table_name = '{name}') FROM {name}").fetchone()
        print(f"{name}: {n:,} rows, {ncol} columns -> {dst.name} ({dst.stat().st_size:,} bytes)")
    con.close()

    fernet = Fernet(get_key())
    for name in TABLES:
        src = DEPLOY / f"{name}.parquet"
        enc = DEPLOY / f"{name}.parquet.enc"
        enc.write_bytes(fernet.encrypt(src.read_bytes()))
        digest = hashlib.sha256(enc.read_bytes()).hexdigest()[:16]
        print(f"{enc.name}: {enc.stat().st_size:,} bytes, sha256 {digest} (safe to commit)")
    print("plaintext deploy/*.parquet stays local (gitignored); commit only the .enc files")


if __name__ == "__main__":
    main()
