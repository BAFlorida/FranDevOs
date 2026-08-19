# MEG sales rooms - handoff

Everything needed to pick this up in a new chat. The code, pages, specs and
brand assets are all committed on branch `claude/meg-sales-rooms-c0l3n2`; this
file carries the decisions and open questions that otherwise only existed in
chat.

---

## What exists

Four brands, same pipeline, 24 pages each, all on the **reconciled copy
baseline** (see below).

| Folder | Brand | State |
|---|---|---|
| `meg-sales-room/` | 1-Tom-Plumber | Source reconciled 2026-08-19 to the live CMS export; all 24 match the CMS text-for-text |
| `kg-sales-room/` | Kitchen Guard | All 24 regenerated on the new baseline. Brand book audited, deviations approved |
| `seals-sales-room/` | The Seals | All 24 regenerated on the new baseline. No brand book supplied |
| `usl-sales-room/` | U.S. Lawns | New 2026-08-19, all 24 built from the supplied styled template. No copy source supplied - facts flagged |

Each folder has the same shape:

```
spec/page-template.html   the brand's design. Replace it and rebuild - drop-in
spec/structure.json       the 24-page map, gates, milestones
content/pages/*.md        the copy, split by "## PAGE: <path>" headers
build/                    the generator
dist/                     the 24 built pages + INDEX.md (tracked for 1-Tom only)
<brand>-meg-pages.zip     the packaged pages (KG / Seals / USL)
preview.html              single-file 24-page preview
copy-sheet.html           per-section copy for CMS paste
```

## The reconciled baseline (2026-08-19)

The client supplied `1TPTemplateHTMLExport.zip`, the live CMS state of the
1-Tom room. It was back-ported into `meg-sales-room/content/` and is now the
source all brands adapt from:

- **B-Verify** (financial + background verification) replaces the Experian
  self-pull and the background-check section on Qualification Summary. 1-Tom
  carries the live links (DocuSign PowerForm, Culture Index survey,
  `bverify.boefly.com/eversmith`); the other brands render the same buttons
  unwired (`href="#"` + `data-asset`) until per-brand URLs are supplied.
- **Index pages carry no sub-step list and no closing card** - the platform
  provides section navigation; the pointer lives in the body copy.
- **Welcome** is one video: 1-Tom's exists (`fcaSfWLHMh8`, captioned
  "Welcome"); KG / Seals / USL show a pending "brand welcome - awaiting final
  cut" slot, exactly as the supplied brand templates do.
- John's FDD trims (no state-rules sentence, no Item 20 note, PH-07 dropped
  on 2.2) and his Brand Overview wording ("Above, you will find...").
- Rebuilt 1-Tom dist matches the CMS export text-for-text on all 24 pages
  except the stray `---` paragraphs **the CMS itself still needs to fix** on
  12 pages (listed below).

To change copy for all brands: edit `meg-sales-room/content/`, run each
brand's `build/adapt_copy.py`, rebuild, re-subset fonts.

## Live artifacts

| What | URL |
|---|---|
| 1-Tom preview | https://claude.ai/code/artifact/ba85ab0c-e0bc-40e5-b152-2c89a766919b |
| 1-Tom copy sheet | https://claude.ai/code/artifact/fd85a6b7-2f7f-43d8-8a52-f37f1e73afd8 |
| Kitchen Guard preview | https://claude.ai/code/artifact/58e1f9d2-7c59-4098-9b22-75c965b993c6 |
| Kitchen Guard copy sheet | https://claude.ai/code/artifact/abd77079-9ec5-40cb-8af4-d7fe144e7d1d |
| The Seals preview | https://claude.ai/code/artifact/bf7fba98-6678-4fe2-b49f-a30dc062bbe4 |
| The Seals copy sheet | https://claude.ai/code/artifact/eb2b9c93-f48a-479f-a77e-93effa419eb6 |
| U.S. Lawns preview | https://claude.ai/code/artifact/44f0cc20-611c-49c8-ac35-9c0654a825ee |
| U.S. Lawns copy sheet | https://claude.ai/code/artifact/0b40bc31-1ff2-419b-8511-1ef524d7a53e |

Republishing from a new chat needs the URL passed explicitly, or it mints a
new artifact instead of updating these.

---

## CMS fixes still owed (1-Tom room)

- **A literal `---` paragraph** shows above the closing line on 12 pages,
  pasted from a pre-fix build: Validation 1-3, Seeking Approval 1-2, all four
  Meet The Team Day sections, Agreement Stage 1-3. Delete the paragraph or
  re-paste the section from the current copy sheet.
- **John's five pages link Google Fonts** rather than embedding, so they show
  fallback type wherever that request is blocked. Re-pasting them from the
  current copy sheet fixes it - the content is now identical either way.

## Open questions

### Kitchen Guard
- Every financial figure remains **deliberately unused** until the final
  issued FDD (the Brand Overview script sources its numbers to "2026-04
  Kitchen Guard FDD - draft 1"). Territory count, regional account fee and
  square footage are flagged, not stated.
- Brand Overview video: script V3 drafted, not recorded. Welcome video not
  recorded.
- B-Verify link left unwired - supply the Kitchen Guard destination (or
  confirm the shared eversmith URL applies).

### The Seals
- **No brand book supplied.** Palette and type are used as the draft authored
  them, unaudited.
- Territory design, premises requirement, brand values, founder, leadership
  and training program are all flagged, not written.
- **The address gate must not go live** until the requirement is confirmed to
  apply to this brand.
- B-Verify link, Qualification Summary form and Culture Index survey URLs
  unwired.

### U.S. Lawns
- Template supplied 2026-08-19 documents the Brand Guidelines v1.1 (June
  2025) palette; **no copy source was supplied**, so territory design,
  premises, the address requirement (same must-not-go-live gate caution as
  The Seals), values, founder, leadership and training are all flagged.
- Welcome and Brand Overview videos pending. All per-brand URLs unwired.
- Fonts: Antonio + Inter + PT Serif, embedded as subsets (the supplied
  template linked Google Fonts; the build replaces that).
