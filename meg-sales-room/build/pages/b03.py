"""Bucket 3 - Validation. Copy transcribed verbatim from content/pages/bucket_3.md."""

from shell import (
    gate, gate_select, next_block, ph, ph_block, render, slot, steps, substeps,
    table, video, video_pending,
)

PAGES = {}

# ---------------------------------------------------------------- 3 · index

PAGES["03-validation/index.html"] = render(
    title="Validation",
    eyebrow="Stage 3 of 6",
    h1="Validation",
    lede="Talk directly to current 1-Tom-Plumber franchise owners.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/sIRDGB7yyGE", "EverSmith Validation Overview"),

        "  <p>One of the most exciting steps in the Mutual Evaluation Process is connecting "
        "with owners.</p>",

        "  <p>This stage covers four things. Who you talk to and what to ask them. How you "
        "will fund the business. The territory you will own. And the technology you will run "
        "it on.</p>",

        "  <p>What our owners tell you carries more weight than anything we have said. That "
        "is by design.</p>",

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-owner-calls.html", "1", "Owner Calls", ""),
            ("02-funding.html", "2", "Funding", ""),
            ("03-territory.html", "3", "Territory", ""),
            ("04-technology.html", "4", "Understanding Your Brand's Technology", ""),
        ]),

        next_block("Start with Owner Calls."),
    ]),
)

# ------------------------------------------------------- 3.1 · Owner Calls

PAGES["03-validation/01-owner-calls.html"] = render(
    title="Owner Calls",
    eyebrow="Stage 3 · Step 1 of 4",
    h1="Owner Calls",
    lede="One of the most exciting steps in the Mutual Evaluation Process is connecting with "
         "owners.",
    body="\n\n".join([
        "  <p>With your Qualification Summary and Credit Report submitted, introductions are "
        "made. We host conference calls with owners and prospective candidates.</p>",

        ph_block("owner call cadence - day, time, timezone, platform, dial-in", ref="PH-21"),

        gate(
            "item19",
            "I understand that my Franchise Developer can only speak to revenue and "
            "profitability numbers stated in the Franchise Disclosure Document Item 19. Any "
            "other information regarding aspects of financial performance must be obtained "
            "through conversations with franchise owners.",
        ),

        "  <h2>Questions to Ask a Franchise Owner</h2>",

        "  <p>Use the guide below to structure and capture your calls. Take notes during each "
        "conversation. Your Franchise Developer will debrief them with you.</p>",

        slot("Download", "Questions to Ask a Franchise Owner",
             "download:questions-to-ask-a-franchise-owner"),

        next_block("Complete your owner calls, then continue to Funding."),
    ]),
)

# ----------------------------------------------------------- 3.2 · Funding

PAGES["03-validation/02-funding.html"] = render(
    title="Funding",
    eyebrow="Stage 3 · Step 2 of 4",
    h1="Funding",
    lede="Four paths, and a plan that has to hold together.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/0Z9bjsRKN5c", "EverSmith Funding Overview"),

        "  <p>There are four common paths to funding a franchise. An SBA loan, a ROBS "
        "rollover of pre-tax retirement funds, personal savings, or home equity.</p>",

        "  <p>Your Franchise Developer's job is to make sure you have a sound financial plan. "
        "We will introduce you to trusted third-party lenders who specialize in franchise "
        "funding.</p>",

        "  <p><strong>1-Tom-Plumber will not award franchises to people who may be put in "
        "financial peril as a result.</strong></p>",

        "  <p>That is not a formality. It is a filter we apply on purpose.</p>",

        gate_select(
            "household-expenses",
            "What are your combined total Personal Monthly Household Responsibilities?",
            ["Less than $1,000", "$1,000 - $2,999", "$3,000 - $4,999",
             "$5,000 - $7,999", "$8,000 - $11,999", "$12,000 or more"],
        ),

        gate_select(
            "outside-coverage",
            "What percentage of those expenses is covered by outside sources?",
            ["0 - 20%", "21 - 40%", "41 - 60%", "61 - 80%", "81 - 100%"],
            note="Outside sources include spouse income, rental income, and any existing "
                 "business or personal income that will continue after you open your "
                 "franchise.",
        ),

        "  <h2>SBA Funding</h2>",

        "  <p>The two relevant programs are SBA Express and SBA 7(a). Our funding partners "
        "will explain the differences and walk you through pre-approval requirements.</p>",

        "  <p>Every funding partner requires a Personal Financial Statement.</p>",

        slot("Download", "SBA Personal Financial Statement - Fillable PDF",
             "download:sba-personal-financial-statement"),

        "  <p><strong>Who must file a PFS:</strong></p>",
        "  <ul>\n"
        "    <li>The proprietor, if a sole proprietorship</li>\n"
        "    <li>Each general partner, if a partnership</li>\n"
        "    <li>Each managing member, if an LLC</li>\n"
        "    <li>Any owner of 20% or more of the business</li>\n"
        "    <li>Any person or entity providing a guaranty on the loan</li>\n"
        "  </ul>",

        "  <p>Your spouse must sign the PFS even if they are not on the loan.</p>",

        "  <h2>ROBS Funding</h2>",

        "  <p>ROBS, Rollover as Business Startup, lets you use pre-tax retirement funds to "
        "capitalize your business without early withdrawal penalties. It can move as fast as "
        "10 days.</p>",

        steps([
            "Set up a C Corporation.",
            "Design a new qualified retirement plan for that corporation.",
            "Transfer your existing retirement funds into the new plan.",
            "The plan purchases stock in the new C Corporation, capitalizing the business.",
        ]),

        video_pending("ROBS Explained", "video:robs-explained"),

        "  <h2>Self-Funding</h2>",

        "  <p>If you are funding with cash, send your Franchise Developer a current bank or "
        "investment statement as proof of funds.</p>",

        video("https://www.youtube.com/embed/oSIvxdHtO-o", "EverSmith Self Funding Overview"),

        "  <h2>Home Equity</h2>",

        "  <p>A HELOC uses the equity in your home. The video below covers your options and "
        "the tradeoffs.</p>",

        video("https://www.youtube.com/embed/TFpdCqMtxQQ", "EverSmith Home Equity Funding"),

        next_block("Confirm your funding path with your Franchise Developer, then continue to "
                   "Territory."),
    ]),
)

