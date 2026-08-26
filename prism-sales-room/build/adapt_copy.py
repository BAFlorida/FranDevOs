#!/usr/bin/env python3
"""Adapt the 1-Tom MEG copy to Prism Specialties.

The MEG language is EverSmith's and is brand-swapped per brand - the Kitchen
Guard Welcome copy in the supplied draft is word-for-word the 1-Tom Welcome
copy. So this is a swap, not a rewrite, and it is done here as an explicit,
auditable table rather than by hand, so the diff is reviewable.

Three things are NOT a swap and are replaced wholesale below: Territory (the
geography is counted in food service locations, not households), Additional
Resources (different founder, values and leadership), and the brand videos.

No financial figure from the Brand Overview script is written into a page. That
script states its numbers come from "2026-04 Kitchen Guard FDD - draft 1" and
must be reconciled to the final issued FDD, so they stay flagged.
"""
import pathlib, re, shutil

SRC = pathlib.Path("/home/user/FranDevOs/meg-sales-room/content/pages")
DST = pathlib.Path("/home/user/FranDevOs/prism-sales-room/content/pages")
DST.mkdir(parents=True, exist_ok=True)

SWAPS = [
    # Provenance note: the 1-Tom wording names its own CMS export; replace it
    # before the 1TP token swap below can mangle the filename.
    ("Reconciled 2026-08-19 to the live CMS export (1TPTemplateHTMLExport): John's rebuilt\n"
     "Welcome, Brand Overview, Qualification Summary (B-Verify replaces the Experian\n"
     "self-pull and the background-check section) and FDD pages are now the source here.\n"
     "Index pages carry no sub-step list and no closing pointer card — the platform\n"
     "supplies section navigation, and the pointer lives in the body copy where John\n"
     "put one.",
     "Adapted from the 1-Tom source as reconciled 2026-08-19 to the live CMS baseline:\n"
     "B-Verify financial and background verification, no sub-step list or closing\n"
     "pointer card on index pages, and the pointer as prose in the body copy."),
    # Technology pricing facts are 1-Tom's; they do not transfer.
    ('1-Tom-Plumber has no one-time setup fee. Technology fees are paid directly to the vendors.',
     '[PLACEHOLDER: confirm against Item 7 whether Prism Specialties has a one-time setup fee and how technology fees are billed.]'),
    ("[PLACEHOLDER: technology fee acknowledgment — the previous acknowledgment was wrong: EverSmith does not collect these fees. 1-Tom-Plumber's technology fees run $1,000 to $8,000 per month paid direct to the vendors, and the arrangement needs a working session with 1-Tom-Plumber before candidate-facing acknowledgment copy can be written.]",
     '[PLACEHOLDER: technology fee acknowledgment — the shared acknowledgment was wrong (EverSmith does not collect these fees; the 1-Tom fee range does not transfer). Confirm how Prism Specialties technology fees are billed and rewrite the acknowledgment.]'),
    ("1-Tom-Plumber", "Prism Specialties"),
    ("1TP", "Prism"),
    # The welcome video is brand-specific; 1-Tom's exists, Prism Specialties' is not
    # yet recorded. The brand template carries this exact slot label, with the
    # brand name set the way the chrome sets it.
    ("[VIDEO: Welcome]",
     "[VIDEO SLOT — PENDING: Prism Specialties welcome — awaiting final cut]"),
    # A cross-brand technology video; only the caption is renamed off the
    # 1-Tom title.
    ("[VIDEO: 1-Tom Service Titan Overview]",
     "[VIDEO: ServiceTitan Overview]"),
    # 1-Tom's Brand Overview video is live (2026-08-24); Prism Specialties' is not
    # recorded, so the embed becomes a pending slot here.
    ("[VIDEO: Executive Approval Overview]",
     "[VIDEO SLOT — PENDING: Prism Specialties Executive Approval Overview — covers the call and the DAP]"),
    ("[VIDEO: Brand Overview]",
     "[VIDEO SLOT — PENDING: Prism Specialties Brand Overview]"),
]

