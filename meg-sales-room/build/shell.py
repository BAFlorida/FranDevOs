"""Page shell for the 1-Tom-Plumber MEG sales room.

The CSS, the font links, the hero swoosh and the journey leak artwork are all
extracted from spec/page-template.html at build time rather than copied into
this file. A redesign is therefore a drop-in: replace the template, rebuild.

Every page carries topbar, pink hero, journey pipe, card stack and footer.
Pages remain self-contained: inline CSS, no build step, no JS.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TEMPLATE = os.path.join(ROOT, "spec", "page-template.html")
LOGO_B64 = os.path.join(HERE, "logo.b64")

with open(TEMPLATE, encoding="utf-8") as _fh:
    _T = _fh.read()


def _grab(pattern, what):
    m = re.search(pattern, _T, re.S)
    if not m:
        raise SystemExit(f"page-template.html: could not find {what}")
    return m.group(1) if m.groups() else m.group(0)


CSS = _grab(r"<style>\n(.*?)\n</style>", "the <style> block")

# The type system is embedded rather than linked. A linked webfont dies wherever
# the outbound request is blocked - a strict CMS, an offline copy, a page under
# a content policy - and Anton then falls back to a generic sans, which is
# exactly the "greyed out headline" failure. Regenerate with subset_fonts.py.
_FONTS_CSS = os.path.join(HERE, "fonts.css")
FONTS_EMBEDDED = os.path.exists(_FONTS_CSS)
if FONTS_EMBEDDED:
    with open(_FONTS_CSS, encoding="utf-8") as _fh:
        CSS = _fh.read() + "\n" + CSS

# Refinements the real content needs, kept out of spec/page-template.html so
# the handed-over template stays pristine and these stay reviewable.
CSS += """
/* ---- build refinements, not in spec/page-template.html ----------------- */
/* The leak is deliberately wider than one step. On the final joint that pushes
   the document sideways at narrow widths. Clip the band on x only: `clip`
   rather than `hidden` so the caution sign can still stand up out of the
   puddle on the y axis, which the template's comment calls load-bearing. */
.journey{overflow-x:clip}"""
# With the faces embedded there is nothing to preconnect or fetch.
FONTS = ("" if FONTS_EMBEDDED else
         "\n".join(re.findall(r'<link[^>]*(?:preconnect|fonts\.googleapis)[^>]*>', _T)))
SWOOSH = _grab(r'(<svg class="hero-swoosh".*?</svg>)', "the hero swoosh svg")
SPILL = _grab(r'(<div class="spill">.*?</svg></div>)', "the journey leak svg")

BUCKET_LABELS = [
    "Welcome", "Brand Overview", "Validation",
    "Seeking Approval", "Meet The Team Day", "Agreement",
]

# The template's logo is a data URI that arrived truncated. Drop a full base64
# payload in build/logo.b64 and it is embedded; until then the <img> is omitted
# rather than emitting a broken image.
LOGO = ""
LOGO_MISSING = True
if os.path.exists(LOGO_B64):
    with open(LOGO_B64, encoding="utf-8") as _fh:
        _b64 = "".join(_fh.read().split())
    if _b64:
        LOGO = (f'<img class="brandmark" src="data:image/png;base64,{_b64}" '
                'alt="1-Tom-Plumber" width="284" height="178" '
                'fetchpriority="high" decoding="sync">')
        LOGO_MISSING = False


def journey(current):
    """The pipe. Water fills completed spans and leaks at the current joint."""
    out = []
    for i, label in enumerate(BUCKET_LABELS, 1):
        if i < current:
            out.append(f'<div class="jstep done"><div class="jlbl">{label}</div>'
                       f'<div class="jnode">{i}</div></div>')
        elif i == current:
            out.append(
                f'<div class="jstep now" aria-current="step">'
                f'<div class="jlbl">{label}</div><div class="jnode">{i}</div>'
                f'<span class="sr-only">You are here</span>\n{SPILL}</div>')
        else:
            out.append(f'<div class="jstep"><div class="jlbl">{label}</div>'
                       f'<div class="jnode">{i}</div></div>')
    return (
        '<div class="journey"><div class="journey-in">\n'
        '<div class="jhead"><span class="jt">Your path to ownership</span>'
        f'<span class="jc">Stage {current} of 6</span></div>\n'
        '<div class="jtrack">\n' + "\n".join(out) + "\n</div></div></div>"
    )


def render(title, stage_n, stage_title, h1, lede, slides, next_html):
    """Assemble one self-contained page.

    slides: list of (section_title, show_h3, inner_html). The opening card
    takes no h3, since the hero already carries the page title.
    """
    cards = []
    for slide_title, show_h3, inner in slides:
        heading = f"<h3>{slide_title}</h3>\n" if (slide_title and show_h3) else ""
        cards.append(f'<section class="slide">\n{heading}{inner}\n</section>')
    if next_html:
        cards.append(next_html)

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
{FONTS}
<style>
{CSS}
</style></head><body>

<div class="topbar"><div class="topbar-in"><span class="meg">MEG<b>.</b></span>
<span class="sub">1-Tom-Plumber · Mutual Evaluation Guide</span>
<span class="chip">Stage {stage_n} of 6</span></div></div>

<div class="hero">
{SWOOSH}
<div class="hero-in">
<div class="hero-copy">
<h1 class="outlined">{h1}</h1>
<p class="subtitle">{lede}</p>
</div>
{LOGO}
</div></div>

{journey(stage_n)}

<main class="stack">

{chr(10) .join(cards)}

</main>
<footer><span>MEG · Mutual Evaluation Guide</span>
<span>1-Tom-Plumber · An EverSmith Brands Company</span></footer>
</body></html>
"""


