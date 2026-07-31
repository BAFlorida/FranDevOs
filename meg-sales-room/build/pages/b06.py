"""Bucket 6 - Agreement Stage. Page 6.3 has no source content and ships as a stub."""

from shell import (
    milestone, next_block, ph, ph_block, render, slot, steps, substeps, table,
    video, warn,
)

PAGES = {}

SOURCE_PENDING = (
    "Source lesson copy was not supplied with this build. Structure, headings, and "
    "interactive elements are correct. Restore the original wording from the source "
    "lesson before this page goes to a candidate."
)

NO_SOURCE = (
    "COPY PENDING - this page has no source content. It does not exist in the source "
    "portal and is a 1-Tom-Plumber addition. Headings and interactive elements are in "
    "place and correct. The prose below each heading has to be written by 1-Tom-Plumber."
)

# ---------------------------------------------------------------- 6 · index

PAGES["06-agreement-stage/index.html"] = render(
    title="Agreement Stage",
    eyebrow="Stage 6 of 6",
    h1="Agreement Stage",
    lede="Final approval, execution, and welcome.",
    body="\n\n".join([
        "  <p>Stage 6 is the last one. The executive board makes the final decision, "
        "agreements are executed, and you are handed off to onboarding.</p>",

        "  <p>Read the execution page carefully. Small errors on those documents cost days, "
        "and a few of them are easy to make.</p>",

        "  <h2>What is left</h2>",
        "  <ul>\n"
        "    <li>The executive board reviews your file and votes.</li>\n"
        "    <li>You execute your franchise agreement and submit your funds transfer "
        "form.</li>\n"
        "    <li>You meet the brand team on a welcome call.</li>\n"
        "    <li>You are introduced to onboarding.</li>\n"
        "  </ul>",

        milestone("Agreement Executed"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-executive-board-approval.html", "1", "Executive Board Approval",
             "Board decision"),
            ("02-executing-your-agreement.html", "2", "Executing Your Franchise Agreement",
             "Execution and ACH"),
            ("03-brand-welcome-call.html", "3", "Brand Welcome Call", "Scheduled call"),
            ("04-thank-you.html", "4", "Thank You For Putting Your Trust In Us",
             "Handoff to onboarding"),
        ]),

        next_block("Your Franchise Developer will tell you when your file goes to the "
                   "executive board."),
    ]),
)

# ------------------------------------------ 6.1 · Executive Board Approval

PAGES["06-agreement-stage/01-executive-board-approval.html"] = render(
    title="Executive Board Approval",
    eyebrow="Stage 6 · Step 1 of 4",
    h1="Executive Board Approval",
    lede="The final decision, and the one your Franchise Developer does not get a vote in.",
    body="\n\n".join([
        "  <p>Your file goes to the executive board. The board reviews everything from Stage "
        "2 forward and decides whether to award a franchise.</p>",

        "  <p>Your Franchise Developer, or FD, presents your case. Your FD does not vote. "
        "That separation is deliberate, and it is what keeps this a real review rather than a "
        "rubber stamp.</p>",

        "  <h2>Three questions before your FD presents</h2>",
        "  <p>Your FD has to be able to answer yes to three questions before your file goes "
        "forward at all.</p>",

        ph_block(
            "The three yes questions are pending. The source lesson carried them specifically. "
            "Restore the exact three rather than approximating, because they are the FD's own "
            "gate on whether a file is ready.",
            ref="SRC",
        ),

        video("https://www.youtube.com/embed/qDuHvclW0kk",
              "EverSmith Executive Board Approval"),

        "  <h2>Three possible outcomes</h2>",

        table(
            "Executive board outcomes",
            ["Outcome", "What it means", "What happens next"],
            [
                ["Full Approval",
                 "The board awards the franchise with no outstanding conditions.",
                 "You move directly to executing your agreement."],
                ["Conditional Approval",
                 "The board awards the franchise once specific conditions are met.",
                 "Your FD works the conditions with you, then the file returns to the "
                 "board."],
                ["Not Approved",
                 "The board does not award a franchise at this time.",
                 "Your FD walks you through the reasoning."],
            ],
        ),

        "  <h2>Not Approved is a healthy outcome</h2>",
        "  <p>It does not feel that way, and it is still true.</p>",

        warn(
            "    <p><strong>We will not put people in financial peril.</strong></p>\n"
            "    <p>If the board's read is that a candidate would be stretched past a safe "
            "point, the answer is no. That answer protects the candidate more than it "
            "protects us.</p>",
            label="Why the board says no",
        ),

        "  <p>A no is sometimes about timing rather than about you. Candidates come back "
        "later with a stronger position and are awarded then.</p>",

        "  <p>Ask your FD for the reasoning. You are entitled to understand it.</p>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        next_block("On approval, move to Executing Your Franchise Agreement."),
    ]),
)

