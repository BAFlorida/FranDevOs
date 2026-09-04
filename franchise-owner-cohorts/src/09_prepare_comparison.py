"""Prepare a matched comparison sample for the warehouse.

Runs the SAME deterministic stages 01 -> 02 -> 03 -> 04 on a Clay export of
non-owners (same column layout as the owner export) into a separate folder, so
the comparison sample is parsed, normalized and screened with the identical
code and vocabulary as the owners. The builder then loads the stage-04 file
with population='comparison':

    .venv/bin/python src/09_prepare_comparison.py --input data/raw/comparison/<export>.csv
    .venv/bin/python src/07_build_warehouse.py \
        --comparison data/processed/comparison/04_work_history_parsed.csv

Anyone in the comparison file whom stage 03 screens as an approved franchise
owner is kept in `persons` (population='comparison') but flagged
usable_reason='screened_as_owner' and excluded from every tenure basis — a
contaminant is recorded, never silently dropped.

No LLM/API calls. Nothing here touches the owner files.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import pipeline_lib as lib


def load_script(stem: str):
    """Import a numbered pipeline script (e.g. '01_clean_people') as a module."""
    if stem in sys.modules:
        return sys.modules[stem]
    spec = importlib.util.spec_from_file_location(stem, SRC / f"{stem}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[stem] = mod
    spec.loader.exec_module(mod)
    return mod


def run(input_path: Path, processed_dir: Path | None = None, outputs_dir: Path | None = None,
        config_dir: Path | None = None) -> dict:
    processed_dir = Path(processed_dir) if processed_dir else lib.DATA_PROCESSED / "comparison"
    outputs_dir = Path(outputs_dir) if outputs_dir else lib.OUTPUTS_DIR / "comparison"
    config_dir = Path(config_dir) if config_dir else lib.CONFIG_DIR
    processed_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    s01 = load_script("01_clean_people")
    s02 = load_script("02_normalize_brand_affiliation")
    s03 = load_script("03_classify_current_ownership")
    s04 = load_script("04_parse_work_history")

    s01.run(input_path=input_path, processed_dir=processed_dir, outputs_dir=outputs_dir)
    s02.run(processed_dir=processed_dir, outputs_dir=outputs_dir, config_dir=config_dir)
    s03.run(processed_dir=processed_dir, outputs_dir=outputs_dir, config_dir=config_dir)
    df = s04.run(processed_dir=processed_dir, outputs_dir=outputs_dir, config_dir=config_dir)

    out = processed_dir / "04_work_history_parsed.csv"
    summary = {
        "input": str(input_path),
        "stage04_file": str(out),
        "people": int(len(df)),
        "screened_as_owner": int((df["current_ownership_status"] == "approved_candidate").sum()),
        "with_history": int((df["work_history_entry_count"].astype(int) > 0).sum()),
    }
    lib.write_json(outputs_dir / "09_comparison_summary.json", summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, required=True, help="raw Clay export of the comparison sample")
    args = parser.parse_args()
    print(json.dumps(run(args.input), indent=2))


if __name__ == "__main__":
    main()
