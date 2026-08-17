#!/usr/bin/env python3
"""Build a single copy-to-clipboard page holding the source of all 24 pages.

The dist files are complete HTML documents, so double-clicking one renders it
instead of showing markup. This page puts each page's source behind a Copy
button so it can go straight into a CMS field.
"""

import html
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, HERE)

from build import ORDER  # noqa: E402

# John has rebuilt these five with newer copy. They are listed so the sheet
# reads in portal order, but flagged and their copy button disarmed, so his
# work cannot be pasted over by accident.
JOHNS = {
    "01-welcome/index.html", "01-welcome/01-mep-end-to-end.html",
    "02-brand-overview/index.html", "02-brand-overview/01-qualification-summary.html",
    "02-brand-overview/02-fdd.html",
}
from parse import BUCKETS  # noqa: E402

rows = []
for i, rel in enumerate(ORDER, 1):
    src = open(os.path.join(DIST, rel), encoding="utf-8").read()
    stage = BUCKETS[rel.split("/")[0]][1]
    leaf = rel.split("/")[1]
    kind = "Bucket index" if leaf == "index.html" else "Sub-step"
    kb = f"{len(src.encode('utf-8')) / 1024:.0f} KB"
    johns = rel in JOHNS
    btn = ('<span class="held">John owns this</span>' if johns else
           f'<button class="copy" type="button" data-target="src{i}">Copy HTML</button>')
    meta = f"{html.escape(stage)} · {kind} · {kb}"
    if johns:
        meta += " · newer copy lives in John's build"
    rows.append(f"""<article class="row{' is-john' if johns else ''}" id="r{i}">
  <div class="head">
    <span class="n">{i:02d}</span>
    <div class="id">
      <div class="path">{html.escape(rel)}</div>
      <div class="meta">{meta}</div>
    </div>
    {btn}
  </div>
  <details>
    <summary>View source</summary>
    <textarea id="src{i}" readonly spellcheck="false">{html.escape(src)}</textarea>
  </details>
</article>""")

