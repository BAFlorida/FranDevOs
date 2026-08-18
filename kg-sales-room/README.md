# Kitchen Guard MEG sales room

Same build as `meg-sales-room/`, retargeted at Kitchen Guard.

## In place

- `spec/page-template.html` — the supplied draft (Stage 1 Welcome). Full component
  set: gate, flag, asset, btn, btnrow, slide, eyebrow, quiz, journey, video-slot.
- `spec/Kitchen_Guard_Brand_Guide.pdf` — the brand book (15 pages).
- `build/logo.b64` — 420x204 PNG lifted from the draft.
- `build/` — the generator, copied from the 1TP build.

## Palette, verified against the brand book (page 11)

| Token | Pantone | RGB | Hex |
|---|---|---|---|
| `--kg-green` | PMS 370 C | 89, 156, 30 | `#599C1E` |
| `--kg-deep` | PMS 546 C | 11, 32, 34 | `#0B2022` |
| `--kg-mint` | PMS 2255 C | 140, 219, 134 | `#8CDB86` |
| `--kg-grey` | Cool Gray 7 | 152, 154, 165 | `#989AA5` |
| off-white | CMYK 4/0/6/0 | 243, 248, 239 | `#F3F8EF` |

The draft's values match the book exactly. Do not re-derive them from the website.

## Brand book deviations - APPROVED

Signed off by the SVP. Recorded here so the audit trail shows they were
raised against the book and consciously accepted, not missed.

1. **Anton is not in the brand book.** APPROVED. Page 13 specifies Poppins only, in Medium,
   Bold and Extra Bold. The draft sets `.hero h1` and `.hero .subtitle` in Anton as
   the logo wordmark's face. Either get sign-off or set display type in Poppins
   Extra Bold.
2. **Weights.** APPROVED. The draft loads Poppins 400/500/600/700. The book specifies
   500/700/800. 800 is missing; 400 and 600 are not in the book.
3. **`--kg-alert` `#C02B0A` is off-palette.** APPROVED. The journey stove
   illustration also introduces a brown metal palette (`#4A3F2A`, `#3A3122`,
   `#221C13`, `#6B5C42`) that the book does not contain. Also approved. The draft already flags this: the
   book has no warm hue, so the flame on the current step cannot be built from the
   palette. Needs sign-off or a different cue.

## Logo rules from the book (page 8)

Do not compress, add shadows, outline, rotate or tilt. The draft complies - the
mark sits on a white `.logo-plate` with no filter. Note this differs from the
1-Tom template, which drop-shadows its mark; that treatment must not be carried
over here.

## Videos

18 embeds, exactly matching the 1-Tom set. The EverSmith process and platform
videos are shared across brands. Only Brand Overview and the brand-specific
resources are brand-owned, so Brand Overview remains a pending slot until the
Kitchen Guard cut is recorded.

Two videos kept their 1-Tom video IDs but were renamed in the caption, because
they are process and technology content rather than brand content: "Mutual
Evaluation Room Explanation" and "ServiceTitan Overview".

## Still needed

Copy for the other 23 pages. The MEG language is EverSmith's and brand-swapped per
brand - the Welcome copy in the draft is word-for-word the 1-Tom Welcome copy - but
several pages are genuinely brand-specific and must not be swapped mechanically.
See the note in the session summary.
