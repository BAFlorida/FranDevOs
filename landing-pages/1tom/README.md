# 1-Tom-Plumber cold landing page (`explore-1tom.html`)

Single self-contained page for cold paid-social traffic (mostly mobile Instagram Reels).
Inline CSS, vanilla JS, no dependencies, no build step. `noindex, nofollow`. The page is
pasteable into a site template later: everything lives in one file.

Structure: hero (6 swappable angles) → who it's for / isn't → how the model works →
what ownership asks → FDD numbers → **five-question fit assessment** (the primary action;
no contact fields) → contact step, reachable **only** from a "strong fit" or "worth a
conversation" result. A "not right now" result shows no form and no alternative CTA by design.

## Brand token block

All colors, fonts, and spacing resolve to CSS custom properties in the **single `:root`
block at the top of the `<style>` element** (marked `1-TOM-PLUMBER BRAND TOKENS`).
Swapping the brand is an edit to that block only — nothing else in the stylesheet holds a
raw color, font name, or spacing value.

The placeholder palette approximates 1TP truck livery (red / near-black / off-white) in a
utilitarian jobsite register. **These are not official values** — the brand book attachment
never reached the build session. Notable tokens:

| Token | Role |
|---|---|
| `--font-display` / `--font-body` | Display (heavy industrial) and body stacks. System fonts only — external font requests are not allowed on this page. If the brand font arrives as a file, embed it via `@font-face` with a `data:` URI or same-origin URL. |
| `--color-ink` / `--color-paper` / `--color-surface` | Near-black, page background, cards/inputs |
| `--color-accent` / `--color-accent-contrast` | Brand red; text color placed on it |
| `--color-accent-on-dark` | Lightened accent for small text/fills on dark panels — keep it ≥4.5:1 against `--color-ink` |
| `--color-focus` | Keyboard focus ring, all surfaces |
| `--s1`–`--s8`, `--bw`, `--rule`, `--radius`, `--container`, `--measure` | Spacing scale and structure |

## What to swap when the brand template lands

1. **Tokens** — replace the `:root` block values (above).
2. **GTM** — set `GTM_CONTAINER_ID` in the small `<script>` in `<head>`; add the standard
   GTM `<noscript>` iframe at the marked comment right after `<body>`. While the ID is
   empty, no GTM request is made and events queue harmlessly in `dataLayer`.
3. **Submit endpoint** — set `SUBMIT_ENDPOINT` at the top of the main script (HubSpot
   Forms API URL or portal/form submit URL). While `null`, submit logs the full payload to
   the console and shows the confirmation. **When wiring it, keep `generate_lead` firing
   only on a 2xx response** — the stub currently fires it on the simulated success.
4. **Image placeholder** — the dashed box in "What ownership actually asks of you" marks
   where a real owner/tech photo goes. No stock.
5. **TODO boxes** — the visible dashed `TODO(ryan)` box (operational specifics) must be
   resolved before live traffic; it is deliberately impossible to miss.
6. **Template wrap** — the page assumes no site nav. If it gets pasted into a template,
   keep `<meta name="robots" content="noindex, nofollow">` and the hero/section markup
   intact; the two `.hazard` strips and the footer are safe to replace with template chrome.

## Hero angle variants

`?angle=` swaps eyebrow, H1, subhead, and CTA label from the `ANGLES` object in the main
script. Unknown/missing values fall back to `operator-scale` silently. Valid values:
`operator-scale`, `essential-demand`, `technology`, `ownership-transition`, `multi-unit`,
`structure`. Every variant subhead is one angle-specific sentence plus the constant
message-match line ("Before anyone asks you for a phone call…"), which is appended in code
so it cannot drift per-variant.

## Events (all via `dataLayer.push`; GTM forwards to GA4/Meta)

Every event carries: `brand:'1tom'`, `page_type:'cold_lp'`, `lp_version:'cold-v1'`,
`creative_angle` (the **resolved** angle actually shown), plus `placement`, `campaign_id`,
`adset_id`, `ad_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` read from
the query string (empty string when absent).

| Event | Trigger | Extra params |
|---|---|---|
| `cold_lp_view` | Page load | — |
| `hero_cta_click` | Hero primary CTA | — |
| `fit_section_view` | Who-this-is-for section 50% visible, once | — |
| `model_section_view` | How-it-works section 50% visible, once | — |
| `assessment_start` | First question rendered (Begin click) | — |
| `assessment_q{1–5}_complete` | Each answer click | `question`, `answer` |
| `assessment_complete` | Result shown | `fit_band` |
| `form_start` | First contact-field interaction, once | — |
| `generate_lead` | Successful submit | `fit_band` |

