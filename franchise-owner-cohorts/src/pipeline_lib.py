"""Shared deterministic helpers for the franchise-owner-cohorts pipeline.

No LLM/API calls belong anywhere in this module or its callers (scripts 01-05, 07).
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_STAGING = PROJECT_ROOT / "data" / "staging"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
CONFIG_DIR = PROJECT_ROOT / "config"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

RAW_INPUT_GLOB = "US-Franchise-Owners-and-Executives-*.csv"

# Punctuation folding for comparison fields. Originals are never altered.
_PUNCT_MAP = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "―": "-", "®": "", "™": "",
    "©": "", "°": "", " ": " ",
}

_CORPORATE_MARKERS = re.compile(
    r"\b("
    r"international inc|international llc|international corp\w*|"
    r"franchising llc|franchising inc|franchising corp\w*|franchise corporation|"
    r"industries inc|industries llc|"
    r"corporate office|corporate hq|franchise hq|world headquarters|home office|franchisor"
    r")\b"
)

LINKEDIN_PERSON_PREFIXES = ("in/", "pub/")


def normalize_text(value: str) -> str:
    """Lowercased comparison form: unicode folded, fancy punctuation normalized,
    ®/™/© stripped, & -> ' and ', accents removed, whitespace collapsed."""
    s = unicodedata.normalize("NFKC", value or "")
    for src, dst in _PUNCT_MAP.items():
        s = s.replace(src, dst)
    s = s.replace("&", " and ")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalize_text(value))


def squash(value: str) -> str:
    return "".join(tokens(value))


def has_corporate_marker(company: str) -> bool:
    # match on the token-joined form so "Franchising, LLC" still hits "franchising llc"
    return bool(_CORPORATE_MARKERS.search(" ".join(tokens(company))))


def normalize_linkedin(url: str) -> str:
    """Canonical comparison form: 'linkedin.com/<path>' lowercased, no scheme/www,
    no query/fragment, no trailing slash. Empty string if blank."""
    s = (url or "").strip().lower()
    if not s:
        return ""
    s = re.sub(r"^https?://", "", s)
    s = re.sub(r"^www\.", "", s)
    m = re.search(r"([a-z]{2,3}\.)?linkedin\.com(/.*)?$", s)
    if not m:
        return s.split("?")[0].split("#")[0].rstrip("/")
    path = (m.group(2) or "").split("?")[0].split("#")[0].rstrip("/")
    return "linkedin.com" + path


def is_valid_person_linkedin(url: str) -> bool:
    norm = normalize_linkedin(url)
    if not norm.startswith("linkedin.com/"):
        return False
    path = norm[len("linkedin.com/"):]
    return path.startswith(LINKEDIN_PERSON_PREFIXES) and len(path.split("/", 1)) > 1


def contains_pattern(haystack_norm: str, pattern_norm: str) -> bool:
    """Word-boundary containment on normalized strings."""
    return f" {pattern_norm} " in f" {haystack_norm} "


def find_token_subsequence(needle: list[str], hay: list[str]) -> int:
    """Index of the first contiguous occurrence of needle in hay, else -1."""
    if not needle or len(needle) > len(hay):
        return -1
    for i in range(len(hay) - len(needle) + 1):
        if hay[i : i + len(needle)] == needle:
            return i
    return -1


@dataclass
class Brand:
    canonical: str
    parent_platform: str
    segment: str
    strict_150k_status: str
    include_in_matching: bool
    bare_name_ambiguous: bool
    aliases: list[str]
    alias_tokens: list[tuple[str, tuple[str, ...]]] = field(default_factory=list)

    def __post_init__(self) -> None:
        seen = set()
        for alias in [self.canonical, *self.aliases]:
            tok = tuple(tokens(alias))
            if tok and tok not in seen:
                seen.add(tok)
                self.alias_tokens.append((alias, tok))


@dataclass
class BrandMatch:
    canonical_brand: str = ""
    matched_alias: str = ""
    match_method: str = "none"  # exact | prefix | contains | none
    confidence: str = "none"  # high | medium | low | none
    local_dba: bool = False
    needs_review: bool = False
    review_reason: str = ""
    segment: str = ""
    parent_platform: str = ""
    strict_150k_status: str = ""


@dataclass
class Exclusion:
    pattern: str
    reason: str
    pattern_norm: str

    @property
    def is_unrelated(self) -> bool:
        return self.reason.strip().lower().startswith("unrelated")


def load_brands(path: Path | None = None) -> list[Brand]:
    path = path or CONFIG_DIR / "approved_brands.csv"
    brands: list[Brand] = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["include_in_matching"].strip().upper() != "TRUE":
                continue
            brands.append(
                Brand(
                    canonical=row["canonical_brand"].strip(),
                    parent_platform=row["parent_platform"].strip(),
                    segment=row["segment"].strip(),
                    strict_150k_status=row["strict_150k_status"].strip(),
                    include_in_matching=True,
                    bare_name_ambiguous=row["bare_name_ambiguous"].strip().upper() == "TRUE",
                    aliases=[a.strip() for a in row["aliases"].split("|") if a.strip()],
                )
            )
    return brands


def load_exclusions(path: Path | None = None) -> list[Exclusion]:
    path = path or CONFIG_DIR / "company_exclusions.csv"
    out: list[Exclusion] = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pat = row["pattern"].strip()
            out.append(Exclusion(pattern=pat, reason=row["reason"].strip(), pattern_norm=normalize_text(pat)))
    return out


def match_exclusion(company: str, exclusions: list[Exclusion]) -> Exclusion | None:
    """First exclusion whose normalized pattern occurs (word-boundary) in the company
    string. Longest patterns first so 'Midas Touch' beats a hypothetical 'Midas'."""
    norm = normalize_text(company)
    comp_tokens = tokens(company)
    for exc in sorted(exclusions, key=lambda e: -len(e.pattern_norm)):
        # word-boundary containment, plus token-subsequence so punctuation variants hit
        if contains_pattern(norm, exc.pattern_norm) or find_token_subsequence(tokens(exc.pattern), comp_tokens) >= 0:
            return exc
    return None


_LOCAL_ENTITY_HINTS = re.compile(
    r"\b(of|llc|inc|dba|d/b/a|store|#|no\.|group|team|corp|company|enterprises|holdings|franchisee?)\b"
)


def match_brand(company: str, brands: list[Brand]) -> BrandMatch:
    """Deterministic best-brand match for one company string.

    Candidate ranking: exact squash equality beats prefix beats contains; longer alias
    token sequences beat shorter. Distinct brands matching the same string routes to
    manual review. Bare single-token aliases of ambiguous brands always route to review.
    """
    comp_tokens = tokens(company)
    comp_squash = squash(company)
    if not comp_tokens:
        return BrandMatch()

    candidates: list[tuple[int, int, int, Brand, str, str, int]] = []
    for brand in brands:
        for alias, alias_tok in brand.alias_tokens:
            if squash(alias) == comp_squash:
                candidates.append((0, -len(alias_tok), 0, brand, alias, "exact", 0))
                continue
            pos = find_token_subsequence(list(alias_tok), comp_tokens)
            if pos == 0:
                candidates.append((1, -len(alias_tok), 0, brand, alias, "prefix", pos))
            elif pos > 0:
                candidates.append((2, -len(alias_tok), pos, brand, alias, "contains", pos))

    if not candidates:
        return BrandMatch()

    candidates.sort(key=lambda c: (c[0], c[1], c[2]))
    _, _, _, brand, alias, method, pos = candidates[0]
    distinct_brands = {c[3].canonical for c in candidates}

    match = BrandMatch(
        canonical_brand=brand.canonical,
        matched_alias=alias,
        match_method=method,
        segment=brand.segment,
        parent_platform=brand.parent_platform,
        strict_150k_status=brand.strict_150k_status,
    )

    alias_len = len(tokens(alias))
    remainder = len(comp_tokens) - (pos + alias_len) if method != "exact" else 0
    match.local_dba = method != "exact" and (
        remainder > 0 or pos > 0 or bool(_LOCAL_ENTITY_HINTS.search(normalize_text(company)))
    )

    if method == "exact":
        match.confidence = "high"
    elif method == "prefix":
        match.confidence = "high"
    else:
        match.confidence = "medium"

    # For generically-named brands, only a qualified multi-token prefix establishes the
    # brand; bare-name equality, exact generic names, and mid-string hits go to review.
    if brand.bare_name_ambiguous and (alias_len == 1 or method in ("contains", "exact")):
        match.needs_review = True
        match.confidence = "low"
        match.review_reason = f"ambiguous brand name match '{alias}' requires context"
    if len(distinct_brands) > 1:
        match.needs_review = True
        match.review_reason = (match.review_reason + "; " if match.review_reason else "") + (
            "multiple brands matched: " + ", ".join(sorted(distinct_brands))
        )
        if match.confidence == "high":
            match.confidence = "medium"

    return match


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def newest_raw_export() -> Path:
    matches = sorted(DATA_RAW.glob(RAW_INPUT_GLOB))
    if not matches:
        raise FileNotFoundError(f"no raw export matching {RAW_INPUT_GLOB} in {DATA_RAW}")
    return matches[-1]
