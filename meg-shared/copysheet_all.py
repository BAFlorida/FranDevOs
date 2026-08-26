#!/usr/bin/env python3
"""Build the all-brands copy sheet: every page of every MEG sales room behind
a Copy button, on one page with brand tabs.

Naively concatenating the four per-brand sheets lands near 15MB because every
page repeats its brand's embedded fonts and CSS. Within a brand, all 24 pages
share one identical head (doctype through </style></head><body>) except the
<title>, so that chunk is stored once per brand and each page stores only its
body. The full document is reassembled at copy time in the browser; this
script proves the reassembly is byte-exact for every page before writing.

Sources are embedded raw inside <script type="text/x-src"> blocks - the HTML
parser leaves script data verbatim, and no page contains "</script" (pages
carry no scripts at all; the build forbids them).
"""

import html
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "meg-sales-room", "build"))
from build import ORDER  # noqa: E402  (identical across brands; builds enforce it)

STAGES = {
    "01-welcome": "Welcome", "02-brand-overview": "Brand Overview",
    "03-validation": "Validation", "04-seeking-approval": "Seeking Approval",
    "05-meet-the-team-day": "Meet The Team Day", "06-agreement-stage": "Agreement Stage",
}

# id, folder, display name, accent (light), accent (dark)
BRANDS = [
    ("meg", "meg-sales-room", "1-Tom-Plumber", "#E8175D", "#FF4D80"),
    ("kg", "kg-sales-room", "Kitchen Guard", "#599C1E", "#8CDB86"),
    ("seals", "seals-sales-room", "The Seals", "#005BA7", "#5FA8E8"),
    ("usl", "usl-sales-room", "U.S. Lawns", "#20376C", "#78b7df"),
]

# 1-Tom only: rows worth a hint in the CMS-cleanup pass.
JOHNS = {
    "01-welcome/index.html", "01-welcome/01-mep-end-to-end.html",
    "02-brand-overview/index.html", "02-brand-overview/01-qualification-summary.html",
    "02-brand-overview/02-fdd.html",
}
# 1-Tom pages that are now ahead of the CMS - re-pasting takes the change live.
CMS_AHEAD = {
    "02-brand-overview/index.html": "adds the Brand Overview video · re-paste to take it live",
}
CMS_DASH_FIX = {
    "03-validation/01-owner-calls.html", "03-validation/02-funding.html",
    "03-validation/03-territory.html",
    "04-seeking-approval/01-executive-approval-call.html",
    "04-seeking-approval/02-dap-contingencies.html",
    "05-meet-the-team-day/01-what-who-to-expect.html",
    "05-meet-the-team-day/02-pre-mttd-questionnaire.html",
    "05-meet-the-team-day/03-meet-the-team-day.html",
    "05-meet-the-team-day/04-post-mttd-assessment.html",
    "06-agreement-stage/01-executive-board-approval.html",
    "06-agreement-stage/02-executing-your-agreement.html",
    "06-agreement-stage/03-brand-welcome-call.html",
}

HEAD_END = "</style></head><body>\n"
MARK = "%%TITLE%%"

stores, tabs, panels, accents_light, accents_dark = [], [], [], [], []

