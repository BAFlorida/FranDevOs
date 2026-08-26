# MEG sales rooms - handoff

Everything needed to pick this up in a new chat. Code, pages, specs and brand
assets are committed on branch `claude/meg-sales-rooms-c0l3n2`. Read this file
first; `meg-shared/PUNCH-LIST.md` and `meg-sales-room/PLACEHOLDERS.md` carry
the item-level trackers.

**Current focus: 1-Tom-Plumber only.** Ryan said to leave the other three
brands alone until asked.

---

## 1-Tom-Plumber - the live room (17 pages, zero placeholder flags)

Built from `meg-sales-room/`; dist is tracked in git. Structure after the
2026-08-25 trim session with Ryan:

- **1 Welcome:** index (Welcome video live) · Mutual Evaluation Process End-to-End
- **2 Brand Overview:** index (Brand Overview video live) · Qualification
  Summary (B-Verify, live DocuSign/Culture Index/B-Verify links) · FDD ·
  Additional Brand Specific Resources
- **3 Validation:** Owner Calls · Funding · Territory (video live) · How
  Technology and Sourcing Works
- **4 Seeking Approval:** ONE long page - Executive Approval Call (video
  live) + Development Action Plan + sample agreements + developer checklist
- **5 Meet The Team Day:** index · What/Who to Expect · Meet The Team Day
- **6 Agreement Stage:** index · Executive Board Approval · Executing Your
  Franchise Agreement (Brand Welcome Call merged in 2026-08-25; ends the room
  with the Thank You send-off)

Videos live: Welcome `fcaSfWLHMh8` · Brand Overview `Q0EAo3Ix3gI` ·
Validation/funding/tech EverSmith set · Territory `HI9J76Spg20` · Exec
Approval `CJJgOxVUhVg` · Resources trio in order: HQ walkthrough
`ot_QVMHzBMU`, Vendor Discounts `pgp80YAD5Xc`, Ghadery interview
`wKzLSE13k7w`.

