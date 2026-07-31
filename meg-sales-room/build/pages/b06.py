"""Bucket 6 - Agreement Stage. Copy transcribed verbatim from bucket_4_5_6.md."""

from shell import (
    next_block, ph_block, render, slot, steps, substeps, video,
)

PAGES = {}

# ---------------------------------------------------------------- 6 · index

PAGES["06-agreement-stage/index.html"] = render(
    title="Agreement Stage",
    eyebrow="Stage 6 of 6",
    h1="Agreement Stage",
    lede="Final approval, execution, and welcome.",
    body="\n\n".join([
        "  <p>Three things happen in this stage. The Executive Committee makes its decision. "
        "You execute your Franchise Agreement. And we welcome you into the system.</p>",

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-executive-board-approval.html", "1", "Executive Board Approval", ""),
            ("02-executing-your-agreement.html", "2",
             "Executing Your Franchise Agreement", ""),
            ("03-brand-welcome-call.html", "3", "Brand Welcome Call", ""),
            ("04-thank-you.html", "4", "Thank You For Putting Your Trust In Us", ""),
        ]),

        next_block("Start with Executive Board Approval."),
    ]),
)

# ------------------------------------------ 6.1 · Executive Board Approval

PAGES["06-agreement-stage/01-executive-board-approval.html"] = render(
    title="Executive Board Approval",
    eyebrow="Stage 6 · Step 1 of 4",
    h1="Executive Board Approval",
    lede="How the decision actually gets made.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/qDuHvclW0kk",
              "EverSmith Executive Board Approval"),

        "  <p>Your Franchise Developer presents you to our Executive Committee.</p>",

        "  <p><strong>They have no vote.</strong></p>",

        "  <p>That is deliberate. Your Franchise Developer's role in that room is to be your "
        "biggest cheerleader. To present your background, your territory, how you moved "
        "through the process, and why they believe you fit. The decision belongs to the "
        "committee.</p>",

        "  <h2>Three Questions First</h2>",

        "  <p>Your Franchise Developer will not present you until you can answer YES to all "
        "three.</p>",

        "  <ol>\n"
        "    <li>Have all your questions regarding the brand been answered?</li>\n"
        "    <li>Have all your questions regarding the franchise agreement been "
        "answered?</li>\n"
        "    <li>Are you committed to the established timeline if awarded?</li>\n"
        "  </ol>",

        "  <p>If any answer is no, we slow down. That is not a setback. It is the process "
        "working.</p>",

        "  <h2>The Decision Comes the Same Day</h2>",

        "  <p>You will not wait a week. After deliberations, a member of the committee calls "
        "you directly.</p>",

        "  <p>There are three possible outcomes.</p>",

        "  <h3>1. Full Approval</h3>",

        "  <p>You are awarded. Your Franchise Developer moves you into execution.</p>",

        "  <h3>2. Conditional Approval</h3>",

        "  <p>You receive full approval once a specific condition is met. Common examples are "
        "a clarification on a background item, or a funding milestone that needs to land "
        "first.</p>",

        "  <p>Once the condition is satisfied, conditional approval converts to full "
        "approval. Your Franchise Developer will be explicit about what is needed and by "
        "when.</p>",

        "  <h3>3. Not Approved</h3>",

        "  <p>This is a healthy outcome, and we mean that.</p>",

        "  <p>If the committee believes you would struggle in this business, or that this "
        "investment would put you in financial difficulty, they will not award you a "
        "franchise. <strong>We will not put people in financial peril.</strong></p>",

        "  <p>A member of the committee will explain the reasoning directly. They will also "
        "offer guidance on where they think you would do better, inside the portfolio or "
        "outside it.</p>",

        "  <p>Some candidates come back to us in a year or two when their situation has "
        "changed. That door stays open.</p>",

        next_block("On approval, continue to Executing Your Franchise Agreement."),
    ]),
)

# ------------------------------- 6.2 · Executing Your Franchise Agreement