PAGE = """<title>1-Tom-Plumber MEG - Page Source for CMS Upload</title>
<script>
/* Supply a viewport meta if the host page has not, or a phone lays this out
   at ~980px and scales it down. */
(function(){
  if (!document.querySelector('meta[name="viewport"]')) {
    var m = document.createElement('meta');
    m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1';
    (document.head || document.documentElement).appendChild(m);
  }
})();
</script>
<style>
:root{
  --ink:#12151A; --paper:#FAF9F6; --card:#FFFFFF; --pink:#E8175D; --pink-dk:#B80E48;
  --slate:#5B6470; --line:#E5E2DC; --ok:#0F7B4F;
  --header:#12151A; --on-header:#FFFFFF; --on-header-dim:#B9C0C9; --btn-tx:#FAF9F6;
}
@media (prefers-color-scheme:dark){
  :root{--ink:#F2F3F5; --paper:#101317; --card:#171B20; --line:#282D34; --slate:#9BA3AE;
        --pink:#FF4D80; --pink-dk:#FF7CA0; --ok:#3FBF86;
        --header:#07090B; --on-header:#F2F3F5; --on-header-dim:#98A0AA; --btn-tx:#101317}
}
:root[data-theme="dark"]{--ink:#F2F3F5; --paper:#101317; --card:#171B20; --line:#282D34;
  --slate:#9BA3AE; --pink:#FF4D80; --pink-dk:#FF7CA0; --ok:#3FBF86;
  --header:#07090B; --on-header:#F2F3F5; --on-header-dim:#98A0AA; --btn-tx:#101317}
:root[data-theme="light"]{--ink:#12151A; --paper:#FAF9F6; --card:#FFFFFF; --line:#E5E2DC;
  --slate:#5B6470; --pink:#E8175D; --pink-dk:#B80E48; --ok:#0F7B4F;
  --header:#12151A; --on-header:#FFFFFF; --on-header-dim:#B9C0C9; --btn-tx:#FAF9F6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);
  font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.6;padding:0 0 64px}
.mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
:focus-visible{outline:3px solid var(--pink);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

header{background:var(--header);color:var(--on-header);padding:30px 24px}
.hin{max-width:940px;margin:0 auto}
.kicker{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--pink);margin-bottom:8px}
header h1{font-size:26px;line-height:1.15;font-weight:600;color:var(--on-header);text-wrap:balance}
header p{color:var(--on-header-dim);margin-top:8px;font-size:15px;max-width:70ch}
main{max-width:940px;margin:0 auto;padding:24px}
.note{border:1px solid var(--line);border-left:4px solid var(--pink);background:var(--card);
  padding:14px 18px;margin-bottom:26px;font-size:14.5px;color:var(--slate)}
.note b{color:var(--ink)}
.row{background:var(--card);border:1px solid var(--line);border-radius:4px;margin-bottom:10px}
.head{display:flex;align-items:center;gap:14px;padding:14px 16px;flex-wrap:wrap}
.n{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--pink);
  font-variant-numeric:tabular-nums;flex:none}
.id{min-width:0;flex:1}
.path{font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:600;
  overflow-wrap:anywhere}
.meta{font-size:12.5px;color:var(--slate);margin-top:2px}
.copy{flex:none;background:var(--ink);color:var(--btn-tx);border:0;border-radius:3px;
  font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.1em;
  text-transform:uppercase;padding:9px 16px;cursor:pointer}
.copy:hover{background:var(--pink);color:#fff}
.copy[data-done="1"]{background:var(--ok);color:#fff}
.held{flex:none;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--slate);border:1px dashed var(--line);
  padding:8px 14px;border-radius:3px}
.row.is-john{opacity:.62}
.row.is-john .path{font-weight:500}
details{border-top:1px solid var(--line)}
summary{cursor:pointer;padding:10px 16px;font-family:ui-monospace,Menlo,monospace;
  font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
textarea{display:block;width:100%;height:300px;border:0;border-top:1px solid var(--line);
  padding:14px 16px;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.5;
  background:var(--paper);color:var(--ink);resize:vertical;white-space:pre}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:20px}
.count{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--slate);
  font-variant-numeric:tabular-nums}
</style>

<header><div class="hin">
  <div class="kicker">MEG · Sales room upload</div>
  <h1>Page source for CMS upload</h1>
  <p>All 24 pages. Hit Copy, then paste into the matching field in the sales room.
     Each block is a complete HTML document.</p>
</div></header>

<main>
  <div class="note">
    <b>Why the downloaded files opened as web pages:</b> they are complete HTML documents,
    so a browser renders them instead of showing markup. Copying from here avoids that
    entirely. In a file manager you can also right-click a file and choose Open With, then
    pick a text editor.
  </div>

  <div class="bar">
    <button class="copy" type="button" id="expand">Expand all</button>
    <span class="count" id="status">19 ready to copy · 5 held for John</span>
  </div>

__ROWS__
</main>

<script>
document.querySelectorAll('.copy[data-target]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const ta = document.getElementById(btn.dataset.target);
    try {
      await navigator.clipboard.writeText(ta.value);
    } catch (e) {
      ta.closest('details').open = true;
      ta.select();
      document.execCommand('copy');
    }
    const was = btn.textContent;
    btn.textContent = 'Copied';
    btn.dataset.done = '1';
    document.getElementById('status').textContent = btn.closest('.row')
      .querySelector('.path').textContent + ' copied to clipboard';
    setTimeout(() => { btn.textContent = was; delete btn.dataset.done; }, 1600);
  });
});
document.getElementById('expand').addEventListener('click', () => {
  const open = [...document.querySelectorAll('details')].some(d => !d.open);
  document.querySelectorAll('details').forEach(d => d.open = open);
  document.getElementById('expand').textContent = open ? 'Collapse all' : 'Expand all';
});
</script>
""".replace("__ROWS__", "\n".join(rows))

out = os.path.join(ROOT, "copy-sheet.html")
with open(out, "w", encoding="utf-8") as fh:
    fh.write(PAGE)
print(f"wrote {out} ({len(PAGE)//1024} KB, {len(ORDER)} pages)")
