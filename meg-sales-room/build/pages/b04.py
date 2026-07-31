"""Bucket 4 - Seeking Approval."""

from shell import (
    milestone, next_block, ph, ph_block, render, slot, steps, substeps, table,
    video_pending, warn,
)

PAGES = {}

SOURCE_PENDING = (
    "Source lesson copy was not supplied with this build. Structure, headings, and "
    "interactive elements are correct. Restore the original wording from the source "
    "lesson before this page goes to a candidate."
)

# ---------------------------------------------------------------- 4 · index

PAGES["04-seeking-approval/index.html"] = render(
    title="Seeking Approval",
    eyebrow="Stage 4 of 6",
    h1="Seeking Approval",
    lede="Present your case to executive leadership and build your timeline.",
    body="\n\n".join([
        "  <p>Stage 4 is where the process turns around. Up to now your Franchise Developer, "
        "or FD, has been presenting the brand to you. From here they present you to the "
        "brand.</p>",

        "  <p>Two things happen. Leadership evaluates your candidacy on an approval call, "
        "and you build the Development Action Plan that sets your timeline.</p>",

        video_pending("Seeking Approval Overview", "video:seeking-approval-overview"),

        "  <h2>What leadership is looking at</h2>",
        "  <p>Your Qualification Summary, your funding path, your territory, and the notes "
        "from your owner calls. Everything you completed in Stages 2 and 3 is the case.</p>",

        "  <p>This is also the point where a candidacy can end. Approval is not automatic, "
        "and it is not a formality.</p>",

        milestone("Executive Approval Received"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-executive-approval-call.html", "1", "Executive Approval Call",
             "Leadership call"),
            ("02-dap-contingencies.html", "2", "Development Action Plan / Contingencies",
             "Timeline and documents"),
        ]),

        next_block("Prepare for your Executive Approval Call. Your FD will tell you when it "
                   "is scheduled."),
    ]),
)

# ------------------------------------------- 4.1 · Executive Approval Call

PAGES["04-seeking-approval/01-executive-approval-call.html"] = render(
    title="Executive Approval Call",
    eyebrow="Stage 4 · Step 1 of 2",
    h1="Executive Approval Call",
    lede="Rather than presenting the brand to you, your Franchise Developer now presents you "
         "to the brand.",
    body="\n\n".join([
        "  <p>That flip is the whole point of this call. Everything before it was us earning "
        "your consideration. This is where we ask whether we can support you well.</p>",

        "  <h2>Who is on the call</h2>",
        "  <p>Your Franchise Developer, or FD, presents. A member of executive leadership "
        "evaluates and decides.</p>",

        ph_block(
            "Title of the executive who runs this call pending. Name the role so candidates "
            "know who they are meeting.",
            ref="PH-14",
        ),

        "  <h2>What gets presented</h2>",
        "  <p>Your FD walks leadership through your full file. Nothing in it will be new to "
        "you.</p>",

        "  <ul>\n"
        "    <li>Your Qualification Summary and financial position.</li>\n"
        "    <li>Your funding path and whether it is realistic.</li>\n"
        "    <li>The territory you are targeting.</li>\n"
        "    <li>What you learned on your owner calls.</li>\n"
        "    <li>Your behavioral assessment and how you like to operate.</li>\n"
        "  </ul>",

        "  <h2>How to prepare</h2>",
        "  <p>You do not build a deck. You do need clear answers to a few questions.</p>",

        steps([
            "Why this business, and why now.",
            "How you will fund it, and what your reserve looks like.",
            "What your first year of operating actually looks like day to day.",
            "What you learned from owners that changed your thinking.",
            "What you still need to resolve before you would sign.",
        ]),

        "  <p>Answer the last one honestly. An unresolved concern raised now gets addressed. "
        "The same concern raised after signing does not.</p>",

        video_pending("Executive Approval Call prep", "video:executive-approval-call-prep"),

        "  <h2>How selective this is</h2>",
        "  <p>Not every candidate who reaches this call is approved. The current figures are "
        "being confirmed against 1-Tom-Plumber's own records.</p>",

        ph_block(
            "Selectivity figures pending. The number is the credibility of the claim, so a "
            "wrong one is worse than none. Pull 1-Tom-Plumber's actuals before publishing.",
            ref="PH-01",
        ),

        "  <h2>What approval unlocks</h2>",
        "  <p>Approval opens your Development Action Plan and puts Meet The Team Day, or "
        "MTTD, on the calendar.</p>",

        "  <p>Worth setting expectations now. By the time you travel, you should have "
        "already made your decision.</p>",

        "  <blockquote>\n"
        "    <p>Meet The Team Day is more of a validation of a decision you have already "
        "made.</p>\n"
        "  </blockquote>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        next_block("After approval, move to your Development Action Plan and start working "
                   "the document checklist."),
    ]),
)

