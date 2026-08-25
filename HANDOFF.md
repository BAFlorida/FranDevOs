# MEG sales rooms - handoff

Everything needed to pick this up in a new chat. The code, pages, specs and
brand assets are all committed on branch `claude/meg-sales-rooms-c0l3n2`; this
file carries the decisions and open questions that otherwise only existed in
chat.

---

## What exists

Four brands, same pipeline, **23 pages each** since John's Aug 4 punch list
was applied on 2026-08-24 (see `meg-shared/PUNCH-LIST.md` for the full
item-by-item status). All on the **reconciled copy baseline** (see below).

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
| **All-brands copy sheet** (one page, brand tabs - the paste tool) | https://claude.ai/code/artifact/3a9499b0-a862-492a-b797-35c08770ded7 |
| 1-Tom preview | https://claude.ai/code/artifact/ba85ab0c-e0bc-40e5-b152-2c89a766919b |
| 1-Tom copy sheet | https://claude.ai/code/artifact/fd85a6b7-2f7f-43d8-8a52-f37f1e73afd8 |
| Kitchen Guard preview | https://claude.ai/code/artifact/58e1f9d2-7c59-4098-9b22-75c965b993c6 |
| Kitchen Guard copy sheet | https://claude.ai/code/artifact/abd77079-9ec5-40cb-8af4-d7fe144e7d1d |
| The Seals preview | https://claude.ai/code/artifact/bf7fba98-6678-4fe2-b49f-a30dc062bbe4 |
| The Seals copy sheet | https://claude.ai/code/artifact/eb2b9c93-f48a-479f-a77e-93effa419eb6 |
| U.S. Lawns preview | https://claude.ai/code/artifact/da3ae4e1-6b74-41a7-a767-c1fe6f7f6e7f |
| U.S. Lawns copy sheet | https://claude.ai/code/artifact/0b40bc31-1ff2-419b-8511-1ef524d7a53e |

Republishing from a new chat needs the URL passed explicitly, or it mints a
new artifact instead of updating these.

The all-brands sheet is built by `meg-shared/copysheet_all.py` from the four
dist trees (rebuild the brands first, then it). It stores each brand's shared
page head once and reassembles full documents at copy time; the build proves
every reassembly byte-exact against dist before writing. On the 1-Tom tab the
rows that clear the CMS `---` bug, and John's five, are chip-labelled.

---

## The Aug 4 punch list (applied 2026-08-24)

`meg-shared/PUNCH-LIST.md` tracks John's standup punch list item by item.
Template-side items are applied across all four brands: the Validation and
Seeking Approval overview pages are deleted (video and framing moved into
Owner Calls / Executive Approval Call), a locked **Franchise Disclosure
Document Review** page with the Item 23 receipt gate sits after the FDD
explainer, the FDD page carries a request button, Owner Calls leads with the
per-candidate Teams link and add-to-calendar buttons, Funding carries the two
vendor video slots, Technology is retitled and reordered ("How Technology and
Sourcing Works", EverSmith Strategic Partnerships named, QuickBooks Online in
the stack, pricing from Item 7, wrong fee acknowledgment removed), and the
Executive Approval page is merged, de-AI'd, and hosted by John Dobelbower
plus the brand leader.

Platform-side items (Q&A builder box, workbook, hideable cards, completion
gating, request-button wiring, Base44 DAP view, section locks) are Shane's.
The franchise proposal builder is blocked on the Neighborly Excel that never
arrived.

## CMS actions owed (1-Tom room)

The CMS predates the punch-list restructure, so the whole 1-Tom room should
be re-pasted from the copy sheet, plus two portal-side edits:

- **Delete** the Validation and Seeking Approval overview pages in the portal
  (candidates go straight to Owner Calls / Executive Approval Call).
- **Add** the Franchise Disclosure Document Review section after the FDD
  explainer and configure it as locked-until-the-FDD-is-sent.
- Re-pasting everything also clears the older debts: the stray `---`
  paragraphs on 12 pages, the Google-Fonts dependency on John's five, the
  pending Brand Overview slot (video `Q0EAo3Ix3gI` is embedded now), and the
  funding-page rendering gap (not present in the current build).

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
