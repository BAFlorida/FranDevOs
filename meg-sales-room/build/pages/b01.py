"""Bucket 1 - Welcome to Your Mutual Evaluation Guide.

Copy is transcribed verbatim from content/pages/bucket_1_2.md. Do not rewrite it.
Only typographic normalisation is applied: em-dashes become a spaced hyphen, per
the house rule in BUILD_PROMPT.md. No words are changed.
"""

from shell import next_block, render, substeps, video

PAGES = {}

# ---------------------------------------------------------------- 1 · index

PAGES["01-welcome/index.html"] = render(
    title="Welcome to Your Mutual Evaluation Guide",
    eyebrow="Stage 1 of 6",
    h1="Welcome to Your Mutual Evaluation Guide",
    lede="Meet the brand and the on-demand plumbing opportunity.",
    body="\n\n".join([
        "  <p>Thank you for taking the time to speak with one of our world class Franchise "
        "Developers.</p>",

        "  <p>This portal is your guide through the Mutual Evaluation Process. Each stage "
        "builds on the one before it, and each unlocks as you and your Franchise Developer "
        "complete the work together.</p>",

        "  <p>The process is deliberately thorough. When we slow down on the front end, we "
        "can really speed up on the back end.</p>",

        video("https://www.youtube.com/embed/fcaSfWLHMh8",
              "1-Tom Mutual Evaluation Room Explanation"),

        video("https://www.youtube.com/embed/hv1-dv84CS0",
              "EverSmith What to Expect on the First Call"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-mep-end-to-end.html", "1", "Mutual Evaluation Process End-to-End", ""),
        ]),

        next_block("Watch the videos above, then continue to the Mutual Evaluation Process "
                   "End-to-End."),
    ]),
)

# ---------------------------------------------- 1.1 · MEP End-to-End

PAGES["01-welcome/01-mep-end-to-end.html"] = render(
    title="Mutual Evaluation Process End-to-End",
    eyebrow="Stage 1 · Step 1 of 1",
    h1="Mutual Evaluation Process End-to-End",
    lede="The full journey, start to finish.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/KvjiPmr-JAw",
              "EverSmith Mutual Evaluation Process End to End"),

        "  <p>The Mutual Evaluation Process runs in six stages.</p>",

        "  <p><strong>Stage 1 - Welcome.</strong> You are here. Meet the brand and understand "
        "how the process works.</p>",

        "  <p><strong>Stage 2 - Brand Overview.</strong> You get the real documents. "
        "Qualification Summary, credit report, and the Franchise Disclosure Document.</p>",

        "  <p><strong>Stage 3 - Validation.</strong> You talk directly to current "
        "1-Tom-Plumber franchise owners. You review funding, territory, and technology.</p>",

        "  <p><strong>Stage 4 - Seeking Approval.</strong> You meet with an executive. If "
        "approved, your Franchise Developer builds your timeline and your sample "
        "agreements.</p>",

        "  <p><strong>Stage 5 - Meet The Team Day.</strong> You come to headquarters and meet "
        "the team in person.</p>",

        "  <p><strong>Stage 6 - Agreement Stage.</strong> Executive Board approval, "
        "execution, and welcome.</p>",

        "  <p>This is a mutual evaluation. We are deciding about each other. At every stage, "
        "either side can say this is not the right fit, and that is a healthy outcome.</p>",

        next_block("Continue to Stage 2, Brand Overview."),
    ]),
)
