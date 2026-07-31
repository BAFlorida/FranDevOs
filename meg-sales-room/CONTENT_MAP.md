# Content Map

Where each source lesson lands in the 24-page sales room structure.

Source files are in `content/source/`. They were written against a 6-stage / 19-lesson architecture that does not match the sales room's 6-bucket / 18-substep structure. This map is the reconciliation.

---

## Routing table

| Sales room page | Source |
|---|---|
| 1 · index | New — bucket overview |
| 1.1 MEP End-to-End | `stage_1_design.md` framing + new 6-bucket journey map |
| **2 · index** | `stage_1_design.md` Lesson 1 (Brand Overview / "Let's Get Started") |
| 2.1 Qualification Summary / Culture Index | `stage_1_design.md` Lesson 2 |
| 2.2 Franchise Disclosure Document | `stage_1_design.md` Lesson 3 |
| 2.3 Additional Brand Specific Resources | `stage_1_design.md` Lessons 4 **and 5** |
| **3 · index** | New — bucket overview |
| 3.1 Owner Calls | `stage_2_validation.md` Lesson 1 |
| 3.2 Funding | `stage_2_validation.md` Lesson 2 |
| 3.3 Territory | `stage_2_validation.md` Lesson 4 |
| 3.4 Understanding Your Brand's Technology | `stage_2_validation.md` Lesson 5 |
| **4 · index** | New — bucket overview |
| 4.1 Executive Approval Call | `stage_3_vp_approval.md` Lesson 1 |
| 4.2 Development Action Plan / Contingencies | `stage_4_booked_mttd.md` Lesson 1 |
| **5 · index** | New — bucket overview |
| 5.1 What / Who to Expect at MTTD | `stage_4_booked_mttd.md` Lesson 3 (org chart + workbook) |
| 5.2 Pre-MTTD Questionnaire | `stage_4_booked_mttd.md` Lesson 3 (pre-work) **+ Lesson 2** |
| 5.3 Meet The Team Day | **NONE** |
| 5.4 Post-MTTD Assessment | `stage_5_mttd_completed.md` Lesson 1 |
| **6 · index** | New — bucket overview |
| 6.1 Executive Board Approval | `stage_5_mttd_completed.md` Lesson 2 |
| 6.2 Executing Your Franchise Agreement | `stage_6_agreement.md` Lesson 1 |
| 6.3 Brand Welcome Call | **NONE** |
| 6.4 Thank You For Putting Your Trust In Us | `stage_6_agreement.md` Lessons 3 **and 2** |

---

## Four pages with no source content

Build these as structured stubs. Correct headings, correct interactive elements, visible "copy pending" note. Do not write speculative copy.

**5.3 Meet The Team Day** — the event itself. Needs: day-by-day agenda, travel logistics (what is covered vs. what the candidate covers), what to bring, guidance on bringing a spouse or partner, and the "Reasons to Become or Not Become a Franchise Owner" form with its do-not-complete-in-advance instruction.

**6.3 Brand Welcome Call** — a 1TP addition, not in the source portal. Needs: who is on the call, what gets covered, what the new owner should bring, how it hands off to onboarding.

**1 · index and 3 · index through 6 · index** — bucket overview pages. Each carries the bucket summary, the milestone, and a linked list of its sub-steps. Short. Bucket 2's index has real source content (the Brand Overview lesson).

---

## Three orphaned lessons

These exist in source but have no matching sales room page. All three route into existing pages as optional depth rather than getting cut.

| Orphan | Route to | Treatment |
|---|---|---|
| `stage_1_design.md` Lesson 5 — The Basics of Franchising | 2.3 Additional Resources | Optional, not required to advance |
| `stage_2_validation.md` Lesson 3 — Is Business Ownership Really Right for Me? | 2.3 Additional Resources | Optional. It is a deliberate pause exercise — keep that framing |
| `stage_4_booked_mttd.md` Lesson 2 — Design Your Life | 5.2 Pre-MTTD Questionnaire | Extra credit, pre-travel prep |

If 1TP wants these as their own sub-steps instead, they become 2.4, 2.5, and 5.5, and the page count goes to 27.

---

## Structural deltas from source

Worth knowing when adapting copy, since some lessons were written assuming a different neighbor.

1. **Welcome is now its own bucket.** Source folded this into the first Design Stage lesson.
2. **Credit report moved.** Source paired it with Qualification Summary. Sales room pairs QS with Culture Index. All four items stay on page 2.1 regardless.
3. **DAP moved earlier.** Source put it in MTTD prep. Sales room puts it in Seeking Approval, alongside the Executive Approval Call. This is the better placement — the DAP is built *because* the executive approved.
4. **MTTD is four pages, not one.** The event itself became a sub-step. Pre-work and post-work split off.
5. **Executive Board Approval moved later.** Source had it closing MTTD. Sales room opens Agreement Stage with it.
6. **Brand Welcome Call is new.** No source equivalent.

---

## Fixes to apply during the build

Three bucket summaries and four milestones are wrong in the tool today. `structure.json` carries both `current` and `proposed` values for each.

**Summaries**
- Bucket 4 — empty ("No summary yet")
- Bucket 5 — shows Validation's summary
- Bucket 6 — shows Meet The Team Day's summary

**Milestones** — these are exit gates, and buckets 3 through 6 are each shifted one bucket forward. Bucket 6 currently has no completion milestone at all. Two existing labels ("Financials Reviewed", "Opportunity Reviewed") come free under the proposed remap and could be reused at the sub-step level — Financials Reviewed on 3.2 Funding, Opportunity Reviewed on the bucket 2 index.

The build should render `proposed` values and note the delta in `dist/INDEX.md` so the change is reviewable before anyone edits the live tool.
