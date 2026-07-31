"""Page shell for the 1-Tom-Plumber MEG sales room.

CSS is lifted verbatim from spec/page-template.html. Token values come from
spec/tokens.css, which states they are the real production values and must not
be substituted or invented.

Every page carries all four chrome elements (topbar, hero, journey, footer) and
the spine-and-slides stack. Pages remain self-contained: inline CSS, no build
step, no JS.
"""

CSS = """:root{
  --ink:#12151A; --paper:#FAF9F6; --card:#FFFFFF; --pink:#E8175D; --pink-dk:#B80E48;
  --slate:#5B6470; --line:#E5E2DC; --flag-bg:#FBF3D6; --flag-ink:#7A5E12; --flag-line:#E4CE8A;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans',-apple-system,'Segoe UI',sans-serif;
  font-size:16.5px;line-height:1.62;-webkit-font-smoothing:antialiased}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
a{color:var(--pink-dk)}
/* top bar */
.topbar{background:var(--ink);color:#fff;padding:14px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.topbar .meg{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:22px;letter-spacing:.06em}
.topbar .meg b{color:var(--pink)}
.topbar .sub{font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#9AA3AE}
.topbar .chip{margin-left:auto;border:1px solid var(--pink);color:var(--pink);font-family:'IBM Plex Mono',monospace;
  font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:5px 12px;border-radius:2px}
/* hero */
.hero{background:var(--ink);color:#fff;padding:56px 24px 44px}
.hero-in{max-width:880px;margin:0 auto}
.hero .stageno{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:15px;letter-spacing:.32em;
  text-transform:uppercase;color:var(--pink);margin-bottom:10px}
.hero h1{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:clamp(40px,7vw,68px);
  line-height:.98;text-transform:uppercase;letter-spacing:.01em;overflow-wrap:break-word}
.hero .subtitle{margin-top:14px;color:#C6CBD2;font-size:18px;max-width:56ch}
.ticket{margin-top:30px;display:flex;flex-wrap:wrap;gap:0;border:1px solid #2A2F37}
.ticket div{padding:10px 18px;border-right:1px solid #2A2F37;min-width:150px;flex:1}
.ticket div:last-child{border-right:none}
.ticket .k{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8A93A0}
.ticket .v{font-size:14px;color:#EDEFF2;margin-top:3px}
/* journey */
.journey{background:var(--ink);border-top:1px solid #23272E;padding:26px 24px 32px}
.journey-in{max-width:880px;margin:0 auto}
.jhead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px}
.jhead .jt{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:15px;letter-spacing:.26em;text-transform:uppercase;color:#fff}
.jhead .jc{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.16em;color:var(--pink)}
.jtrack{display:flex}
.jstep{flex:1;text-align:center;position:relative}
.jstep::before{content:"";position:absolute;top:16px;left:calc(-50% + 17px);width:calc(100% - 34px);height:3px;background:#2C313A;border-radius:2px}
.jstep:first-child::before{display:none}
.jstep.done::before{background:var(--pink-dk)}
.jstep.now::before{background:linear-gradient(90deg,var(--pink-dk),var(--pink))}
.jnode{width:34px;height:34px;border-radius:50%;margin:0 auto;position:relative;z-index:1;
  display:flex;align-items:center;justify-content:center;
  font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:15px;
  border:2px solid #39404B;color:#7C8592;background:var(--ink)}
.jstep.done .jnode{background:var(--pink-dk);border-color:var(--pink-dk);color:#fff}
.jstep.now .jnode{background:var(--pink);border-color:#fff;color:#fff;
  box-shadow:0 0 0 5px rgba(232,23,93,.22),0 4px 14px rgba(232,23,93,.45)}
.jlbl{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7C8592;margin-top:10px}
.jstep.done .jlbl{color:#A8AFB9}
.jstep.now .jlbl{color:#fff;font-weight:500}
.jhere{display:inline-block;margin-top:6px;background:var(--pink);color:#fff;font-family:'IBM Plex Mono',monospace;
  font-size:8.5px;letter-spacing:.16em;padding:3px 8px;border-radius:2px}
/* video embed */
.video-embed{margin:6px 0 8px;border-radius:4px;overflow:hidden;border:1px solid var(--line);
  position:relative;padding-top:56.25%;background:#000}
.video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-cap{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--slate);margin:8px 0 18px}
/* slide stack + spine */
.stack{max-width:880px;margin:0 auto;padding:48px 24px 24px;position:relative}
.stack::before{content:"";position:absolute;top:60px;bottom:40px;left:24px;width:3px;background:linear-gradient(var(--pink),var(--pink-dk))}
.slide{background:var(--card);border:1px solid var(--line);border-radius:4px;margin:0 0 34px 44px;padding:34px 38px;position:relative;
  box-shadow:0 1px 2px rgba(18,21,26,.05)}
.slide::before{content:attr(data-n);position:absolute;left:-44px;top:26px;transform:translateX(-50%);
  width:34px;height:34px;border-radius:50%;background:var(--pink);color:#fff;display:flex;align-items:center;justify-content:center;
  font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:16px;box-shadow:0 0 0 5px var(--paper)}
.slide .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--pink-dk);margin-bottom:10px}
.slide h3{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:32px;line-height:1.04;
  text-transform:uppercase;margin-bottom:16px}
.slide h4{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:600;font-size:21px;text-transform:uppercase;
  letter-spacing:.02em;margin:26px 0 8px;color:var(--ink)}
.slide p{margin:0 0 14px;color:#2A2F37}
.slide p:last-child{margin-bottom:0}
.slide strong{color:var(--ink)}
.slide ul,.slide ol{margin:0 0 16px 22px}
.slide li{margin-bottom:7px;color:#2A2F37}
.slide table{border-collapse:collapse;width:100%;margin:6px 0 18px;font-size:15px}
.slide th{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  text-align:left;color:var(--slate);border-bottom:2px solid var(--ink);padding:8px 12px}
.slide td{border-bottom:1px solid var(--line);padding:10px 12px;vertical-align:top}
.slide tr td:first-child{white-space:nowrap;font-weight:600}
.t-scroll{overflow-x:auto}
.slide caption{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--slate);text-align:left;padding-bottom:8px}
blockquote{background:var(--flag-bg);border:1px solid var(--flag-line);border-left:4px solid var(--flag-ink);
  border-radius:3px;padding:14px 18px;margin:0 0 16px;font-size:14px;color:var(--flag-ink)}
blockquote p{color:var(--flag-ink)!important;margin-bottom:8px}
blockquote::before{content:"\\2699 INTERNAL \\2014 BUILD AUTOMATION";display:block;font-family:'IBM Plex Mono',monospace;
  font-size:10px;letter-spacing:.18em;margin-bottom:8px}
.video-slot{border:2px dashed #C9CDD4;border-radius:4px;background:#F3F2EE;padding:22px;margin:6px 0 18px;
  display:flex;align-items:center;gap:14px;color:var(--slate)}
.video-slot .play{width:40px;height:40px;border-radius:50%;background:var(--ink);color:#fff;display:flex;
  align-items:center;justify-content:center;font-size:14px;flex:none}
.video-slot .t{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.flag{display:block;background:var(--flag-bg);border:1px solid var(--flag-line);border-left:4px solid var(--flag-ink);
  border-radius:3px;padding:12px 16px;margin:10px 0 16px;font-size:13.5px;color:var(--flag-ink)}
.flag b{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;display:block;margin-bottom:6px}
.flag-in{display:inline;background:var(--flag-bg);border:1px solid var(--flag-line);border-radius:3px;
  padding:1px 7px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--flag-ink)}
/* GATE - compliance acknowledgment. Pink-bordered, real control. */
.gate{border:2px solid var(--pink);border-radius:4px;background:#FEF2F6;padding:22px 24px;margin:10px 0 20px}
.gate .glabel{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--pink-dk);margin-bottom:10px}
.gate .gtext{font-size:16.5px;font-weight:600;color:var(--ink);margin-bottom:16px;line-height:1.5}
.gate .gnote{font-size:14.5px;color:var(--slate);margin-bottom:16px}
.gate .gcheck{display:flex;align-items:flex-start;gap:11px;border-top:1px solid rgba(232,23,93,.25);padding-top:14px}
.gate .gcheck input[type=checkbox]{width:20px;height:20px;flex:none;margin-top:2px;accent-color:var(--pink);cursor:pointer}
.gate .gcheck label{font-weight:600;cursor:pointer}
.gate select{font-family:'IBM Plex Sans',sans-serif;font-size:15px;padding:9px 11px;border:1px solid var(--line);
  background:var(--card);width:100%;max-width:340px;border-radius:2px}
.sr-only{position:absolute;left:-9999px}
/* asset slots - download / form / scheduler */
.asset{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:4px;background:var(--card);
  padding:14px 18px;margin:8px 0 16px;text-decoration:none;color:inherit}
.asset:hover{border-color:var(--pink)}
.asset .kind{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  background:var(--ink);color:#fff;padding:5px 9px;border-radius:2px;flex:none}
.asset .lbl{font-weight:600}
.quiz{list-style:none;margin:4px 0 18px 0!important}
.quiz li{border:1px solid var(--line);border-radius:3px;padding:11px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:baseline;background:#FCFCFA}
.quiz li .box{font-family:'IBM Plex Mono',monospace;font-size:13px;color:#AEB4BC;flex:none}
.quiz li.correct{border-color:var(--pink);background:#FEF2F6}
.quiz li.correct .box{color:var(--pink);font-weight:700}
.quiz li.correct::after{content:"CORRECT";margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:9.5px;
  letter-spacing:.16em;color:var(--pink);align-self:center}
.ui-chip{display:inline-block;background:var(--ink);color:#fff;font-family:'IBM Plex Mono',monospace;font-size:12px;
  letter-spacing:.1em;text-transform:uppercase;padding:9px 18px;border-radius:2px;margin:2px 6px 2px 0}
/* substep list - bucket index pages only */
.substeps{list-style:none;margin:4px 0 0 0!important}
.substeps li{border-bottom:1px solid var(--line)}
.substeps a{display:flex;align-items:baseline;gap:14px;padding:15px 4px;text-decoration:none;color:var(--ink)}
.substeps a:hover .sst{color:var(--pink-dk)}
.ssn{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--pink);flex:none;width:22px}
.sst{font-weight:600}
.ssnote{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--slate)}
.nextstep{background:var(--ink);color:#fff;border-radius:4px;margin:6px 0 34px 44px;padding:30px 38px}
.nextstep .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--pink);margin-bottom:10px}
.nextstep p{color:#D9DDE2;margin-bottom:12px}
.nextstep strong{color:#fff}
footer{max-width:880px;margin:0 auto;padding:10px 24px 56px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;
  font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--slate)}
footer a{color:var(--slate)}
@media(max-width:640px){
  .stack::before{left:14px}
  .slide{margin-left:30px;padding:24px 20px}
  .slide::before{left:-30px;width:28px;height:28px;font-size:14px}
  .nextstep{margin-left:30px;padding:24px 20px}
  .jlbl{display:none}
  .jstep.now .jlbl{display:block;font-size:9px}
  .jhere{display:none}
  .jnode{width:28px;height:28px;font-size:13px}
  .jstep::before{top:13px;left:calc(-50% + 14px);width:calc(100% - 28px)}
  .ticket div{min-width:46%}
  /* The template's nowrap first column assumes short labels. Real copy is
     longer, so let it wrap rather than push the page sideways. */
  .slide tr td:first-child{white-space:normal}
  .asset{flex-wrap:wrap}
  .asset .lbl,.video-slot .t{overflow-wrap:anywhere;min-width:0}
}
:focus-visible{outline:3px solid var(--pink);outline-offset:2px}"""

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700'
    "&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap\" "
    'rel="stylesheet">'
)

