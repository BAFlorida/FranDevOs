"""Bucket 3 - Validation. Carries every compliance gate in the portal."""

from shell import (
    gate, gate_select, milestone, next_block, ph, ph_block, render, slot, steps,
    substeps, table, video, video_pending, warn,
)

PAGES = {}

SOURCE_PENDING = (
    "Source lesson copy was not supplied with this build. Structure, headings, and "
    "interactive elements are correct. Restore the original wording from the source "
    "lesson before this page goes to a candidate."
)

# ---------------------------------------------------------------- 3 · index

PAGES["03-validation/index.html"] = render(
    title="Validation",
    eyebrow="Stage 3 of 6",
    h1="Validation",
    lede="Talk directly to current 1-Tom-Plumber franchise owners.",
    body="\n\n".join([
        "  <p>Stage 3 is the stage that decides most candidacies. You stop hearing about the "
        "business from us and start hearing about it from the people running it.</p>",

        "  <p>Alongside those calls, you settle the three practical questions: how you fund "
        "the business, where your territory sits, and what technology you will run on.</p>",

        video("https://www.youtube.com/embed/sIRDGB7yyGE", "EverSmith Validation Overview"),

        "  <h2>Three required acknowledgments live in this stage</h2>",
        "  <p>Owner Calls, Territory, and Technology each carry an acknowledgment you must "
        "check before advancing. Funding carries two short self-assessments.</p>",

        "  <p>These are compliance controls. They exist because the rules around franchise "
        "sales are strict, and because misunderstanding them costs you real money.</p>",

        milestone("Validation Completed"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-owner-calls.html", "1", "Owner Calls", "Acknowledgment required"),
            ("02-funding.html", "2", "Funding", "2 self assessments"),
            ("03-territory.html", "3", "Territory", "Acknowledgment required"),
            ("04-technology.html", "4", "Understanding Your Brand's Technology",
             "Acknowledgment required"),
        ]),

        next_block("Start with Owner Calls. Read its acknowledgment before you speak to "
                   "anyone."),
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
        "  <p>Read the acknowledgment below before your first call. It explains a rule that "
        "governs every financial conversation in this process.</p>",

        gate(
            "item19",
            "I understand that my Franchise Developer can only speak to revenue and "
            "profitability numbers stated in the Franchise Disclosure Document Item 19. Any "
            "other information regarding aspects of financial performance must be obtained "
            "through conversations with franchise owners.",
        ),

        "  <h2>Why that rule exists</h2>",
        "  <p>Federal law limits what a franchisor may say about financial performance. The "
        "only sanctioned place for those figures is Item 19 of the Franchise Disclosure "
        "Document, or FDD.</p>",

        "  <p>Your Franchise Developer, or FD, is not dodging you when they decline a "
        "revenue question. They are following a rule that protects you from unverified "
        "claims.</p>",

        "  <p>Franchise owners are under no such restriction. They can tell you what they "
        "actually experience, and that is exactly why these calls matter.</p>",

        ph_block(
            "Item 19 status not confirmed. If the current FDD has no financial performance "
            "representation, this page must say so directly, because it changes what owners "
            "are the only source of.",
            ref="PH-07",
        ),

        "  <h2>How the calls are set up</h2>",
        "  <p>With your Qualification Summary and credit report submitted, introductions are "
        "made. We host conference calls with owners and prospective candidates on a regular "
        "cadence.</p>",

        ph_block(
            "Owner question and answer call cadence pending. Needs day, time, timezone, "
            "platform, and dial-in details.",
            ref="PH-21",
        ),

        "  <p>You are also free to call anyone on the Item 20 list in the FDD directly. We "
        "do not select who you speak with and we do not sit in on those calls.</p>",

        "  <h2>Questions to ask a franchise owner</h2>",
        "  <p>Use the guide below to structure and capture your calls. Take notes during "
        "each conversation.</p>",

        slot("Download", "Questions to Ask a Franchise Owner",
             "download:questions-to-ask-a-franchise-owner"),

        "  <p>A few habits make these calls far more useful.</p>",
        "  <ul>\n"
        "    <li>Call more than three owners. Patterns only show up across several "
        "conversations.</li>\n"
        "    <li>Include at least one owner in their first two years and one who is well "
        "established.</li>\n"
        "    <li>Ask what surprised them. That question gets better answers than asking what "
        "they like.</li>\n"
        "    <li>Ask what they would do differently in their first year.</li>\n"
        "    <li>Write the answers down while they are fresh.</li>\n"
        "  </ul>",

        "  <p>Owners volunteer for these calls. Be respectful of their time, and come with "
        "your questions already written.</p>",

        next_block("Complete your owner calls and check the acknowledgment above, then move "
                   "to Funding."),
    ]),
)

