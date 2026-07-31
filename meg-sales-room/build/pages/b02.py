"""Bucket 2 - Brand Overview.

Copy transcribed verbatim from content/pages/bucket_1_2.md.
"""

from shell import (
    next_block, ph, ph_block, render, slot, steps, substeps, table, video,
    video_pending,
)

PAGES = {}

# ---------------------------------------------------------------- 2 · index

PAGES["02-brand-overview/index.html"] = render(
    title="Brand Overview",
    eyebrow="Stage 2 of 6",
    h1="Brand Overview",
    lede="High level operational overview.",
    body="\n\n".join([
        "  <p><strong>LET'S GET STARTED!</strong></p>",

        "  <p>Thank you for taking the time to speak with one of our world class Franchise "
        "Developers. On your last call, you spoke through why business ownership may make "
        "sense for this time in your life. You gave us insight into your background, your "
        "timing, your family, and so much more. Today, we want to provide the same depth of "
        "information for the brand you are considering.</p>",

        "  <p>Below, you will find a video covering your brand at a high level. We have "
        "discovered that this helps our candidates digest the information in bite sized "
        "chunks. Your only homework is to watch the video entitled, \"Brand Overview.\"</p>",

        "  <p>Your Franchise Developer has set a meeting with you to debrief the video below. "
        "Please jot down any questions you may have from the video as that will be a point of "
        "discussion for your next call. Below the main video, you will also find a series of "
        "additional resources that dive more deeply into each topic discussed in the "
        "overview. If you would like, feel free to review those resources as well, although "
        "they are not required to continue moving forward in the process.</p>",

        video_pending("1-Tom-Plumber Brand Overview", "video:brand-overview"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-qualification-summary.html", "1", "Qualification Summary / Culture Index",
             ""),
            ("02-fdd.html", "2", "Franchise Disclosure Document", ""),
            ("03-additional-resources.html", "3", "Additional Brand Specific Resources", ""),
        ]),

        next_block("Watch the Brand Overview, then complete your Qualification Summary."),
    ]),
)

# -------------------------------- 2.1 · Qualification Summary / Culture Index

PAGES["02-brand-overview/01-qualification-summary.html"] = render(
    title="Qualification Summary / Culture Index",
    eyebrow="Stage 2 · Step 1 of 3",
    h1="Qualification Summary / Culture Index",
    lede="The next step in our process.",
    body="\n\n".join([
        "  <p>Thank you for taking the time to delve deeper into the brand that interests "
        "you! Watching the brand overview video and related links undoubtedly led to "
        "thought-provoking questions for your Franchise Developer.</p>",

        "  <p>As your Franchise Developer may have informed you, the next step in our process "
        "is to complete the Qualification Summary Form. Once you finish the form and submit, "
        "a copy is sent to your Franchise Developer. This step enables us to arrange calls "
        "with existing owners on your behalf.</p>",

        video("https://www.youtube.com/embed/GWB3gkycrKw",
              "EverSmith Qualification Summary Overview"),

        slot("Form", "Qualification Summary Form", "form:qualification-summary"),
        slot("Form", "Culture Index Survey", "form:culture-index-survey"),

        "  <h2>Your Credit Report</h2>",

        "  <p>Additionally, we do not believe in making unnecessary inquiries on the credit "
        "reports of potential candidates. If you want us to run your credit report, request "
        "your Franchise Developer to conduct the report on your behalf. However, we recommend "
        "obtaining your own Experian Credit Report (with score) and uploading it.</p>",

        "  <p>The report you are generating is the only report the SBA, the Bank and "
        "1-Tom-Plumber will accept.</p>",

        steps([
            "Go to Experian.com",
            "Create an account. On \"What is your main reason you are checking your credit?\" "
            "choose \"Checking my report or score for accuracy.\" Complete identity "
            "verification and authentication questions.",
            "Navigate to the \"Credit Reports\" tab.",
            "Find \"Print your Report\" about halfway down the page.",
            "Right-click and select Print.",
            "Change the destination to Save as PDF, then Print. Save it to your desktop.",
            "Email the saved copy to your Franchise Developer.",
        ]),

        "  <p>This is a soft pull. It does not affect your score.</p>",

        "  <h2>Background Check</h2>",

        "  <p>Once your Qualification Summary is complete, your Franchise Developer's "
        "assistant will email our screening company. You will receive a request to authorize "
        "the check and provide brief biographical information. Please complete it promptly so "
        "we can keep your timeline on track.</p>",

        ph_block("background check vendor", ref="PH-09"),

        "  <h2>Book Your Next Meeting</h2>",

        "  <p>Book the next meeting with your Franchise Developer to review the Qualification "
        "Summary together.</p>",

        slot("Scheduler", "Schedule Qualification Summary Review",
             "scheduler:qualification-summary-review"),

        next_block("Submit your Qualification Summary and credit report, then continue to the "
                   "Franchise Disclosure Document."),
    ]),
)

# ------------------------------------- 2.2 · Franchise Disclosure Document

