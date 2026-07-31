"""Bucket 2 - Brand Overview."""

from shell import (
    milestone, next_block, ph, ph_block, render, slot, steps, substeps, table,
    video, video_pending, warn,
)

PAGES = {}

SOURCE_PENDING = (
    "Source lesson copy was not supplied with this build. Structure, headings, and "
    "interactive elements are correct. Restore the original wording from the source "
    "lesson before this page goes to a candidate."
)

# ---------------------------------------------------------------- 2 · index

PAGES["02-brand-overview/index.html"] = render(
    title="Brand Overview",
    eyebrow="Stage 2 of 6",
    h1="Brand Overview",
    lede="High level operational overview.",
    body="\n\n".join([
        "  <p>Stage 2 is where you get the real documents. You will complete your "
        "Qualification Summary, pull your own credit report, and receive the Franchise "
        "Disclosure Document.</p>",

        "  <p>This is the heaviest reading stage in the process. Give it the time it "
        "deserves.</p>",

        video_pending("1-Tom-Plumber Brand Overview", "video:brand-overview"),

        "  <h2>What the business actually is</h2>",
        "  <p>1-Tom-Plumber is an emergency plumbing and drain cleaning brand, founded in "
        "2018 and leaning commercial. Owners run a dispatch-driven service business, not a "
        "retail storefront.</p>",

        "  <p>The brand operates 57 territories across 22 states with 37 franchisees. In "
        "December 2025 it was acquired by EverSmith Brands, which is backed by The Riverside "
        "Company.</p>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        "  <h2>What Stage 2 asks of you</h2>",
        "  <ul>\n"
        "    <li>Complete your Qualification Summary and behavioral assessment.</li>\n"
        "    <li>Pull your own credit report and authorize a background check.</li>\n"
        "    <li>Read the Franchise Disclosure Document and sign its receipt.</li>\n"
        "    <li>Work through the optional resources if you are new to franchising.</li>\n"
        "  </ul>",

        milestone("FDD Receipt Signed"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-qualification-summary.html", "1", "Qualification Summary / Culture Index",
             "3 forms"),
            ("02-fdd.html", "2", "Franchise Disclosure Document", "Receipt required"),
            ("03-additional-resources.html", "3", "Additional Brand Specific Resources",
             "Optional depth"),
        ]),

        next_block("Start with your Qualification Summary. It is the first thing your "
                   "Franchise Developer needs to move you forward."),
    ]),
)

# -------------------------------- 2.1 · Qualification Summary / Culture Index

PAGES["02-brand-overview/01-qualification-summary.html"] = render(
    title="Qualification Summary / Culture Index",
    eyebrow="Stage 2 · Step 1 of 3",
    h1="Qualification Summary / Culture Index",
    lede="Four items, one page. Complete all four and your Franchise Developer can move you "
         "into Validation.",
    body="\n\n".join([
        "  <p>This page collects everything we need to understand your financial position, "
        "your working style, and your background. Your Franchise Developer, or FD, cannot "
        "advance you to Stage 3 until all four are done.</p>",

        "  <p>None of this is a credit application. Nothing here is submitted to a lender, "
        "and nothing here affects your credit score.</p>",

        "  <h2>1. Qualification Summary</h2>",
        "  <p>The Qualification Summary captures your assets, liabilities, liquidity, and "
        "the capital you are prepared to put into a business.</p>",

        "  <p>Answer it accurately rather than optimistically. An inflated number here "
        "produces a funding conversation later that falls apart, and that wastes your "
        "time more than ours.</p>",

        video("https://www.youtube.com/embed/GWB3gkycrKw",
              "EverSmith Qualification Summary Overview"),

        slot("Form", "Qualification Summary Form", "form:qualification-summary"),

        "  <h2>2. Culture Index</h2>",
        "  <p>The behavioral assessment takes roughly ten minutes and has no right answers. "
        "It tells us how you prefer to work, make decisions, and handle pressure.</p>",

        "  <p>We use it to understand how to support you, not to screen you out. Owners "
        "succeed here with very different profiles.</p>",

        ph_block(
            "Behavioral assessment tool not confirmed. The sales room says Culture Index; "
            "the source portal used DISC. Confirm one tool and use the same name here and on "
            "the Pre Meet The Team Day Questionnaire.",
            ref="PH-10",
        ),

        slot("Form", "Culture Index Survey", "form:culture-index-survey"),

        "  <h2>3. Your credit report</h2>",
        "  <p>You pull your own report and share it with us. We do not pull it for you, and "
        "this does not create a hard inquiry.</p>",

        "  <p>Lenders will eventually look at your credit. Seeing it now means we can flag a "
        "problem early, while there is still time to address it.</p>",

        steps([
            "Go to <strong>Experian.com</strong>",
            "Create an account. Choose \"Checking my report or score for accuracy.\"",
            "Navigate to the <strong>Credit Reports</strong> tab.",
            "Open your current report and review it for accuracy.",
            "Save or print the full report as a PDF.",
            "Check that your score and the full trade line detail are both visible.",
            "Send the PDF to your Franchise Developer.",
        ]),

        ph_block(
            "Credit report instruction wording pending. Steps 1 through 3 match the reference "
            "template. Confirm steps 4 through 7 against the source lesson before publishing.",
            ref="SRC",
        ),

        "  <h2>4. Background check authorization</h2>",
        "  <p>Every candidate authorizes a standard background check. It is a routine part of "
        "awarding a franchise and it protects the owners already in the system.</p>",

        ph_block(
            "Background check vendor not confirmed. Name the vendor here so candidates know "
            "who is contacting them.",
            ref="PH-09",
        ),

        "  <h2>Then we review it together</h2>",
        "  <p>Once all four items are in, you and your FD schedule a review call. That call "
        "walks your Qualification Summary line by line and sets up the funding conversation "
        "in Stage 3.</p>",

        slot("Scheduler", "Schedule Qualification Summary Review",
             "scheduler:qualification-summary-review"),

        next_block("Complete all four items, then schedule your review call. The Franchise "
                   "Disclosure Document comes next."),
    ]),
)

