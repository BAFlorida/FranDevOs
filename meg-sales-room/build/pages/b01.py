"""Bucket 1 - Welcome to Your Mutual Evaluation Guide."""

from shell import (
    gate, milestone, next_block, ph, ph_block, render, slot, substeps, table,
    video,
)

PAGES = {}

# ---------------------------------------------------------------- 1 · index

PAGES["01-welcome/index.html"] = render(
    title="Welcome to Your Mutual Evaluation Guide",
    eyebrow="Stage 1 of 6",
    h1="Welcome to Your Mutual Evaluation Guide",
    lede="Meet the brand and the on-demand plumbing opportunity.",
    body="\n\n".join([
        "  <p>This guide is your working space for the next several weeks. It holds every step, "
        "every document, and every form you will need to evaluate 1-Tom-Plumber.</p>",

        "  <p>We call it a <strong>Mutual Evaluation Process</strong>, or MEP, because the "
        "evaluation runs both directions. You are deciding whether this brand fits your life. "
        "We are deciding whether we can set you up to succeed. Both answers have to be yes.</p>",

        "  <p>Start with this walkthrough of the room itself, then watch what to expect on "
        "your first call.</p>",

        video("https://www.youtube.com/embed/fcaSfWLHMh8",
              "1-Tom Mutual Evaluation Room Explanation"),

        "  <h3>What to expect on the first call</h3>",

        video("https://www.youtube.com/embed/hv1-dv84CS0",
              "EverSmith What to Expect on the First Call"),

        "  <h2>The brand at a glance</h2>",
        "  <p>Facts below come from public disclosure documents and the EverSmith Brands "
        "acquisition announcement. Everything here is verifiable before you go further.</p>",

        table(
            "1-Tom-Plumber brand snapshot",
            ["Item", "Detail"],
            [
                ["Founded", "2018"],
                ["Model", "Emergency plumbing and drain cleaning, commercial-leaning"],
                ["Franchisees", "37"],
                ["Territories", "57"],
                ["States", "22"],
                ["Parent", "EverSmith Brands, backed by The Riverside Company"],
                ["Acquired", "December 2025"],
            ],
        ),

        "  <p>Cost figures live in the Franchise Disclosure Document, which you receive in "
        "Stage 2. We will walk you through that document item by item.</p>",

        "  <h2>How to use this guide</h2>",
        "  <p>Work the stages in order. Each stage ends in a milestone, and that milestone "
        "unlocks the next stage. Nothing here is a race.</p>",
        "  <ul>\n"
        "    <li>Read every page in a stage before you move on.</li>\n"
        "    <li>Complete each form when the page asks for it, not later.</li>\n"
        "    <li>Some pages carry a required acknowledgment. Those are compliance controls, "
        "and they exist to protect you.</li>\n"
        "    <li>Bring every question to your Franchise Developer, the person guiding you "
        "through this process. There are no bad ones.</li>\n"
        "  </ul>",

        milestone("Welcome Completed"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-mep-end-to-end.html", "1", "Mutual Evaluation Process End-to-End",
             "Video"),
        ]),

        next_block("Open the Mutual Evaluation Process End-to-End page and walk the full "
                   "six stages before you start Stage 2."),
    ]),
)

# ---------------------------------------------- 1.1 · MEP End-to-End