# --------------------------------------------------------- 3.3 · Territory

PAGES["03-validation/03-territory.html"] = render(
    title="Territory",
    eyebrow="Stage 3 · Step 3 of 4",
    h1="Territory",
    lede="The decision that compounds for the life of your business.",
    body="\n\n".join([
        video_pending("Territory Design and DBA", "video:territory-design-and-dba"),

        "  <h2>Territory Design</h2>",

        "  <p>Different brands prioritize different criteria. Some design around population. "
        "Some design around households. Recurring-service brands weight route density. Brands "
        "that lean on marketing spread want larger territories. Some brands hand you a "
        "pre-defined map, others build it with you.</p>",

        "  <p>Your Franchise Developer designs your territory to maximize the potential of "
        "the business, not to hit a number on a page.</p>",

        ph_block(
            "1TP territory design criteria. Commercial emergency plumbing likely weights "
            "commercial building count, property management concentration, permit volume, and "
            "drive-time - not households per square mile.",
            ref="PH-22",
        ),

        "  <h2>The DBA Smell Test</h2>",

        "  <p>Your Franchise Developer coordinates with our Local Marketing Specialist before "
        "your territory is finalized.</p>",

        "  <p>You will form a legal entity under a name of your choosing. That entity name "
        "cannot include the brand name. Your public-facing name is your DBA.</p>",

        "  <p>Example: KHM Holdings, DBA 1-Tom-Plumber of San Marco, Florida</p>",

        "  <p>Marketing runs keyword research on the most-searched city and area names inside "
        "your territory. We award the DBA that gives you the best possible search exposure. "
        "This is not cosmetic. It compounds for the life of your business.</p>",

        "  <h2>You Will Need an Address</h2>",

        "  <p>This is Google's world, and we just live in it.</p>",

        "  <p>The most common search in our category is some version of \"plumber near me.\" "
        "Our listings team sets up your Google Business Profile and handles back-end SEO. "
        "Google verifies a business by mailing a physical postcard to a physical address.</p>",

        "  <p>That means you need a unique physical address inside your territory. No P.O. "
        "boxes. No shared-mailbox office suites.</p>",

        "  <p>For most owners, a home address works and does not appear publicly. Some "
        "situations require an office or warehouse.</p>",

        "  <p>If you live outside your territory, you must secure an address inside it. SBA "
        "lending also requires an address within the territory you own.</p>",

        gate(
            "address",
            "I understand that I will need a unique physical address within my territory, "
            "and that P.O. boxes and shared mailbox services do not qualify.",
        ),

        next_block("Continue to Understanding Your Brand's Technology."),
    ]),
)

# -------------------------------------------------------- 3.4 · Technology

PAGES["03-validation/04-technology.html"] = render(
    title="Understanding Your Brand's Technology",
    eyebrow="Stage 3 · Step 4 of 4",
    h1="Understanding Your Brand's Technology",
    lede="The platforms you will run the business on, and what they cost.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/kXK6u3O8hCU", "1-Tom Service Titan Overview"),

        "  <h2>How Technology Sourcing Works</h2>",

        f"  <p>{ph('sourcing entity', 'PH-04')} sources our software platforms and negotiates "
        "vendor pricing using the scale of the full portfolio. They hold vendors accountable "
        "and provide support when something breaks.</p>",

        f"  <p>Every brand's package is different. There is a one-time setup fee plus a "
        f"monthly payment. {ph('sourcing entity', 'PH-04')} collects from you and pays the "
        "vendors.</p>",

        "  <h2>Your Package</h2>",

        table(
            "Platforms included in your technology package",
            ["Platform", "Function"],
            [
                ["ServiceTitan",
                 "Customer and technician management, dispatch, scheduling"],
                ["CareerPlug", "Recruiting and applicant tracking"],
                [ph("financial analysis", "PH-02"),
                 "Financial reporting, used with your Franchise Business Coach"],
                [ph("reviews / NPS", "PH-02"),
                 "Review generation and Net Promoter Score"],
                [ph("productivity", "PH-02"), "Email and productivity licenses"],
                [ph("resource library", "PH-02"),
                 "Franchise resource library and documentation"],
            ],
        ),

        video("https://www.youtube.com/embed/3aL_T7_3Ojo", "EverSmith Career Plug"),

        "  <h2>Pricing</h2>",

        table(
            "Technology pricing",
            ["Line Item", "Cost"],
            [
                ["One-time setup fee", ph("pending", "PH-03")],
                ["Monthly technology fee", ph("pending", "PH-03")],
                ["ServiceTitan - first admin user and field technician",
                 ph("pending", "PH-03")],
                ["Each additional admin user", ph("pending", "PH-03")],
                ["Each additional field technician", ph("pending", "PH-03")],
            ],
        ),

        "  <p>Pricing subject to change.</p>",

        gate(
            "tech-fee-timing",
            "I understand that the one-time technology fee and my first monthly payment will "
            "draft within a few weeks of being awarded, and that this may occur before my SBA "
            "or ROBS funding has completed.",
        ),

        next_block("Continue to Stage 4, Seeking Approval."),
    ]),
)
