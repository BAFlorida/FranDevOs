#!/usr/bin/env python3
"""Adapt the 1-Tom MEG copy to Kitchen Guard.

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
DST = pathlib.Path("/home/user/FranDevOs/kg-sales-room/content/pages")
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
    ("1-Tom-Plumber", "Kitchen Guard"),
    ("1TP", "KG"),
    # The welcome video is brand-specific; 1-Tom's exists, Kitchen Guard's is
    # not yet recorded. The brand templates carry this exact slot label.
    ("[VIDEO: Welcome]",
     "[VIDEO SLOT — PENDING: Kitchen Guard welcome — awaiting final cut]"),
    # A cross-brand technology video; only the caption is renamed off the
    # 1-Tom title.
    ("[VIDEO: 1-Tom Service Titan Overview]",
     "[VIDEO: ServiceTitan Overview]"),
    # 1-Tom's Brand Overview video is live (2026-08-24); Kitchen Guard's is
    # still a drafted script, so the embed becomes a pending slot here.
    ("[VIDEO: Brand Overview]",
     "[VIDEO SLOT — PENDING: Kitchen Guard Brand Overview — script V3 drafted, not recorded]"),
]

# ---- Territory: rewritten. KG counts food service locations, not households,
#      and its premises are light-industrial flex rather than a home address.
TERRITORY = """### BODY

[VIDEO SLOT — PENDING: Territory and Premises]

### H2: Territory Design

Different brands prioritize different criteria. Some design around population. Some design around households. Recurring-service brands weight route density.

Your territory is drawn around the thing that actually drives this business: the number of commercial kitchens inside it. Boundaries are set to contain between 1,000 and 2,000 retail food service locations.

Your Franchise Developer maps the territory with our platform team, counts the food service locations inside the boundaries, and looks at the composition - independent restaurants, chains, senior living, healthcare, hospitality, education, corporate dining.

[PLACEHOLDER: confirm the territory location count against the final issued FDD. The 1,000 to 2,000 range comes from the Brand Overview script, which sources it to FDD draft 1.]

### H2: Your Territory Is Not Exclusive

You should hear this from us rather than find it in Item 12.

The company retains the right to solicit and sell to accounts with locations inside your boundaries. Where a Regional or Centrally Managed Account has locations in your territory, you get the first opportunity to bid on and service them, and a regional account management fee applies to that work.

[PLACEHOLDER: confirm the regional account management fee percentage against the final issued FDD before this page is published.]

### H2: Your Premises

This is a commercial, business-to-business business. There is no retail frontage, no walk-in traffic and no build-out theater.

What you need is light-industrial flex space. Your Franchise Developer will work the requirement with you as part of your Development Action Plan.

[PLACEHOLDER: confirm the square footage range and the cost per square foot against the final issued FDD.]

### H2: You Will Need an Address

Even without a storefront, the address matters more than candidates expect.

Local search is the front door in this category, and a real physical address is what anchors a Google Business Profile. An operator working out of a house cannot compete there.

That means you need a unique physical address inside your territory. No P.O. boxes. No shared-mailbox office suites.

Your Franchise Developer coordinates with our Local Marketing Specialist before your territory is finalized. You will form a legal entity under a name of your choosing, that entity name cannot include the brand name, and your public-facing name is your DBA.

[PLACEHOLDER: confirm the Kitchen Guard DBA naming convention and provide a worked example.]

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
- Our five values - Devotion, Resourcefulness, Resilience, Accountability, and Customer Service, which we define as one hundred percent satisfaction one hundred percent of the time
- Nate Leathers, founder - Kitchen Guard was founded in San Diego in 2009
- Tim Breen, Brand Leader - more than thirty years of operations experience, and he oversees initial training
- EverSmith Brands — our parent platform and what it means for you
- Kitchen Guard Academy — how technicians and owners are trained
- [PLACEHOLDER: procurement / Strategic Partnerships detail]
- [PLACEHOLDER: podcast and press features]

### H2: The Basics of Franchising

We take a holistic view of franchising. Not every concept suits every owner, and not every candidate is awarded a franchise. Those two facts are related.

The videos below cover general franchise industry concepts. How franchising works, what a franchisor actually does, what obligations run both directions, and how to evaluate any brand you are considering. They are brand-agnostic on purpose. Watch them with Kitchen Guard in mind, and with whatever other brands you are exploring in mind too.

[VIDEO SLOT — PENDING: General Franchising Concepts series]

### H2: Is Business Ownership Really Right for Me?

Let's pause.

You have learned the brand. Before you go further, we want you to step back and ask a harder question. Not whether Kitchen Guard is a good business, but whether business ownership is right for you and your family at this point in your life.

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
