#!/usr/bin/env python3
"""Assemble the 24 dist pages into one shareable single-file viewer.

The pages themselves are the product; this is a demo shell so the whole set
can be clicked through from one URL. Page CSS is scoped under .pane so the
sales room design system stays untouched while the shell keeps its own.
"""
import os, re, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, HERE)
from build import ORDER  # noqa: E402

BUCKETS = [
    ("01-welcome", "1", "Welcome"),
    ("02-brand-overview", "2", "Brand Overview"),
    ("03-validation", "3", "Validation"),
    ("04-seeking-approval", "4", "Seeking Approval"),
    ("05-meet-the-team-day", "5", "Meet The Team Day"),
    ("06-agreement-stage", "6", "Agreement Stage"),
]


def scope(css, prefix):
    """Prefix every selector so page CSS cannot leak into the shell."""
    out, i, n = [], 0, len(css)
    while i < n:
        brace = css.find("{", i)
        if brace == -1:
            out.append(css[i:]); break
        sel = css[i:brace].strip()
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{": depth += 1
            elif css[j] == "}": depth -= 1
            j += 1
        body = css[brace + 1:j - 1]
        if sel.startswith("@media") or sel.startswith("@supports"):
            out.append(f"{sel}{{{scope(body, prefix)}}}")
        elif sel.startswith("@"):
            out.append(f"{sel}{{{body}}}")
        elif sel == ":root":
            out.append(f":root{{{body}}}")
        else:
            parts = []
            for s in sel.split(","):
                s = s.strip()
                if not s: continue
                if s == "body": parts.append(prefix)
                elif s == "*": parts.append(f"{prefix} *")
                elif s.startswith(":focus-visible"): parts.append(s)
                else: parts.append(f"{prefix} {s}")
            out.append(f"{','.join(parts)}{{{body}}}")
        i = j
    return "".join(out)


pages, page_css = {}, None
for rel in ORDER:
    html = open(os.path.join(DIST, rel), encoding="utf-8").read()
    if page_css is None:
        page_css = scope(re.search(r"<style>\n(.*?)\n</style>", html, re.S).group(1), ".pane")
    body = re.search(r'<div class="wrap">\n(.*?)\n</div>\n</body>', html, re.S).group(1)
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    pages[rel] = (title, body)

# The video rule only ships on pages that use it; the viewer needs it once.
page_css += (".pane .video{position:relative;padding-bottom:56.25%;height:0;"
             "margin:20px 0 26px;max-width:74ch;background:#141414}"
             ".pane .video iframe{position:absolute;top:0;left:0;width:100%;"
             "height:100%;border:0}")

nav, panes = [], []
for bucket_id, num, label in BUCKETS:
    items = [r for r in ORDER if r.startswith(bucket_id + "/")]
    nav.append(f'<div class="grp"><div class="grp__h"><span class="grp__n">{num}</span>{label}</div>')
    for rel in items:
        title, _ = pages[rel]
        leaf = rel.split("/")[1]
        kind = "idx" if leaf == "index.html" else "sub"
        nav.append(f'<button class="nav {kind}" data-page="{rel}" type="button">{title}</button>')
    nav.append("</div>")

for rel in ORDER:
    title, body = pages[rel]
    panes.append(f'<article class="pane" id="p-{rel.replace("/", "__")}" hidden>{body}</article>')

meta = {r: pages[r][0] for r in ORDER}

HTML = f"""<title>1-Tom-Plumber MEG Sales Room - 24 Page Preview</title>
<style>
:root{{
  --shell:#16181C; --shell-2:#1E2126; --edge:#2C3037;
  --txt:#E6E4DF; --dim:#8B9099; --accent:#C8102E; --paper:#FAFAF7;
  --ui:'Barlow',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}}
*{{box-sizing:border-box}}
html,body{{margin:0;padding:0;height:100%}}
body{{font-family:var(--ui);background:var(--shell);color:var(--txt);
  display:grid;grid-template-columns:296px 1fr;height:100vh;overflow:hidden}}
:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}

.side{{background:var(--shell-2);border-right:1px solid var(--edge);
  overflow-y:auto;display:flex;flex-direction:column}}
.brand{{padding:20px 20px 16px;border-bottom:1px solid var(--edge);position:sticky;top:0;
  background:var(--shell-2);z-index:2}}
.brand__k{{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);margin-bottom:7px}}
.brand__t{{font-size:15px;font-weight:600;line-height:1.3}}
.brand__s{{font-size:12.5px;color:var(--dim);margin-top:5px;font-variant-numeric:tabular-nums}}
.grp{{padding:14px 12px 6px}}
.grp__h{{display:flex;align-items:center;gap:9px;padding:0 8px 8px;
  font-family:var(--mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}}
.grp__n{{width:17px;height:17px;display:grid;place-items:center;background:var(--edge);
  color:var(--txt);font-size:9.5px;flex:0 0 17px}}
.nav{{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);
  font-family:var(--ui);font-size:13.5px;line-height:1.35;padding:8px 10px 8px 34px;
  cursor:pointer;border-left:2px solid transparent;position:relative}}
.nav:hover{{background:#24272D}}
.nav.idx{{font-weight:600}}
.nav.idx::before{{content:"";position:absolute;left:18px;top:14px;width:5px;height:5px;
  background:var(--dim)}}
.nav.sub{{color:#B7BBC2}}
.nav.sub::before{{content:"";position:absolute;left:20px;top:16px;width:8px;height:1px;
  background:var(--edge)}}
.nav[aria-current=page]{{background:#282B32;border-left-color:var(--accent);color:#fff;font-weight:600}}
.nav[aria-current=page]::before{{background:var(--accent)}}

.main{{overflow-y:auto;background:var(--paper)}}
.bar{{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:14px;
  padding:11px 22px;background:rgba(22,24,28,.97);border-bottom:1px solid var(--edge);
  font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}}
.bar b{{color:var(--txt);font-weight:500}}
.bar__sp{{margin-left:auto;display:flex;gap:8px}}
.pg{{background:var(--edge);border:0;color:var(--txt);font-family:var(--mono);font-size:11px;
  padding:5px 11px;cursor:pointer;letter-spacing:.06em}}
.pg:hover{{background:var(--accent);color:#fff}}
.pg[disabled]{{opacity:.35;cursor:default}}
.pg[disabled]:hover{{background:var(--edge);color:var(--txt)}}
.wrapper{{padding:32px 24px 72px}}
.pane{{max-width:820px;margin:0 auto;background:transparent;padding:0!important}}
.pane[hidden]{{display:none}}

.menu{{display:none}}
@media (max-width:860px){{
  body{{grid-template-columns:1fr;grid-template-rows:auto 1fr}}
  .side{{position:fixed;inset:0 auto 0 0;width:280px;transform:translateX(-100%);
    transition:transform .18s ease;z-index:10}}
  .side.open{{transform:none}}
  .menu{{display:inline-block;background:var(--edge);border:0;color:var(--txt);
    font-family:var(--mono);font-size:11px;padding:5px 11px;cursor:pointer}}
}}
{page_css}
</style>

<nav class="side" id="side">
  <div class="brand">
    <div class="brand__k">Preview build</div>
    <div class="brand__t">1-Tom-Plumber Mutual Evaluation Guide</div>
    <div class="brand__s">24 sales room pages · 5 compliance gates · 18 videos</div>
  </div>
  {''.join(nav)}
</nav>

<div class="main" id="main">
  <div class="bar">
    <button class="menu" id="menu" type="button">Pages</button>
    <span id="crumb"><b>&nbsp;</b></span>
    <span class="bar__sp">
      <button class="pg" id="prev" type="button">&larr; Prev</button>
      <button class="pg" id="next" type="button">Next &rarr;</button>
    </span>
  </div>
  <div class="wrapper">{''.join(panes)}</div>
</div>

<script>
const ORDER = {json.dumps(ORDER)};
const META  = {json.dumps(meta)};
const side = document.getElementById('side');
const main = document.getElementById('main');
let cur = null;

function show(rel, push) {{
  if (!META[rel]) return;
  document.querySelectorAll('.pane').forEach(p => p.hidden = true);
  document.getElementById('p-' + rel.replace(/\\//g, '__')).hidden = false;
  document.querySelectorAll('.nav').forEach(b =>
    b.dataset.page === rel ? b.setAttribute('aria-current', 'page')
                           : b.removeAttribute('aria-current'));
  const i = ORDER.indexOf(rel);
  document.getElementById('crumb').innerHTML =
    'Page ' + (i + 1) + ' of 24 &nbsp;·&nbsp; <b>' + META[rel] + '</b>';
  document.getElementById('prev').disabled = i === 0;
  document.getElementById('next').disabled = i === ORDER.length - 1;
  main.scrollTop = 0;
  side.classList.remove('open');
  cur = rel;
  if (push !== false) history.replaceState(null, '', '#' + rel);
}}

document.querySelectorAll('.nav').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.page)));
document.getElementById('prev').addEventListener('click',
  () => show(ORDER[ORDER.indexOf(cur) - 1]));
document.getElementById('next').addEventListener('click',
  () => show(ORDER[ORDER.indexOf(cur) + 1]));
document.getElementById('menu').addEventListener('click',
  () => side.classList.toggle('open'));

// Sub-step links inside a bucket index resolve within the viewer.
document.querySelector('.wrapper').addEventListener('click', e => {{
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || !href.endsWith('.html')) {{
    if (href === '#') e.preventDefault();
    return;
  }}
  e.preventDefault();
  show(cur.split('/')[0] + '/' + href);
}});

document.addEventListener('keydown', e => {{
  if (e.target.matches('input,select,textarea')) return;
  if (e.key === 'ArrowLeft'  && ORDER.indexOf(cur) > 0) show(ORDER[ORDER.indexOf(cur) - 1]);
  if (e.key === 'ArrowRight' && ORDER.indexOf(cur) < 23) show(ORDER[ORDER.indexOf(cur) + 1]);
}});

show(META[location.hash.slice(1)] ? location.hash.slice(1) : ORDER[0], false);
</script>
"""

out = os.path.join(ROOT, "preview.html")
open(out, "w", encoding="utf-8").write(HTML)
print(f"wrote {out}  ({len(HTML)//1024} KB, {len(pages)} pages)")