PAGES["06-agreement-stage/02-executing-your-agreement.html"] = render(
    title="Executing Your Franchise Agreement",
    eyebrow="Stage 6 · Step 2 of 4",
    h1="Executing Your Franchise Agreement",
    lede="You are truly in elite air.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/lcOn6qL1uoo", "EverSmith Agreement Execution"),

        "  <p>You have successfully navigated one of the most selective franchise development "
        "processes in the world.</p>",

        "  <h2>What Happens Now</h2>",

        "  <p>DocuSign sends you a link to Step 2 of execution. Your password is the same one "
        "you used for the Step 1 acknowledgment in Stage 4. If you cannot find it, Legal can "
        "resend.</p>",

        "  <p>Alongside it, you will receive an ACH form for your franchise fee, or for your "
        "equity injection if you are funding through SBA.</p>",

        "  <h2>Seven Things to Know</h2>",

        steps([
            "Phone company name and address. This field may be left blank. Sign anyway.",
            "Bank account information. You will need bank name, the name and address on the "
            "account, routing number, and account number. A personal checking account works "
            "as a placeholder and can be updated later. The account number must be real. A "
            "placeholder number kicks the agreements back and costs you days.",
            "Signature. Sign your full name exactly as it reads on the agreement.",
            "Schedule D. There are only three acceptable answers. Leave it blank. A clear "
            "confirmation that the statement is accurate. Or a statement that it is false, "
            "which pauses closing until we clarify it with you. You cannot answer \"N/A.\" "
            "You cannot answer a bare \"yes\" or \"no.\" Those will bounce.",
            "Schedule D skip. After you select \"I agree\" in the dropdown, hit skip on the "
            "comment section and move on.",
            "Signature verification. Your Franchise Developer coordinates with Legal to "
            "verify all signatures, including your spouse's if applicable.",
            "Countersignature routing. <span class=\"ph\"><span class=\"ph__ref\">PH-17</span> "
            "confirm the 1TP / EverSmith countersignature chain.</span> You receive a fully "
            "executed copy when it is complete.",
        ]),

        "  <h2>The ACH Form</h2>",

        slot("Download", "ACH Form - Franchise Fee / Equity Injection",
             "download:ach-franchise-fee-equity-injection"),

        "  <p>Complete it and email it to your Franchise Developer. <strong>Double-check your "
        "account numbers.</strong> This is the single most common source of delay at this "
        "stage.</p>",

        next_block("Once executed, schedule your Brand Welcome Call."),
    ]),
)

# ------------------------------------------------- 6.3 · Brand Welcome Call

PAGES["06-agreement-stage/03-brand-welcome-call.html"] = render(
    title="Brand Welcome Call",
    eyebrow="Stage 6 · Step 3 of 4",
    h1="Brand Welcome Call",
    lede="Your handoff into Sure Start.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/1NynLBubPv0", "EverSmith Welcome Call"),

        ph_block(
            "Brand Welcome Call detail. Needs who is on the call, what gets covered, what the "
            "new owner should bring, and how it hands off to Sure Start.",
            ref="PH-18",
        ),

        slot("Scheduler", "Schedule Brand Welcome Call", "scheduler:brand-welcome-call"),

        next_block("Continue to your Sure Start introduction."),
    ]),
)

# ---------------------------------------------------------- 6.4 · Thank You

PAGES["06-agreement-stage/04-thank-you.html"] = render(
    title="Thank You For Putting Your Trust In Us",
    eyebrow="Stage 6 · Step 4 of 4",
    h1="Thank You For Putting Your Trust In Us",
    lede="Welcome to 1-Tom-Plumber.",
    body="\n\n".join([
        "  <h2>Sure Start</h2>",

        "  <p>Schedule your formal training introduction with our Sure Start Coordinator "
        "using the link below.</p>",

        slot("Scheduler", "Schedule Sure Start Introduction",
             "scheduler:sure-start-introduction"),

        "  <p>Your relationship with your Franchise Developer does not end here. They remain "
        "your biggest cheerleader. Your Sure Start Coordinator takes over the work of making "
        "sure your business is set up for the highest possible chance of success.</p>",

        "  <h2>Referral Program</h2>",

        ph_block(
            "1TP referral program name and all figures. The original structure was $5,000 per "
            "successful placed referral, a quarterly $1,350 drawing, Reunion travel comp, and "
            "a live $5,000 Reunion drawing, on an April 1 to March 31 award year. Replace "
            "every figure with 1TP's actual program, or remove this section if none exists "
            "yet.",
            ref="PH-06",
        ),

        "  <p><strong>What counts as qualified:</strong></p>",
        "  <ul>\n"
        "    <li>We can verify a prior conversation with the referral</li>\n"
        "    <li>You provided accurate contact information</li>\n"
        "    <li>The referral is a new unit, not a resale or transfer</li>\n"
        "  </ul>",

        "  <p><strong>What does not count:</strong></p>",
        "  <ul>\n"
        "    <li>Existing owners</li>\n"
        "    <li>Anyone already in Lead Development or Franchise Development</li>\n"
        "    <li>Immediate family - spouse, child, or sibling</li>\n"
        "    <li>Yourself</li>\n"
        "  </ul>",

        "  <h2>Thank You</h2>",

        "  <p>The franchise development process can feel long and arduous. But when we slow "
        "down on the front end, we can really speed up on the back end.</p>",

        "  <p>You asked hard questions. You talked to owners. You looked honestly at your "
        "finances and your family. You did the work.</p>",

        "  <p>Welcome to 1-Tom-Plumber.</p>",

        "  <p><strong>- The Franchise Development Team</strong></p>",

        next_block("Your Sure Start Coordinator takes it from here.", label="Last step"),
    ]),
)
