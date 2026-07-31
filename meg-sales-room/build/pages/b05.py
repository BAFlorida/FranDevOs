"""Bucket 5 - Meet The Team Day. Page 5.3 has no source content and ships as a stub."""

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

NO_SOURCE = (
    "COPY PENDING - this page has no source content. Headings and interactive elements "
    "are in place and correct. The prose below each heading has to be written by "
    "1-Tom-Plumber. Nothing here is speculative and nothing should be published as is."
)

# ---------------------------------------------------------------- 5 · index

PAGES["05-meet-the-team-day/index.html"] = render(
    title="Meet The Team Day",
    eyebrow="Stage 5 of 6",
    h1="Meet The Team Day",
    lede="Visit headquarters and meet the team in person.",
    body="\n\n".join([
        "  <p>Meet The Team Day, or MTTD, is the only stage where you travel. You meet the "
        "operations team face to face and see how the business is actually run.</p>",

        "  <p>Four pages sit in this stage: what to expect, the work you complete before you "
        "fly, the event itself, and the assessment you complete afterward.</p>",

        "  <h2>By now the decision is mostly made</h2>",
        "  <p>Candidates sometimes treat MTTD as the moment they decide. It is better "
        "understood as the moment you confirm.</p>",

        "  <blockquote>\n"
        "    <p>Meet The Team Day is more of a validation of a decision you have already "
        "made.</p>\n"
        "  </blockquote>",

        "  <p>You have read the Franchise Disclosure Document, spoken to owners, settled "
        "funding, and been approved by leadership. This is where you meet the people behind "
        "all of it.</p>",

        "  <h2>Two forms before you travel</h2>",
        "  <p>The Pre Meet The Team Day Questionnaire and your behavioral assessment both "
        "have to be complete before you fly. Your Franchise Developer needs time to read "
        "them.</p>",

        milestone("Discovery Day Completed"),

        "  <h2>Steps in this stage</h2>",
        substeps([
            ("01-what-who-to-expect.html", "1", "What / Who to Expect at Meet The Team Day",
             "Handout and org chart"),
            ("02-pre-mttd-questionnaire.html", "2", "Pre Meet The Team Day Questionnaire",
             "2 forms, before travel"),
            ("03-meet-the-team-day.html", "3", "Meet The Team Day", "The event"),
            ("04-post-mttd-assessment.html", "4", "Post Meet The Team Day Assessment",
             "Complete same week"),
        ]),

        next_block("Start with What / Who to Expect, then complete both pre-travel forms."),
    ]),
)

# ------------------------------------------- 5.1 · What / Who to Expect

PAGES["05-meet-the-team-day/01-what-who-to-expect.html"] = render(
    title="What / Who to Expect at Meet The Team Day",
    eyebrow="Stage 5 · Step 1 of 4",
    h1="What / Who to Expect at Meet The Team Day",
    lede="You are meeting the people who will support your business for years, not a sales "
         "team.",
    body="\n\n".join([
        "  <p>Meet The Team Day, or MTTD, puts you in a room with the operations team. These "
        "are the people you will call when a technician quits, when a job goes wrong, or when "
        "you want to open a second territory.</p>",

        "  <p>Learn their names and what each one owns. It makes your first year "
        "easier.</p>",

        video("https://www.youtube.com/embed/LBU9FTGv0NE", "EverSmith Meet The Team Day"),

        slot("Download", "1-Tom-Plumber Meet The Team Day Handout",
             "download:mttd-handout"),

        "  <h2>The operations team</h2>",
        "  <p>The org chart below shows who does what, and specifically what each person owns "
        "in your business after you open.</p>",

        slot("Interactive", "Operations Team org chart", "interactive:operations-org-chart"),

        ph_block(
            "Operations Team org chart pending. Needs real names, real titles, and a plain "
            "statement of what each person owns in the owner's business after opening. A "
            "chart of titles alone does not do the job this page needs.",
            ref="PH-15",
        ),

        "  <h2>What the day is for</h2>",
        "  <p>Three things, in this order.</p>",

        "  <ul>\n"
        "    <li><strong>You evaluate us.</strong> Ask hard questions of the people who will "
        "answer your calls later.</li>\n"
        "    <li><strong>We evaluate fit.</strong> Leadership is forming a view on whether we "
        "can support you well.</li>\n"
        "    <li><strong>You see the operation.</strong> Systems, training, and support look "
        "different in person than on a call.</li>\n"
        "  </ul>",

        "  <h2>How to get value out of it</h2>",
        "  <p>Come with questions written down. The day moves fast and the ones you meant to "
        "ask are the ones you forget.</p>",

        "  <p>Ask about failure, not just success. Ask what happens when an owner falls "
        "behind, and what support actually looks like in that situation.</p>",

        ph_block(SOURCE_PENDING, ref="SRC"),

        next_block("Complete your Pre Meet The Team Day Questionnaire and behavioral "
                   "assessment before you travel."),
    ]),
)

