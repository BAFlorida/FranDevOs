#!/usr/bin/env python3
"""Assemble the dist pages into one shareable single-file preview.

Each page is rendered in an iframe via srcdoc rather than having its CSS
re-scoped into the host document. Scoping was fragile: the viewer's own shell
colours inherited into the page wherever the page CSS did not set them, which
washed the content out to near-white. An iframe is a real document boundary, so
every page renders byte-for-byte as the file a candidate would open.

Only the active page's srcdoc is populated, so one document is live at a time.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, HERE)
from build import ORDER  # noqa: E402
from parse import BUCKETS  # noqa: E402

BRAND = "The Seals"

pages, meta = {}, {}
for rel in ORDER:
    src = open(os.path.join(DIST, rel), encoding="utf-8").read()
    pages[rel] = src
    meta[rel] = re.search(r"<title>(.*?)</title>", src).group(1)

nav = []
for bucket_id, (num, label) in sorted(BUCKETS.items(), key=lambda kv: kv[1][0]):
    items = [r for r in ORDER if r.startswith(bucket_id + "/")]
    nav.append(f'<div class="grp"><div class="grp__h">'
               f'<span class="grp__n">{num}</span>{label}</div>')
    for rel in items:
        kind = "idx" if rel.endswith("index.html") else "sub"
        nav.append(f'<button class="nav {kind}" data-page="{rel}" type="button">'
                   f'{meta[rel]}</button>')
    nav.append("</div>")

HTML = f"""<title>{BRAND} MEG Sales Room - 24 Page Preview</title>
<script>
(function(){{
  if (!document.querySelector('meta[name="viewport"]')) {{
    var m = document.createElement('meta');
    m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1';
    (document.head || document.documentElement).appendChild(m);
  }}
}})();
</script>
<style>
:root{{--shell:#16181C;--shell-2:#1E2126;--edge:#2C3037;--txt:#E6E4DF;--dim:#8B9099;
  --accent:#005BA7;
  --ui:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:ui-monospace,Menlo,Consolas,monospace}}
*{{box-sizing:border-box}}
html,body{{margin:0;padding:0;height:100%}}
body{{font-family:var(--ui);background:var(--shell);color:var(--txt);
  display:grid;grid-template-columns:296px 1fr;height:100vh;overflow:hidden}}
:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
.side{{background:var(--shell-2);border-right:1px solid var(--edge);overflow-y:auto}}
.brand{{padding:20px;border-bottom:1px solid var(--edge);position:sticky;top:0;
  background:var(--shell-2);z-index:2}}
.brand__k{{font-family:var(--mono);font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--accent);margin-bottom:7px}}
.brand__t{{font-size:15px;font-weight:600;line-height:1.3}}
.brand__s{{font-size:12.5px;color:var(--dim);margin-top:5px}}
.grp{{padding:14px 12px 6px}}
.grp__h{{display:flex;align-items:center;gap:9px;padding:0 8px 8px;font-family:var(--mono);
  font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}}
.grp__n{{width:17px;height:17px;display:grid;place-items:center;background:var(--edge);
  color:var(--txt);font-size:9.5px;flex:0 0 17px}}
.nav{{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);
  font-family:var(--ui);font-size:13.5px;line-height:1.35;padding:8px 10px 8px 30px;
  cursor:pointer;border-left:2px solid transparent}}
.nav:hover{{background:#24272D}}
.nav.idx{{font-weight:600}}
.nav.sub{{color:#B7BBC2}}
.nav[aria-current=page]{{background:#282B32;border-left-color:var(--accent);
  color:#fff;font-weight:600}}
.main{{display:flex;flex-direction:column;min-width:0;background:#fff}}
.bar{{display:flex;align-items:center;gap:14px;padding:11px 22px;background:var(--shell);
  border-bottom:1px solid var(--edge);font-family:var(--mono);font-size:10.5px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--dim);flex:none}}
.bar b{{color:var(--txt);font-weight:500}}
.bar__sp{{margin-left:auto;display:flex;gap:8px}}
.pg{{background:var(--edge);border:0;color:var(--txt);font-family:var(--mono);font-size:11px;
  padding:5px 11px;cursor:pointer}}
.pg:hover{{background:var(--accent);color:#fff}}
.pg[disabled]{{opacity:.35;cursor:default}}
#frame{{flex:1;width:100%;border:0;background:#fff}}
.menu{{display:none}}
@media (max-width:860px){{
  body{{grid-template-columns:1fr;grid-template-rows:auto 1fr}}
  .side{{position:fixed;inset:0 auto 0 0;width:280px;transform:translateX(-100%);
    transition:transform .18s ease;z-index:10}}
  .side.open{{transform:none}}
  .menu{{display:inline-block;background:var(--edge);border:0;color:var(--txt);
    font-family:var(--mono);font-size:11px;padding:5px 11px;cursor:pointer}}
}}
</style>

<nav class="side" id="side">
  <div class="brand">
    <div class="brand__k">Preview build</div>
    <div class="brand__t">{BRAND} Mutual Evaluation Guide</div>
    <div class="brand__s">24 pages · 5 compliance gates</div>
  </div>
  {''.join(nav)}
</nav>

<div class="main">
  <div class="bar">
    <button class="menu" id="menu" type="button">Pages</button>
    <span id="crumb"><b>&nbsp;</b></span>
    <span class="bar__sp">
      <button class="pg" id="prev" type="button">&larr; Prev</button>
      <button class="pg" id="next" type="button">Next &rarr;</button>
    </span>
  </div>
  <iframe id="frame" title="Page preview"></iframe>
</div>

<script>
const ORDER = {json.dumps(ORDER)};
const META  = {json.dumps(meta)};
const SRC   = {json.dumps(pages)};
const side = document.getElementById('side');
const frame = document.getElementById('frame');
let cur = null;

function show(rel, push) {{
  if (!SRC[rel]) return;
  frame.srcdoc = SRC[rel];
  document.querySelectorAll('.nav').forEach(b =>
    b.dataset.page === rel ? b.setAttribute('aria-current', 'page')
                           : b.removeAttribute('aria-current'));
  const i = ORDER.indexOf(rel);
  document.getElementById('crumb').innerHTML =
    'Page ' + (i + 1) + ' of 24 &nbsp;·&nbsp; <b>' + META[rel] + '</b>';
  document.getElementById('prev').disabled = i === 0;
  document.getElementById('next').disabled = i === ORDER.length - 1;
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
document.addEventListener('keydown', e => {{
  if (e.target.matches('input,select,textarea')) return;
  const i = ORDER.indexOf(cur);
  if (e.key === 'ArrowLeft'  && i > 0) show(ORDER[i - 1]);
  if (e.key === 'ArrowRight' && i < ORDER.length - 1) show(ORDER[i + 1]);
}});

show(SRC[location.hash.slice(1)] ? location.hash.slice(1) : ORDER[0], false);
</script>
"""

out = os.path.join(ROOT, "preview.html")
with open(out, "w", encoding="utf-8") as fh:
    fh.write(HTML)
print(f"wrote {out}  ({len(HTML)//1024} KB, {len(pages)} pages)")