for bid, folder, name, acc, acc_dark in BRANDS:
    dist = os.path.join(ROOT, folder, "dist")
    # A brand's dist can lag the shared ORDER while only 1-Tom is being
    # iterated; list what that brand actually has, in ORDER order.
    avail = [rel for rel in ORDER if os.path.exists(os.path.join(dist, rel))]
    missing = [rel for rel in ORDER if rel not in avail]
    if missing:
        print(f"  note: {folder} dist lags ORDER by {len(missing)} page(s); listing what it has")
    pages = {rel: open(os.path.join(dist, rel), encoding="utf-8").read()
             for rel in avail}

    head = None
    rows = []
    for i, rel in enumerate(avail, 1):
        src = pages[rel]
        if "</script" in src.lower() or MARK in src:
            raise SystemExit(f"{folder}/{rel}: cannot be embedded raw")
        m = re.match(r"(.*?)<title>(.*?)</title>(.*?)" + re.escape(HEAD_END),
                     src, re.S)
        if not m:
            raise SystemExit(f"{folder}/{rel}: no head chunk found")
        cut = m.end()
        this_head = src[:cut].replace(f"<title>{m.group(2)}</title>",
                                      f"<title>{MARK}</title>", 1)
        if head is None:
            head = this_head
        elif this_head != head:
            raise SystemExit(f"{folder}/{rel}: head differs from the brand's shared head")
        title, body = m.group(2), src[cut:]
        # Prove the browser-side reassembly is byte-exact.
        if head.replace(MARK, title) + body != src:
            raise SystemExit(f"{folder}/{rel}: reassembly is not byte-exact")

        stores.append(f'<script type="text/x-src" id="s-{bid}-{i}">{body}</script>')

        stage = STAGES[rel.split("/")[0]]
        kind = "Bucket index" if rel.endswith("index.html") else "Sub-step"
        kb = f"{len(src.encode('utf-8')) / 1024:.0f} KB"
        chips = ""
        if bid == "meg" and rel in CMS_AHEAD:
            chips += f'<span class="chip chip-fix">{html.escape(CMS_AHEAD[rel])}</span>'
        elif bid == "meg" and rel in JOHNS:
            chips += '<span class="chip">matches John\'s live copy · paste embeds fonts</span>'
        if bid == "meg" and rel in CMS_DASH_FIX:
            chips += '<span class="chip chip-fix">re-paste clears the CMS "---"</span>'
        rows.append(f"""<article class="row" data-brand="{bid}" data-key="{bid}/{html.escape(rel, quote=True)}">
  <div class="head">
    <span class="n">{i:02d}</span>
    <div class="id">
      <div class="path">{html.escape(rel)}</div>
      <div class="meta">{html.escape(stage)} · {kind} · {kb}{chips}</div>
    </div>
    <button class="copy" type="button" data-brand="{bid}" data-n="{i}"
      data-title="{html.escape(title, quote=True)}">Copy HTML</button>
  </div>
  <details data-brand="{bid}" data-n="{i}" data-title="{html.escape(title, quote=True)}">
    <summary>View source</summary>
    <textarea readonly spellcheck="false"></textarea>
  </details>
</article>""")

    stores.append(f'<script type="text/x-src" id="head-{bid}">{head}</script>')
    tabs.append(f'<button class="tab" type="button" data-brand="{bid}" '
                f'role="tab" aria-selected="false">{html.escape(name)}</button>')
    panels.append(f'<section class="panel" data-brand="{bid}" role="tabpanel" hidden>\n'
                  + "\n".join(rows) + "\n</section>")
    accents_light.append(f'body[data-brand="{bid}"]{{--acc:{acc}}}')
    accents_dark.append(f'body[data-brand="{bid}"]{{--acc:{acc_dark}}}')

