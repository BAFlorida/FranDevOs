# Build Prompt — 1-Tom-Plumber MEG Sales Room Pages

Paste this into Claude Code from the root of this folder.

---

## Task

Build 24 self-contained HTML pages for the 1-Tom-Plumber Mutual Evaluation Guide sales room: 6 bucket pages and 18 sub-step pages.

Each page gets pasted into a sales room CMS field and rendered inside a content pane. Build accordingly.

## Read first

1. `spec/structure.json` — the authoritative 24-page map. Every page, its title, its content source, its interactive elements.
2. `spec/tokens.css` — design tokens. Do not invent colors or type.
3. `spec/page-template.html` — a fully built reference page. Match this pattern exactly.
4. `CONTENT_MAP.md` — which source lesson feeds which page, plus the four pages with no source content.
5. `PLACEHOLDERS.md` — the unknowns. Render these as visible flags, never as invented facts.

Source copy lives in `content/source/*.md`.

## Output

```
dist/
  01-welcome/
    index.html
    01-mep-end-to-end.html
  02-brand-overview/
    index.html
    01-qualification-summary.html
    02-fdd.html
    03-additional-resources.html
  03-validation/
    index.html
    01-owner-calls.html
    02-funding.html
    03-territory.html
    04-technology.html
  04-seeking-approval/
    index.html
    01-executive-approval-call.html
    02-dap-contingencies.html
  05-meet-the-team-day/
    index.html
    01-what-who-to-expect.html
    02-pre-mttd-questionnaire.html
    03-meet-the-team-day.html
    04-post-mttd-assessment.html
  06-agreement-stage/
    index.html
    01-executive-board-approval.html
    02-executing-your-agreement.html
    03-brand-welcome-call.html
    04-thank-you.html
```

`index.html` is the bucket page. It carries the bucket summary, the milestone, and a linked list of its sub-steps.

## Hard requirements

**Self-contained.** Every page inlines its own CSS in a single `<style>` block. No external stylesheets, no build step, no JS frameworks. Copy the token values from `spec/tokens.css` into each page. Yes, this duplicates. That is intentional — these get pasted individually.

**No page chrome.** No site header, no nav bar, no footer. The sales room supplies those. Start at the page's own H1.

**Compliance gates are real elements.** Four pages carry acknowledgment gates (marked in `structure.json`). Render each as a bordered block with a real `<input type="checkbox">` and a label. Do not render them as plain paragraphs. These are the legal spine of the portal.

**Placeholders stay visible.** Anything in `PLACEHOLDERS.md` renders as an inline `<span class="ph">` — dashed border, amber. Never silently fill one in. Never invent a vendor name, a dollar figure, a person's name, or a funnel percentage.

**Asset slots are visible.** Videos, downloads, and form launches render as labeled slot blocks with the asset name, not as bare text or dead links. Use `href="#"` and a `data-asset` attribute naming what belongs there.

**Accessibility floor.** Responsive to 360px. Visible keyboard focus. `prefers-reduced-motion` respected. Tables get `<caption>` or a preceding heading. Every checkbox has an associated `<label>`.

## Voice and copy rules

Follow these when adapting source markdown into page copy:

- Sentences 15–20 words, active voice. Fragments allowed for emphasis.
- Spaced hyphen ( - ). Never an em-dash.
- Define every acronym on first use on that page. Candidates do not carry a glossary between pages.
- Lead with the answer, then support it.
- No earnings claims, ever. If copy drifts toward implying what an owner can earn, stop and flag it.
- Close each page on the next action.

Do not rewrite the source copy wholesale. Adapt it to fit the page boundary, preserve its structure and its specifics.

## Build order

1. Read all five spec files.
2. Build `01-welcome/index.html` first and stop. Show it to me before continuing.
3. On approval, build the remaining 23.
4. Write `dist/INDEX.md` — a table of all 24 pages with title, path, gates, placeholder count.

## Acceptance checks

Before you report done, verify:

- [ ] 24 files exist at the exact paths above
- [ ] Every file opens standalone with no console errors and no missing styles
- [ ] The 4 compliance gates render as checkboxes, not paragraphs
- [ ] Zero invented facts — grep your output for any dollar figure, percentage, or vendor name not present in the source or explicitly marked as a placeholder
- [ ] No em-dashes in any output file
- [ ] Every bucket `index.html` links to all of its sub-steps
- [ ] `dist/INDEX.md` exists and is accurate

## Known gaps

Four pages have no source content. `CONTENT_MAP.md` names them. Build them as structured stubs with correct headings, correct interactive elements, and a visible note that copy is pending. Do not write speculative copy for them.
