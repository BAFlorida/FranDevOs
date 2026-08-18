#!/usr/bin/env python3
"""Adapt the 1-Tom MEG copy to The Seals.

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
DST = pathlib.Path("/home/user/FranDevOs/seals-sales-room/content/pages")
DST.mkdir(parents=True, exist_ok=True)

SWAPS = [
    ("1-Tom-Plumber", "The Seals"),
    ("1TP", "Seals"),
    ("Original MEG language, brand-swapped to The Seals.",
     "Original MEG language, brand-swapped to The Seals."),
    ("**H1:** Welcome to Your Mutual Evaluation Guide", "**H1:** Welcome"),
    ("**Lede:** Meet the brand and the on-demand plumbing opportunity.",
     "**Lede:** Your guide through the Mutual Evaluation Process."),
    ("Watch the videos above, then continue to the Mutual Evaluation Process End-to-End.",
     "To learn about the EverSmith Mutual Evaluation Process, please see the next step "
     "entitled **Mutual Evaluation Process End-to-End**."),
    # These two are process and technology videos, used across all brands, so
    # they carry over. Only the caption is renamed off the 1-Tom title.
    ("[VIDEO: 1-Tom Mutual Evaluation Room Explanation]",
     "[VIDEO: Mutual Evaluation Room Explanation]"),
    ("[VIDEO: 1-Tom Service Titan Overview]",
     "[VIDEO: ServiceTitan Overview]"),
    ("[VIDEO SLOT — PENDING: The Seals Brand Overview]",
     "[VIDEO SLOT — PENDING: The Seals Brand Overview]"),
]

# ---- Territory: rewritten. KG counts food service locations, not households,
#      and its premises are light-industrial flex rather than a home address.
TERRITORY = """### BODY

[VIDEO SLOT — PENDING: Territory and Premises]

### H2: Territory Design

Different brands prioritize different criteria. Some design around population. Some design around households. Recurring-service brands weight route density.

Your Franchise Developer designs your territory to maximize the potential of the business, not to hit a number on a page, and maps it with our platform team before anything is confirmed.

[PLACEHOLDER: The Seals territory design criteria. Sister brands weight very different variables - consumer search density in one, commercial site count in another - so neither transfers. Supply the variable this brand's territories are actually drawn around, and the unit they are counted in.]

### H2: Your Premises

[PLACEHOLDER: premises requirement for The Seals - whether a physical location is required, what type, and the size range. Sister brands differ - one allows a home address, another requires light-industrial flex. Confirm which applies here.]

### H2: You Will Need an Address

[PLACEHOLDER: confirm the address requirement for The Seals before publishing this section. The gate below is carried over from the shared MEG language and must not go live until the requirement is confirmed to apply to this brand.]

Your Franchise Developer coordinates with our Local Marketing Specialist before your territory is finalized. You will form a legal entity under a name of your choosing, that entity name cannot include the brand name, and your public-facing name is your DBA.

[PLACEHOLDER: confirm The Seals DBA naming convention and provide a worked example.]

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
- [PLACEHOLDER: The Seals values]
- [PLACEHOLDER: founder and founding story]
- [PLACEHOLDER: brand leadership - name and title]
- EverSmith Brands — our parent platform and what it means for you
- [PLACEHOLDER: training program name and how owners and technicians are trained]
- [PLACEHOLDER: procurement / Strategic Partnerships detail]
- [PLACEHOLDER: podcast and press features]

### H2: The Basics of Franchising

We take a holistic view of franchising. Not every concept suits every owner, and not every candidate is awarded a franchise. Those two facts are related.

The videos below cover general franchise industry concepts. How franchising works, what a franchisor actually does, what obligations run both directions, and how to evaluate any brand you are considering. They are brand-agnostic on purpose. Watch them with The Seals in mind, and with whatever other brands you are exploring in mind too.

[VIDEO SLOT — PENDING: General Franchising Concepts series]

### H2: Is Business Ownership Really Right for Me?

Let's pause.

You have learned the brand. Before you go further, we want you to step back and ask a harder question. Not whether The Seals is a good business, but whether business ownership is right for you and your family at this point in your life.

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
