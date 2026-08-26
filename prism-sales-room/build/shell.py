"""Page shell for the Prism Specialties MEG sales room.

Same approach as the 1-Tom build: the CSS, the hero wave and the journey stove
icon are extracted from spec/page-template.html at build time, so a redesign is
a drop-in. Only the chrome differs between the two brands; every content
component (gate, flag, btn, slide, table, quiz) has the same class names, so
parse.py is shared.

No brand book has been supplied for Prism Specialties; the palette is taken
from the supplied draft template as authored (Frutiger with Open Sans fallback).
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

# The Stage 1 draft ships no component styles; append the shared set.
with open(os.path.join(HERE, "components.css"), encoding="utf-8") as _fh:
    CSS += "\n" + _fh.read()

_FONTS_CSS = os.path.join(HERE, "fonts.css")
FONTS_EMBEDDED = os.path.exists(_FONTS_CSS)
if FONTS_EMBEDDED:
    with open(_FONTS_CSS, encoding="utf-8") as _fh:
        CSS = _fh.read() + "\n" + CSS

FONTS = ("" if FONTS_EMBEDDED else
         "\n".join(re.findall(r'<link[^>]*(?:preconnect|fonts\.googleapis)[^>]*>', _T)))

WAVE = _grab(r'(<svg class="hero-wave".*?</svg>)', "the hero wave svg")

BUCKET_LABELS = [
    "Welcome", "Brand Overview", "Validation",
    "Seeking Approval", "Meet The Team Day", "Agreement",
]

LOGO = ""
LOGO_MISSING = True
if os.path.exists(LOGO_B64):
    with open(LOGO_B64, encoding="utf-8") as _fh:
        _b64 = "".join(_fh.read().split())
    if _b64:
        # Mark sits on its white plate exactly as the supplied draft has it.
        LOGO = ('<div class="logo-plate"><img class="brandmark" '
                f'src="data:image/png;base64,{_b64}" alt="Prism Specialties" '
                'width="720" height="391" fetchpriority="high" decoding="sync"></div>')
        LOGO_MISSING = False



def _extract_jsteps():
    """The template draws six unique step illustrations (state comes from the
    .done/.now classes in its CSS). Capture each block verbatim and re-class
    per page rather than trying to regenerate the artwork."""
    out = []
    for m in re.finditer(r'<div class="jstep', _T):
        i = m.start(); depth = 0
        for tag in re.finditer(r'<div\b|</div>', _T[i:]):
            depth += 1 if tag.group(0) == '<div' else -1
            if depth == 0:
                out.append(_T[i:i + tag.end()])
                break
    if len(out) != 6:
        raise SystemExit(f"page-template.html: expected 6 jstep blocks, found {len(out)}")
    norm = []
    for blk in out:
        blk = blk.replace('<div class="jstep now" aria-current="step">',
                          '<div class="jstep">', 1)
        blk = re.sub(r'<span class="sr-only">[^<]*</span>', '', blk)
        norm.append(blk)
    return norm


_JSTEPS = _extract_jsteps()


def journey(current):
    """Six template-drawn steps; completed and current state is re-classed."""
    out = []
    for i, blk in enumerate(_JSTEPS, 1):
        here = " — you are here" if i == current else ""
        if i < current:
            blk = blk.replace('<div class="jstep">', '<div class="jstep done">', 1)
        elif i == current:
            blk = blk.replace('<div class="jstep">',
                              '<div class="jstep now" aria-current="step">', 1)
        j = blk.rfind('</div>')
        blk = blk[:j] + f'<span class="sr-only">Step {i} of 6{here}</span>' + blk[j:]
        out.append(blk)
    return (
        '<div class="journey"><div class="journey-in">\n'
        '<div class="jhead"><span class="jt">Your path to ownership</span>'
        f'<span class="jc">Stage {current} of 6</span></div>\n'
        '<div class="jtrack">\n' + "\n".join(out) + "\n</div></div></div>"
    )



def render(title, stage_n, stage_title, h1, lede, slides, next_html):
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
<span class="sub">Prism Specialties · Mutual Evaluation Guide</span>
<span class="chip">Stage {stage_n} of 6</span></div></div>

<div class="hero">
{WAVE}
<div class="hero-in">
<div class="hero-copy">
<h1>{h1}</h1>
<p class="subtitle">{lede}</p>
</div>
{LOGO}
</div></div>

{journey(stage_n)}

<main class="stack">

{chr(10).join(cards)}

</main>
<footer><span>MEG · Mutual Evaluation Guide</span>
<span>Prism Specialties · An EverSmith Brands Company</span></footer>
</body></html>
"""


# --------------------------------------------------- components (shared names)

def video(url, title, caption=None):
    cap = f'\n<div class="video-cap">▶ {caption}</div>' if caption else ""
    return (
        f'<div class="video-embed"><iframe src="{url}" title="{title}" '
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; '
        'picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' + cap
    )


def video_slot(label):
    return (f'<div class="video-slot"><span class="play">▶</span>'
            f'<span class="t">Video slot · {label}</span></div>')


# Real destinations, once known, go here keyed by asset ref; an absent ref
# renders href="#" and is wired in the CMS. Nothing is invented.
ASSET_URLS = {
    "download:sba-personal-financial-statement-fillable-pdf":
        "https://legacy.sba.gov/document/sba-form-413-personal-financial-statement",
}


def asset(kind, label, ref):
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
    return f"<p>{text}</p>"
