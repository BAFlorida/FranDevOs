"""Bucket 4 - Seeking Approval. Copy transcribed verbatim from bucket_4_5_6.md."""

from shell import (
    next_block, ph, ph_block, render, slot, steps, substeps, table, video_pending,
    warn,
)

PAGES = {}

# ---------------------------------------------------------------- 4 · index

PAGES["04-seeking-approval/index.html"] = render(
    title="Seeking Approval",
    eyebrow="Stage 4 of 6",
    h1="Seeking Approval",
    lede="Present your case to executive leadership and build your timeline.",
    body="\n\n".join([
        video_pending("Seeking Approval Overview", "video:seeking-approval-overview"),

        "  <p>Up to this point, your Franchise Developer has been presenting the BRAND to "
        "YOU.</p>",

        "  <p>That flips now. In this stage, they present YOU to the BRAND.</p>",

        "  <p>Two things happen here. You meet with an executive. If approved, your Franchise "
        "Developer builds your Development Action Plan and drafts your sample agreements.</p>",

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-executive-approval-call.html", "1", "Executive Approval Call", ""),
            ("02-dap-contingencies.html", "2", "Development Action Plan / Contingencies", ""),
        ]),

        next_block("Start with the Executive Approval Call."),
    ]),
)

# ------------------------------------------- 4.1 · Executive Approval Call

PAGES["04-seeking-approval/01-executive-approval-call.html"] = render(
    title="Executive Approval Call",
    eyebrow="Stage 4 · Step 1 of 2",
    h1="Executive Approval Call",
    lede="Rather than presenting the BRAND to YOU, they now will present YOU to the BRAND.",
    body="\n\n".join([
        video_pending("Executive Approval Call prep", "video:executive-approval-call-prep"),

        "  <h2>What This Milestone Means</h2>",

        "  <p>Reaching this stage means you are being considered for an invitation to Meet "
        "The Team Day, our brand orientation event at headquarters.</p>",

        ph_block(
            "1TP selectivity figures. The original read \"fewer than 5% of candidates "
            "introduced to a Franchise Developer are eventually invited to Meet The Team "
            "Day\" and \"statistically, only 2 out of 3 candidates who attend are awarded a "
            "franchise.\" Pull 1TP's actuals before publishing.",
            ref="PH-01",
        ),

        "  <h2>Who You Will Meet</h2>",

        f"  <p>Our {ph('executive title', 'PH-14')} will meet with you, and with your spouse "
        "or partner if they are part of this decision.</p>",

        "  <p>This is not a grueling interview. It is informal. The purpose is for our "
        "executive to understand your interest in their brand, and to validate that your "
        "Franchise Developer has guided you thoroughly through the process.</p>",

        "  <p>By this point, our executive often already knows a great deal about you. Your "
        "Franchise Developer has been advocating for you internally the whole way. It is not "
        "unusual for the invitation to Meet The Team Day to be extended on this first "
        "call.</p>",

        "  <h2>The Frame</h2>",

        "  <p><strong>Meet The Team Day is more of a validation of a decision you have "
        "already made in your mind.</strong></p>",

        "  <p>That is the honest framing. If you arrive at Meet The Team Day still deciding "
        "whether you want this, something earlier in the process did not work. This call is "
        "where we confirm you are past that point.</p>",

        "  <h2>What Happens If You Are Approved</h2>",

        "  <p>If our executive approves you for Meet The Team Day, they will ask your "
        "Franchise Developer to do two things.</p>",

        "  <ol>\n"
        "    <li>Build your timeline. A specific plan from orientation through training to "
        "your Grand Opening.</li>\n"
        "    <li>Draft your sample set of agreements. Populated with your specific territory, "
        "demographics, and the nuances of your situation.</li>\n"
        "  </ol>",

        "  <p>Both arrive in the next step.</p>",

        "  <h2>How to Prepare</h2>",

        "  <p>Be ready to speak to why business ownership and why now. What you heard from "
        "owners during Validation, in your own words. Your funding path and where it stands. "
        "The territory you want and why. Your timeline to open.</p>",

        "  <p>Bring the questions you have not been able to get answered elsewhere. Our "
        "executive has visibility your Franchise Developer does not.</p>",

        next_block("Attend your Executive Approval Call, then continue to your Development "
                   "Action Plan."),
    ]),
)

