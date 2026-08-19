#!/usr/bin/env python3
"""Separate the pages John has already rebuilt from the ones still mine.

John's five carry newer copy than content/pages/*.md, so shipping my versions
of them would overwrite his work. They are excluded from the upload package.
"""
import os, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build import ORDER

JOHNS = {
    "01-welcome/index.html",
    "01-welcome/01-mep-end-to-end.html",
    "02-brand-overview/index.html",
    "02-brand-overview/01-qualification-summary.html",
    "02-brand-overview/02-fdd.html",
}
MINE = [p for p in ORDER if p not in JOHNS]

out = os.path.join(ROOT, "dist-remaining")
shutil.rmtree(out, ignore_errors=True)
for rel in MINE:
    dst = os.path.join(out, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(os.path.join(ROOT, "dist", rel), dst)

readme = [
    "# Remaining MEG pages\n",
    f"{len(MINE)} pages. The {len(JOHNS)} John has already rebuilt are deliberately",
    "excluded so his newer copy is not overwritten:\n",
]
readme += [f"  - {p}" for p in sorted(JOHNS)]
readme += ["", "Everything here matches John's conventions: .btn links with data-asset,",
           "no .eyebrow, the closing pointer as prose in the final card, the",
           '"▶ Watch · <name>" video caption format, and no sub-step list on index',
           "pages (the platform supplies section navigation).", "",
           "The source markdown was reconciled to the live CMS export on 2026-08-19,",
           "so these pages differ from the CMS only where the CMS itself needs the",
           'fix: the stray "---" paragraph pasted before each closing line.', ""]
open(os.path.join(out, "README.md"), "w").write("\n".join(readme))

zpath = os.path.join(ROOT, "1tp-meg-remaining-19-pages.zip")
if os.path.exists(zpath): os.remove(zpath)
subprocess.run(["zip", "-q", "-r", zpath, "."], cwd=out, check=True)
print(f"  {len(MINE)} pages -> dist-remaining/ and {os.path.basename(zpath)}")
for p in MINE: print(f"    {p}")