# ------------------------------- 6.2 · Executing Your Franchise Agreement

PAGES["06-agreement-stage/02-executing-your-agreement.html"] = render(
    title="Executing Your Franchise Agreement",
    eyebrow="Stage 6 · Step 2 of 4",
    h1="Executing Your Franchise Agreement",
    lede="This is the real signature. Read every note on this page before you start.",
    body="\n\n".join([
        "  <p>Everything you signed before this was an acknowledgment of receipt. This is "
        "execution.</p>",

        "  <p>Your Franchise Developer, or FD, walks the documents with you. Do not work "
        "through them alone on a Friday night.</p>",

        "  <p>The documents route through <strong>DocuSign</strong>, the same platform that "
        "delivered your acknowledgment package in Stage 4. This time the signature is "
        "real.</p>",

        video("https://www.youtube.com/embed/lcOn6qL1uoo", "EverSmith Agreement Execution"),

        "  <h2>Seven execution notes</h2>",
        "  <p>These are the specific places candidates make mistakes. Each one costs days "
        "when it goes wrong.</p>",

        ph_block(
            "Seven execution notes pending. The source lesson carried a specific numbered "
            "list. Restore all seven verbatim. This page is a procedural checklist, and "
            "paraphrasing it introduces exactly the errors it exists to prevent.",
            ref="SRC",
        ),

        "  <h2>Schedule D</h2>",
        "  <p>Schedule D has three acceptable answers, and only three. This trips up more "
        "candidates than any other field in the package.</p>",

        warn(
            "    <p><strong>Do not answer Schedule D with \"N/A.\"</strong></p>\n"
            "    <p>N/A is not one of the accepted answers. It bounces the document back, and "
            "you start the routing over.</p>",
            label="Schedule D",
        ),

        ph_block(
            "The three acceptable Schedule D answers are pending and must be reproduced "
            "exactly. Do not paraphrase them, and do not offer examples in their place.",
            ref="SRC",
        ),

        "  <h2>Funds transfer</h2>",
        "  <p>Your franchise fee and equity injection move by Automated Clearing House "
        "transfer, or ACH. The form below authorizes it.</p>",

        slot("Download", "ACH Form - Franchise Fee / Equity Injection",
             "download:ach-franchise-fee-equity-injection"),

        "  <p>Check the account and routing numbers twice. A transposed digit here is a "
        "week.</p>",

        "  <h2>Countersignature</h2>",
        "  <p>Your signature does not complete the agreement. It is countersigned on the "
        "brand side, and only then is the agreement fully executed.</p>",

        ph_block(
            "Countersignature routing chain pending. The source routed through a brand "
            "president and then a second entity president. Confirm the 1-Tom-Plumber and "
            "EverSmith chain, and state how long it usually takes.",
            ref="PH-17",
        ),

        "  <p>You receive a fully executed copy once every signature is in place. Keep it "
        "somewhere you can find it, and send a copy to your attorney and your "
        "accountant.</p>",

        next_block("Once your agreement is executed, schedule your Brand Welcome Call."),
    ]),
)

# ------------------------------- 6.3 · Brand Welcome Call (NO SOURCE - stub)

