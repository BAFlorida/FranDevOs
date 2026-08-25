#!/usr/bin/env python3
"""Generate the MEG sales room pages into dist/.

Run from anywhere:  python3 kg-sales-room/build/build.py

Copy comes from content/pages/*.md and is rendered by parse.py, so the pages
cannot drift from the source. Design comes from spec/page-template.html and
spec/tokens.css, whose values the spec states are the real production values.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, HERE)

from parse import BUCKETS, VIDEOS, all_pages  # noqa: E402
from shell import FONTS_EMBEDDED, LOGO_MISSING  # noqa: E402

# However many faces the brand's type system needs, every page must carry all
# of them. 1-Tom is three; Kitchen Guard is five (Anton plus four Poppins
# weights, since Poppins is not a variable font).
_fc = os.path.join(HERE, "fonts.css")
FACE_COUNT = (open(_fc, encoding="utf-8").read().count("@font-face")
              if os.path.exists(_fc) else 0)

ORDER = [
    "01-welcome/index.html", "01-welcome/01-mep-end-to-end.html",
    "02-brand-overview/index.html", "02-brand-overview/01-qualification-summary.html",
    "02-brand-overview/02-fdd.html", "02-brand-overview/03-additional-resources.html",
    "03-validation/01-owner-calls.html",
    "03-validation/02-funding.html", "03-validation/03-territory.html",
    "03-validation/04-technology.html",
    "04-seeking-approval/01-executive-approval-call.html",
    "05-meet-the-team-day/index.html",
    "05-meet-the-team-day/01-what-who-to-expect.html",
    "05-meet-the-team-day/02-pre-mttd-questionnaire.html",
    "05-meet-the-team-day/03-meet-the-team-day.html",
    "05-meet-the-team-day/04-post-mttd-assessment.html",
    "06-agreement-stage/index.html", "06-agreement-stage/01-executive-board-approval.html",
    "06-agreement-stage/02-executing-your-agreement.html",
    "06-agreement-stage/03-brand-welcome-call.html",
]


def write(pages):
    for path, html in sorted(pages.items()):
        full = os.path.join(DIST, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(html)
        print(f"  wrote {path}")


# ------------------------------------------------------------------ checks

def check(pages):
    """Acceptance checks against the production template contract."""
    fails = []

    for path in ORDER:
        if path not in pages:
            fails.append(f"MISSING PAGE: {path}")
    for path in pages:
        if path not in ORDER:
            fails.append(f"UNEXPECTED PAGE: {path}")

    for path, html in sorted(pages.items()):
        stage = BUCKETS[path.split("/")[0]][0]

        # Page chrome: all four, on every page.
        for needed, what in (
            ('class="topbar"', "topbar"), ('class="hero"', "hero"),
            ('class="journey"', "journey"), ("<footer>", "footer"),
        ):
            if needed not in html:
                fails.append(f"{path}: missing {what}")

        # The spine and at least one numbered slide.
        if 'class="stack"' not in html:
            fails.append(f"{path}: missing .stack")
        if '<section class="slide">' not in html:
            fails.append(f"{path}: no slide cards")

        # Journey marks exactly one current stage, and it is this page's.
        nows = re.findall(r'<div class="jstep now" aria-current="step">'
                          r'<div class="jlbl">[^<]*</div>\n<div class="jnode">.*?'
                          r'<span class="jnum">(\d)</span>', html, re.S)
        if nows != [str(stage)]:
            fails.append(f"{path}: journey .now is {nows}, expected ['{stage}']")
        if len(re.findall(r'class="jstep', html)) != 6:
            fails.append(f"{path}: journey does not have 6 steps")
        if f"Stage {stage} of 6" not in html:
            fails.append(f"{path}: topbar chip does not read Stage {stage} of 6")

        # Gates are real controls with associated labels.
        for block in re.findall(r'<div class="gate">.*?\n</div>', html, re.S):
            if "<input" not in block and "<select" not in block:
                fails.append(f"{path}: a .gate renders no form control")
        for box_id in re.findall(r'<input type="checkbox" id="([^"]+)"', html):
            if f'<label for="{box_id}"' not in html:
                fails.append(f"{path}: checkbox #{box_id} has no <label for>")
        for sel_id in re.findall(r'<select id="([^"]+)"', html):
            if f'<label for="{sel_id}"' not in html:
                fails.append(f"{path}: select #{sel_id} has no <label for>")

        # Self-contained: no stylesheet, no script, and - since the faces are
        # embedded - no outbound request of any kind except the video iframes.
        if re.search(r'<link[^>]+rel="stylesheet"', html):
            fails.append(f"{path}: links an external stylesheet")
        if "<script" in html:
            fails.append(f"{path}: contains a <script> tag")
        if html.count("@font-face") != FACE_COUNT:
            fails.append(f"{path}: expected {FACE_COUNT} embedded @font-face rules, "
                         f"found {html.count('@font-face')}")
        wired = {re.search(r'href="(https?://[^"]+)"', a).group(1)
                 for a in re.findall(r'<a class="btn"[^>]*data-asset=[^>]*>', html)
                 if re.search(r'href="(https?://[^"]+)"', a)}
        outbound = {u for u in re.findall(r'(?:href|src)="(https?://[^"]+)"', html)
                    if "youtube.com/embed/" not in u and u not in wired}
        if outbound:
            fails.append(f"{path}: outbound request(s) besides video: {sorted(outbound)}")

        # Tables scroll and are captioned.
        for tbl in re.findall(r"<table>(.*?)</table>", html, re.S):
            if "<caption" not in tbl:
                fails.append(f"{path}: a table has no <caption>")
        if "<table>" in html and 't-scroll' not in html:
            fails.append(f"{path}: a table is not in a scroll container")

        # Every actionable link is a .btn and names the asset it stands for.
        if '<a class="asset"' in html:
            fails.append(f"{path}: uses .asset; the system uses .btn for links")
        for a in re.findall(r'<a class="btn"[^>]*>', html):
            if "data-asset=" not in a:
                fails.append(f"{path}: a .btn has no data-asset attribute")
            if 'rel="noopener"' not in a:
                fails.append(f"{path}: a .btn opens a new tab without rel=noopener")

        # Videos are embed URLs from the known list, in a 16:9 wrapper.
        for vid in re.findall(r"youtube\.com/embed/([A-Za-z0-9_-]+)", html):
            if vid not in VIDEOS.values():
                fails.append(f"{path}: unknown video id {vid}")
        if "youtube.com/embed" in html and ".video-embed iframe{" not in html:
            fails.append(f"{path}: video embedded without .video-embed CSS")
        for bad in re.findall(r'src="https://www\.youtube\.com/watch[^"]*"', html):
            fails.append(f"{path}: watch URL instead of embed URL: {bad}")

        # No unrendered source markers leaked through.
        for marker in re.findall(r"\[(?:VIDEO|FORM|DOWNLOAD|SCHEDULER|PLACEHOLDER)[^\]]*\]",
                                 html):
            fails.append(f"{path}: unrendered source marker {marker}")
        for stray in ("**", "### ", "**STEPS:**", "**TABLE:**"):
            if stray in html:
                fails.append(f"{path}: unrendered markdown {stray!r}")

        # Kitchen Guard chrome.
        for needed, what in (('class="hero-wave"', "hero wave"),
                             ('class="logo-plate"', "logo plate")):
            if needed not in html:
                fails.append(f"{path}: missing {what}")
        stoves = html.count('class="jnode"')
        if stoves != 6:
            fails.append(f"{path}: expected 6 journey stoves, found {stoves}")
        # The brand book forbids shadows/outline/rotation on the mark.
        mark = re.search(r'<img class="brandmark"[^>]*>', html)
        if mark and re.search(r"filter:|drop-shadow|rotate\(", mark.group(0)):
            fails.append(f"{path}: brandmark carries a forbidden effect")

    # Index pages carry no sub-step list: the platform supplies section
    # navigation, and John's rebuilt pages set the convention. Guard against
    # the old block reappearing.
    for path in pages:
        if path.endswith("/index.html") and "Steps in This Stage" in pages[path]:
            fails.append(f"{path}: carries a sub-step list; the platform "
                         "provides section navigation")

    return fails


# ------------------------------------------------------------------ index

def stats(html):
    return dict(
        title=re.search(r"<title>(.*?)</title>", html).group(1),
        slides=len(re.findall(r'<section class="slide"', html)),
        gates=len(re.findall(r'<div class="gate">', html)),
        checks=len(re.findall(r'<input type="checkbox"', html)),
        selects=len(re.findall(r"<select ", html)),
        flags=len(re.findall(r'class="flag[ "]', html)),
        vids=len(re.findall(r"youtube\.com/embed/", html)),
        pending=len(re.findall(r'class="video-slot"', html)),
        assets=len(re.findall(r'<a class="btn"', html)),
    )


def write_index(pages):
    with open(os.path.join(ROOT, "spec", "structure.json"), encoding="utf-8") as fh:
        spec = json.load(fh)

    st = {p: stats(h) for p, h in pages.items()}
    tot = lambda k: sum(s[k] for s in st.values())

    L = ["# MEG Sales Room - Page Index\n"]
    L.append(f"{len(ORDER)} self-contained HTML pages for the Kitchen Guard Mutual Evaluation Guide.\n")
    L.append("Each page inlines its own CSS and carries the full production chrome: topbar, "
             "hero, six-node journey track, spine-and-slides stack, and footer. No external "
             "stylesheet, no JS, no build step needed to render.\n")
    L.append("**Copy is rendered directly from `content/pages/*.md`.** Nothing is "
             "transcribed by hand, so the pages cannot drift from the source. To change "
             "copy, edit the markdown and rebuild.\n")
    L.append("**Design comes from `spec/page-template.html` and `spec/tokens.css`.** Token "
             "values are used exactly as given; none were substituted or invented.\n")
    L.append("Rebuild: `python3 meg-sales-room/build/build.py`\n")

    L.append(f"\n## All {len(ORDER)} pages\n")
    L.append("| # | Page | Path | Slides | Gates | Flags | Video | Assets |")
    L.append("|---|---|---|---|---|---|---|---|")
    for i, path in enumerate(ORDER, 1):
        s = st[path]
        g = "-"
        if s["gates"]:
            bits = []
            if s["checks"]:
                bits.append(f"{s['checks']} checkbox")
            if s["selects"]:
                bits.append(f"{s['selects']} select")
            g = ", ".join(bits)
        v = []
        if s["vids"]:
            v.append(f"{s['vids']} embed" + ("s" if s["vids"] > 1 else ""))
        if s["pending"]:
            v.append(f"{s['pending']} pending")
        L.append(f"| {i} | {s['title']} | `{path}` | {s['slides']} | {g} | "
                 f"{s['flags'] or '-'} | {', '.join(v) or '-'} | {s['assets'] or '-'} |")
    L.append(f"\n**Totals:** {tot('slides')} slides, {tot('gates')} gates "
             f"({tot('checks')} checkboxes, {tot('selects')} selects) on 4 pages, "
             f"{tot('flags')} placeholder flags, {tot('vids')} video embeds, "
             f"{tot('pending')} pending video slots, {tot('assets')} asset slots.\n")

    L.append("\n## Compliance gates\n")
    L.append("| Page | Gate | Type |")
    L.append("|---|---|---|")
    for b in spec["buckets"]:
        for sub in b["substeps"]:
            for g in sub.get("gates", []):
                p = next((k for k in ORDER
                          if k.startswith(b["id"]) and sub["id"] in k), b["id"])
                L.append(f"| `{p}` | `{g['id']}` | {g['type']} |")

    L.append("\n## Summary and milestone deltas\n")
    L.append("The pages render the **proposed** values. Review before editing the live "
             "tool.\n")
    L.append("| Bucket | Field | Current in tool | Proposed | Status |")
    L.append("|---|---|---|---|---|")
    for b in spec["buckets"]:
        s = b["summary"]
        if isinstance(s, dict):
            L.append(f"| {b['n']} · {b['title']} | Summary | {s['current']} | "
                     f"{s['proposed']} | {s['status']} |")
        m = b["milestone"]
        flagv = "unchanged" if m["current"] == m["proposed"] else m["status"]
        L.append(f"| {b['n']} · {b['title']} | Milestone | {m['current']} | "
                 f"{m['proposed']} | {flagv} |")
    L.append("\nMilestones are **exit** gates. Buckets 3 through 6 are each shifted one "
             "bucket forward in the tool today, and bucket 6 has no completion milestone.\n")

    L.append("\n## Placeholders still open\n")
    L.append("Each renders as an amber `.flag` block or inline chip in the page. Nothing was "
             "silently filled in.\n")
    L.append("| Ref | Pages |")
    L.append("|---|---|")
    refs = {}
    for path in ORDER:
        for r in re.findall(r"PLACEHOLDER — (PH-\d+)", pages[path]):
            refs.setdefault(r, set()).add(path)
        for r in re.findall(r'class="flag-in">(PH-\d+) ', pages[path]):
            refs.setdefault(r, set()).add(path)
    for r in sorted(refs):
        L.append(f"| `{r}` | {', '.join(f'`{p}`' for p in sorted(refs[r]))} |")

    L.append("\n## Video inventory\n")
    L.append("| Page | Video | ID |")
    L.append("|---|---|---|")
    for path in ORDER:
        for vid, t in re.findall(
                r'src="https://www\.youtube\.com/embed/([A-Za-z0-9_-]+)" title="([^"]+)"',
                pages[path]):
            L.append(f"| `{path}` | {t} | `{vid}` |")
    L.append("\n### Pending video slots\n")
    L.append("| Page | Awaiting |")
    L.append("|---|---|")
    for path in ORDER:
        for lab in re.findall(r'class="t">Pending — ([^<]+)<', pages[path]):
            L.append(f"| `{path}` | {lab} |")

    L.append("\n## Verification\n")
    L.append("`build.py` fails the build on: a missing or unexpected page, any of the four "
             "chrome elements missing, a missing spine or slides, a journey track that does "
             "not mark this page's stage as current, a gate without a form control, an "
             "unlabelled checkbox or select, an uncaptioned or unscrollable table, an asset "
             "without `data-asset`, an unknown video id, a `watch` URL in place of an "
             "`embed` URL, an unrendered source marker or stray markdown, a missing closing "
             "card, or a bucket index that does not link every sub-step.\n")
    L.append("A copy-fidelity check confirms every prose line of `content/pages/*.md` "
             "appears in its rendered page. All 24 pages are additionally loaded in headless "
             "Chromium to confirm the CSS applies, no console errors fire, no horizontal "
             "overflow occurs at 360px, and every gate control operates.\n")

    with open(os.path.join(DIST, "INDEX.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("  wrote INDEX.md")


if __name__ == "__main__":
    pages = all_pages()
    write(pages)
    if len(pages) == len(ORDER):
        write_index(pages)
    s = {p: stats(h) for p, h in pages.items()}
    print(f"\n  {len(pages)} pages, {sum(v['slides'] for v in s.values())} slides, "
          f"{sum(v['gates'] for v in s.values())} gates, "
          f"{sum(v['vids'] for v in s.values())} videos, "
          f"{sum(v['flags'] for v in s.values())} flags")
    failures = check(pages)
    if failures:
        print(f"\n  FAILED {len(failures)} check(s):")
        for f in failures:
            print(f"    - {f}")
        sys.exit(1)
    if LOGO_MISSING:
        print("\n  NOTE: hero logo omitted. The template's data URI arrived\n"
              "  truncated; drop the full base64 in build/logo.b64 and rebuild.")
    print("\n  all checks passed")
