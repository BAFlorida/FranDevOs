"""Parse content/pages/*.md into rendered pages.

The copy is rendered straight from the markdown rather than transcribed by hand,
so the pages cannot drift from the source. Editing a .md file and rebuilding is
the whole workflow.

Source grammar:
  ## PAGE: <path>          page boundary
  **Eyebrow: / H1: / Lede:**
  ### BODY                 start of content
  ### H2: Title            starts a new numbered slide
  ### H3: Title            h4 inside the current slide
  ### GATE - ...           compliance gate, attaches to the current slide
  ### WARNING BLOCK - X    its own slide
  ### SUBSTEP LIST         its own slide
  ### NEXT                 the closing dark card
  **STEPS:** / **TABLE:** / **LIST:**
  [VIDEO:] [VIDEO SLOT - PENDING:] [FORM:] [DOWNLOAD:] [SCHEDULER:] [PLACEHOLDER:]
"""

import html as H
import os
import re

from shell import (
    asset, btnrow, flag, flag_inline, gate, gate_select, next_step, render,
    substeps, table, video, video_slot,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, "content", "pages")

VIDEOS = {
    # EverSmith process videos are brand-neutral and carry across brands.
    "Mutual Evaluation Room Explanation": "fcaSfWLHMh8",
    "ServiceTitan Overview": "kXK6u3O8hCU",
    "EverSmith What to Expect on the First Call": "hv1-dv84CS0",
    "EverSmith Mutual Evaluation Process End to End": "KvjiPmr-JAw",
    "EverSmith Qualification Summary Overview": "GWB3gkycrKw",
    "EverSmith Franchise Disclosure Document Overview": "udCsGBIY1Rs",
    "EverSmith EverConnect": "2gaiZ4BcF8Y",
    "EverSmith Brands CSS": "x32yLyjEPDk",
    "EverSmith Validation Overview": "sIRDGB7yyGE",
    "EverSmith Funding Overview": "0Z9bjsRKN5c",
    "EverSmith Self Funding Overview": "oSIvxdHtO-o",
    "EverSmith Home Equity Funding": "TFpdCqMtxQQ",
    "EverSmith Career Plug": "3aL_T7_3Ojo",
    "EverSmith Meet The Team Day": "LBU9FTGv0NE",
    "EverSmith Pre-MTTD": "3wI0n4g9eOQ",
    "EverSmith Executive Board Approval": "qDuHvclW0kk",
    "EverSmith Agreement Execution": "lcOn6qL1uoo",
    "EverSmith Welcome Call": "1NynLBubPv0",
}

# Iframe title attributes that differ from the caption name.
VIDEO_TITLES = {}

# Maps a placeholder's text to its PLACEHOLDERS.md reference.
PH_REFS = [
    ("selectivity", "PH-01"), ("financial analysis", "PH-02"),
    ("reviews / NPS", "PH-02"), ("productivity", "PH-02"),
    ("resource library", "PH-02"), ("sourcing entity", "PH-04"),
    ("referral program", "PH-06"), ("Item 19", "PH-07"),
    ("background check", "PH-09"), ("behavioral assessment", "PH-10"),
    ("technology fee acknowledgment", "PH-03"), ("procurement", "PH-11"), ("President of 1-Tom-Plumber", "PH-13"),
    ("name], President", "PH-13"), ("executive title", "PH-14"),
    ("org chart", "PH-15"), ("countersignature", "PH-17"),
    ("Brand Welcome Call detail", "PH-18"), ("culture framework", "PH-19"),
    ("podcast", "PH-20"), ("owner call cadence", "PH-21"),
    ("territory design", "PH-22"), ("MTTD agenda", "PH-24"),
]

GATE_IDS = [
    ("Franchise Developer can only speak", "item19"),
    ("signed the Item 23 receipt", "fdd-receipt"),
    ("unique physical address", "address"),
    ("one-time technology fee", "tech-fee-timing"),
    ("Personal Monthly Household Responsibilities", "household-expenses"),
    ("percentage of those expenses", "outside-coverage"),
]

BUCKETS = {
    "01-welcome": (1, "Welcome"),
    "02-brand-overview": (2, "Brand Overview"),
    "03-validation": (3, "Validation"),
    "04-seeking-approval": (4, "Seeking Approval"),
    "05-meet-the-team-day": (5, "Meet The Team Day"),
    "06-agreement-stage": (6, "Agreement Stage"),
}


def ph_ref(text):
    low = text.lower()
    for key, ref in PH_REFS:
        if key.lower() in low:
            return ref
    return None


def gate_id_for(statement):
    for key, gid in GATE_IDS:
        if key.lower() in statement.lower():
            return gid
    return re.sub(r"[^a-z0-9]+", "-", statement.lower())[:28].strip("-")


def esc(t):
    return H.escape(t, quote=False)


