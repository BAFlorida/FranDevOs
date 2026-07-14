# EverSmith Brands — Investment Case Design System

**One token layer, four case types, three render targets.** Point Claude Design at this folder and every capital request, brand growth plan, add-on thesis, and board review comes out looking like it was written by a portfolio company that thinks like an investor.

---

## Start here: the three-line swap

The system is built so the brand is a swap, not a dependency. Open `eversmith-ds.css`, find these three variables, overwrite them with the exact hex from the EverSmith brand guide:

```css
--esb-blue:   #123A5E;
--esb-teal:   #1B9A92;
--esb-crown:  #123A5E;
```

Nothing else needs to change. **The field is neutral by design.** Brand color appears only on data, gates, and the claim mark, so if my hex values are off by a few points, 90% of the system is still correct. This is also why the system reads as a board document rather than a marketing deck.

---

## What is in the folder

| File | What it is | What it is for |
|---|---|---|
| `eversmith-ds.css` | The authoritative token + component layer | Claude Design ingests this. So does anything else you build. |
| `component-library.html` | Every component rendered, with its usage rule | The spec sheet. Also the visual reference Claude Design reads. |
| `business-case.html` | A worked capital request, nine slides plus a one-pager | Proves the system in situ. Clone it and replace. |
| `README.md` | This file | The rules. |

---

## The rules the system enforces

### The headline is the argument, not the topic

If a headline can be true or false, it is a claim. If it can only be a subject, it is a label. Labels are banned. A committee member who reads nothing but your headlines should be able to reconstruct the entire case.

> Banned: *Q3 Lead Performance*
> Required: *Paid cost per qualified lead fell 78% while qualified volume held flat*

### Every figure is sourced in the rail

The 104px mono column on the left of every surface is the signature element and the only structural constraint in the system. It carries the claim number, a source line for every figure in the body, and the document status at the foot. **You cannot lay out a page in this system without filling it.** Sourcing stops being a habit you have to remember and becomes something the grid will not let you skip.

### The downside card is never omitted

A case without a downside is a pitch, and an operating partner reads its absence as naivety or concealment. Lead with the downside. It is how you buy the room's trust for the base case.

### Capital releases against gates, not against the calendar

The gate track is the most effective de-risking device in a capital request, because it lets the committee say yes to the first tranche without saying yes to all of it. Number the gates. The sequence is real, so the numbering carries information rather than decorating the slide.

### Red is earned

Signal color appears at most twice in a deck. If everything is red, nothing is.

### The callout fires once

Its power is entirely a function of scarcity. Use it twice and you have taught the room to skim past the first one.

---

## The four case types, one component set

The same components recombine. Nothing new gets invented per case type.

**Capital request.** Thesis → Situation → Complication → Unit economics → Scenarios → Use of funds → Gate track → Risk → Decision. This is `business-case.html` as built.

**Brand growth plan / budget defense.** Thesis → Prior-year actuals against plan → Unit economics → Scenarios → Use of funds → Risk. Drop the gate track, since you are defending an allocation rather than staging one.

**Add-on or conversion thesis.** Thesis → Target profile and TAM → Unit economics of the converted operator → Royalty arbitrage → Scenarios → Integration gates → Risk. The gate track returns, because an add-on is staged by nature.

**Recurring board and ops review.** Metric strip → Pacing table → Variance narrative → Risk register. No thesis block. A review is not an argument, and pretending otherwise wastes the committee's attention.

---

## Loading it into Claude Design

Two paths, depending on where the folder lives.

**From the Claude Design UI.** Create a project, then attach the design system. Upload `eversmith-ds.css` plus `component-library.html`. Claude reads the CSS for tokens and the HTML for how they compose, then builds against your real components and checks its own output against them before you see it.

**From Claude Code.** Push this folder to a repo and run:

```
/design-sync
```

That pulls the design system in so everything you build in Claude Design starts from these components rather than from a screenshot. When a case is ready to become a live prototype or a shared internal URL, it hands off in either direction without a rebuild.

Once the system is attached to the project, every new case inherits it automatically. You do not re-upload the brand each time.

---

## Rendering to PPTX

The tokens map to PowerPoint theme slots. Set these once in the master and the export holds.

| PPTX theme slot | Token | Hex |
|---|---|---|
| Dark 1 (text) | `--esb-ink` | `#11181F` |
| Light 1 (background) | `--esb-paper` | `#FCFCFA` |
| Dark 2 | `--esb-graphite` | `#39454F` |
| Light 2 | `--esb-panel` | `#F3F4F1` |
| Accent 1 | `--esb-blue` | swap |
| Accent 2 | `--esb-teal` | swap |
| Accent 3 | `--esb-d3` | `#2F6E86` |
| Accent 4 | `--esb-d5` | `#9DB6BE` |
| Accent 5 | `--esb-signal` | `#A8412C` |
| Accent 6 | `--esb-watch` | `#C8862A` |

**Fonts.** Major (headings) = Archivo. Minor (body) = Source Serif 4. Tables and figures = IBM Plex Mono, set manually since PowerPoint carries only two theme faces. If the machine running the deck lacks these, the fallback stack degrades to Arial / Georgia / Consolas without breaking the grid.

**Slide size.** 13.333 x 7.5 in, which is the 1280 x 720 the CSS is built to.

---

## Rendering to PDF

Print from the browser. The stylesheet already handles it: 12mm page margins, one surface per page, the illustrative badge suppressed, and `print-color-adjust` forced on the use-of-funds bar so the segments survive.

**The paper white is deliberate.** `#FCFCFA` rather than pure white, because pure white renders cold blue-grey on a laser printer and half of Riverside will read this as a printed board book, not a screen. The data ramp is monotonic in lightness for the same reason: every series stays distinct in grayscale.

---

## What is illustrative in the worked example

Real and sourced: 7 brands, 750+ territories, 1,400 national account locations serviced in 2025, $600M+ combined annual platform revenue. All from EverSmith Brands, eversmithbrands.com, April 2026.

Everything else is placeholder, flagged in-frame with the `.esb-illustrative` badge. **Strip the badges and replace the figures before this goes anywhere near an operating partner.** The badge is styled loud on purpose so you cannot ship it by accident, and it is hidden in print so it never reaches a page you did not mean to send.