# --------------------------------------- 4.2 · DAP and contingencies

PAGES["04-seeking-approval/02-dap-contingencies.html"] = render(
    title="Development Action Plan / Contingencies",
    eyebrow="Stage 4 · Step 2 of 2",
    h1="Development Action Plan / Contingencies",
    lede="Your timeline, your documents, and your sample agreements.",
    body="\n\n".join([
        video_pending("Development Action Plan and Document Acknowledgment",
                      "video:dap-and-document-acknowledgment"),

        "  <h2>Your Development Action Plan</h2>",

        "  <p>The DAP is a concise, customized timeline. It runs from today, through Meet The "
        "Team Day, through award, through training, to your Grand Opening.</p>",

        "  <p>It is fluid. Your Franchise Developer adjusts it to your needs, your goals, and "
        "your funding path. An SBA timeline moves differently than a ROBS timeline, which "
        "moves differently than cash.</p>",

        slot("Download", "Your Development Action Plan", "download:development-action-plan"),

        "  <h2>Your Sample Set of Agreements</h2>",

        "  <p>You saw these agreements listed in FDD Item 22. Now you will see them filled in "
        "for your specific situation. Your territory, your fee, your equity injection, your "
        "dates.</p>",

        "  <h2>What Your Franchise Developer Needs From You</h2>",

        table(
            "Documents your Franchise Developer needs from you",
            ["#", "Item", "Notes"],
            [
                ["1", "Qualification Summary",
                 "Updated from Stage 2 if anything has changed"],
                ["2", "Credit Report", "Your Experian self-pull"],
                ["3", "FDD Receipt", "The executed receipt page from Item 23"],
                ["4", "Territory Map", "Marketing runs the DBA smell test on it"],
                ["5", "Franchise Proposal",
                 "Fee investment derived from the map. Equity injection based on your "
                 "funding path"],
                ["6", "SBA Pre-Approval Letter", "If you are funding through SBA"],
                ["7", "ROBS or Self-Funding Proof", "Bank or retirement statements"],
                ["8", "DAP Timeline", "Reviewed with your Franchise Developer"],
                ["9", "Bio",
                 "Your Franchise Developer writes an executive bio. You provide a family "
                 "photo"],
                ["10", "Address Confirmation",
                 "Your in-territory address, or your plan to secure one"],
            ],
        ),

        "  <p>Additional items as they apply. DD-214 for VetFran discount eligibility. E2 "
        "visa attorney letter if applicable. P&amp;L for conversions of an existing "
        "business.</p>",

        warn(
            "    <p>Our Legal team drafts your sample agreements. You then formally "
            "acknowledge receipt, which begins the FTC-mandated hold time.</p>\n"
            "    <p>The DocuSign email you receive will say <strong>\"Begin Signing "
            "Process.\"</strong> That wording is the platform's, not ours.</p>\n"
            "    <p><strong>This is only an acknowledgment of receipt. It is not "
            "execution.</strong></p>\n"
            "    <p>You have not been presented to the Executive Committee. You have not been "
            "awarded a franchise. You are acknowledging that you received documents for "
            "review, which is a legal requirement your Franchise Developer must satisfy.</p>\n"
            "    <p>Please acknowledge promptly. The hold clock does not start until you "
            "do.</p>",
            label="Read this carefully",
        ),

        "  <h2>DocuSign Walkthrough</h2>",

        steps([
            "Our contract administrator emails you a custom login and password. Your "
            "Franchise Developer never sees it. If you are awarded, you will reuse this same "
            "login for execution.",
            "You receive a second email from DocuSign, \"Step One: Begin Signing Process.\"",
            "Log in with the credentials from the first email.",
            "Accept the Terms.",
            "Sign your name exactly as it appears on the document.",
            "Complete the signing process.",
        ]),

        "  <p>If anything does not work, contact your Franchise Developer. Do not create a "
        "second account.</p>",

        next_block("Acknowledge receipt of your agreements, then continue to Stage 5, Meet "
                   "The Team Day."),
    ]),
)
