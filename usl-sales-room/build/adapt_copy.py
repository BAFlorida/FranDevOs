#!/usr/bin/env python3
"""Adapt the 1-Tom MEG copy to U.S. Lawns.

The MEG language is EverSmith's and is brand-swapped per brand, so this is a
swap, not a rewrite, done as an explicit, auditable table so the diff is
reviewable.

Two pages are NOT a swap and are replaced wholesale below: Territory and
Additional Resources. No U.S. Lawns source copy was supplied for territory
design, premises, founder, values, leadership or training, so those facts are
flagged, not written - the same discipline as The Seals room. The brand
guidelines supplied for U.S. Lawns cover the visual identity only.
"""
import pathlib, re

SRC = pathlib.Path("/home/user/FranDevOs/meg-sales-room/content/pages")
DST = pathlib.Path("/home/user/FranDevOs/usl-sales-room/content/pages")
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
    ("1-Tom-Plumber", "U.S. Lawns"),
    ("1TP", "USL"),
    # The welcome video is brand-specific; 1-Tom's exists, U.S. Lawns' is not
    # yet recorded. The brand template carries this exact slot label.
    ("[VIDEO: Welcome]",
     "[VIDEO SLOT — PENDING: U.S. Lawns welcome — awaiting final cut]"),
    # A cross-brand technology video; only the caption is renamed off the
    # 1-Tom title.
    ("[VIDEO: 1-Tom Service Titan Overview]",
     "[VIDEO: ServiceTitan Overview]"),
    # 1-Tom's Brand Overview video is live (2026-08-24); U.S. Lawns' is not
    # recorded, so the embed becomes a pending slot here.
    ("[VIDEO: Brand Overview]",
     "[VIDEO SLOT — PENDING: U.S. Lawns Brand Overview]"),
]

# ---- Territory: rewritten. No U.S. Lawns territory source copy was supplied,
#      so design criteria, premises and the address requirement are flagged.
TERRITORY = """### BODY

[VIDEO SLOT — PENDING: Territory and Premises]

### H2: Territory Design

Different brands prioritize different criteria. Some design around population. Some design around households. Recurring-service brands weight route density.

Your Franchise Developer designs your territory to maximize the potential of the business, not to hit a number on a page, and maps it with our platform team before anything is confirmed.

[PLACEHOLDER: U.S. Lawns territory design criteria. Sister brands weight very different variables - consumer search density in one, commercial site count in another - so neither transfers. Commercial landscaping likely weights commercial property concentration and route density, but supply the variable this brand's territories are actually drawn around, and the unit they are counted in.]

### H2: Your Premises

[PLACEHOLDER: premises requirement for U.S. Lawns - whether a physical location is required, what type, and the size range. Sister brands differ - one allows a home address, another requires light-industrial flex. A landscaping operation also has equipment and vehicle storage to account for. Confirm what applies here.]

### H2: You Will Need an Address

[PLACEHOLDER: confirm the address requirement for U.S. Lawns before publishing this section. The gate below is carried over from the shared MEG language and must not go live until the requirement is confirmed to apply to this brand.]

Your Franchise Developer coordinates with our Local Marketing Specialist before your territory is finalized. You will form a legal entity under a name of your choosing, that entity name cannot include the brand name, and your public-facing name is your DBA.

[PLACEHOLDER: confirm the U.S. Lawns DBA naming convention and provide a worked example.]

### GATE — acknowledgment, required

**Label:** Required acknowledgment

**Statement:** I understand that I will need a unique physical address within my territory, and that P.O. boxes and shared mailbox services do not qualify.

**Checkbox label:** I understand

### NEXT
Continue to Understanding Your Brand's Technology.
"""

# ---- Additional Resources: founder, values and leadership were not supplied,
#      so they are flagged rather than invented.
RESOURCES = """### BODY

Click each item below to go deeper on the parts of the business that matter most to you. None of this is required to advance. All of it is available when you want it.

[VIDEO: EverSmith EverConnect]

[VIDEO: EverSmith Brands CSS]

**LIST:**
- [PLACEHOLDER: U.S. Lawns values]
- [PLACEHOLDER: founder and founding story]
- [PLACEHOLDER: brand leadership - name and title]
- EverSmith Brands — our parent platform and what it means for you
- [PLACEHOLDER: training program name and how owners and crews are trained]
- [PLACEHOLDER: procurement / Strategic Partnerships detail]
- [PLACEHOLDER: podcast and press features]

### H2: The Basics of Franchising

We take a holistic view of franchising. Not every concept suits every owner, and not every candidate is awarded a franchise. Those two facts are related.

The videos below cover general franchise industry concepts. How franchising works, what a franchisor actually does, what obligations run both directions, and how to evaluate any brand you are considering. They are brand-agnostic on purpose. Watch them with U.S. Lawns in mind, and with whatever other brands you are exploring in mind too.

[VIDEO SLOT — PENDING: General Franchising Concepts series]

### H2: Is Business Ownership Really Right for Me?

Let's pause.

You have learned the brand. Before you go further, we want you to step back and ask a harder question. Not whether U.S. Lawns is a good business, but whether business ownership is right for you and your family at this point in your life.

There is no wrong answer here. Some of the best conversations we have are the ones where a candidate decides the timing is not right. We would rather have that conversation now than two years into an agreement.

[VIDEO SLOT — PENDING: executive perspective on business ownership readiness]

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