### Removed on 2026-08-25 (Ryan's live trim session) - do not resurrect
FDD request button (section is now "Receiving Your FDD" - the developer
sends it on a call) · the whole FDD Review page (receipt gate + DocuSign
re-access; receipt lives in DocuSign outside the portal; "The Receipt and
the Clock" moved onto the FDD page) · both DocuSign walkthroughs · the DAP
hold-time warning block and DAP download button · Design Your Life ·
Seven Things to Know + the ACH Form section · Brand Welcome Call scheduler
(developer schedules it) · Sure Start intro scheduler · Hear From Our
Owners testimonial slot (bring back when video IDs arrive) · Basics of
Franchising + Is Business Ownership sections · every placeholder flag
(tracked in PLACEHOLDERS.md only - pages render none) · the Pre-MTTD
Questionnaire and Post-MTTD Assessment pages plus the Behavioral Assessment
(cut later on 2026-08-25; stage 5 is now 3 pages; EverSmith Pre-MTTD video
`3wI0n4g9eOQ` stays registered in parse.py but unused).

### Still pending for 1-Tom
- Videos: owner testimonials (IDs from John's folder), MTTD logistics,
  FranConnect overview (added 2026-08-25; Ryan hunting for the video); one
  validation video is cut off (Ryan to identify). QuickBooks Online went
  live 2026-08-25 (`uaUmFB9tv-w`). SBA 7(a) (`XyBHEblayCQ`) and 401(k)
  rollover (`haoMilg_dWA`) explainers went live 2026-08-26, all brands.
- Wiring (`href="#"` + data-asset): Teams owner-call link + add-to-calendar,
  the qualification-review scheduler, MTTD handout, Reasons form. SBA PFS
  wired 2026-08-25 to the legacy.sba.gov Form 413 page. (Pre/post MTTD forms
  and behavioral assessment left the room with their pages.)
- Facts (see PLACEHOLDERS.md): selectivity stats, remaining tech stack,
  tech-fee acknowledgment (working session), President's name, culture
  framework, podcast list, territory criteria text, MTTD agenda, org chart,
  referral program.
- Franchise proposal builder: blocked on the Neighborly Excel from John.
- Platform items (Shane): Q&A box, workbook, hideable cards, completion
  gating bug.
- Deferred at MVP sign-off (2026-08-25 meeting-notes review; Ryan said hold,
  waiting on people — do NOT do these unprompted):
  - Clayton Kendall row for the technology/sourcing table (approved in the
    meeting, not yet added).
  - Drop "compliance" from the Strategic Partnerships copy (meeting dropped
    it — no compliance vendor; Ryan's dictation to the room kept it for now).
  - Owner-call buttons need real URLs: static Teams link + add-to-calendar
    .ics (Wednesday commitment; Dial Pad swaps in later).
  - Pending slot for FM's 3-minute Strategic Partnerships video (section is
    copy-only).
  - CSS testimonial video `x32yLyjEPDk` on Additional Resources is the
    UNEDITED cut with earnings claims — swap when Shane's compliance edit
    lands.
  - Exec Approval wording: page says "Franchise Development Leaders",
    meeting notes said "franchise development executives" — Ryan to pick.

### CMS actions
Re-paste the whole 1-Tom room from the copy sheet (the CMS predates most of
this). Portal-side: delete the Validation, Seeking Approval and DAP,
Thank You sections (merged/removed), and do NOT create an FDD Review
section. Re-pasting also clears the old stray `---` paragraphs and John's
Google-Fonts dependency.

## MilliCare and Prism Specialties (built 2026-08-26)

Built from supplied Stage 1 Welcome drafts (`spec/page-template.html` in
`millicare-sales-room/` and `prism-sales-room/`), full 17-page 1-Tom MVP
structure. The drafts style only the welcome chrome, so the shared MEG
component set is appended from `build/components.css` with palette vars
aliased per brand (Prism's text accent is the deep blue - the bright brand
blue misses AA on white). Journey artwork is per-step and unique (MilliCare
carpet-cleaning run, Prism restoration frames): shell.py captures all six
jstep blocks from the draft verbatim and re-classes done/now per page.
Fonts embedded: Poppins (MilliCare, static 400-800) and Open Sans (Prism,
variable) - seeds in `build/fonts/`, latin subset from Google Fonts.
Territory / Additional Resources are the placeholder rewrites (4 flags
each, intentional); welcome / brand overview / exec-approval videos pending.

## The other three brands (caught up to the 1-Tom MVP 2026-08-25)

KG / Seals / U.S. Lawns were re-run through their pipelines after MVP
sign-off: 17 pages each, matching the 1-Tom structure. Brand-specific
content is placeholdered (welcome / brand overview / exec-approval videos
pending; 4 territory-fact flags each - intentional); the EverSmith process
videos, ServiceTitan and QuickBooks (`uaUmFB9tv-w`) carry across; the SBA
Form 413 link is wired. Their build.py ORDER, parse.py VIDEOS and shell.py
ASSET_URLS were synced with the 1-Tom trims (MTTD questionnaires out, Brand
Welcome Call merged). Brand dist/ trees are gitignored - rebuild locally
with adapt_copy.py + build.py. Note: subset_fonts.py needs
`pip install fonttools brotli` in a fresh container.

## Rebuild (1-Tom)

```bash
python3 meg-sales-room/build/build.py          # 17 pages + INDEX, all checks
python3 meg-sales-room/build/subset_fonts.py   # after copy changes, then rebuild
python3 meg-sales-room/build/viewer.py         # preview.html
python3 meg-sales-room/build/copysheet.py      # copy-sheet.html
python3 meg-shared/copysheet_all.py            # all-brands sheet
```

Copy lives in `meg-sales-room/content/pages/*.md` (edit, rebuild - never
hand-edit dist). Videos register in `build/parse.py` (VIDEOS / VIDEO_TITLES);
live URLs in `build/shell.py` ASSET_URLS.

## Live artifacts (pass the URL to update; publishing without it mints a new one)

| What | URL |
|---|---|
| **1-Tom copy sheet** (the paste tool) | https://claude.ai/code/artifact/fd85a6b7-2f7f-43d8-8a52-f37f1e73afd8 |
| **1-Tom preview** | https://claude.ai/code/artifact/ba85ab0c-e0bc-40e5-b152-2c89a766919b |
| All-brands copy sheet (brand tabs) | https://claude.ai/code/artifact/3a9499b0-a862-492a-b797-35c08770ded7 |
| Kitchen Guard preview / copy sheet | https://claude.ai/code/artifact/58e1f9d2-7c59-4098-9b22-75c965b993c6 · https://claude.ai/code/artifact/abd77079-9ec5-40cb-8af4-d7fe144e7d1d |
| The Seals preview / copy sheet | https://claude.ai/code/artifact/bf7fba98-6678-4fe2-b49f-a30dc062bbe4 · https://claude.ai/code/artifact/eb2b9c93-f48a-479f-a77e-93effa419eb6 |
| U.S. Lawns preview / copy sheet | https://claude.ai/code/artifact/da3ae4e1-6b74-41a7-a767-c1fe6f7f6e7f · https://claude.ai/code/artifact/0b40bc31-1ff2-419b-8511-1ef524d7a53e |
| MilliCare preview / copy sheet | https://claude.ai/code/artifact/7dcd77a9-ee4d-4fe3-aa62-e36c0f41724f · https://claude.ai/code/artifact/ae7171d8-82a3-4930-8ab0-ca3f510a81d2 |
| Prism Specialties preview / copy sheet | https://claude.ai/code/artifact/f8b2caa0-6f4d-4074-aeba-fe6a9386e137 · https://claude.ai/code/artifact/1851e59d-aa0d-4886-9d56-d321b9a7ec78 |

Note: another session (Ryan's Cowork side) sometimes republishes these; on a
publish conflict, supersede with the current repo build - the repo is the
source of truth.

## Working agreement with Ryan
Small, fast changes to 1-Tom only. One short confirmation per change. After
every content change: rebuild, commit, push, republish the 1-Tom copy sheet
and preview, and name which portal pages to re-paste.