# ---- Territory: rewritten. KG counts food service locations, not households,
#      and its premises are light-industrial flex rather than a home address.
TERRITORY = """### BODY

[VIDEO SLOT — PENDING: Territory and Premises]

### H2: Territory Design

Different brands prioritize different criteria. Some design around population. Some design around households. Recurring-service brands weight route density.

Your Franchise Developer designs your territory to maximize the potential of the business, not to hit a number on a page, and maps it with our platform team before anything is confirmed.

[PLACEHOLDER: Prism Specialties territory design criteria. Sister brands weight very different variables - consumer search density in one, commercial site count in another - so neither transfers. Supply the variable this brand's territories are actually drawn around, and the unit they are counted in.]

### H2: Your Premises

[PLACEHOLDER: premises requirement for Prism Specialties - whether a physical location is required, what type, and the size range. Sister brands differ - one allows a home address, another requires light-industrial flex. Confirm which applies here.]

### H2: You Will Need an Address

[PLACEHOLDER: confirm the address requirement for Prism Specialties before publishing this section. The gate below is carried over from the shared MEG language and must not go live until the requirement is confirmed to apply to this brand.]

Your Franchise Developer coordinates with our Local Marketing Specialist before your territory is finalized. You will form a legal entity under a name of your choosing, that entity name cannot include the brand name, and your public-facing name is your DBA.

[PLACEHOLDER: confirm Prism Specialties DBA naming convention and provide a worked example.]

### GATE — acknowledgment, required

**Label:** Required acknowledgment

**Statement:** I understand that I will need a unique physical address within my territory, and that P.O. boxes and shared mailbox services do not qualify.

**Checkbox label:** I understand

### NEXT
Continue to Understanding Your Brand's Technology.
"""

# ---- Additional Resources: different founder, values and leadership.
RESOURCES = """### BODY

Click each item below to go deeper on the parts of the business that matter most to you. None of this is required to advance. All of it is available when you want it.

[VIDEO: EverSmith EverConnect]

[VIDEO: EverSmith Brands CSS]

**LIST:**
- [PLACEHOLDER: Prism Specialties values]
- [PLACEHOLDER: founder and founding story]
- [PLACEHOLDER: brand leadership - name and title]
- EverSmith Brands — our parent platform and what it means for you
- [PLACEHOLDER: training program name and how owners and technicians are trained]
- [PLACEHOLDER: procurement / Strategic Partnerships detail]
- [PLACEHOLDER: podcast and press features]

### NEXT
Continue to Stage 3, Validation.
"""

OVERRIDES = {
    "03-validation/03-territory.html": TERRITORY,
    "02-brand-overview/03-additional-resources.html": RESOURCES,
}

changed = {}
for f in sorted(SRC.glob("*.md")):
    t = f.read_text(encoding="utf-8")
    before = t
    for a, b in SWAPS:
        t = t.replace(a, b)
    # splice in whole-section overrides
    for page, body in OVERRIDES.items():
        pat = re.compile(r"(## PAGE: " + re.escape(page) + r"\n\n(?:\*\*[^\n]*\n)+\n)"
                         r".*?(?=\n---\n|\Z)", re.S)
        if pat.search(t):
            t = pat.sub(lambda m: m.group(1) + body, t)
            changed.setdefault(f.name, []).append(page)
    (DST / f.name).write_text(t, encoding="utf-8")
    n = sum(before.count(a) for a, _ in SWAPS)
    print(f"  {f.name}: {n} swaps"
          + (f", rewrote {', '.join(changed.get(f.name, []))}" if f.name in changed else ""))

leftover = []
for f in DST.glob("*.md"):
    for m in re.finditer(r"(?i)(plumb\w*|1-Tom)", f.read_text(encoding="utf-8")):
        leftover.append(f"{f.name}: {m.group(0)}")
print("\n  residual 1-Tom / plumbing references:", leftover or "none")