PAGES["01-welcome/01-mep-end-to-end.html"] = render(
    title="Mutual Evaluation Process End-to-End",
    eyebrow="Stage 1 · Step 1 of 1",
    h1="Mutual Evaluation Process End-to-End",
    lede="Here is the entire process, start to finish, before you take a single step into it.",
    body="\n\n".join([
        "  <p>The Mutual Evaluation Process, or MEP, runs in six stages. You are in Stage 1 "
        "right now. Each stage ends in a milestone, and each milestone opens the stage after it.</p>",

        "  <p>We show you the whole map first on purpose. You should know what is coming, what "
        "we will ask of you, and where the real decision points sit.</p>",

        video("https://www.youtube.com/embed/KvjiPmr-JAw",
              "EverSmith Mutual Evaluation Process End to End"),

        "  <h2>The six stages</h2>",

        table(
            "The six stages of the Mutual Evaluation Process and their exit milestones",
            ["Stage", "What happens", "Exit milestone"],
            [
                ["1 · Welcome",
                 "Meet the brand and see the full process.",
                 "Welcome Completed"],
                ["2 · Brand Overview",
                 "Qualification Summary, credit and background review, and the Franchise "
                 "Disclosure Document.",
                 "FDD Receipt Signed"],
                ["3 · Validation",
                 "Talk directly to current owners. Work through funding, territory, and "
                 "technology.",
                 "Validation Completed"],
                ["4 · Seeking Approval",
                 "Present your case to executive leadership and build your Development "
                 "Action Plan.",
                 "Executive Approval Received"],
                ["5 · Meet The Team Day",
                 "Travel to headquarters, meet the operations team, and complete your "
                 "assessment.",
                 "Discovery Day Completed"],
                ["6 · Agreement Stage",
                 "Executive board approval, agreement execution, and your welcome call.",
                 "Agreement Executed"],
            ],
        ),

        "  <h2>Each stage gates the next</h2>",
        "  <p>You cannot skip ahead. That is deliberate, and it is the single most important "
        "thing to understand about this process.</p>",

        "  <p>A candidate who reaches Meet The Team Day without doing owner calls is a "
        "candidate making a large decision on thin information. We would rather slow you down "
        "early than watch that happen.</p>",

        "  <blockquote>\n"
        "    <p>When we slow down on the front end, we can really speed up on the back end.</p>\n"
        "  </blockquote>",

        "  <h2>What mutual actually means</h2>",
        "  <p>Most of Stage 2 and Stage 3 is us handing you information. You read the "
        "Franchise Disclosure Document. You call owners we do not script. You look at funding "
        "and territory with real numbers.</p>",

        "  <p>Stage 4 flips it. Your Franchise Developer stops presenting the brand to you and "
        "starts presenting you to the brand. From that point forward, leadership is evaluating "
        "whether we can support you well.</p>",

        "  <h2>How selective this process is</h2>",
        "  <p>Not every candidate who starts this guide is awarded a franchise, and that is by "
        "design. The current figures are being confirmed against 1-Tom-Plumber's own "
        "records.</p>",

        ph_block(
            "Selectivity figures pending. Do not publish a candidate-facing number until "
            "1-Tom-Plumber confirms its own actuals. A wrong figure is worse than no figure.",
            ref="PH-01",
        ),

        "  <h2>What we will ask you for</h2>",
        "  <p>Nothing on this list is a surprise later. Every item below appears in the stage "
        "listed next to it.</p>",

        "  <ul>\n"
        "    <li><strong>Stage 2</strong> - Qualification Summary, a behavioral assessment, "
        "your own credit report pull, and a background check authorization.</li>\n"
        "    <li><strong>Stage 3</strong> - owner call notes, a funding path, two short "
        "financial self-assessments, and territory preferences.</li>\n"
        "    <li><strong>Stage 4</strong> - a Development Action Plan, or DAP, that sets your "
        "timeline and contingencies.</li>\n"
        "    <li><strong>Stage 5</strong> - a pre-visit questionnaire, travel to headquarters, "
        "and a post-visit assessment.</li>\n"
        "    <li><strong>Stage 6</strong> - executed agreements and your funds transfer form.</li>\n"
        "  </ul>",

        "  <h2>Who guides you</h2>",
        "  <p>Your Franchise Developer, or FD, runs this process with you end to end. They "
        "schedule your calls, answer your questions, and prepare you for each stage.</p>",

        "  <p>One limit is worth stating now. Your FD can only discuss financial performance "
        "figures that appear in the Franchise Disclosure Document. Everything else about "
        "money comes from owners, directly. Stage 3 covers that rule in full.</p>",

        next_block("You have finished Stage 1. Move to Stage 2, Brand Overview, and start "
                   "with your Qualification Summary."),
    ]),
)
