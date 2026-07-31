"""Bucket 5 - Meet The Team Day. Copy transcribed verbatim from bucket_4_5_6.md."""

from shell import (
    next_block, ph_block, render, slot, substeps, video, video_pending,
)

PAGES = {}

# ---------------------------------------------------------------- 5 · index

PAGES["05-meet-the-team-day/index.html"] = render(
    title="Meet The Team Day",
    eyebrow="Stage 5 of 6",
    h1="Meet The Team Day",
    lede="Visit headquarters and meet the team in person.",
    body="\n\n".join([
        "  <p>This is the biggest step in the process.</p>",

        "  <p>You will leave the virtual world behind, come see us in person, meet the "
        "leadership team, tour the operation, and go deep on the business in ways no video "
        "call can match.</p>",

        "  <p>For most candidates, this is when the decision starts to feel real.</p>",

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-what-who-to-expect.html", "1",
             "What / Who to Expect at Meet The Team Day", ""),
            ("02-pre-mttd-questionnaire.html", "2",
             "Pre Meet The Team Day Questionnaire", ""),
            ("03-meet-the-team-day.html", "3", "Meet The Team Day", ""),
            ("04-post-mttd-assessment.html", "4",
             "Post Meet The Team Day Assessment", ""),
        ]),

        next_block("Start with What and Who to Expect."),
    ]),
)

# ------------------------------------------- 5.1 · What / Who to Expect

PAGES["05-meet-the-team-day/01-what-who-to-expect.html"] = render(
    title="What / Who to Expect at Meet The Team Day",
    eyebrow="Stage 5 · Step 1 of 4",
    h1="What / Who to Expect at Meet The Team Day",
    lede="Who you will meet and what to bring.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/LBU9FTGv0NE", "EverSmith Meet The Team Day"),

        "  <h2>Who You Will Meet</h2>",

        ph_block(
            "Operations Team org chart. Needs real names, titles, and what each person owns "
            "in your business after you open.",
            ref="PH-15",
        ),

        "  <h2>Your Workbook</h2>",

        "  <p>Download and bring the workbook below. You will use it throughout the day.</p>",

        slot("Download", "1-Tom-Plumber Meet The Team Day Handout",
             "download:mttd-handout"),

        "  <h2>One Form to Save for Later</h2>",

        "  <p>You will also see a form titled \"Reasons to Become or Not Become a Franchise "
        "Owner.\"</p>",

        "  <p><strong>Do not complete it in advance.</strong> Our last speaker of the day "
        "will prompt you to fill it out near the end of the event, either by QR code or by "
        "button. It is designed to be completed at that moment, with everything you learned "
        "that day fresh.</p>",

        next_block("Complete your pre-event questionnaires before you travel."),
    ]),
)

# ------------------------------------- 5.2 · Pre Meet The Team Day Questionnaire

PAGES["05-meet-the-team-day/02-pre-mttd-questionnaire.html"] = render(
    title="Pre Meet The Team Day Questionnaire",
    eyebrow="Stage 5 · Step 2 of 4",
    h1="Pre Meet The Team Day Questionnaire",
    lede="Two items to complete before you travel.",
    body="\n\n".join([
        video("https://www.youtube.com/embed/3wI0n4g9eOQ", "EverSmith Pre-MTTD"),

        "  <p>Two items must be completed before you attend.</p>",

        slot("Form", "Pre-MTTD Questionnaire", "form:pre-mttd-questionnaire"),

        slot("Form", "Behavioral Assessment", "form:behavioral-assessment"),

        ph_block("confirm behavioral assessment tool", ref="PH-10"),

        "  <h2>Extra Credit - Design Your Life</h2>",

        "  <p>Time to start thinking big.</p>",

        "  <p>Meet The Team Day includes personal development exercises. They are not filler. "
        "They are there because the owners who do best are the ones who know what they are "
        "building toward.</p>",

        "  <p>Watch the video below before you travel. It will put you in the right frame of "
        "mind for the exercises we run on the day.</p>",

        video_pending("Design Your Life", "video:design-your-life"),

        "  <p>This is extra credit. It is not required to advance. We recommend it "
        "anyway.</p>",

        next_block("Complete both questionnaires, then travel to Meet The Team Day."),
    ]),
)

# ---------------------------------------------- 5.3 · Meet The Team Day

PAGES["05-meet-the-team-day/03-meet-the-team-day.html"] = render(
    title="Meet The Team Day",
    eyebrow="Stage 5 · Step 3 of 4",
    h1="Meet The Team Day",
    lede="The event itself.",
    body="\n\n".join([
        video_pending("MTTD logistics", "video:mttd-logistics"),

        ph_block(
            "full MTTD agenda and logistics. Needs day-by-day schedule, headquarters "
            "location, travel arrangements - what is covered versus what the candidate "
            "covers, what to bring, guidance on bringing a spouse or partner.",
            ref="PH-24",
        ),

        "  <h2>Reasons to Become or Not Become a Franchise Owner</h2>",

        "  <p>Our last speaker of the day will prompt you to complete this form near the end "
        "of the event.</p>",

        "  <p><strong>Do not complete it in advance.</strong></p>",

        slot("Form", "Reasons to Become or Not Become a Franchise Owner",
             "form:reasons-to-become-or-not-become-a-franchise-owner"),

        next_block("After the event, complete your Post Meet The Team Day Assessment."),
    ]),
)

# ------------------------------------------- 5.4 · Post MTTD Assessment

PAGES["05-meet-the-team-day/04-post-mttd-assessment.html"] = render(
    title="Post Meet The Team Day Assessment",
    eyebrow="Stage 5 · Step 4 of 4",
    h1="Post Meet The Team Day Assessment",
    lede="Complete while the event is still fresh.",
    body="\n\n".join([
        "  <p>Thank you for making the trip.</p>",

        "  <p>Please complete the assessment below while the event is still fresh. It "
        "captures what you saw, what landed, what did not, and where you stand.</p>",

        slot("Form", "Post-Meet The Team Day Franchise Assessment and Evaluation Form",
             "form:post-mttd-assessment"),

        "  <p>Your Franchise Developer reviews your responses before your debrief call.</p>",

        next_block("Continue to Stage 6, Agreement Stage."),
    ]),
)
