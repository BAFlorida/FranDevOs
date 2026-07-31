# MEG Sales Room - Page Index

24 self-contained HTML pages for the 1-Tom-Plumber Mutual Evaluation Guide sales room.

Each page inlines its own CSS and carries no site header, nav, or footer. Paste one at a time into the sales room CMS content field.

Regenerate with `python3 meg-sales-room/build/build.py`. Page copy lives in `build/pages/b01.py` through `b06.py`; the shared shell and components live in `build/shell.py`.


## All 24 pages

| # | Page | Path | Gates | Placeholders | Video |
|---|---|---|---|---|---|
| 1 | Welcome to Your Mutual Evaluation Guide | `01-welcome/index.html` | - | - | 2 embeds |
| 2 | Mutual Evaluation Process End-to-End | `01-welcome/01-mep-end-to-end.html` | - | - | 1 embed |
| 3 | Brand Overview | `02-brand-overview/index.html` | - | - | 1 pending |
| 4 | Qualification Summary / Culture Index | `02-brand-overview/01-qualification-summary.html` | - | 1 | 1 embed |
| 5 | Franchise Disclosure Document | `02-brand-overview/02-fdd.html` | - | 1 | 1 embed |
| 6 | Additional Brand Specific Resources | `02-brand-overview/03-additional-resources.html` | - | 4 | 2 embeds, 2 pending |
| 7 | Validation | `03-validation/index.html` | - | - | 1 embed |
| 8 | Owner Calls | `03-validation/01-owner-calls.html` | 1 checkbox | 1 | - |
| 9 | Funding | `03-validation/02-funding.html` | 2 select | - | 3 embeds, 1 pending |
| 10 | Territory | `03-validation/03-territory.html` | 1 checkbox | 1 | 1 pending |
| 11 | Understanding Your Brand's Technology | `03-validation/04-technology.html` | 1 checkbox | 11 | 2 embeds |
| 12 | Seeking Approval | `04-seeking-approval/index.html` | - | - | 1 pending |
| 13 | Executive Approval Call | `04-seeking-approval/01-executive-approval-call.html` | - | 2 | 1 pending |
| 14 | Development Action Plan / Contingencies | `04-seeking-approval/02-dap-contingencies.html` | - | - | 1 pending |
| 15 | Meet The Team Day | `05-meet-the-team-day/index.html` | - | - | - |
| 16 | What / Who to Expect at Meet The Team Day | `05-meet-the-team-day/01-what-who-to-expect.html` | - | 1 | 1 embed |
| 17 | Pre Meet The Team Day Questionnaire | `05-meet-the-team-day/02-pre-mttd-questionnaire.html` | - | 1 | 1 embed, 1 pending |
| 18 | Meet The Team Day | `05-meet-the-team-day/03-meet-the-team-day.html` | - | 1 | 1 pending |
| 19 | Post Meet The Team Day Assessment | `05-meet-the-team-day/04-post-mttd-assessment.html` | - | - | - |
| 20 | Agreement Stage | `06-agreement-stage/index.html` | - | - | - |
| 21 | Executive Board Approval | `06-agreement-stage/01-executive-board-approval.html` | - | - | 1 embed |
| 22 | Executing Your Franchise Agreement | `06-agreement-stage/02-executing-your-agreement.html` | - | 1 | 1 embed |
| 23 | Brand Welcome Call | `06-agreement-stage/03-brand-welcome-call.html` | - | 1 | 1 embed |
| 24 | Thank You For Putting Your Trust In Us | `06-agreement-stage/04-thank-you.html` | - | 1 | - |

**Totals:** 5 gates (3 checkboxes, 2 selects) on 4 pages, 27 placeholder flags, 18 video embeds, 10 pending video slots.


## Compliance gates

Four pages carry gates. All render as real form controls with associated labels, verified in a headless browser.

| Page | Gate | Type |
|---|---|---|
| `03-validation/01-owner-calls.html` | `item19` | acknowledgment |
| `03-validation/02-funding.html` | `household-expenses` | select |
| `03-validation/02-funding.html` | `outside-coverage` | select |
| `03-validation/03-territory.html` | `address` | acknowledgment |
| `03-validation/04-technology.html` | `tech-fee-timing` | acknowledgment |

## Summary and milestone deltas

The build renders the **proposed** values. Review these before anyone edits the live tool.