# ------------------------------------- 5.2 · Pre Meet The Team Day Questionnaire

PAGES["05-meet-the-team-day/02-pre-mttd-questionnaire.html"] = render(
    title="Pre Meet The Team Day Questionnaire",
    eyebrow="Stage 5 · Step 2 of 4",
    h1="Pre Meet The Team Day Questionnaire",
    lede="Two forms, both due before you travel. Your Franchise Developer reads them before "
         "you arrive.",
    body="\n\n".join([
        "  <p>These forms shape your day. They tell your Franchise Developer, or FD, what you "
        "still want answered, so the agenda can be pointed at your actual questions.</p>",

        video("https://www.youtube.com/embed/3wI0n4g9eOQ", "EverSmith Pre-MTTD"),

        warn(
            "    <p><strong>Both forms must be complete before you travel.</strong></p>\n"
            "    <p>Submitting them the night before defeats the point. Your FD needs time to "
            "read them and adjust the day.</p>",
            label="Timing",
        ),

        "  <h2>1. Pre Meet The Team Day Questionnaire</h2>",
        "  <p>This captures where you are in your thinking: what you have resolved, what you "
        "have not, and what would need to be true for you to move forward.</p>",

        "  <p>Answer it candidly. An unresolved concern written here becomes an agenda item. "
        "The same concern left unwritten becomes a problem after you sign.</p>",

        slot("Form", "Pre-MTTD Questionnaire", "form:pre-mttd-questionnaire"),

        "  <h2>2. Behavioral assessment</h2>",
        "  <p>If you completed this in Stage 2 with your Qualification Summary, confirm with "
        "your FD whether it needs to be redone.</p>",

        ph_block(
            "Behavioral assessment tool not confirmed. Use the same tool name here as on page "
            "2.1 Qualification Summary. The sales room says Culture Index; the source portal "
            "used DISC. Pick one.",
            ref="PH-10",
        ),

        slot("Form", "Behavioral Assessment", "form:behavioral-assessment"),

        "  <h2>Extra credit: Design Your Life</h2>",
        "  <p>Optional, and worth the time on the flight. This exercise works backward from "
        "the life you want to the business that supports it.</p>",

        "  <p>Most people evaluate a business and then ask how it fits their life. Reversing "
        "that order changes what questions you ask at Meet The Team Day.</p>",

        slot("Video", "Design Your Life", "video:design-your-life"),

        ph_block(SOURCE_PENDING, ref="SRC"),

        next_block("Submit both forms, then review the Meet The Team Day page for travel "
                   "details."),
    ]),
)

# ---------------------------------- 5.3 · Meet The Team Day (NO SOURCE - stub)