BUCKET_LABELS = [
    "Welcome", "Brand Overview", "Validation",
    "Seeking Approval", "Meet The Team Day", "Agreement",
]


def journey(current):
    """The six-node progress track. current is 1-indexed."""
    out = []
    for i, label in enumerate(BUCKET_LABELS, 1):
        cls = "jstep done" if i < current else ("jstep now" if i == current else "jstep")
        here = ('<div><span class="jhere">You are here</span></div>'
                if i == current else "")
        out.append(f'<div class="{cls}"><div class="jnode">{i}</div>'
                   f'<div class="jlbl">{label}</div>{here}</div>')
    return (
        '<div class="journey"><div class="journey-in">\n'
        '<div class="jhead"><span class="jt">Your path to ownership</span>'
        f'<span class="jc">Stage {current} of 6</span></div>\n'
        '<div class="jtrack">\n' + "\n".join(out) + "\n</div></div></div>"
    )


def render(title, stage_n, stage_title, h1, lede, slides, next_html):
    """Assemble one self-contained page.

    slides: list of (eyebrow_title, show_h3, inner_html). Numbered along the spine.
    The opening slide takes its eyebrow from the page H1 but does not repeat it
    as an h3, since the hero already carries it.
    """
    stack = []
    for i, (slide_title, show_h3, inner) in enumerate(slides, 1):
        eyebrow = f"Slide {i:02d} · {slide_title}" if slide_title else f"Slide {i:02d}"
        heading = f"<h3>{slide_title}</h3>\n" if (slide_title and show_h3) else ""
        stack.append(
            f'<section class="slide" data-n="{i:02d}">\n'
            f'<div class="eyebrow">{eyebrow}</div>\n{heading}{inner}\n</section>'
        )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
{FONTS}
<style>
{CSS}
</style></head><body>

