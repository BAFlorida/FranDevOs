# MEG sales rooms - handoff

Everything needed to pick this up in a new chat. The code, pages, specs and
brand assets are all committed on branch `claude/get-to-work-853b92`; this file
carries the decisions and open questions that otherwise only existed in chat.

---

## What exists

Three brands, same pipeline, 24 pages each.

| Folder | Brand | State |
|---|---|---|
| `meg-sales-room/` | 1-Tom-Plumber | 19 pages mine, 5 rebuilt by John with newer copy |
| `kg-sales-room/` | Kitchen Guard | All 24 mine. Brand book audited, deviations approved |
| `seals-sales-room/` | The Seals | All 24 mine. No brand book supplied |

Each folder has the same shape:

```
spec/page-template.html   the brand's design. Replace it and rebuild - drop-in
spec/structure.json       the 24-page map, gates, milestones
content/pages/*.md        the copy, split by "## PAGE: <path>" headers
build/                    the generator
dist/                     the 24 built pages + INDEX.md
```

## How it works

**Copy comes from markdown, design comes from the template, and neither is
retyped.** `parse.py` renders `content/pages/*.md`; `shell.py` extracts the CSS,
fonts and SVG artwork out of `spec/page-template.html` at build time.

To change copy: edit the markdown, rebuild.
To change design: replace `spec/page-template.html`, rebuild.

```bash
python3 <brand>/build/build.py          # build 24 pages + INDEX.md, run all checks
python3 <brand>/build/adapt_copy.py     # regenerate KG/Seals copy from the 1-Tom source
python3 <brand>/build/subset_fonts.py   # re-subset fonts after copy changes
python3 <brand>/build/viewer.py         # preview.html
python3 <brand>/build/copysheet.py      # copy-sheet.html for CMS paste
python3 meg-sales-room/build/split.py   # 1-Tom only: package the 19 excluding John's 5
```

`build.py` fails the build on: a missing or unexpected page, missing chrome, a
journey track marking the wrong stage, a gate without a form control, an
unlabelled input, an uncaptioned table, an unknown video id, a `watch` URL, an
unrendered source marker, stray markdown, a `.asset` where `.btn` belongs, a
`.btn` without `data-asset`, the wrong number of embedded font faces, or any
outbound request besides a YouTube embed.

## Live artifacts

| What | URL |
|---|---|
| 1-Tom preview | https://claude.ai/code/artifact/ba85ab0c-e0bc-40e5-b152-2c89a766919b |
| 1-Tom copy sheet | https://claude.ai/code/artifact/fd85a6b7-2f7f-43d8-8a52-f37f1e73afd8 |
| Kitchen Guard preview | https://claude.ai/code/artifact/58e1f9d2-7c59-4098-9b22-75c965b993c6 |
| Kitchen Guard copy sheet | https://claude.ai/code/artifact/abd77079-9ec5-40cb-8af4-d7fe144e7d1d |
| The Seals preview | https://claude.ai/code/artifact/bf7fba98-6678-4fe2-b49f-a30dc062bbe4 |
| The Seals copy sheet | https://claude.ai/code/artifact/eb2b9c93-f48a-479f-a77e-93effa419eb6 |

Republishing from a new chat needs the URL passed explicitly, or it mints a new
artifact instead of updating these.

---

## Open questions

### 1-Tom-Plumber
- **John owns 5 pages** with newer copy: `01-welcome/index`, `01-welcome/01-mep-end-to-end`,
  `02-brand-overview/index`, `.../01-qualification-summary`, `.../02-fdd`. Do not
  ship mine for those. `split.py` packages the other 19.
- His Qualification Summary replaced the Experian self-pull with **B-Verify**.
  Mine still has Experian.
- Should the four remaining bucket index pages keep their **sub-step lists**?
  John's two index pages have none.
- His five pages **link Google Fonts** rather than embedding, so they will show
  the fallback wherever that request is blocked. `build/fonts.css` fixes it.

### Kitchen Guard
- Brand book deviations are **approved**: Anton as a display face, the Poppins
  weight set, the off-palette flame `#C02B0A`, and the brown metal palette in
  the stove illustration.
- Every financial figure is **deliberately unused**. The Brand Overview script
  states its numbers come from "2026-04 Kitchen Guard FDD - draft 1" and must be
  reconciled to the final issued FDD. Territory count, regional account fee and
  square footage are flagged, not stated.
- Brand Overview video: script V3 drafted, not recorded.
- Does Kitchen Guard use **B-Verify** like John's 1-Tom rebuild?

### The Seals
- **No brand book supplied.** Palette and type are used as the draft authored
  them, unaudited.
- Territory design, premises requirement, brand values, founder, leadership and
  training program are all flagged, not written.
- **The address gate must not go live** until the requirement is confirmed to
  apply to this brand. It is carried over from shared MEG language.
- Technology page names ServiceTitan and CareerPlug, carried over on the basis
  that technology is shared. Confirm for this brand.

---

## Decisions worth not relitigating

**The MEG copy is EverSmith's, brand-swapped per brand.** Confirmed by the KG
draft's Welcome copy being word-for-word 1-Tom's. Process and platform videos
are shared across brands; only Brand Overview and Brand Specific Resources are
brand-owned.

**Fonts are embedded, not linked.** A linked webfont dies wherever the outbound
request is blocked, and Anton at weight 400 falls back to something thin that
reads as greyed-out. `subset_fonts.py` subsets to the characters in use and
inlines woff2 data URIs. Pages then make no outbound request except video.

**Preview pages render in iframes.** An earlier viewer re-scoped each page's CSS
into the host document, and the host's colours inherited into anything the page
CSS did not set, washing the content to near-white. An iframe is a real document
boundary.

**Actionable links are `.btn`, never `.asset`.** The template says so and John's
pages do it. `data-asset` is kept for wiring.

**Never state a figure that has not been confirmed.** The 1-Tom "confirmed
facts" table turned out stale - unit counts, investment range, royalty - after
it had been written into four pages as fact. Everything unverified renders as a
visible amber flag instead.

## Known unknowns about the CMS

Confirmed working: the pages render correctly in the CMS preview and styling
survives the paste.

Not yet tested: whether the CMS **strips video iframes** on save. If it does,
all 18 videos vanish silently. Worth checking one video page before bulk upload.

Kitchen Guard pages are ~155 KB each - the heaviest, because its logo is a 52 KB
PNG. 1-Tom is ~95 KB, The Seals ~120 KB. If a field-size limit bites, the logo
can be optimised losslessly and the fonts can be split out.