# --------------------------------------- 4.2 · DAP and contingencies

PAGES["04-seeking-approval/02-dap-contingencies.html"] = render(
    title="Development Action Plan / Contingencies",
    eyebrow="Stage 4 · Step 2 of 2",
    h1="Development Action Plan / Contingencies",
    lede="Your timeline, your document checklist, and the contingencies that have to clear "
         "before you open.",
    body="\n\n".join([
        "  <p>The Development Action Plan, or DAP, exists because executive leadership "
        "approved you. It turns that approval into dates.</p>",

        "  <p>It also names every contingency between here and opening, so nothing surfaces "
        "as a surprise in month three.</p>",

        slot("Download", "Your Development Action Plan", "download:development-action-plan"),

        video_pending("DAP and Document Acknowledgment", "video:dap-and-document-acknowledgment"),

        "  <h2>The document checklist</h2>",
        "  <p>Ten documents make up the package. Your Franchise Developer, or FD, will work "
        "the list with you and tell you what order to attack it in.</p>",

        ph_block(
            "Ten-item document checklist pending. The source lesson carried the specific list. "
            "Restore it here rather than approximating, because candidates work directly from "
            "this checklist.",
            ref="SRC",
        ),

        "  <h2>Sample agreements</h2>",
        "  <p>You will receive sample agreements alongside the Franchise Disclosure Document, "
        "or FDD. They are attached as exhibits to the FDD itself.</p>",

        "  <p>Sample means unsigned and unfilled. They show you exactly what you would be "
        "asked to sign, with your specific terms left blank. Give them to your attorney now, "
        "not later.</p>",

        "  <h2>The e-signature walkthrough</h2>",
        "  <p>Documents route to you through <strong>DocuSign</strong>. The email you "
        "receive uses DocuSign's standard language, and that language causes real "
        "confusion.</p>",

        "  <p>Watch for a DocuSign email from your Franchise Developer. It is legitimate, "
        "and it is not phishing.</p>",

        warn(
            "    <p>The DocuSign email will say <strong>\"Begin Signing Process.\"</strong> "
            "That wording is DocuSign's, not ours.</p>\n"
            "    <p><strong>This is only an acknowledgment of receipt. It is not "
            "execution.</strong></p>\n"
            "    <p>You are confirming you received the documents on a given date. You have "
            "not bought anything, you have not committed to anything, and you can still walk "
            "away.</p>",
            label="Acknowledgment is not execution",
        ),

        "  <p>Execution happens in Stage 6, after board approval, on a separate set of "
        "documents, with your FD walking you through it. You will know when it is real.</p>",

        "  <h2>Contingencies</h2>",
        "  <p>Contingencies are the conditions that must clear before you open. Each one gets "
        "a date and an owner on the DAP.</p>",

        "  <p>Typical items include funding approval, entity formation, your territory "
        "address, insurance, and licensing. Your FD sets the specific list with you.</p>",

        "  <p>Build in slack. Lending timelines and municipal licensing both move slower than "
        "candidates expect.</p>",

        next_block("Complete your DAP with your FD, then prepare for Meet The Team Day."),
    ]),
)