| Bucket | Field | Current in tool | Rendered here | Status |
|---|---|---|---|---|
| 1 · Welcome to Your Mutual Evaluation Guide | Milestone | Welcome Completed | Welcome Completed | unchanged |
| 2 · Brand Overview | Milestone | Financials Reviewed | FDD Receipt Signed | remap |
| 3 · Validation | Milestone | Opportunity Reviewed | Validation Completed | remap |
| 4 · Seeking Approval | Summary | No summary yet | Present your case to executive leadership and build your timeline. | missing |
| 4 · Seeking Approval | Milestone | FDD Receipt Signed | Executive Approval Received | remap |
| 5 · Meet The Team Day | Summary | Talk to existing 1-Tom-Plumber owners. | Visit headquarters and meet the team in person. | wrong - this is Validation's summary |
| 5 · Meet The Team Day | Milestone | Validation Completed | Discovery Day Completed | remap |
| 6 · Agreement Stage | Summary | Meet the team and see the operation firsthand. | Final approval, execution, and welcome. | wrong - this is Meet The Team Day's summary |
| 6 · Agreement Stage | Milestone | Discovery Day Completed | Agreement Executed | remap |

Milestones are **exit** gates: completing the bucket produces the milestone. Buckets 3 through 6 are each shifted one bucket forward in the tool today, and bucket 6 has no completion milestone at all.

Two labels come free under the remap and could be reused at the sub-step level: **Financials Reviewed** on 3.2 Funding, **Opportunity Reviewed** on the bucket 2 index. Neither is rendered in the pages - they are a suggestion for the tool.


## Placeholders resolved during this build

| Ref | Was | Now | Pages |
|---|---|---|---|
| `PH-02` | CRM / FSM vendor | **ServiceTitan** | 3.4 |
| `PH-02` | ATS vendor | **CareerPlug** | 3.4 |
| `PH-05` | Onboarding program name | **Sure Start** | 6.4 |
| `PH-08` | E-signature platform | **DocuSign** | 4.2, 6.2 |

> `PLACEHOLDERS.md` explicitly warned against defaulting the onboarding program to "Sure Start", because it is the source brand's program name and PIRTEK uses it too. It was confirmed as 1-Tom-Plumber's actual program name and applied. Flagging the reversal here so it is not mistaken for the warned-against default.


## Copy provenance

Every page renders the supplied source copy from `content/pages/` verbatim. No prose was written, paraphrased, or summarised by the build.

One typographic normalisation is applied and nothing else: em-dashes in the source become a spaced hyphen, per the `BUILD_PROMPT.md` house rule and the acceptance check that forbids em-dashes in output. No words are changed. If the em-dashes should be preserved instead, drop that rule from `build.py` and rebuild.

Two italic lines in the source are build directions rather than candidate-facing copy and are deliberately not rendered: the *Render above the fold* note on the Owner Calls gate, and the *This gate exists because the timing surprises people* note on the Technology gate. The italic note explaining outside sources on the Funding gate **is** candidate copy and is rendered.

Table captions are generated from each table's own heading. The build requires a caption on every table for accessibility; the source markdown carries none.


## Placeholders still open

Every one renders as a visible amber flag in the page. Nothing was silently filled in.

| Ref | Pages |
|---|---|
| `PH-01` | `04-seeking-approval/01-executive-approval-call.html` |
| `PH-02` | `03-validation/04-technology.html` |
| `PH-03` | `03-validation/04-technology.html` |
| `PH-04` | `03-validation/04-technology.html` |
| `PH-06` | `06-agreement-stage/04-thank-you.html` |
| `PH-07` | `02-brand-overview/02-fdd.html` |
| `PH-09` | `02-brand-overview/01-qualification-summary.html` |
| `PH-10` | `05-meet-the-team-day/02-pre-mttd-questionnaire.html` |
| `PH-11` | `02-brand-overview/03-additional-resources.html` |
| `PH-13` | `02-brand-overview/03-additional-resources.html` |
| `PH-14` | `04-seeking-approval/01-executive-approval-call.html` |
| `PH-15` | `05-meet-the-team-day/01-what-who-to-expect.html` |
| `PH-17` | `06-agreement-stage/02-executing-your-agreement.html` |
| `PH-18` | `06-agreement-stage/03-brand-welcome-call.html` |
| `PH-19` | `02-brand-overview/03-additional-resources.html` |
| `PH-20` | `02-brand-overview/03-additional-resources.html` |
| `PH-21` | `03-validation/01-owner-calls.html` |
| `PH-22` | `03-validation/03-territory.html` |
| `PH-24` | `05-meet-the-team-day/03-meet-the-team-day.html` |

## What still needs 1-Tom-Plumber input

These are the placeholders the source copy itself flags. Each renders as a visible amber flag in the page.