# ------------------------------------- 2.2 · Franchise Disclosure Document

PAGES["02-brand-overview/02-fdd.html"] = render(
    title="Franchise Disclosure Document",
    eyebrow="Stage 2 · Step 2 of 3",
    h1="Franchise Disclosure Document",
    lede="The single most important document you will read in this process. Federal law "
         "requires us to give it to you.",
    body="\n\n".join([
        "  <p>The Franchise Disclosure Document, or FDD, is a 23-item disclosure that every "
        "franchisor in the United States must provide. Its contents are set by the Federal "
        "Trade Commission, not by us.</p>",

        "  <p>Read all of it. Then have your attorney and your accountant read it too. That "
        "is not a formality, and candidates who skip it regret it.</p>",

        "  <h2>The 14 day rule protects you</h2>",
        "  <p>You must have the FDD in hand for at least 14 calendar days before you sign "
        "any agreement or pay us any money. That waiting period is federal law.</p>",

        "  <p>Signing the receipt starts that 14 day clock. It does not commit you to "
        "anything, and it is not an agreement to buy a franchise.</p>",

        warn(
            "    <p>Signing the FDD receipt confirms one thing only: that you received the "
            "document on a given date.</p>\n"
            "    <p><strong>It is not a purchase, a commitment, or an agreement of any "
            "kind.</strong></p>",
            label="What signing the receipt means",
        ),

        "  <h2>What is in the 23 items</h2>",
        "  <p>Every FDD carries the same 23 items in the same order. Use the table to find "
        "what you are looking for.</p>",

        video("https://www.youtube.com/embed/udCsGBIY1Rs", "EverSmith FDD Overview"),

        table(
            "The 23 items of the Franchise Disclosure Document",
            ["Item", "Covers"],
            [
                ["1", "The franchisor, its parents, predecessors, and affiliates"],
                ["2", "Business experience of the leadership team"],
                ["3", "Litigation history"],
                ["4", "Bankruptcy history"],
                ["5", "Initial fees"],
                ["6", "Other fees, including royalty and marketing"],
                ["7", "Estimated initial investment"],
                ["8", "Restrictions on sources of products and services"],
                ["9", "Your obligations as a franchisee"],
                ["10", "Financing offered by the franchisor"],
                ["11", "Franchisor assistance, advertising, computer systems, and training"],
                ["12", "Territory"],
                ["13", "Trademarks"],
                ["14", "Patents, copyrights, and proprietary information"],
                ["15", "Your obligation to participate in operating the business"],
                ["16", "Restrictions on what you may sell"],
                ["17", "Renewal, termination, transfer, and dispute resolution"],
                ["18", "Public figures"],
                ["19", "Financial performance representations"],
                ["20", "Outlet counts and franchisee contact information"],
                ["21", "Financial statements"],
                ["22", "Contracts, including the franchise agreement itself"],
                ["23", "Receipts"],
            ],
        ),

        "  <h2>Item 19 - Financial Performance Representations</h2>",
        "  <p>Item 19 is the only place a franchisor may make a financial performance "
        "representation, or FPR. If a number about revenue or profit is not in Item 19, we "
        "cannot give it to you.</p>",

        "  <p>Franchisors are not required to include an Item 19. Many do not. The absence of "
        "one is normal and is not a red flag by itself.</p>",

        ph_block(
            "Item 19 status not confirmed. Check the current FDD. If there is no financial "
            "performance representation, say so plainly here, and carry the full explanation "
            "into the Owner Calls acknowledgment on page 3.1.",
            ref="PH-07",
        ),

        "  <h2>Item 20 - your validation list</h2>",
        "  <p>Item 20 lists current franchisees and, separately, owners who have left the "
        "system in the past year. Contact information is included.</p>",

        "  <p>That list is yours to use. You do not need our permission to call anyone on it, "
        "and we do not choose who you speak with. Stage 3 is built around those "
        "conversations.</p>",

        "  <h2>Where the cost figures live</h2>",
        "  <p>Items 5, 6, and 7 carry the money. Public disclosure data shows the figures "
        "below, and you should confirm each against the FDD you receive.</p>",

        table(
            "Where to find cost figures in the FDD",
            ["Item", "Figure", "Public value"],
            [
                ["5", "Initial franchise fee", "$50,000 per territory"],
                ["6", "Royalty", "6% of gross revenue"],
                ["7", "Estimated initial investment", "$515,719 to $2,784,795"],
            ],
        ),

        "  <p>The Item 7 range is wide because it spans a range of build-outs, vehicle "
        "counts, and market conditions. Your Franchise Developer will help you understand "
        "where your plan is likely to land.</p>",

        "  <h2>How to read it</h2>",
        steps([
            "Read Items 5, 6, and 7 first. That is the money.",
            "Read Item 19, then note every question it does not answer.",
            "Pull the Item 20 list and mark the owners you want to call in Stage 3.",
            "Read Item 17 closely. It governs renewal, transfer, and exit.",
            "Send it to your attorney and your accountant.",
            "Sign the Item 23 receipt to start your 14 day review period.",
        ]),

        next_block("Sign your FDD receipt, then use the additional resources page while your "
                   "14 day review period runs."),
    ]),
)