def inline(t):
    """Inline markdown -> HTML. Escapes first so source text is never markup."""
    t = esc(t)
    t = re.sub(r"\[PLACEHOLDER:\s*([^\]]+)\]",
               lambda m: flag_inline(m.group(1).strip(), ph_ref(m.group(1))), t)
    t = re.sub(r"\[PLACEHOLDER\]", lambda m: flag_inline("pending"), t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", t)
    return t


ASSET_KINDS = {"FORM": "Form", "DOWNLOAD": "Download", "SCHEDULER": "Scheduler",
               "LINK": "Link"}


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_pages(text):
    pages, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"##\s+PAGE:\s+(\S+)", line)
        if m:
            cur = m.group(1)
            pages[cur] = []
        elif cur is not None:
            pages[cur].append(line)
    return pages


def build_page(rel, lines, all_paths, titles):
    bucket = rel.split("/")[0]
    stage_n, stage_title = BUCKETS[bucket]

    meta = {}
    for line in lines:
        m = re.match(r"\*\*(Eyebrow|H1|Lede):\*\*\s*(.+)", line)
        if m:
            meta[m.group(1)] = m.group(2).strip()

    slides = []           # list of [title, show_h3, [html parts]]
    next_text = ""
    cur = None            # current slide parts
    mode = None           # None | steps | table | list | next | gate | substeps
    buf = []
    gate_kind = None
    gate_fields = {}

    def new_slide(title, show_h3=True):
        nonlocal cur
        cur = [title, show_h3, []]
        slides.append(cur)

    def emit(html):
        if cur is None:
            new_slide(meta.get("H1", ""), show_h3=False)
        cur[2].append(html)

    def flush():
        nonlocal mode, buf, gate_kind, gate_fields
        if mode == "steps" and buf:
            emit("<ol>\n" + "\n".join(f"<li>{inline(b)}</li>" for b in buf) + "\n</ol>")
        elif mode == "list" and buf:
            emit("<ul>\n" + "\n".join(f"<li>{inline(b)}</li>" for b in buf) + "\n</ul>")
        elif mode == "table" and buf:
            rows = [[c.strip() for c in r.strip().strip("|").split("|")] for r in buf]
            caption = cur[0] if cur and cur[0] else meta.get("H1", "")
            # When the slide's visible heading already names the table, the
            # caption is kept for screen readers but not painted twice.
            dup = bool(cur and cur[0] and cur[1])
            emit(table(caption, [esc(c) for c in rows[0]],
                       [[inline(c) for c in r] for r in rows[1:]],
                       caption_hidden=dup))
        elif mode == "substeps" and buf:
            subs = sorted(p for p in all_paths
                          if p.startswith(bucket + "/") and not p.endswith("index.html"))
            items = []
            for i, entry in enumerate(buf):
                t = re.sub(r"^\d+\.\s*", "", entry).strip()
                href = os.path.basename(subs[i]) if i < len(subs) else "#"
                items.append((href, i + 1, esc(t), ""))
            emit(substeps(items))
        elif mode == "gate" and gate_fields.get("Statement"):
            gid = gate_id_for(gate_fields["Statement"])
            heading = gate_fields.get("Label", "Required acknowledgment")
            if gate_kind == "select":
                opts = [o.strip() for o in gate_fields.get("Options", "").split("·")
                        if o.strip()]
                emit(gate_select(gid, esc(gate_fields["Statement"]), [esc(o) for o in opts],
                                 heading=esc(heading),
                                 note=inline(gate_fields["note"]) if gate_fields.get("note")
                                 else None))
            else:
                emit(gate(gid, esc(gate_fields["Statement"]),
                          label=esc(gate_fields.get("Checkbox label", "I understand")),
                          heading=esc(heading)))
        mode, buf, gate_kind, gate_fields = None, [], None, {}

    for raw in lines:
        line = raw.rstrip()
        t = line.strip()

        if re.match(r"\*\*(Eyebrow|H1|Lede):\*\*", t):
            continue

        h = re.match(r"###\s+(.*)", t)
        if h:
            flush()
            head = h.group(1).strip()
            if head == "BODY":
                continue
            if head == "NEXT":
                mode = "next"
                continue
            if head == "SUBSTEP LIST":
                new_slide("Steps in This Stage")
                mode = "substeps"
                continue
            if head.startswith("GATE"):
                mode = "gate"
                gate_kind = "select" if "select" in head.lower() else "ack"
                continue
            if head.startswith("WARNING BLOCK"):
                label = head.split("—", 1)[-1].split("-", 1)[-1].strip() \
                    if ("—" in head or "-" in head[13:]) else "Read This Carefully"
                new_slide(label.title() if label else "Read This Carefully")
                continue
            m2 = re.match(r"H2:\s*(.+)", head)
            if m2:
                new_slide(m2.group(1).strip())
                continue
            m3 = re.match(r"H3:\s*(.+)", head)
            if m3:
                emit(f"<h4>{esc(m3.group(1).strip())}</h4>")
                continue
            continue

        if mode == "next":
            # Take the first real line only. The trailing "---" page separator
            # belongs to the file, not to the copy.
            if t and not re.fullmatch(r"-{3,}", t):
                next_text = t
                mode = None
            continue

        if mode == "gate":
            mg = re.match(r"\*\*(Label|Statement|Checkbox label|Options):\*\*\s*(.+)", t)
            if mg:
                gate_fields[mg.group(1)] = mg.group(2).strip()
                continue
            if t.startswith("*") and t.endswith("*") and not t.startswith("**"):
                body = t.strip("*").strip()
                # Directions to the builder are not candidate copy.
                if not re.match(r"(Render above|This gate exists)", body):
                    gate_fields["note"] = body
                continue
            if not t:
                continue
            flush()

        if not t:
            if mode in ("steps", "list", "table"):
                flush()
            continue

        # A rule of dashes is the markdown file's page separator, not copy.
        if re.fullmatch(r"-{3,}", t):
            continue

        if t == "**STEPS:**":
            flush(); mode = "steps"; continue
        if t == "**TABLE:**":
            flush(); mode = "table"; continue
        if t == "**LIST:**":
            flush(); mode = "list"; continue

        if mode == "steps" and re.match(r"^\d+\.\s", t):
            buf.append(re.sub(r"^\d+\.\s*", "", t)); continue
        if mode == "substeps" and re.match(r"^\d+\.\s", t):
            buf.append(t); continue
        if mode == "table" and t.startswith("|"):
            buf.append(t); continue
        if mode == "list" and t.startswith("- "):
            buf.append(t[2:]); continue

        m = re.match(r"^\[VIDEO SLOT\s*[—-]\s*PENDING:\s*([^\]]+)\]$", t)
        if m:
            flush(); emit(video_slot(esc(m.group(1).strip()))); continue

        m = re.match(r"^\[VIDEO:\s*([^\]]+)\]$", t)
        if m:
            flush()
            name = m.group(1).strip()
            vid = VIDEOS.get(name)
            if not vid:
                raise SystemExit(f"{rel}: no URL known for video {name!r}")
            emit(video(f"https://www.youtube.com/embed/{vid}",
                       esc(VIDEO_TITLES.get(name, name)),
                       caption=f"Watch · {esc(name)}"))
            continue

        m = re.match(r"^\[(FORM|DOWNLOAD|SCHEDULER|LINK):\s*([^\]]+)\]$", t)
        if m:
            flush()
            kind, label = ASSET_KINDS[m.group(1)], m.group(2).strip()
            # An explicit ref slug can follow the label: [LINK: Label | slug].
            ref_slug = None
            if "|" in label:
                label, ref_slug = (s.strip() for s in label.rsplit("|", 1))
            clean = re.sub(r"\s*[—-]\s*PLACEHOLDER:.*$", "", label).strip()
            emit(asset(kind, esc(clean),
                       f"{m.group(1).lower()}:{ref_slug or slugify(clean)}"))
            if "PLACEHOLDER" in label:
                note = re.search(r"PLACEHOLDER:\s*([^\]]+)", label).group(1).strip()
                emit(flag(esc(note), ph_ref(note)))
            continue

        m = re.match(r"^\[PLACEHOLDER:\s*(.+)\]$", t, re.S)
        if m:
            flush()
            body = m.group(1).strip()
            emit(flag(inline(body), ph_ref(body)))
            continue

        # Ordinary paragraph, or a numbered item outside a STEPS block.
        if re.match(r"^\d+\.\s", t) and mode is None:
            if cur and cur[2] and cur[2][-1].startswith("<ol class=\"loose\">"):
                prev = cur[2].pop()
                cur[2].append(prev[:-len("</ol>")]
                              + f"<li>{inline(re.sub(r'^[0-9]+[.] *', '', t))}</li></ol>")
            else:
                emit('<ol class="loose">'
                     f"<li>{inline(re.sub(r'^[0-9]+[.] *', '', t))}</li></ol>")
            continue

        flush()
        emit(f"<p>{inline(t)}</p>")

    flush()

    slides = [s for s in slides if s[2]]

    # John's pages close with the next-step pointer as prose in the final card,
    # not as a separate card, and never use .eyebrow. Match that.
    if next_text and slides:
        slides[-1][2].append(f"<p>{inline(next_text)}</p>")

    # Every button run - singles included - becomes one .btnrow, matching
    # John's pages, so the buttons share a gap and stack uniformly on mobile.
    for sl in slides:
        merged, run = [], []
        for part in sl[2]:
            if part.startswith('<a class="btn"'):
                run.append(part)
                continue
            if run:
                merged.append(btnrow(run))
                run = []
            merged.append(part)
        if run:
            merged.append(btnrow(run))
        sl[2] = merged

    return render(
        title=meta.get("H1", rel),
        stage_n=stage_n,
        stage_title=stage_title,
        h1=esc(meta.get("H1", "")),
        lede=esc(meta.get("Lede", "")),
        slides=[(esc(title), show_h3, "\n".join(parts))
                for title, show_h3, parts in slides],
        next_html="",
    )


def all_pages():
    pages = {}
    for name in sorted(os.listdir(CONTENT)):
        if not name.endswith(".md"):
            continue
        with open(os.path.join(CONTENT, name), encoding="utf-8") as fh:
            pages.update(parse_pages(fh.read()))
    paths = sorted(pages)
    out = {}
    for rel, lines in pages.items():
        out[rel] = build_page(rel, lines, paths, {})
    return out