# ----------------------------------------------------------- 3.2 · Funding

PAGES["03-validation/02-funding.html"] = render(
    title="Funding",
    eyebrow="Stage 3 · Step 2 of 4",
    h1="Funding",
    lede="Four paths lead into this business. Most owners use one, some combine two.",
    body="\n\n".join([
        "  <p>Funding is the conversation candidates most want to skip and most regret "
        "skipping. Work it now, while you still have every option open.</p>",

        video("https://www.youtube.com/embed/0Z9bjsRKN5c", "EverSmith Funding Overview"),

        warn(
            "    <p><strong>We will not award a franchise to people who may be put in "
            "financial peril.</strong></p>\n"
            "    <p>That is not a formality. If the numbers say a candidate would be "
            "stretched past a safe point, we say no, and we say it early.</p>",
            label="Where we draw the line",
        ),

        "  <h2>Two questions before we go further</h2>",
        "  <p>Both answers stay between you and your Franchise Developer, or FD. They set "
        "the size of the reserve you need beyond the cost of opening.</p>",

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
        ),

        "  <p>Outside sources means income that continues whether or not the business "
        "produces anything. A spouse's salary, a pension, or rental income all count.</p>",

        "  <h2>The four paths</h2>",

        table(
            "Funding paths available to candidates",
            ["Path", "What it is", "Best suited to"],
            [
                ["SBA 7(a) or SBA Express",
                 "A bank loan partially guaranteed by the Small Business Administration",
                 "Candidates with strong credit and a down payment ready"],
                ["ROBS",
                 "Rollovers as Business Startups, funding the business with retirement "
                 "savings without an early withdrawal penalty",
                 "Candidates with substantial retirement balances"],
                ["Self funding",
                 "Cash and liquid assets you already hold",
                 "Candidates who want no debt service in year one"],
                ["HELOC",
                 "Home Equity Line of Credit, borrowing against equity in your home",
                 "Candidates with significant home equity, often as a supplement"],
            ],
        ),

        "  <h2>SBA lending</h2>",
        "  <p>Most franchise lending runs through the Small Business Administration, or SBA. "
        "The agency does not lend directly. It guarantees part of a bank's loan, which makes "
        "banks willing to lend against a business rather than only against collateral.</p>",

        ph_block(
            "SBA loan performance history withheld pending verification. The figure "
            "supplied with the build spec was not verifiable, and other figures from the "
            "same table proved stale. If it is confirmed, keep the framing that it "
            "describes loan performance for lenders and is not a representation about what "
            "any business earns.",
            ref="PH-26",
        ),

        "  <h3>Personal Financial Statement</h3>",
        "  <p>Every SBA applicant files a Personal Financial Statement, or PFS. Fill it out "
        "once, carefully, and it will serve every lender you approach.</p>",

        slot("Download", "SBA Personal Financial Statement - Fillable PDF",
             "download:sba-personal-financial-statement"),

        ph_block(
            "Personal Financial Statement filing-requirement list pending. The source lesson "
            "carried a specific list of who must file and what must be attached. Restore it "
            "verbatim rather than paraphrasing.",
            ref="SRC",
        ),

        "  <h2>ROBS</h2>",
        "  <p>Rollovers as Business Startups, or ROBS, lets you fund a business with "
        "retirement savings without triggering an early withdrawal penalty or income tax at "
        "the time of the rollover.</p>",

        "  <p>It is a legitimate and well established structure. It is also strict, and it "
        "must be set up by a specialist firm.</p>",

        steps([
            "Form a C corporation for the new business.",
            "The corporation sponsors a new retirement plan.",
            "Roll your existing retirement funds into that new plan.",
            "The plan purchases stock in the corporation, and the corporation now holds the "
            "cash.",
        ]),

        ph_block(
            "ROBS four-step wording pending. The steps above describe the standard structure. "
            "Restore the source lesson's exact four steps before publishing.",
            ref="SRC",
        ),

        video_pending("ROBS Explained", "video:robs-explained"),

        "  <h2>Self funding</h2>",
        "  <p>Self funding uses cash and liquid assets you already hold. No lender, no "
        "debt service, and no approval timeline.</p>",

        "  <p>The tradeoff is your reserve. Putting every liquid dollar into opening leaves "
        "nothing to absorb a slow first quarter.</p>",

        video("https://www.youtube.com/embed/oSIvxdHtO-o",
              "EverSmith Self Funding Overview"),

        "  <h2>HELOC</h2>",
        "  <p>A Home Equity Line of Credit, or HELOC, borrows against equity in your home. "
        "It is usually a supplement to another path rather than the whole plan.</p>",

        "  <p>Understand the risk plainly. A HELOC puts your home behind the business.</p>",

        video("https://www.youtube.com/embed/TFpdCqMtxQQ",
              "EverSmith Home Equity Funding"),

        "  <h2>Do not forget working capital</h2>",
        "  <p>The cost of opening is not the cost of operating. You need enough cash to "
        "cover the business and your household until revenue is steady.</p>",

        "  <p>That reserve is what the two questions at the top of this page are sizing.</p>",

        next_block("Pick your likely funding path and tell your FD, then move to Territory."),
    ]),
)

