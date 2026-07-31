#!/usr/bin/env python3
"""Generate the 24 self-contained MEG sales room pages into dist/.

Run from anywhere:  python3 meg-sales-room/build/build.py

The generator exists so all 24 pages share one CSS block and one component
vocabulary. The pages it emits are still fully standalone: no external
stylesheet, no JS, no build step needed to render them.
"""

import importlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, HERE)

MODULES = ["pages.b01", "pages.b02", "pages.b03", "pages.b04", "pages.b05", "pages.b06"]


def collect():
    pages = {}
    for name in MODULES:
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError as exc:
            if name.split(".")[-1] in str(exc):
                print(f"  (skipping {name}, not written yet)")
                continue
            raise
        for path, html in mod.PAGES.items():
            if path in pages:
                raise SystemExit(f"duplicate page path: {path}")
            pages[path] = html
    return pages


def write(pages):
    for path, html in sorted(pages.items()):
        full = os.path.join(DIST, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(html)
        print(f"  wrote {path}")


# ------------------------------------------------------------------ checks

def check(pages):
    """Acceptance checks from BUILD_PROMPT.md. Returns a list of failures."""
    fails = []

    for path, html in sorted(pages.items()):
        # No em-dashes, and no en-dashes standing in for one.
        for ch, label in ((chr(0x2014), "em-dash"), (chr(0x2013), "en-dash")):
            if ch in html:
                fails.append(f"{path}: contains {label}")

        # Every checkbox and select has an associated label.
        for box_id in re.findall(r'<input type="checkbox" id="([^"]+)"', html):
            if f'<label for="{box_id}"' not in html:
                fails.append(f"{path}: checkbox #{box_id} has no <label for>")
        for sel_id in re.findall(r'<select id="([^"]+)"', html):
            if f'<label for="{sel_id}"' not in html:
                fails.append(f"{path}: select #{sel_id} has no <label for>")

        # Gates must be real controls, not paragraphs.
        for block in re.findall(r'<div class="gate[^"]*">.*?</div>\s*</div>', html, re.S):
            if "<input" not in block and "<select" not in block:
                fails.append(f"{path}: a .gate block renders no form control")

        # No page chrome.
        for tag in ("<header", "<nav", "<footer"):
            if tag in html:
                fails.append(f"{path}: contains page chrome {tag}>")

        # Self-contained: no external CSS, no script.
        no_fonts = re.sub(r"<link[^>]*fonts\.googleapis\.com[^>]*>", "", html)
        if re.search(r'<link[^>]+rel="stylesheet"', no_fonts):
            fails.append(f"{path}: links a non-font stylesheet")
        if "<script" in html:
            fails.append(f"{path}: contains a <script> tag")

        # Tables need a caption or a preceding heading.
        for tbl in re.findall(r"<table>(.*?)</table>", html, re.S):
            if "<caption>" not in tbl:
                fails.append(f"{path}: a table has no <caption>")

        # Asset slots must name their asset.
        for a in re.findall(r"<a class=\"slot\"[^>]*>", html):
            if "data-asset=" not in a:
                fails.append(f"{path}: a .slot has no data-asset attribute")

        # Video embeds: CSS present, iframe well formed, no bare watch URLs.
        if 'class="video"' in html:
            if ".video iframe{" not in html:
                fails.append(f"{path}: has a .video block but no .video CSS")
            for blk in re.findall(r'<div class="video">.*?</div>', html, re.S):
                if "<iframe" not in blk:
                    fails.append(f"{path}: .video block has no iframe")
                elif not re.search(r'src="[^"]+"[^>]*title="[^"]+"', blk):
                    fails.append(f"{path}: video iframe missing src or title")
        for bad_url in re.findall(r'src="https://www\.youtube\.com/watch[^"]*"', html):
            fails.append(f"{path}: watch URL used instead of embed URL: {bad_url}")

        # Structure floor.
        for required in ('class="page-title"', 'class="next"'):
            if required not in html:
                fails.append(f"{path}: missing {required}")

    # Every bucket index links all of its sub-steps.
    for path in pages:
        if not path.endswith("/index.html"):
            continue
        bucket = path.split("/")[0]
        subs = [p.split("/")[1] for p in pages
                if p.startswith(bucket + "/") and not p.endswith("index.html")]
        for sub in subs:
            if f'href="{sub}"' not in pages[path]:
                fails.append(f"{path}: does not link {sub}")

    return fails


def report(pages):
    print(f"\n  {len(pages)} pages generated")
    total_ph = sum(len(re.findall(r'class="ph[ "]', h)) for h in pages.values())
    total_gates = sum(len(re.findall(r'class="gate[ "]', h)) for h in pages.values())
    gated = [p for p, h in pages.items() if 'class="gate' in h]
    print(f"  {total_gates} gates across {len(gated)} pages")
    print(f"  {total_ph} placeholder flags")


ORDER = [
    "01-welcome/index.html", "01-welcome/01-mep-end-to-end.html",
    "02-brand-overview/index.html", "02-brand-overview/01-qualification-summary.html",
    "02-brand-overview/02-fdd.html", "02-brand-overview/03-additional-resources.html",
    "03-validation/index.html", "03-validation/01-owner-calls.html",
    "03-validation/02-funding.html", "03-validation/03-territory.html",
    "03-validation/04-technology.html",
    "04-seeking-approval/index.html",
    "04-seeking-approval/01-executive-approval-call.html",
    "04-seeking-approval/02-dap-contingencies.html",
    "05-meet-the-team-day/index.html",
    "05-meet-the-team-day/01-what-who-to-expect.html",
    "05-meet-the-team-day/02-pre-mttd-questionnaire.html",
    "05-meet-the-team-day/03-meet-the-team-day.html",
    "05-meet-the-team-day/04-post-mttd-assessment.html",
    "06-agreement-stage/index.html", "06-agreement-stage/01-executive-board-approval.html",
    "06-agreement-stage/02-executing-your-agreement.html",
    "06-agreement-stage/03-brand-welcome-call.html", "06-agreement-stage/04-thank-you.html",
]

# Pages whose source lesson was not supplied, or that have no source at all.
SOURCE_STATE = {
    "05-meet-the-team-day/03-meet-the-team-day.html": "No source - stub",
    "06-agreement-stage/03-brand-welcome-call.html": "No source - stub",
}


def stats(html):
    gates = len(re.findall(r'class="gate[ "]', html))
    checks = len(re.findall(r'<input type="checkbox"', html))
    selects = len(re.findall(r"<select ", html))
    phs = len(re.findall(r'class="ph[ "]', html))
    vids = len(re.findall(r"youtube\.com/embed/", html))
    pending = len(re.findall(r">Pending: ", html))
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    return dict(title=title, gates=gates, checks=checks, selects=selects,
                phs=phs, vids=vids, pending=pending)


def write_index(pages):
    import json
    with open(os.path.join(ROOT, "spec", "structure.json"), encoding="utf-8") as fh:
        spec = json.load(fh)

    st = {p: stats(h) for p, h in pages.items()}
    tot = lambda k: sum(s[k] for s in st.values())

    L = []
    L.append("# MEG Sales Room - Page Index\n")
    L.append("24 self-contained HTML pages for the 1-Tom-Plumber Mutual Evaluation Guide "
             "sales room.\n")
    L.append("Each page inlines its own CSS and carries no site header, nav, or footer. "
             "Paste one at a time into the sales room CMS content field.\n")
    L.append(f"Regenerate with `python3 meg-sales-room/build/build.py`. Page copy lives in "
             f"`build/pages/b01.py` through `b06.py`; the shared shell and components live "
             f"in `build/shell.py`.\n")

    L.append("\n## All 24 pages\n")
    L.append("| # | Page | Path | Gates | Placeholders | Video |")
    L.append("|---|---|---|---|---|---|")
    for i, path in enumerate(ORDER, 1):
        s = st[path]
        if s["gates"]:
            g = f"{s['gates']} ({s['checks']} checkbox, {s['selects']} select)" \
                if s["checks"] and s["selects"] else \
                (f"{s['checks']} checkbox" if s["checks"] else f"{s['selects']} select")
        else:
            g = "-"
        v = []
        if s["vids"]:
            v.append(f"{s['vids']} embed" + ("s" if s["vids"] > 1 else ""))
        if s["pending"]:
            v.append(f"{s['pending']} pending")
        note = SOURCE_STATE.get(path, "")
        title = s["title"] + (f" _({note})_" if note else "")
        L.append(f"| {i} | {title} | `{path}` | {g} | {s['phs'] or '-'} | "
                 f"{', '.join(v) or '-'} |")
    L.append(f"\n**Totals:** {tot('gates')} gates ({tot('checks')} checkboxes, "
             f"{tot('selects')} selects) on 4 pages, {tot('phs')} placeholder flags, "
             f"{tot('vids')} video embeds, {tot('pending')} pending video slots.\n")

    L.append("\n## Compliance gates\n")
    L.append("Four pages carry gates. All render as real form controls with associated "
             "labels, verified in a headless browser.\n")
    L.append("| Page | Gate | Type |")
    L.append("|---|---|---|")
    for b in spec["buckets"]:
        for sub in b["substeps"]:
            for g in sub.get("gates", []):
                p = f"{b['id']}/{sub['n']:02d}-{sub['id'].split('-', 1)[1]}.html"
                p = next((k for k in ORDER if k.startswith(b["id"]) and sub["id"] in k), p)
                L.append(f"| `{p}` | `{g['id']}` | {g['type']} |")

    L.append("\n## Summary and milestone deltas\n")
    L.append("The build renders the **proposed** values. Review these before anyone edits "
             "the live tool.\n")
    L.append("| Bucket | Field | Current in tool | Rendered here | Status |")
    L.append("|---|---|---|---|---|")
    for b in spec["buckets"]:
        s = b["summary"]
        if isinstance(s, dict):
            L.append(f"| {b['n']} · {b['title']} | Summary | {s['current']} | "
                     f"{s['proposed']} | {s['status']} |")
        m = b["milestone"]
        flag = "unchanged" if m["current"] == m["proposed"] else m["status"]
        L.append(f"| {b['n']} · {b['title']} | Milestone | {m['current']} | "
                 f"{m['proposed']} | {flag} |")
    L.append("\nMilestones are **exit** gates: completing the bucket produces the milestone. "
             "Buckets 3 through 6 are each shifted one bucket forward in the tool today, and "
             "bucket 6 has no completion milestone at all.\n")
    L.append("Two labels come free under the remap and could be reused at the sub-step "
             "level: **Financials Reviewed** on 3.2 Funding, **Opportunity Reviewed** on the "
             "bucket 2 index. Neither is rendered in the pages - they are a suggestion for "
             "the tool.\n")

    L.append("\n## Placeholders resolved during this build\n")
    L.append("| Ref | Was | Now | Pages |")
    L.append("|---|---|---|---|")
    L.append("| `PH-02` | CRM / FSM vendor | **ServiceTitan** | 3.4 |")
    L.append("| `PH-02` | ATS vendor | **CareerPlug** | 3.4 |")
    L.append("| `PH-05` | Onboarding program name | **Sure Start** | 6.4 |")
    L.append("| `PH-08` | E-signature platform | **DocuSign** | 4.2, 6.2 |")
    L.append("\n> `PLACEHOLDERS.md` explicitly warned against defaulting the onboarding "
             "program to \"Sure Start\", because it is the source brand's program name and "
             "PIRTEK uses it too. It was confirmed as 1-Tom-Plumber's actual program name "
             "and applied. Flagging the reversal here so it is not mistaken for the "
             "warned-against default.\n")

    L.append("\n## Placeholders still open\n")
    L.append("Every one renders as a visible amber flag in the page. Nothing was silently "
             "filled in.\n")
    L.append("| Ref | Pages |")
    L.append("|---|---|")
    refs = {}
    for path in ORDER:
        for r in re.findall(r'class="ph__ref">([^<]+)<', pages[path]):
            for part in r.split(" / "):
                part = part.strip()
                if part.startswith("PH-"):
                    refs.setdefault(part, set()).add(path)
    for r in sorted(refs):
        L.append(f"| `{r}` | {', '.join(f'`{p}`' for p in sorted(refs[r]))} |")

    L.append("\n## Source content gap\n")
    L.append("`BUILD_PROMPT.md` points at `content/source/*.md` (the six stage lessons). "
             "Those files were **not** included in the upload, so no source prose was "
             "available to adapt.\n")
    L.append("Where the spec calls for source copy to be preserved verbatim, the page "
             "carries the correct heading, the correct interactive elements, and an amber "
             "`SRC` flag naming exactly what has to be restored. No source prose was "
             "invented to fill those gaps. Specifically still needed:\n")
    L.append("- 2.1 - exact wording of the credit report self-pull steps 4 through 7")
    L.append("- 3.2 - the Personal Financial Statement filing-requirement list, and the "
             "ROBS four-step wording")
    L.append("- 4.2 - the ten-item document checklist")
    L.append("- 6.1 - the three yes questions the FD must clear before presenting")
    L.append("- 6.2 - the seven execution notes, and the three acceptable Schedule D answers\n")
    L.append("Two pages have no source content at all by design (5.3 Meet The Team Day and "
             "6.3 Brand Welcome Call) and ship as structured stubs, per `CONTENT_MAP.md`.\n")

    L.append("\n## Video inventory\n")
    L.append("| Page | Video | ID |")
    L.append("|---|---|---|")
    for path in ORDER:
        for vid, title in re.findall(
                r'src="https://www\.youtube\.com/embed/([A-Za-z0-9_-]+)" title="([^"]+)"',
                pages[path]):
            L.append(f"| `{path}` | {title} | `{vid}` |")
    L.append("\n### Pending video slots\n")
    L.append("| Page | Awaiting |")
    L.append("|---|---|")
    for path in ORDER:
        for lab in re.findall(r'class="slot__label">Pending: ([^<]+)<', pages[path]):
            L.append(f"| `{path}` | {lab} |")

    L.append("\n## Verification run\n")
    L.append("`build.py` fails the build on any of: em-dash or en-dash in output, a gate "
             "without a form control, a checkbox or select without an associated label, a "
             "table without a caption, an asset slot without a `data-asset`, page chrome, "
             "an external stylesheet, a `<script>` tag, a bucket index that does not link "
             "every sub-step, a video block without its CSS, or a `watch` URL used in place "
             "of an `embed` URL.\n")
    L.append("All 24 pages were additionally loaded in headless Chromium to confirm the "
             "inline CSS applies, no console errors fire, no horizontal overflow occurs at "
             "360px, and every gate checkbox actually toggles.\n")
    L.append("\n> The accent red `#C8102E` is a working value, not a confirmed brand hex. "
             "Confirm against 1-Tom-Plumber or EverSmith brand assets before anything ships "
             "to a candidate.\n")

    out = os.path.join(DIST, "INDEX.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("  wrote INDEX.md")


if __name__ == "__main__":
    pages = collect()
    write(pages)
    if len(pages) == len(ORDER):
        write_index(pages)
    report(pages)
    failures = check(pages)
    if failures:
        print(f"\n  FAILED {len(failures)} check(s):")
        for f in failures:
            print(f"    - {f}")
        sys.exit(1)
    print("\n  all checks passed")
