# MEG Sales Room - Page Index

24 self-contained HTML pages for the 1-Tom-Plumber Mutual Evaluation Guide.

Each page inlines its own CSS and carries the full production chrome: topbar, hero, six-node journey track, spine-and-slides stack, and footer. No external stylesheet, no JS, no build step needed to render.

**Copy is rendered directly from `content/pages/*.md`.** Nothing is transcribed by hand, so the pages cannot drift from the source. To change copy, edit the markdown and rebuild.

**Design comes from `spec/page-template.html` and `spec/tokens.css`.** Token values are used exactly as given; none were substituted or invented.

Rebuild: `python3 meg-sales-room/build/build.py`


## All 24 pages

| # | Page | Path | Slides | Gates | Flags | Video | Assets |
|---|---|---|---|---|---|---|---|
| 1 | Welcome | `01-welcome/index.html` | 1 | - | - | 1 embed | - |
| 2 | Mutual Evaluation Process End-to-End | `01-welcome/01-mep-end-to-end.html` | 1 | - | - | 1 embed | - |
| 3 | Brand Overview | `02-brand-overview/index.html` | 1 | - | - | 1 pending | - |
| 4 | Qualification Summary | `02-brand-overview/01-qualification-summary.html` | 3 | - | - | 1 embed | 4 |
| 5 | Franchise Disclosure Document | `02-brand-overview/02-fdd.html` | 2 | - | - | 1 embed | - |
| 6 | Additional Brand Specific Resources | `02-brand-overview/03-additional-resources.html` | 3 | - | - | 2 embeds, 2 pending | - |
| 7 | Validation | `03-validation/index.html` | 1 | - | - | 1 embed | - |
| 8 | Owner Calls | `03-validation/01-owner-calls.html` | 2 | 1 checkbox | 1 | - | 1 |
| 9 | Funding | `03-validation/02-funding.html` | 5 | 2 select | - | 3 embeds, 1 pending | 1 |
| 10 | Territory | `03-validation/03-territory.html` | 4 | 1 checkbox | 1 | 1 pending | - |
| 11 | Understanding Your Brand's Technology | `03-validation/04-technology.html` | 4 | 1 checkbox | - | 2 embeds | - |
| 12 | Seeking Approval | `04-seeking-approval/index.html` | 1 | - | - | 1 pending | - |
| 13 | Executive Approval Call | `04-seeking-approval/01-executive-approval-call.html` | 6 | - | 1 | 1 pending | - |
| 14 | Development Action Plan / Contingencies | `04-seeking-approval/02-dap-contingencies.html` | 6 | - | - | 1 pending | 1 |
| 15 | Meet The Team Day | `05-meet-the-team-day/index.html` | 1 | - | - | - | - |
| 16 | What / Who to Expect at Meet The Team Day | `05-meet-the-team-day/01-what-who-to-expect.html` | 4 | - | 1 | 1 embed | 1 |
| 17 | Pre Meet The Team Day Questionnaire | `05-meet-the-team-day/02-pre-mttd-questionnaire.html` | 2 | - | 1 | 1 embed, 1 pending | 2 |
| 18 | Meet The Team Day | `05-meet-the-team-day/03-meet-the-team-day.html` | 2 | - | 1 | 1 pending | 1 |
| 19 | Post Meet The Team Day Assessment | `05-meet-the-team-day/04-post-mttd-assessment.html` | 1 | - | - | - | 1 |
| 20 | Agreement Stage | `06-agreement-stage/index.html` | 1 | - | - | - | - |
| 21 | Executive Board Approval | `06-agreement-stage/01-executive-board-approval.html` | 3 | - | - | 1 embed | - |
| 22 | Executing Your Franchise Agreement | `06-agreement-stage/02-executing-your-agreement.html` | 4 | - | - | 1 embed | 1 |
| 23 | Brand Welcome Call | `06-agreement-stage/03-brand-welcome-call.html` | 1 | - | 1 | 1 embed | 1 |
| 24 | Thank You For Putting Your Trust In Us | `06-agreement-stage/04-thank-you.html` | 3 | - | 1 | - | 1 |

**Totals:** 62 slides, 5 gates (3 checkboxes, 2 selects) on 4 pages, 8 placeholder flags, 17 video embeds, 10 pending video slots, 15 asset slots.


## Compliance gates

| Page | Gate | Type |
|---|---|---|
| `03-validation/01-owner-calls.html` | `item19` | acknowledgment |
| `03-validation/02-funding.html` | `household-expenses` | select |
| `03-validation/02-funding.html` | `outside-coverage` | select |
| `03-validation/03-territory.html` | `address` | acknowledgment |
| `03-validation/04-technology.html` | `tech-fee-timing` | acknowledgment |

## Summary and milestone deltas

The pages render the **proposed** values. Review before editing the live tool.

| Bucket | Field | Current in tool | Proposed | Status |
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

Milestones are **exit** gates. Buckets 3 through 6 are each shifted one bucket forward in the tool today, and bucket 6 has no completion milestone.


## Placeholders still open

Each renders as an amber `.flag` block or inline chip in the page. Nothing was silently filled in.

| Ref | Pages |
|---|---|
| `PH-01` | `04-seeking-approval/01-executive-approval-call.html` |
| `PH-02` | `03-validation/04-technology.html` |
| `PH-04` | `03-validation/04-technology.html` |
| `PH-06` | `06-agreement-stage/04-thank-you.html` |
| `PH-11` | `02-brand-overview/03-additional-resources.html` |
| `PH-14` | `04-seeking-approval/01-executive-approval-call.html` |
| `PH-15` | `05-meet-the-team-day/01-what-who-to-expect.html` |
| `PH-17` | `06-agreement-stage/02-executing-your-agreement.html` |
| `PH-18` | `06-agreement-stage/03-brand-welcome-call.html` |
| `PH-19` | `02-brand-overview/03-additional-resources.html` |
| `PH-20` | `02-brand-overview/03-additional-resources.html` |
| `PH-21` | `03-validation/01-owner-calls.html` |
| `PH-22` | `03-validation/03-territory.html` |
| `PH-24` | `05-meet-the-team-day/03-meet-the-team-day.html` |

## Video inventory

| Page | Video | ID |
|---|---|---|
| `01-welcome/index.html` | Welcome — 1-Tom-Plumber Mutual Evaluation Guide | `fcaSfWLHMh8` |
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

## Verification

`build.py` fails the build on: a missing or unexpected page, any of the four chrome elements missing, a missing spine or slides, a journey track that does not mark this page's stage as current, a gate without a form control, an unlabelled checkbox or select, an uncaptioned or unscrollable table, an asset without `data-asset`, an outbound request that is not a video embed or a resolved `.btn` destination, an unknown video id, a `watch` URL in place of an `embed` URL, an unrendered source marker or stray markdown, or an index page that reintroduces a sub-step list.

A copy-fidelity check confirms every prose line of `content/pages/*.md` appears in its rendered page. All 24 pages are additionally loaded in headless Chromium to confirm the CSS applies, no console errors fire, no horizontal overflow occurs at 360px, and every gate control operates.