# --------------------------------------------------------- 3.3 · Territory

PAGES["03-validation/03-territory.html"] = render(
    title="Territory",
    eyebrow="Stage 3 · Step 3 of 4",
    h1="Territory",
    lede="Where you operate shapes everything else. Territory decisions are effectively "
         "permanent once agreements are signed.",
    body="\n\n".join([
        "  <p>Three things to settle on this page: how territories are designed, how your "
        "local business name has to look, and the physical address requirement.</p>",

        "  <h2>How territories are designed</h2>",
        "  <p>A territory is not just a circle on a map. It is drawn around the variables "
        "that actually drive emergency plumbing demand.</p>",

        ph_block(
            "Territory design criteria pending, and this one should not be filled by copying "
            "a pattern. The source brand designed around route density because recurring lawn "
            "service is a routed business. Commercial emergency plumbing is not. The relevant "
            "variables are likely commercial building count, property-management "
            "concentration, permit volume, and drive-time to an emergency call. Getting this "
            "wrong compounds, and territory decisions are permanent once agreements are "
            "signed.",
            ref="PH-22",
        ),

        video_pending("Territory Design and DBA", "video:territory-design-and-dba"),

        "  <h2>The DBA smell test</h2>",
        "  <p>Your local entity will operate under a Doing Business As name, or DBA. That "
        "name and its address have to look like a real local business to a search engine, "
        "because that is how customers find you in an emergency.</p>",

        "  <blockquote>\n"
        "    <p>This is Google's world, and we just live in it.</p>\n"
        "  </blockquote>",

        "  <p>Someone with a burst pipe does not browse. They search, they call the first "
        "credible result, and they are done in ninety seconds. If your listing looks "
        "questionable, you never enter that decision.</p>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        "  <h2>The physical address requirement</h2>",
        "  <p>You need a unique physical address inside your territory. This is not a brand "
        "preference. It is what business listing verification requires.</p>",

        "  <p>Verification is done by mailing a postcard with a code to the address on the "
        "listing. A mailbox service cannot receive that postcard as a distinct business "
        "location, and a P.O. box cannot either.</p>",

        "  <p>Unique matters too. If another business is already verified at your address, "
        "your listing competes with it rather than standing on its own.</p>",

        gate(
            "address",
            "I understand that I will need a unique physical address within my territory, "
            "and that P.O. boxes and shared mailbox services do not qualify.",
        ),

        "  <p>Sort the address early. Candidates who leave it to the week before opening "
        "find that verification takes longer than they planned.</p>",

        next_block("Confirm your territory preferences with your Franchise Developer, then "
                   "move to Understanding Your Brand's Technology."),
    ]),
)