`fit_band` values: `strong_fit`, `worth_a_conversation`, `not_right_now`.
`fbclid` is captured on landing, held in a JS variable only (no cookie/storage), and added
to the lead payload at submit time.

**Known caveat:** section-view uses `IntersectionObserver` at threshold 0.5 per spec. A
section more than ~2× the viewport height can never reach 50% visibility, so on short
phones `model_section_view` may under-fire. If that shows up in data, switch to a per-section
adaptive threshold (`min(0.5, viewportHeight*0.5/sectionHeight)`).

## Assessment scoring

One tunable config object, `SCORING`, in the main script: per-answer `weights` (max total
15), `disqualifiers` (Q3 "overseeing while I keep my current role", Q4 "under $100K" →
forced `not_right_now` regardless of score), and `bands` (`strongMin: 11`,
`conversationMin: 7`; below 7 → `not_right_now`). Strong-fit reason bullets (`REASONS`)
and the worth-a-conversation named uncertainty (`OPEN_QUESTIONS`, lowest-weighted answer,
tie order capital → timing → P&L → day-to-day → background) are keyed by answer so tuning
weights never touches logic.

Lead payload/hidden fields: `first_name`, `last_name`, `email`, `mobile`, `state_metro`,
`heard_about_us` (facebook|instagram), `assessment_background`, `assessment_pl_experience`,
`assessment_involvement`, `assessment_liquid_capital`, `assessment_timing` (answer slugs),
`fit_band`, `fit_score`, `creative_angle`, `lp_version`, `placement`, `campaign_id`,
`adset_id`, `ad_id`, `utm_*`, `landing_page_url`, plus `fbclid` and `submitted_at` added in JS.

## Copy flags for Ryan / legal review

Spec copy was used verbatim where supplied. The following was **authored in the build**
(the spec required the sections but supplied no copy) and needs Ryan + legal eyes before
live traffic:

- The five non-default angle **subheads** (H1s were supplied).
- Section 4.4 prose ("What ownership actually asks of you").
- All three **result-band copy** blocks, including the three not-right-now variants.
- Assessment intro/trust copy, contact-step confirmation, submit-error line, and the
  footer franchise disclaimer (state-registration language, e.g. NY/MN, not addressed —
  legal should confirm what the footer needs before paid traffic).
- Mid-page CTA labels in "How the model works".

Judgment calls to be aware of:

- **No retake/back-out is offered on the "not right now" screen beyond the standard ← Back
  button** (which returns to Q5, consistent with every step having a back button). Nothing
  routes to contact. If "offer nothing" should also mean no back button on that screen,
  delete the `topBarHTML` line in the `not_right_now` branch of `showResult()`.
- "How did you first hear about us?" offers exactly Facebook and Instagram (per spec) plus
  a disabled "Choose one" placeholder. No "Other".
- The two mid-page CTAs fire no dedicated event (spec defines none); `assessment_start`
  captures the funnel regardless.
- `assessment_q{n}_complete` includes the `answer` slug for audience building; drop the
  param in GTM if unwanted.
- Weak spot worth a look: the CTA label says "1Tom" while body copy says "1-Tom-Plumber"
  (both verbatim from the spec) — confirm which short form the brand book sanctions.

## Open TODO(ryan) items (grep `TODO(ryan)` in the HTML)

1. `GTM_CONTAINER_ID` (head script)
2. `SUBMIT_ENDPOINT` (main script) — HubSpot portal/form ID or endpoint
3. Brand tokens + fonts (`:root` block) — brand book never reached the build session
4. 2–3 concrete operational specifics for section 4.4 (visible dashed box)
5. Liquid capital requirement + franchise fee — **omitted entirely** per spec; add a
   fourth stat block if supplied
6. Territory availability — nothing on the page states or implies it
7. Legal review of full copy before live traffic

## QA snapshot (build-time)

Verified via headless Chromium: renders at 360/768/1440 with no horizontal scroll; all six
angle variants + silent fallback; full event set with parameters in `dataLayer`; "not right
now" renders no form/CTA; keyboard-only path hero → assessment → submit; zero external
network requests; 16px+ inputs (no iOS zoom-on-focus); `prefers-reduced-motion` gates all
motion including smooth scroll.
