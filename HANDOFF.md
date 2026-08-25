# MEG sales rooms - handoff

Everything needed to pick this up in a new chat. Code, pages, specs and brand
assets are committed on branch `claude/meg-sales-rooms-c0l3n2`. Read this file
first; `meg-shared/PUNCH-LIST.md` and `meg-sales-room/PLACEHOLDERS.md` carry
the item-level trackers.

**Current focus: 1-Tom-Plumber only.** Ryan said to leave the other three
brands alone until asked.

---

## 1-Tom-Plumber - the live room (20 pages, zero placeholder flags)

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
- **5 Meet The Team Day:** index · What/Who to Expect · Pre-MTTD
  Questionnaire · Meet The Team Day · Post-MTTD Assessment
- **6 Agreement Stage:** index · Executive Board Approval · Executing Your
  Franchise Agreement · Brand Welcome Call (ends the room with the Thank You
  send-off)

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
(tracked in PLACEHOLDERS.md only - pages render none).

### Still pending for 1-Tom
- Videos: owner testimonials (IDs from John's folder), SBA + ROBS vendor
  slots, MTTD logistics, FranConnect overview (added 2026-08-25; Ryan hunting
  for the video); one validation video is cut off (Ryan to identify).
  QuickBooks Online went live 2026-08-25 (`uaUmFB9tv-w`).
- Wiring (`href="#"` + data-asset): Teams owner-call link + add-to-calendar,
  the qualification-review scheduler, MTTD handout, pre/post MTTD forms,
  behavioral assessment, Reasons form. SBA PFS wired 2026-08-25 to the
  legacy.sba.gov Form 413 page.
- Facts (see PLACEHOLDERS.md): selectivity stats, remaining tech stack,
  tech-fee acknowledgment (working session), President's name, culture
  framework, podcast list, territory criteria text, MTTD agenda, org chart,
  referral program.
- Franchise proposal builder: blocked on the Neighborly Excel from John.
- Platform items (Shane): Q&A box, workbook, hideable cards, completion
  gating bug.

### CMS actions
Re-paste the whole 1-Tom room from the copy sheet (the CMS predates most of
this). Portal-side: delete the Validation, Seeking Approval and DAP,
Thank You sections (merged/removed), and do NOT create an FDD Review
section. Re-pasting also clears the old stray `---` paragraphs and John's
Google-Fonts dependency.

## The other three brands (parked)

KG / Seals / U.S. Lawns are at the punch-list-era build. Their pipelines
(adapt_copy.py, build.py, structure.json) are kept current with the shared
source, so **one run each of adapt_copy.py + build.py + subset_fonts.py**
catches them up whenever work resumes; their dist trees lag the shared
ORDER until then (the all-brands sheet tolerates this). Their brand-specific
flags are intentional - those rooms are not candidate-facing.

## Rebuild (1-Tom)

```bash
python3 meg-sales-room/build/build.py          # 20 pages + INDEX, all checks
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

Note: another session (Ryan's Cowork side) sometimes republishes these; on a
publish conflict, supersede with the current repo build - the repo is the
source of truth.

## Working agreement with Ryan
Small, fast changes to 1-Tom only. One short confirmation per change. After
every content change: rebuild, commit, push, republish the 1-Tom copy sheet
and preview, and name which portal pages to re-paste.
