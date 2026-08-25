# John's portal punch list — application status

Source: Portal Bros standup, 2026-08-04 (John / Shane / Ryan). Applied to the
sales room templates 2026-08-24 on the shared source, so every item below
marked **applied** is live in all four brands (1-Tom-Plumber, Kitchen Guard,
The Seals, U.S. Lawns) unless noted. Items marked **platform** belong to the
portal builder, not the page HTML. Items marked **blocked** name what they
wait on.

## Structure

| Item | Status |
|---|---|
| Validation overview page: delete; its video moves to Owner Calls | **Applied.** Page removed; EverSmith Validation Overview now opens Owner Calls. Rooms are 23 pages |
| Seeking Approval overview: merge into Executive Approval Call | **Applied.** The flip framing and the (pending) overview video now open the exec page; one video serves both |
| "Steps in this stage" blocks: remove | **Applied earlier** (2026-08-19 reconciliation) on every index page |
| New locked "Franchise Disclosure Document Review" section after the FDD explainer | **Applied** as page `02-brand-overview/03-fdd-review.html`: unlock note, DocuSign re-access button, receipt-and-clock explainer, Item 23 receipt acknowledgment gate. The lock itself is enforced by the portal |
| Cards individually hideable | **Platform** (Shane) — unresolved on the call; single-HTML-document obstacle |
| Q&A moves out of HTML into a builder box type | **Platform** (Shane) — agreed model; page-side answer fields stay put until it lands |
| The workbook (answers captured, candidate-visible, developer-visible) | **Platform** (Shane) — data-storage concern unresolved |
| Completion-gating bug (step completable with sub-modules skipped) | **Platform** (Shane) — confirmed on the call |

## FDD flow

| Item | Status |
|---|---|
| Request button on the FDD page | **Applied** as a `data-asset="link:fdd-request"` button with the confirmation copy ("your developer will walk you through it on your next call"). The notify wiring is portal-side |
| Signing stays outside the portal; candidate re-accesses afterward | **Applied** — the FDD Review page says signing happens in DocuSign and carries the re-access button (`link:fdd-reaccess`, wired per candidate) |

## Kill and trim

| Item | Status |
|---|---|
| "Complete your owner call, then continue to funding" | **Applied** — removed; replaced with the tandem sentence in body copy |
| DBA home-address sentence | **Applied** — "For most owners, a home address works…" removed from the 1-Tom territory page (other brands' territory pages are separate rewrites and never had it) |
| "Questions to Ask During Validation" form | **Applied** — the capture-guide section and download are cut for MVP |
| "Let me frame this up for you" / AI-salesy exec copy | **Applied** — "The Frame" section rewritten as "Where This Call Fits," plain language, no framing-speak |

## Page-by-page

| Item | Status |
|---|---|
| Owner Calls: Teams link is the page's most important element; add-to-calendar | **Applied** — "Your Call Link" section up top with `link:owner-call-teams` and `link:owner-call-calendar` buttons (URLs wired per candidate in the portal) |
| Owner Calls: 1-Tom testimonial videos | **Slot placed** ("Hear From Our Owners"). Videos exist in the folder John sent Ryan — needs the IDs. The clipped, FAQ-indexed library is a later, separate page |
| Funding: vendor video slots as ad inventory | **Applied** — SBA slot (First Financial / FranFund) and ROBS slot (Benetrends / Tenet). Self-funding and home equity already embedded |
| Funding: rendering gap | **Not in our build** — current funding page renders with normal spacing; the gap lives in the CMS's old paste. Re-pasting the page fixes it |
| Funding: answer fields go nowhere | **Platform** — the two self-assessment selects stay until the Q&A builder box and workbook exist |
| Technology: retitle + reorder | **Applied** — now "How Technology and Sourcing Works": sourcing sentence first ("EverSmith Strategic Partnerships sources our software platforms," unlinked, back-referencing Additional Resources), package table, vendor videos (ServiceTitan ✓, CareerPlug ✓, QuickBooks Online pending slot), pricing from Item 7 |
| Technology: wrong fee acknowledgment | **Removed, blocked** — the gate claiming a one-time fee drafted by EverSmith is gone. 1-Tom: no setup fee, $1,000–$8,000/mo direct to vendors; acknowledgment copy waits on the 1-Tom working session. Other brands carry a confirm-billing flag |
| Exec approval: stats placeholder → real numbers | **Still flagged** — needs 1-Tom's actual funnel numbers |
| Exec approval: hosts | **Applied** — "John Dobelbower and the [brand] brand leader," with the every-candidate-before-MTTD requirement stated |
| Exec approval: dress + lighting prep guidance | **Applied** |
| DAP video reference | **Applied** — standalone slot removed; the exec-approval overview slot notes it covers the DAP and contingent agreements |
| DAP: developer builds timeline, section unlocks after upload | **Applied** as copy; the Base44 developer-only view and unlock mechanics are **platform** |
| DAP: auto-build on approval | **Killed by John** — no action |
| Agreements: Experian → B-Verify | **Applied earlier**; the DAP checklist's stale "Experian self-pull" row now reads B-Verify |
| Agreements: FDD receipt / territory map / proposal / SBA letter | Checklist rows exist on the DAP page; receipt now collects in FDD Review. Producing the actual artifacts is process/platform work |

## Franchise proposals

**Blocked.** Three structures (pay in full · ~20% equity injection with balance
on SBA funding · ROBS zero-down one-month balloon, except when Tenet is used),
discounts layered on top, attached to the setup forms for Michelle and Katie.
Blocked on the Neighborly Excel proposal builder that never arrived —
re-request it from John.

## Content inventory notes

- Cut-off validation video: Ryan to watch through and identify which.
- Territory videos: per-brand. **1-Tom's is live** (`HI9J76Spg20`, supplied
  2026-08-25, embedded on the Territory page). Other brands still pending;
  criteria drop into the existing placeholder.
- Basics of Franchising + "Is Business Ownership Really Right for Me":
  **sections removed from Additional Resources on all brands (2026-08-25)**
  rather than shipping unbuilt slots. The four box remains unrecorded.
- Additional Resources (1-Tom) gained three live videos on 2026-08-25:
  Vendor Discounts (`pgp80YAD5Xc`), Behind the Scenes at HQ (`ot_QVMHzBMU`),
  and the Justin Ghadery "Is It Worth It in 2026?" interview (`wKzLSE13k7w`).
- National accounts + strategic partnerships EverSmith videos: needed.
- Vendor walkthrough Loom rather than outbound links; anything that must link
  out opens a new window (all our `.btn` links already do).