PAGES["05-meet-the-team-day/03-meet-the-team-day.html"] = render(
    title="Meet The Team Day",
    eyebrow="Stage 5 · Step 3 of 4",
    h1="Meet The Team Day",
    lede="The event itself: agenda, travel, and what to bring.",
    body="\n\n".join([
        ph_block(NO_SOURCE, ref="NO SOURCE"),

        "  <h2>Agenda</h2>",
        "  <p>A day by day agenda goes here, with times, sessions, and who leads each "
        "one.</p>",

        ph_block(
            "Meet The Team Day agenda and logistics pending. Needs the full day by day "
            "schedule, session titles, and the person leading each session.",
            ref="PH-24",
        ),

        video_pending("MTTD logistics", "video:mttd-logistics"),

        "  <h2>Where you are going</h2>",

        ph_block(
            "Headquarters location pending. Needs the address, the nearest airport, and "
            "recommended hotels.",
            ref="PH-25",
        ),

        "  <h2>Travel: what is covered and what you cover</h2>",
        "  <p>State this plainly and in a table. Candidates budget around it, and ambiguity "
        "here creates friction on an otherwise good day.</p>",

        table(
            "Travel cost responsibility",
            ["Item", "Covered by"],
            [
                ["Airfare", ph("pending", "PH-24")],
                ["Hotel", ph("pending", "PH-24")],
                ["Ground transportation", ph("pending", "PH-24")],
                ["Meals during the event", ph("pending", "PH-24")],
                ["Meals outside the event", ph("pending", "PH-24")],
            ],
        ),

        "  <h2>What to bring</h2>",

        ph_block(
            "What to bring list pending. Cover dress code, documents, notebook, and anything "
            "the candidate is expected to have already read.",
            ref="PH-24",
        ),

        "  <h2>Bringing a spouse or partner</h2>",
        "  <p>Guidance goes here on whether a spouse or partner should attend, which sessions "
        "they join, and what the brand covers for them.</p>",

        ph_block(
            "Spouse and partner guidance pending. This decision affects travel booking, so it "
            "needs to be stated well before the trip.",
            ref="PH-24",
        ),

        "  <h2>Reasons to Become or Not Become a Franchise Owner</h2>",
        "  <p>You will complete this form at the end of the day, when the last speaker "
        "prompts you.</p>",

        warn(
            "    <p><strong>Do not complete this form in advance.</strong></p>\n"
            "    <p>It is filled in at the end of Meet The Team Day, on purpose. Completing "
            "it early defeats the exercise, because the whole point is to capture what you "
            "think after the day rather than before it.</p>",
            label="Do not complete in advance",
        ),

        slot("Form", "Reasons to Become or Not Become a Franchise Owner",
             "form:reasons-to-become-or-not-become-a-franchise-owner"),

        next_block("Complete your Post Meet The Team Day Assessment while the event is still "
                   "fresh."),
    ]),
)

# ------------------------------------------- 5.4 · Post MTTD Assessment

PAGES["05-meet-the-team-day/04-post-mttd-assessment.html"] = render(
    title="Post Meet The Team Day Assessment",
    eyebrow="Stage 5 · Step 4 of 4",
    h1="Post Meet The Team Day Assessment",
    lede="Complete this while the event is fresh. Same week, ideally the same day.",
    body="\n\n".join([
        "  <p>Your Franchise Developer, or FD, reads your responses before your debrief call. "
        "That is what makes the debrief useful rather than generic.</p>",

        "  <p>Memory fades fast and softens edges. The reservation you felt clearly on "
        "Thursday is hard to name by the following Wednesday.</p>",

        slot("Form", "Post-Meet The Team Day Franchise Assessment and Evaluation Form",
             "form:post-mttd-assessment"),

        "  <h2>Answer it honestly</h2>",
        "  <p>This form is not a thank you note. If something concerned you, write it "
        "down.</p>",

        "  <p>A concern raised here gets addressed before you sign anything. The same concern "
        "kept quiet becomes something you live with for years.</p>",

        "  <h2>What happens next</h2>",
        steps([
            "You submit the assessment.",
            "Your FD reviews your responses.",
            "You and your FD hold a debrief call.",
            "If you are both aligned, your file goes to the executive board.",
        ]),

        next_block("Submit your assessment and hold your debrief call. Stage 6 opens with "
                   "Executive Board Approval."),
    ]),
)