<div class="topbar"><span class="meg">MEG<b>.</b></span>
<span class="sub">1-Tom-Plumber · Mutual Evaluation Guide</span>
<span class="chip">Stage {stage_n} of 6</span></div>

<div class="hero"><div class="hero-in">
<div class="stageno">Stage {stage_n:02d} · {stage_title}</div>
<h1>{h1}</h1>
<p class="subtitle">{lede}</p>
</div></div>

{journey(stage_n)}

<main class="stack">

{chr(10).join(stack)}

{next_html}

</main>
<footer><span>MEG · Mutual Evaluation Guide</span>
<span>1-Tom-Plumber · An EverSmith Brands Company</span></footer>
</body></html>
"""


# ---------------------------------------------------------------- components

def video(url, title, caption=None):
    cap = (f'\n<div class="video-cap">▶ {caption}</div>'
           if caption else "")
    return (
        f'<div class="video-embed"><iframe src="{url}" title="{title}" '
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; '
        'picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' + cap
    )


def video_slot(label):
    return (f'<div class="video-slot"><span class="play">▶</span>'
            f'<span class="t">Pending — {label}</span></div>')


def asset(kind, label, ref):
    return (f'<a class="asset" href="#" data-asset="{ref}">'
            f'<span class="kind">{kind}</span><span class="lbl">{label}</span></a>')


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


def table(caption, headers, rows):
    head = "".join(f"<th>{h}</th>" for h in headers)
    body = "\n".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return (f'<div class="t-scroll"><table>\n<caption>{caption}</caption>\n'
            f"<thead><tr>{head}</tr></thead>\n<tbody>\n{body}\n</tbody>\n</table></div>")


def substeps(items):
    rows = "\n".join(
        f'<li><a href="{href}"><span class="ssn">{n}</span>'
        f'<span class="sst">{t}</span><span class="ssnote">{note}</span></a></li>'
        for href, n, t, note in items
    )
    return f'<ul class="substeps">\n{rows}\n</ul>'


def next_step(text):
    return f"""<div class="nextstep">
<div class="eyebrow">Next Step</div>
<p><strong>{text}</strong></p>
<p><span class="ui-chip">Mark Complete</span> <span class="mono" style="font-size:11px;color:#8A93A0">→ returns candidate to MEG dashboard</span></p>
</div>"""