PAGES["02-brand-overview/02-fdd.html"] = render(
    title="Franchise Disclosure Document",
    eyebrow="Stage 2 · Step 2 of 3",
    h1="Franchise Disclosure Document",
    lede="The document that governs everything.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/udCsGBIY1Rs",
              "EverSmith Franchise Disclosure Document Overview"),

        "  <p>The goal of the FDD is to provide buyers with information to make a buying "
        "decision. Federal law, The FTC Rule, requires franchisors to file an FDD annually "
        "and provide it to every potential franchise buyer.</p>",

        "  <p>FDDs must be provided upon request at least 14 days before signing a franchise "
        "agreement. State rules vary and some require longer. The FDD is updated annually, or "
        "sooner on any material change.</p>",

        "  <p>The FDD includes 23 Items, the franchise agreement, and various exhibits. "
        "Request the 1-Tom-Plumber FDD from your Franchise Developer and review it "
        "together.</p>",

        "  <h2>The 23 Items</h2>",

        table(
            "The 23 Items of the Franchise Disclosure Document",
            ["Item", "Subject"],
            [
                ["1", "Franchisor, parents, predecessors, affiliates. Company description "
                      "and history."],
                ["2", "Business Experience. Bios of officers, directors, and executives."],
                ["3", "Litigation. Current and past criminal and civil."],
                ["4", "Bankruptcy."],
                ["5", "Initial Fees. Range and the factors that move it."],
                ["6", "Other Fees. Everything recurring."],
                ["7", "Estimated Initial Investment. Table of all required expenditures."],
                ["8", "Restrictions on Sources of Products and Services."],
                ["9", "Franchisee's Obligations. Reference table."],
                ["10", "Financing. Any terms the franchisor offers."],
                ["11", "Franchisor's Assistance, Advertising, Computer Systems, Training."],
                ["12", "Territory. Protected territory and how it can be modified."],
                ["13", "Trademarks."],
                ["14", "Patents, Copyrights, Proprietary Information."],
                ["15", "Obligation to Participate in Actual Operations."],
                ["16", "Restrictions on What the Franchisee May Sell."],
                ["17", "Renewal, Termination, Transfer, Dispute Resolution."],
                ["18", "Public Figures."],
                ["19", "Financial Performance Representations."],
                ["20", "Outlets and Franchisee Information. Three-year location outline."],
                ["21", "Financial Statements. Audited, past three years."],
                ["22", "Contracts. Every agreement you will sign."],
                ["23", "Receipts. Your acknowledgement of FDD receipt."],
            ],
        ),

        "  <h3>A note on Item 19</h3>",

        "  <p>Item 19 is where a franchisor may, but is not required to, disclose financial "
        "performance information. If a franchisor makes an Item 19 representation, there is "
        "no assurance your business will achieve the same results.</p>",

        ph_block("confirm current 1TP Item 19 status against the most recent FDD",
                 ref="PH-07"),

        "  <h3>A note on Item 20</h3>",

        "  <p>Item 20 gives you a three-year outline of locations. Openings, closures, "
        "transfers, terminations. Read it. It is the clearest available signal of system size "
        "and growth direction.</p>",

        next_block("Review your FDD, then continue to Additional Brand Specific Resources."),
    ]),
)

# ------------------------------- 2.3 · Additional Brand Specific Resources

PAGES["02-brand-overview/03-additional-resources.html"] = render(
    title="Additional Brand Specific Resources",
    eyebrow="Stage 2 · Step 3 of 3",
    h1="Additional Brand Specific Resources",
    lede="Optional depth. None of this is required to advance.",
    body="\n\n".join([
        "  <p>Click each item below to go deeper on the parts of the business that matter "
        "most to you. None of this is required to advance. All of it is available when you "
        "want it.</p>",

        video("https://www.youtube.com/embed/2gaiZ4BcF8Y", "EverSmith EverConnect"),

        video("https://www.youtube.com/embed/x32yLyjEPDk", "EverSmith Brands CSS"),

        "  <ul>\n"
        f"    <li>{ph('1TP culture framework', 'PH-19')} - how we define the way we "
        "work</li>\n"
        f"    <li>{ph('name', 'PH-13')}, President of 1-Tom-Plumber</li>\n"
        "    <li>EverSmith Brands - our parent platform and what it means for you</li>\n"
        f"    <li>{ph('procurement / buying group', 'PH-11')} - vendor pricing and purchasing "
        "power</li>\n"
        "    <li>The Resale Department - how existing units transfer</li>\n"
        f"    <li>{ph('podcast and press features', 'PH-20')}</li>\n"
        "  </ul>",

        "  <h2>The Basics of Franchising</h2>",

        "  <p>We take a holistic view of franchising. Not every concept suits every owner, "
        "and not every candidate is awarded a franchise. Those two facts are related.</p>",

        "  <p>The videos below cover general franchise industry concepts. How franchising "
        "works, what a franchisor actually does, what obligations run both directions, and "
        "how to evaluate any brand you are considering. They are brand-agnostic on purpose. "
        "Watch them with 1-Tom-Plumber in mind, and with whatever other brands you are "
        "exploring in mind too.</p>",

        video_pending("General Franchising Concepts series",
                      "video:general-franchising-concepts-series"),

        "  <h2>Is Business Ownership Really Right for Me?</h2>",

        "  <p>Let's pause.</p>",

        "  <p>You have learned the brand. Before you go further, we want you to step back and "
        "ask a harder question. Not whether 1-Tom-Plumber is a good business, but whether "
        "business ownership is right for you and your family at this point in your life.</p>",

        "  <p>There is no wrong answer here. Some of the best conversations we have are the "
        "ones where a candidate decides the timing is not right. We would rather have that "
        "conversation now than two years into an agreement.</p>",

        video_pending("executive perspective on business ownership readiness",
                      "video:business-ownership-readiness"),

        next_block("Continue to Stage 3, Validation."),
    ]),
)
