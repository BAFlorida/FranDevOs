#!/usr/bin/env python3
"""Subset the three MEG faces to the characters these pages use, then emit
build/fonts.css: @font-face rules with the woff2 inlined as data URIs.

Why: linking fonts.googleapis.com makes the pages depend on an outbound
request. Wherever that request is blocked - a strict CMS, an offline copy,
a page embedded under a content policy - Anton silently falls back to a
generic sans and the display type stops looking like the brand. Embedding
makes the pages genuinely self-contained, which the brief asked for anyway.

Anton, Montserrat and Nunito Sans are all SIL Open Font License, which
permits embedding. The OFL text is kept alongside in fonts/OFL.txt.
"""
import base64, html, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
FONTS = os.path.join(HERE, "fonts")

FACES = [
    ("Anton-400.woff2", "Anton", "400", False),
    ("Poppins-400.woff2", "Poppins", "400", False),
    ("Poppins-500.woff2", "Poppins", "500", False),
    ("Poppins-600.woff2", "Poppins", "600", False),
    ("Poppins-700.woff2", "Poppins", "700", False),
]


def used_characters():
    chars = set()
    for root, _, files in os.walk(DIST):
        for f in files:
            if not f.endswith(".html"):
                continue
            t = open(os.path.join(root, f), encoding="utf-8").read()
            t = re.sub(r"<style>.*?</style>", " ", t, flags=re.S)
            t = re.sub(r"<[^>]+>", " ", t)
            chars |= set(html.unescape(t))
    # Display faces are set in text-transform:uppercase, so the browser needs
    # the uppercase glyph even where the source text is lower case.
    chars |= {c.upper() for c in chars}
    # ASCII printable as a floor, so future copy edits do not silently lose a
    # glyph and fall back mid-word.
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= set("·—–…‘’“”€£°®™✓▶⚙")
    return {c for c in chars if c.isprintable() and not c.isspace()} | {" "}


def main():
    chars = used_characters()
    unicodes = ",".join(f"U+{ord(c):04X}" for c in sorted(chars))
    print(f"  subsetting to {len(chars)} characters")

    blocks, total_before, total_after = [], 0, 0
    for fname, family, weight, variable in FACES:
        src = os.path.join(FONTS, fname)
        before = os.path.getsize(src)
        with tempfile.NamedTemporaryFile(suffix=".woff2", delete=False) as tmp:
            out = tmp.name
        cmd = [sys.executable, "-m", "fontTools.subset", src,
               f"--unicodes={unicodes}", "--flavor=woff2",
               "--layout-features=kern,liga,calt", f"--output-file={out}"]
        if variable:
            # Keep the weight axis so 500/600/700 stay real weights rather
            # than a browser-synthesised faux bold.
            cmd.append("--recalc-bounds")
        subprocess.run(cmd, check=True, capture_output=True)
        data = open(out, "rb").read()
        os.unlink(out)
        after = len(data)
        total_before += before
        total_after += after
        print(f"  {family:12s} {before:>7,}B -> {after:>7,}B")
        b64 = base64.b64encode(data).decode()
        blocks.append(
            f"@font-face{{font-family:'{family}';font-style:normal;"
            f"font-weight:{weight};font-display:swap;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2')}}"
        )

    css = ("/* MEG type system, embedded. Subset by build/subset_fonts.py so the\n"
           "   pages need no outbound font request. SIL Open Font License; see\n"
           "   build/fonts/OFL.txt. Regenerate after changing copy. */\n"
           + "\n".join(blocks))
    with open(os.path.join(HERE, "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write(css)
    print(f"  wrote build/fonts.css  ({total_before:,}B -> {total_after:,}B subset, "
          f"{len(css):,}B base64)")


if __name__ == "__main__":
    main()