# ------------------------------- 2.3 · Additional Brand Specific Resources

PAGES["02-brand-overview/03-additional-resources.html"] = render(
    title="Additional Brand Specific Resources",
    eyebrow="Stage 2 · Step 3 of 3",
    h1="Additional Brand Specific Resources",
    lede="Optional depth. None of this is required to advance, and all of it helps.",
    body="\n\n".join([
        "  <p>Your 14 day Franchise Disclosure Document review period is running. This page "
        "is what to do with that time.</p>",

        "  <p>Nothing below gates your progress. Work through what is useful to you and skip "
        "what is not.</p>",

        "  <h2>The basics of franchising</h2>",
        "  <p>If this is your first look at franchising, start here. The series covers how "
        "franchise systems work, what a franchisor actually owes you, and what you owe "
        "them.</p>",

        slot("Video", "General Franchising Concepts series",
             "video:general-franchising-concepts-series"),

        "  <h2>EverConnect</h2>",
        "  <p>EverConnect is part of the EverSmith Brands network your territory plugs "
        "into. This overview explains what it does for an owner.</p>",

        video("https://www.youtube.com/embed/2gaiZ4BcF8Y", "EverSmith EverConnect"),

        "  <h2>EverSmith Brands CSS</h2>",
        "  <p>Shared services across the EverSmith portfolio, and what they mean for a "
        "1-Tom-Plumber territory.</p>",

        video("https://www.youtube.com/embed/x32yLyjEPDk", "EverSmith Brands CSS"),

        "  <h2>Is business ownership really right for you?</h2>",
        "  <p>This one is a deliberate pause, not a sales exercise. Sit with it honestly.</p>",

        "  <p>Business ownership changes your income structure, your schedule, and your risk. "
        "Some people finish this exercise and step out of the process. That is a good "
        "outcome, and it is far cheaper now than after you sign.</p>",

        "  <blockquote>\n"
        "    <p>The right answer to this question is the true one, not the one that keeps "
        "the process moving.</p>\n"
        "  </blockquote>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        "  <h2>Focus</h2>",
        "  <p>The brand has a short talk on why owners who split their attention across two "
        "ventures tend to underperform owners who commit to one.</p>",

        ph_block(
            "Focus talk not yet recorded. The source brand had its own version of this. It "
            "needs a 1-Tom-Plumber or EverSmith executive to record an equivalent.",
            ref="PH-23",
        ),

        "  <h2>Support you will have</h2>",
        "  <p>Owners do not buy supplies, answer phones, or build culture alone. Three "
        "support structures sit behind every territory.</p>",

        table(
            "Brand support structures",
            ["Structure", "What it does for an owner"],
            [
                [ph("Procurement / buying group", "PH-11"),
                 "Negotiates equipment and parts pricing across the system"],
                [ph("Call center / dispatch support", "PH-12"),
                 "Answers and routes emergency calls outside your own hours"],
                [ph("Culture framework", "PH-19"),
                 "The brand's named operating values, used in hiring and training"],
            ],
        ),

        "  <h2>Leadership and press</h2>",
        "  <p>Hearing directly from leadership tells you more about a brand than any deck.</p>",

        "  <ul>\n"
        f"    <li>President of 1-Tom-Plumber: {ph('name pending', 'PH-13')}</li>\n"
        f"    <li>Podcast and press features: {ph('list pending', 'PH-20')}</li>\n"
        "  </ul>",

        next_block("When your 14 day review period is complete and your FDD receipt is "
                   "signed, Stage 3 opens. Validation starts with owner calls."),
    ]),
)