- `PH-01` selectivity figures - the source carried the original brand's numbers and says to pull 1TP's actuals
- `PH-06` referral program name and every figure in it
- `PH-07` current Item 19 status against the most recent FDD
- `PH-22` territory design criteria - the source explicitly says commercial emergency plumbing does not weight the same variables as a routed service brand
- `PH-24` full MTTD agenda, headquarters location, and travel logistics
- Vendor, name, and title gaps: `PH-02`, `PH-03`, `PH-04`, `PH-09`, `PH-10`, `PH-11`, `PH-13`, `PH-14`, `PH-15`, `PH-17`, `PH-18`, `PH-19`, `PH-20`, `PH-21`


## Video inventory

| Page | Video | ID |
|---|---|---|
| `01-welcome/index.html` | 1-Tom Mutual Evaluation Room Explanation | `fcaSfWLHMh8` |
| `01-welcome/index.html` | EverSmith What to Expect on the First Call | `hv1-dv84CS0` |
| `01-welcome/01-mep-end-to-end.html` | EverSmith Mutual Evaluation Process End to End | `KvjiPmr-JAw` |
| `02-brand-overview/01-qualification-summary.html` | EverSmith Qualification Summary Overview | `GWB3gkycrKw` |
| `02-brand-overview/02-fdd.html` | EverSmith Franchise Disclosure Document Overview | `udCsGBIY1Rs` |
| `02-brand-overview/03-additional-resources.html` | EverSmith EverConnect | `2gaiZ4BcF8Y` |
| `02-brand-overview/03-additional-resources.html` | EverSmith Brands CSS | `x32yLyjEPDk` |
| `03-validation/index.html` | EverSmith Validation Overview | `sIRDGB7yyGE` |
| `03-validation/02-funding.html` | EverSmith Funding Overview | `0Z9bjsRKN5c` |
| `03-validation/02-funding.html` | EverSmith Self Funding Overview | `oSIvxdHtO-o` |
| `03-validation/02-funding.html` | EverSmith Home Equity Funding | `TFpdCqMtxQQ` |
| `03-validation/04-technology.html` | 1-Tom Service Titan Overview | `kXK6u3O8hCU` |
| `03-validation/04-technology.html` | EverSmith Career Plug | `3aL_T7_3Ojo` |
| `05-meet-the-team-day/01-what-who-to-expect.html` | EverSmith Meet The Team Day | `LBU9FTGv0NE` |
| `05-meet-the-team-day/02-pre-mttd-questionnaire.html` | EverSmith Pre-MTTD | `3wI0n4g9eOQ` |
| `06-agreement-stage/01-executive-board-approval.html` | EverSmith Executive Board Approval | `qDuHvclW0kk` |
| `06-agreement-stage/02-executing-your-agreement.html` | EverSmith Agreement Execution | `lcOn6qL1uoo` |
| `06-agreement-stage/03-brand-welcome-call.html` | EverSmith Welcome Call | `1NynLBubPv0` |

### Pending video slots

| Page | Awaiting |
|---|---|
| `02-brand-overview/index.html` | 1-Tom-Plumber Brand Overview |
| `02-brand-overview/03-additional-resources.html` | General Franchising Concepts series |
| `02-brand-overview/03-additional-resources.html` | executive perspective on business ownership readiness |
| `03-validation/02-funding.html` | ROBS Explained |
| `03-validation/03-territory.html` | Territory Design and DBA |
| `04-seeking-approval/index.html` | Seeking Approval Overview |
| `04-seeking-approval/01-executive-approval-call.html` | Executive Approval Call prep |
| `04-seeking-approval/02-dap-contingencies.html` | Development Action Plan and Document Acknowledgment |
| `05-meet-the-team-day/02-pre-mttd-questionnaire.html` | Design Your Life |
| `05-meet-the-team-day/03-meet-the-team-day.html` | MTTD logistics |

## Verification run

`build.py` fails the build on any of: em-dash or en-dash in output, a gate without a form control, a checkbox or select without an associated label, a table without a caption, an asset slot without a `data-asset`, page chrome, an external stylesheet, a `<script>` tag, a bucket index that does not link every sub-step, a video block without its CSS, or a `watch` URL used in place of an `embed` URL.

All 24 pages were additionally loaded in headless Chromium to confirm the inline CSS applies, no console errors fire, no horizontal overflow occurs at 360px, and every gate checkbox actually toggles.


> The accent red `#C8102E` is a working value, not a confirmed brand hex. Confirm against 1-Tom-Plumber or EverSmith brand assets before anything ships to a candidate.