PAGE = """<title>MEG All-Brands Copy Sheet</title>
<script>
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
  --ink:#12151A; --paper:#FAF9F6; --card:#FFFFFF;
  --slate:#5B6470; --line:#E5E2DC; --ok:#0F7B4F;
  --header:#12151A; --on-header:#FFFFFF; --on-header-dim:#B9C0C9; --btn-tx:#FAF9F6;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){--ink:#F2F3F5; --paper:#101317; --card:#171B20;
    --line:#282D34; --slate:#9BA3AE; --ok:#3FBF86;
    --header:#07090B; --on-header:#F2F3F5; --on-header-dim:#98A0AA; --btn-tx:#101317}
}
:root[data-theme="dark"]{--ink:#F2F3F5; --paper:#101317; --card:#171B20; --line:#282D34;
  --slate:#9BA3AE; --ok:#3FBF86;
  --header:#07090B; --on-header:#F2F3F5; --on-header-dim:#98A0AA; --btn-tx:#101317}
/* Brand accent: light base, then the two dark-theme paths. */
__ACC_LIGHT__
@media (prefers-color-scheme:dark){
  __ACC_DARK_MEDIA__
}
__ACC_DARK_STAMP__
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);
  font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.6;padding:0 0 64px}
:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

header{background:var(--header);color:var(--on-header);padding:26px 24px 0}
.hin{max-width:940px;margin:0 auto}
.kicker{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--acc);margin-bottom:8px}
header h1{font-size:26px;line-height:1.15;font-weight:600;color:var(--on-header);text-wrap:balance}
header p{color:var(--on-header-dim);margin-top:8px;font-size:15px;max-width:70ch}
.tabs{max-width:940px;margin:18px auto 0;display:flex;gap:4px;flex-wrap:wrap}
.tab{background:none;border:0;border-bottom:3px solid transparent;color:var(--on-header-dim);
  font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.08em;
  text-transform:uppercase;padding:10px 14px;cursor:pointer}
.tab:hover{color:var(--on-header)}
.tab[aria-selected="true"]{color:var(--on-header);border-bottom-color:var(--acc);font-weight:600}

main{max-width:940px;margin:0 auto;padding:24px}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:20px}
.count{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--slate);
  font-variant-numeric:tabular-nums}
.row{background:var(--card);border:1px solid var(--line);border-radius:4px;margin-bottom:10px}
.head{display:flex;align-items:center;gap:14px;padding:14px 16px;flex-wrap:wrap}
.n{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--acc);
  font-variant-numeric:tabular-nums;flex:none}
.id{min-width:0;flex:1}
.path{font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:600;
  overflow-wrap:anywhere}
.meta{font-size:12.5px;color:var(--slate);margin-top:2px}
.chip{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:10px;
  letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);
  border-radius:3px;padding:1px 7px;margin-left:8px;color:var(--slate)}
.chip-fix{border-color:var(--acc);color:var(--acc)}
.copy{flex:none;background:var(--ink);color:var(--btn-tx);border:0;border-radius:3px;
  font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.1em;
  text-transform:uppercase;padding:9px 16px;cursor:pointer}
.copy:hover{background:var(--acc);color:#fff}
.copy[data-done="1"]{background:var(--ok);color:#fff}
.reset{flex:none;background:none;color:var(--slate);border:1px solid var(--line);
  border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;
  letter-spacing:.1em;text-transform:uppercase;padding:8px 15px;cursor:pointer}
.reset:hover{border-color:var(--acc);color:var(--acc)}
.row.last{border-color:var(--acc);box-shadow:inset 3px 0 0 var(--acc)}
.row.last .path::after{content:" · last copied";color:var(--acc);
  font-size:11px;letter-spacing:.05em;text-transform:uppercase}
details{border-top:1px solid var(--line)}
summary{cursor:pointer;padding:10px 16px;font-family:ui-monospace,Menlo,monospace;
  font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
textarea{display:block;width:100%;height:300px;border:0;border-top:1px solid var(--line);
  padding:14px 16px;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.5;
  background:var(--paper);color:var(--ink);resize:vertical;white-space:pre}
</style>

<header><div class="hin">
  <div class="kicker">MEG · Sales room upload</div>
  <h1>Page source for CMS upload</h1>
  <p>Every brand, every page, one sheet. Pick a brand, hit Copy, paste into the
     matching field in that brand's sales room. Each copy is a complete HTML
     document with the fonts embedded.</p>
</div>
<nav class="tabs" role="tablist">__TABS__</nav>
</header>

<main>
  <div class="bar">
    <button class="copy" type="button" id="expand">Expand all</button>
    <button class="reset" type="button" id="reset">Reset copied</button>
    <span class="count" id="progress"></span>
    <span class="count" id="status">__COUNT__</span>
  </div>
__PANELS__
</main>

__STORES__

<script>
function srcOf(brand, n, title) {
  const head = document.getElementById('head-' + brand).textContent;
  const body = document.getElementById('s-' + brand + '-' + n).textContent;
  return head.replace('%%TITLE%%', title) + body;
}

/* Copied-state ledger, per viewer, survives reloads. {copied:{key:1}, last:{brand:key}} */
const KEY = 'meg-copysheet-progress-v1';
function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
function applyState() {
  const s = loadState(), copied = s.copied || {}, last = s.last || {};
  document.querySelectorAll('article.row').forEach(row => {
    const btn = row.querySelector('.copy');
    if (copied[row.dataset.key]) { btn.dataset.done = '1'; btn.textContent = 'Copied \\u2713'; }
    else { delete btn.dataset.done; btn.textContent = 'Copy HTML'; }
    row.classList.toggle('last', last[row.dataset.brand] === row.dataset.key);
  });
  updateProgress();
}
function updateProgress() {
  const brand = document.body.dataset.brand;
  const rows = [...document.querySelectorAll('article.row[data-brand="' + brand + '"]')];
  const done = rows.filter(r => r.querySelector('.copy').dataset.done === '1').length;
  document.getElementById('progress').textContent = done + ' / ' + rows.length + ' copied';
}

const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.panel')];
function show(brand) {
  document.body.dataset.brand = brand;
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.brand === brand)));
  panels.forEach(p => { p.hidden = p.dataset.brand !== brand; });
  try { history.replaceState(null, '', '#' + brand); } catch (e) {}
  updateProgress();
}
tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.brand)));
show(/^#(meg|kg|seals|usl)$/.test(location.hash) ? location.hash.slice(1) : 'meg');
applyState();

document.querySelectorAll('.copy[data-n]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const text = srcOf(btn.dataset.brand, btn.dataset.n, btn.dataset.title);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const d = btn.closest('.row').querySelector('details');
      fill(d); d.open = true;
      const ta = d.querySelector('textarea');
      ta.select(); document.execCommand('copy');
    }
    const row = btn.closest('.row');
    const s = loadState();
    (s.copied = s.copied || {})[row.dataset.key] = 1;
    (s.last = s.last || {})[row.dataset.brand] = row.dataset.key;
    saveState(s);
    applyState();
    document.getElementById('status').textContent =
      row.querySelector('.path').textContent + ' copied to clipboard';
  });
});

document.getElementById('reset').addEventListener('click', () => {
  const brand = document.body.dataset.brand;
  const s = loadState();
  Object.keys(s.copied || {}).forEach(k => {
    if (k.indexOf(brand + '/') === 0) delete s.copied[k];
  });
  if (s.last) delete s.last[brand];
  saveState(s);
  applyState();
  document.getElementById('status').textContent = 'Copied marks cleared for this brand';
});

function fill(d) {
  const ta = d.querySelector('textarea');
  if (!ta.value) ta.value = srcOf(d.dataset.brand, d.dataset.n, d.dataset.title);
}
document.querySelectorAll('details[data-n]').forEach(d =>
  d.addEventListener('toggle', () => { if (d.open) fill(d); }));

document.getElementById('expand').addEventListener('click', () => {
  const scope = [...document.querySelectorAll('.panel:not([hidden]) details')];
  const open = scope.some(d => !d.open);
  scope.forEach(d => { if (open) fill(d); d.open = open; });
  document.getElementById('expand').textContent = open ? 'Collapse all' : 'Expand all';
});
</script>
"""

PAGE = (PAGE
        .replace("__COUNT__",
                 f"{len(ORDER)} pages per brand · {len(BRANDS) * len(ORDER)} total")
        .replace("__ACC_LIGHT__", "\n".join(accents_light))
        .replace("__ACC_DARK_MEDIA__",
                 "\n  ".join(a.replace("body[", ':root:not([data-theme="light"]) body[')
                             for a in accents_dark))
        .replace("__ACC_DARK_STAMP__",
                 "\n".join(a.replace("body[", ':root[data-theme="dark"] body[')
                           for a in accents_dark))
        .replace("__TABS__", "\n".join(tabs))
        .replace("__PANELS__", "\n".join(panels))
        .replace("__STORES__", "\n".join(stores)))

out = os.path.join(HERE, "all-brands-copy-sheet.html")
with open(out, "w", encoding="utf-8") as fh:
    fh.write(PAGE)
print(f"wrote {out} ({len(PAGE.encode('utf-8'))//1024} KB, "
      f"{len(BRANDS)} brands x {len(ORDER)} pages, reassembly proven byte-exact)")