PAGES["06-agreement-stage/03-brand-welcome-call.html"] = render(
    title="Brand Welcome Call",
    eyebrow="Stage 6 · Step 3 of 4",
    h1="Brand Welcome Call",
    lede="Your first call as an owner rather than a candidate.",
    body="\n\n".join([
        ph_block(NO_SOURCE, ref="NO SOURCE"),

        video("https://www.youtube.com/embed/1NynLBubPv0", "EverSmith Welcome Call"),

        "  <h2>Who is on the call</h2>",
        "  <p>Names and roles of the brand team members who join this call go here, with what "
        "each one will own in the new owner's business.</p>",

        ph_block(
            "Brand Welcome Call attendees pending. Needs names, titles, and what each person "
            "is responsible for going forward.",
            ref="PH-18",
        ),

        "  <h2>What gets covered</h2>",
        "  <p>The agenda for the call goes here.</p>",

        ph_block(
            "Call agenda pending. Cover what is discussed, how long the call runs, and what "
            "decisions get made on it.",
            ref="PH-18",
        ),

        "  <h2>What to bring</h2>",
        "  <p>What the new owner should have ready before the call goes here.</p>",

        ph_block(
            "Preparation list pending. Name the documents, dates, and decisions the owner "
            "should arrive with.",
            ref="PH-18",
        ),

        "  <h2>How it hands off to onboarding</h2>",
        "  <p>How this call connects to the onboarding program goes here, including who takes "
        "over and when.</p>",

        ph_block(
            "Handoff detail pending. State who owns the relationship after this call and what "
            "the first onboarding milestone is.",
            ref="PH-18",
        ),

        slot("Scheduler", "Schedule Brand Welcome Call", "scheduler:brand-welcome-call"),

        next_block("After your welcome call, your onboarding introduction is the last step "
                   "in this guide."),
    ]),
)

# ---------------------------------------------------------- 6.4 · Thank You

PAGES["06-agreement-stage/04-thank-you.html"] = render(
    title="Thank You For Putting Your Trust In Us",
    eyebrow="Stage 6 · Step 4 of 4",
    h1="Thank You For Putting Your Trust In Us",
    lede="You did the work. You asked hard questions, you talked to owners, and you made a "
         "decision with your eyes open.",
    body="\n\n".join([
        "  <p>Thank you for putting your trust in us. We take seriously what it means that "
        "you chose to build something here.</p>",

        "  <p>The Mutual Evaluation Process was deliberately slow. That was the point.</p>",

        "  <blockquote>\n"
        "    <p>When we slow down on the front end, we can really speed up on the back "
        "end.</p>\n"
        "  </blockquote>",

        "  <p>Everything you settled during evaluation is something you will not be settling "
        "while you are trying to open. Funding, territory, technology, and timeline are all "
        "already decided.</p>",

        "  <h2>Onboarding starts now</h2>",
        "  <p>The evaluation process ends here and the onboarding program begins. Different "
        "team, different pace, same brand.</p>",

        "  <p>The program is called <strong>Sure Start</strong>. It picks up where this "
        "guide leaves off and carries you through to opening.</p>",

        "  <p>Your onboarding coordinator takes over from your Franchise Developer and runs "
        "you through Sure Start.</p>",

        ph_block(
            "Onboarding coordinator title pending. Name the role so the new owner knows who "
            "they are being handed to.",
            ref="PH-16",
        ),

        slot("Scheduler", "Schedule Onboarding Introduction",
             "scheduler:onboarding-introduction"),

        "  <h2>Referring other owners</h2>",
        "  <p>Owners who know candidates who would fit this system can refer them. The "
        "program details are being confirmed.</p>",

        ph_block(
            "Referral program name and every figure in it are pending. The source program used "
            "a per-placement award, a quarterly drawing, a travel award, a live drawing, and "
            "an April 1 to March 31 award year. None of those figures transfer. Replace the "
            "section entirely with 1-Tom-Plumber's own program, or cut it.",
            ref="PH-06",
        ),

        "  <h2>What we ask of you</h2>",
        "  <p>Three things, and none of them are complicated.</p>",

        "  <ul>\n"
        "    <li>Work the onboarding program in order, the same way you worked this "
        "guide.</li>\n"
        "    <li>Ask for help early. The support team would rather hear about a problem in "
        "week two than month six.</li>\n"
        "    <li>Take owner calls from future candidates when we ask. You know exactly how "
        "much those calls mattered.</li>\n"
        "  </ul>",

        "  <p>Welcome to 1-Tom-Plumber.</p>",

        next_block("Schedule your onboarding introduction. Your onboarding coordinator takes "
                   "it from here.", label="Last step"),
    ]),
)