# ---------------------------------------------------------------- components

def video(url, title, caption=None):
    cap = f'\n<div class="video-cap">▶ {caption}</div>' if caption else ""
    return (
        f'<div class="video-embed"><iframe src="{url}" title="{title}" '
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; '
        'picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' + cap
    )


def video_slot(label):
    return (f'<div class="video-slot"><span class="play">▶</span>'
            f'<span class="t">Pending — {label}</span></div>')


# Live destinations, exactly as wired on John's rebuilt CMS pages. An asset ref
# absent here renders href="#" and is wired in the CMS; nothing is invented.
ASSET_URLS = {
    "form:qualification-summary-form":
        "https://na4.docusign.net/Member/PowerFormSigning.aspx"
        "?PowerFormId=ac9012b2-bd64-4b9d-8546-4423ed44ccae&amp;env=na4"
        "&amp;acct=f3a07e16-9d68-4247-8407-8b476c0d9169&amp;v=2",
    "form:culture-index-survey":
        "https://surveys.cultureindex.com/s/unupYpLkij/114568",
    "link:b-verify": "https://bverify.boefly.com/eversmith",
}


def asset(kind, label, ref):
    """Every actionable link is a .btn.

    The template's own comment is explicit: "Every actionable link on the page
    uses this one class - forms, scheduler and B-Verify alike - so there is a
    single button appearance to maintain." data-asset is kept so the real URL
    can be wired by attribute rather than by hunting through markup.
    """
    href = ASSET_URLS.get(ref, "#")
    return (f'<a class="btn" href="{href}" data-asset="{ref}" target="_blank" '
            f'rel="noopener">{label} <span aria-hidden="true">&#8599;</span></a>')


def btnrow(buttons):
    # John's pages wrap every button run - singles included - so the mobile
    # stacking rules apply uniformly.
    return '<div class="btnrow">\n' + "\n".join(buttons) + "\n</div>"


def flag(text, ref=None):
    label = f"<b>PLACEHOLDER — {ref}</b>" if ref else "<b>PLACEHOLDER</b>"
    return f'<span class="flag">{label}{text}</span>'


def flag_inline(text, ref=None):
    tag = f"{ref} " if ref else ""
    return f'<span class="flag-in">{tag}{text}</span>'


def gate(gate_id, statement, label="I understand", heading="Required acknowledgment"):
    return f"""<div class="gate">
  <div class="glabel">{heading}</div>
  <p class="gtext">{statement}</p>
  <div class="gcheck"><input type="checkbox" id="g-{gate_id}"><label for="g-{gate_id}">{label}</label></div>
</div>"""


def gate_select(gate_id, statement, options, heading="Required — self assessment",
                note=None):
    opts = "".join(f"<option>{o}</option>" for o in options)
    note_html = f'\n  <p class="gnote">{note}</p>' if note else ""
    return f"""<div class="gate">
  <div class="glabel">{heading}</div>
  <p class="gtext">{statement}</p>{note_html}
  <div class="gcheck">
    <label for="g-{gate_id}" class="sr-only">{statement}</label>
    <select id="g-{gate_id}"><option value="">Select one</option>{opts}</select>
  </div>
</div>"""


def table(caption, headers, rows, caption_hidden=False):
    head = "".join(f"<th>{h}</th>" for h in headers)
    body = "\n".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    cap = (f'<caption class="sr-only">{caption}</caption>' if caption_hidden
           else f"<caption>{caption}</caption>")
    return (f'<div class="t-scroll"><table>\n{cap}\n'
            f"<thead><tr>{head}</tr></thead>\n<tbody>\n{body}\n</tbody>\n</table></div>")


def substeps(items):
    rows = "\n".join(
        f'<li><a href="{href}"><span class="ssn">{n}</span>'
        f'<span class="sst">{t}</span><span class="ssnote">{note}</span></a></li>'
        for href, n, t, note in items
    )
    return f'<ul class="substeps">\n{rows}\n</ul>'


def next_step(text):
    """Unused. John's pages carry the closing pointer as prose inside the last
    content card rather than as a card of its own, and never use .eyebrow."""
    return f"<p>{text}</p>"