# -------------------------------------------------------- 3.4 · Technology

PAGES["03-validation/04-technology.html"] = render(
    title="Understanding Your Brand's Technology",
    eyebrow="Stage 3 · Step 4 of 4",
    h1="Understanding Your Brand's Technology",
    lede="Six platforms run the business. You do not source or negotiate any of them "
         "yourself.",
    body="\n\n".join([
        "  <p>The technology package is standard across every territory. That is what makes "
        "system-wide pricing and system-wide support possible.</p>",

        "  <p>Read the fee timing section carefully. It is the part candidates most often "
        "misjudge.</p>",

        video("https://www.youtube.com/embed/kXK6u3O8hCU",
              "1-Tom Service Titan Overview"),

        ph_block(
            "Two of six platforms are confirmed: ServiceTitan and CareerPlug. The remaining "
            "four vendors and every dollar figure on this page are still unresolved. Do not "
            "carry over another brand's vendors for the open rows.",
            ref="PH-02 / PH-03 / PH-04",
        ),

        "  <h2>The platform stack</h2>",

        table(
            "The six platforms in the technology package",
            ["Platform", "Function"],
            [
                ["<strong>ServiceTitan</strong>",
                 "Customer Relationship Management and Field Service Management: dispatch, "
                 "scheduling, and customer records"],
                [ph("Financial analysis", "PH-02"),
                 "Bookkeeping sync and system-wide financial benchmarking"],
                ["<strong>CareerPlug</strong>",
                 "Applicant Tracking System: recruiting and hiring technicians"],
                [ph("Reviews / NPS", "PH-02"),
                 "Review generation and Net Promoter Score tracking"],
                [ph("Productivity", "PH-02"),
                 "Email, calendar, and document collaboration"],
                [ph("Resource library", "PH-02"),
                 "Brand standards, training material, and operating documents"],
            ],
        ),

        "  <h3>CareerPlug</h3>",
        "  <p>Hiring is the constraint on growth in this business. CareerPlug is the "
        "applicant tracking system you will recruit technicians through.</p>",

        video("https://www.youtube.com/embed/3aL_T7_3Ojo", "EverSmith Career Plug"),

        "  <h2>What it costs</h2>",
        "  <p>Technology carries a one-time setup charge and a recurring monthly fee. The "
        "customer platform is also priced per seat, at different rates for office staff and "
        "field technicians.</p>",

        table(
            "Technology fee structure",
            ["Charge", "Amount", "Frequency"],
            [
                ["Technology setup", ph("pending", "PH-03"), "One time"],
                ["Technology fee", ph("pending", "PH-03"), "Monthly"],
                ["ServiceTitan seat - administrative", ph("pending", "PH-03"),
                 "Monthly, per seat"],
                ["ServiceTitan seat - field technician", ph("pending", "PH-03"),
                 "Monthly, per seat"],
            ],
        ),

        "  <p>Pricing is negotiated on behalf of the whole system rather than territory by "
        "territory. One party handles that negotiation and collects payment.</p>",

        ph_block(
            "Technology sourcing entity pending. Name the party that negotiates vendor "
            "pricing and collects payment, so owners know who they are paying.",
            ref="PH-04",
        ),

        "  <h2>When the charges hit</h2>",
        "  <p>This is the part to plan for. Technology billing starts on the brand's "
        "schedule, not on your lender's schedule.</p>",

        warn(
            "    <p>The one-time technology fee and your first monthly payment draft within a "
            "few weeks of being awarded.</p>\n"
            "    <p><strong>That can happen before your SBA or ROBS funding has "
            "completed.</strong> Plan to cover it from your own cash.</p>",
            label="Fee timing",
        ),

        "  <p>SBA refers to the Small Business Administration and ROBS to Rollovers as "
        "Business Startups, the two funding paths covered on the Funding page.</p>",

        gate(
            "tech-fee-timing",
            "I understand that the one-time technology fee and my first monthly payment will "
            "draft within a few weeks of being awarded, and that this may occur before my SBA "
            "or ROBS funding has completed.",
        ),

        next_block("You have completed Validation. Stage 4 opens with your Executive "
                   "Approval Call."),
    ]),
)
