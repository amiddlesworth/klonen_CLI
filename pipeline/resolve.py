"""Resolve extracted careers into seed data for the app.

Inputs
  work/registry.json        D-III football programs (crawl.py)
  work/staff.json           current staff per program (crawl.py; titles come from here)
  work/bios_index.json      one row per crawled bio (crawl.py)
  ncaa_members.json         all NCAA members, for matching other colleges
  ncaa_mfb.json             NCAA football sponsors: the football division of each member
  <extract dir>/*.json      extraction output: one array of coach objects per program

Outputs (committed, loaded by `npm run db:seed`)
  data/organizations.json  data/people.json  data/tenures.json
  data/tree_edges.json     data/stats.json

Rules this file enforces (see pipeline/audits/audit1_pipeline_findings.json):
  - Orgs: exact alias matches first; query-side variants mirror the alias rules
    (renamed "X College" -> "X University" merge) but only when the level or a
    state hint confirms; "fuzzy" means the same distinctive words and is also
    confirmed by level/state. Ties that the level cannot break, and anything
    unconfirmed, become an unmatched org (never a guess). Unmatched orgs carry
    the state hint from the name, role or evidence; same-named schools in
    different states stay apart and the stateless rest of such a name is marked
    ambiguous (no tree edges). Placeholders ("Unnamed high school") collapse
    into one unknown org per kind and never form edges.
  - Sport: every stint keeps its sport; football-staff support work tagged as its
    own sport (strength and conditioning, athletic training, sports performance,
    football operations) is football unless the tag names another sport.
    Non-football stints are kept but get roleGroup 'other' and never count for
    edges, head coaches or a person's role.
  - Roles: classify() as documented there; role strings are cleaned (no extractor
    annotations such as '(bio text: ...)' or '(role not stated)'), semicolon-joined
    roles are split into separate stints, and placeholder roles ('Coach', 'Staff')
    stay roleGroup 'other'.
  - Current stint (choose_current): the latest dated open football stint at the
    person's program (title match breaks ties); concurrent roles the title names
    stay open; superseded ones keep the source's end year, which is unknown (None)
    when the source gives none: never an invented end the season before.
  - Slugs (assign_slugs): bare when the name is unique; every namesake gets a
    program suffix; pinned slugs (the demo account) never change.
  - Tree edges: per-season sets, one row per contiguous interval, worked_under
    only in seasons the mentor was head coach and the mentee was on staff,
    worked_alongside never in the same seasons as worked_under, no self edges.

Usage: python3 -I pipeline/resolve.py [extract_dir]
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
DATA = ROOT.parent / "data"
CURRENT_SEASON = 2026

# ------------------------------------------------------------------ helpers
US_STATES = {
    "alabama": "al", "alaska": "ak", "arizona": "az", "arkansas": "ar", "california": "ca", "colorado": "co",
    "connecticut": "ct", "delaware": "de", "district of columbia": "dc", "florida": "fl", "georgia": "ga",
    "hawaii": "hi", "idaho": "id", "illinois": "il", "indiana": "in", "iowa": "ia", "kansas": "ks",
    "kentucky": "ky", "louisiana": "la", "maine": "me", "maryland": "md", "massachusetts": "ma", "michigan": "mi",
    "minnesota": "mn", "mississippi": "ms", "missouri": "mo", "montana": "mt", "nebraska": "ne", "nevada": "nv",
    "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny", "north carolina": "nc",
    "north dakota": "nd", "ohio": "oh", "oklahoma": "ok", "oregon": "or", "pennsylvania": "pa",
    "rhode island": "ri", "south carolina": "sc", "south dakota": "sd", "tennessee": "tn", "texas": "tx",
    "utah": "ut", "vermont": "vt", "virginia": "va", "washington": "wa", "west virginia": "wv",
    "wisconsin": "wi", "wyoming": "wy",
}
POSTAL = set(US_STATES.values())
# AP-style abbreviations, written without dots or spaces ("N.Y." -> "ny", "W. Va." -> "wva")
AP_ABBR = {
    "ala": "al", "ariz": "az", "ark": "ar", "calif": "ca", "cal": "ca", "colo": "co", "conn": "ct", "del": "de",
    "fla": "fl", "ga": "ga", "ill": "il", "ind": "in", "kan": "ks", "kans": "ks", "ky": "ky", "la": "la",
    "md": "md", "mass": "ma", "mich": "mi", "minn": "mn", "miss": "ms", "mo": "mo", "mont": "mt", "neb": "ne",
    "nebr": "ne", "nev": "nv", "nh": "nh", "nj": "nj", "nm": "nm", "ny": "ny", "nc": "nc", "nd": "nd",
    "okla": "ok", "ore": "or", "oreg": "or", "pa": "pa", "penn": "pa", "ri": "ri", "sc": "sc", "sd": "sd",
    "tenn": "tn", "tex": "tx", "va": "va", "vt": "vt", "wash": "wa", "wis": "wi", "wisc": "wi", "wva": "wv",
    "wyo": "wy", "dc": "dc",
}
# Trailing state hints left in a normalized name ("westminster college mo"): kept for exact alias keys
STATE_ABBR = {
    "ala": "al", "ariz": "az", "ark": "ar", "calif": "ca", "colo": "co", "conn": "ct", "del": "de", "fla": "fl",
    "ga": "ga", "ill": "il", "ind": "in", "kan": "ks", "kans": "ks", "ky": "ky", "la": "la", "md": "md",
    "mass": "ma", "mich": "mi", "minn": "mn", "miss": "ms", "mo": "mo", "mont": "mt", "neb": "ne", "nev": "nv",
    "n h": "nh", "n j": "nj", "n m": "nm", "n y": "ny", "n c": "nc", "n d": "nd", "okla": "ok", "ore": "or",
    "pa": "pa", "r i": "ri", "s c": "sc", "s d": "sd", "tenn": "tn", "tex": "tx", "va": "va", "vt": "vt",
    "wash": "wa", "wis": "wi", "w va": "wv", "wyo": "wy", "ohio": "oh", "iowa": "ia", "maine": "me",
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()  # "Muñoz" -> "munoz"
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_org(s: str) -> str:
    s = s.lower().replace("&", " and ").replace("'", "").replace("’", "")
    s = re.sub(r"\bu\.\s?s\.\s", "united states ", s)
    s = re.sub(r"\buniv\b\.?", "university", s)
    s = re.sub(r"\bst\.\s", "saint ", s) if re.match(r"^st\.\s", s) else s
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\b(the|of|at|football|program|team)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def state_code(token: str | None) -> str | None:
    """'Ohio' / 'Pa.' / 'N.Y.' / 'TX' -> two-letter code (lowercase). Postal codes only when written in capitals."""
    if not token:
        return None
    raw = token.strip().strip(",;:()").strip()
    dotted = "." in raw
    raw = raw.strip(".").strip()
    t = re.sub(r"\s+", " ", raw.lower())
    if t in US_STATES:
        return US_STATES[t]
    squeezed = re.sub(r"[.\s]", "", t)
    if squeezed in AP_ABBR and (len(squeezed) > 2 or dotted or raw.isupper()):
        return AP_ABBR[squeezed]
    if re.fullmatch(r"[A-Z]{2}", raw) and raw.lower() in POSTAL:
        return raw.lower()
    return None


_STATE_WORD = r"(?:[A-Z][a-z]+\.?(?:\s[A-Z][a-z]+\.?)?|[A-Z]\.\s?[A-Z]\.|[A-Z]{2})"


def state_hint_in(text: str | None) -> str | None:
    """First US state named as '(Ohio)', '(Fort Wayne, Ind.)' or 'Bethlehem, Pa.' in text."""
    if not text:
        return None
    for m in re.finditer(r"\(([^()]{2,60})\)", text):
        st = state_code(m.group(1).split(",")[-1])
        if st:
            return st
    for m in re.finditer(r"\b[A-Z][\w.'\-]+(?:\s[A-Z][\w.'\-]+){0,2},\s*(" + _STATE_WORD + r")(?=[\s,.;)]|$)", text):
        st = state_code(m.group(1))
        if st:
            return st
    return None


def evidence_state_hint(org_raw: str, evidence: str | None) -> str | None:
    """State named right after the org's first distinctive word in the evidence quote."""
    if not evidence:
        return None
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z'’.\-]+", re.sub(r"\(.*?\)", " ", org_raw))
             if w.lower() not in GENERIC_WORDS and len(w) > 2]
    if not words:
        return None
    m = re.search(re.escape(words[0]), evidence, re.I)
    if not m:
        return None
    return state_hint_in(evidence[m.start(): m.start() + 110])


def level_of(member: dict) -> str:
    d, sub = member["division"], member.get("subdivision")
    if d == 1:
        return "NCAA D-I FBS" if sub == 1 else ("NCAA D-I FCS" if sub == 2 else "NCAA D-I")
    return {2: "NCAA D-II", 3: "NCAA D-III"}[d]


def clean_conference_abbr(abbr: str | None) -> str | None:
    """Drop Wikipedia footnote markers: 'NACC[g]' -> 'NACC'."""
    if not abbr:
        return abbr
    return re.sub(r"\s*\[[^\]]*\]", "", abbr).strip() or None


# Names the alias rules cannot derive: extracted spelling -> NCAA official name
MANUAL_ALIASES = {
    "Hobart College": "Hobart and William Smith Colleges",
    "Hobart": "Hobart and William Smith Colleges",
    "University of Wisconsin-Stout": "University of Wisconsin-Stout Polytechnic",
    "UW-Stout": "University of Wisconsin-Stout Polytechnic",
    "Catholic University of America": "Catholic University",
    "The Catholic University of America": "Catholic University",
    "Sewanee: The University of the South": "University of the South",
    "Sewanee": "University of the South",
    "William Paterson University": "William Paterson University of New Jersey",
    "Buffalo State University": "Buffalo State, State University of New York",
    "Buffalo State College": "Buffalo State, State University of New York",
    "Buffalo State": "Buffalo State, State University of New York",
    "University at Buffalo": "University at Buffalo, the State University of New York",
    "University of Buffalo": "University at Buffalo, the State University of New York",
    "United States Coast Guard Academy": "U.S. Coast Guard Academy",
    "Coast Guard Academy": "U.S. Coast Guard Academy",
    "United States Merchant Marine Academy": "U.S. Merchant Marine Academy",
    "Merchant Marine Academy": "U.S. Merchant Marine Academy",
    "TCNJ": "The College of New Jersey",
    "RPI": "Rensselaer Polytechnic Institute",
    "WPI": "Worcester Polytechnic Institute",
    "MIT": "Massachusetts Institute of Technology",
    "College of William & Mary": "William & Mary",
    "College of William and Mary": "William & Mary",
    "Rutgers University": "Rutgers, The State University of New Jersey, New Brunswick",
    "Rutgers": "Rutgers, The State University of New Jersey, New Brunswick",
    "Marist College": "Marist University",
    "Army West Point": "U.S. Military Academy",
    "Army": "U.S. Military Academy",
    # renamed or merged schools (old name -> current NCAA name)
    "Clarion University of Pennsylvania": "Pennsylvania Western University, Clarion",
    "Clarion University": "Pennsylvania Western University, Clarion",
    "PennWest Clarion": "Pennsylvania Western University, Clarion",
    "California University of Pennsylvania": "Pennsylvania Western University, California",
    "PennWest California": "Pennsylvania Western University, California",
    "Edinboro University": "Pennsylvania Western University, Edinboro",
    "Edinboro University of Pennsylvania": "Pennsylvania Western University, Edinboro",
    "Humboldt State University": "California State Polytechnic University, Humboldt",
    "Texas A&M University-Commerce": "East Texas A&M University",
    "Texas A&M-Commerce": "East Texas A&M University",
    "Castleton University": "Vermont State University Castleton",
    "Castleton State College": "Vermont State University Castleton",
    "Castleton State University": "Vermont State University Castleton",
    "Long Island University-C.W. Post": "Long Island University",
    "Long Island University Post": "Long Island University",
    "Dixie State University": "Utah Tech University",
    "Dixie State College": "Utah Tech University",
    "LIU Post": "Long Island University",
    "LIU C.W. Post": "Long Island University",
    "C.W. Post": "Long Island University",
    "Jamestown College": "University of Jamestown",
    "Emory & Henry College": "Emory & Henry University",
    "Thomas More College": "Thomas More University",
    "Canisius College": "Canisius University",
    "Manhattan College": "Manhattan University",
    "Siena College": "Siena University",
    # common names
    "Virginia Tech": "Virginia Polytechnic Institute and State University",
    "Columbia University": "Columbia University-Barnard College",
    "Southern Illinois University": "Southern Illinois University at Carbondale",
    "Southern Illinois": "Southern Illinois University at Carbondale",
    "Texas A&M University": "Texas A&M University, College Station",
}

# Schools outside the NCAA list that were renamed: old normalized name -> current name
RENAMED = {
    "bluefield college": "Bluefield University",
    "limestone college": "Limestone University",
}

# ------------------------------------------------------------------ sport
NOT_TACKLE = re.compile(r"flag|touch|7v7|\bwomen|\bgirls|unified", re.I)
# Football-staff support work the extractor tags with its own "sport" ('strength and conditioning',
# 'athletic training', 'sports performance', 'football operations'): it is football staff work.
SUPPORT_SPORT = re.compile(
    r"strength|conditioning|athletic (?:performance )?training|(?:sports?|athletic|human) performance|"
    r"performance training|football operations", re.I)
# A support tag that names a genuinely different sport ('basketball (strength and conditioning)',
# 'strength and conditioning (baseball, women's soccer)', 'athletic training / powerlifting') is not football.
DIFFERENT_SPORT = re.compile(
    r"basketball|baseball|softball|soccer|hockey|lacrosse|track|cross country|wrestling|volleyball|swimming|diving|"
    r"tennis|golf|rowing|bowling|rugby|powerlifting|weightlifting|boxing|handball|bobsled|field hockey|\bwomen|\bgirls",
    re.I)


def normalize_sport(raw: str | None) -> str:
    """'football' for any (men's) tackle football, including arena/indoor/sprint/Canadian and
    multi-sport roles that include football, and for football-staff support work (strength and
    conditioning, athletic training, sports performance, football operations) unless the tag names
    another sport; otherwise the extracted sport, lowercased."""
    s = re.sub(r"\s+", " ", (raw or "").strip().lower())
    if not s:
        return "football"
    if "football" in s and not NOT_TACKLE.search(s):
        return "football"
    if SUPPORT_SPORT.search(s) and not DIFFERENT_SPORT.search(s) and not NOT_TACKLE.search(s):
        return "football"
    return s


# ------------------------------------------------------------------ role classification
OFF = r"offens|quarterback|\bqbs?\b|running back|\brbs?\b|wide receiver|receivers|\bwrs?\b|tight end|\btes?\b|offensive line|\bol\b|o-line|h-back|full ?backs?|\bfb\b|slot|pass(ing)? game|run(ning)? game"
DEF = r"defens|linebacker|\blbs?\b|defensive back|secondary|safet|cornerback|\bcbs?\b|\bdbs?\b|defensive line|\bdl\b|d-line|edge|nickel|outside linebacker|inside linebacker|defensive end|defensive tackle"
ST = r"special teams|kicker|punter|kicking|\bst coordinator|\bspecialists?\b|long snap|snappers"
SUPPORT = (r"strength|conditioning|performance|operations|\bops\b|director of|equipment|video|\bfilm|athletic train|manager|"
           r"personnel|recruiting|administrative|nutrition|creative|social media|chaplain|academic|athletic director|"
           r"athletics director|\bad\b|consultant|advis[eo]r|chief of staff|turf|facilit")
HC_PHRASE = re.compile(r"\bhead (football )?coach\b|\bhc\b")
# Qualifiers that make a "head coach" phrase something other than the varsity football head coach
HC_NOT = re.compile(
    r"\b(assistant|associate|asst\.?|assoc\.?|deputy|vice)[\s-]+head\b"
    r"|\b(to|for|under|with) (the )?head (football )?coach"
    r"|\bj\.?v\.?\d*\b|\b(junior varsity|freshmen|freshman|frosh|sophomore|middle school|junior high|youth|grade|b-team|scout team|reserve|developmental|futures)\b"
    r"|\b(flag|touch|7v7|women'?s|girls)\b"
    r"|\binterim\b.*\bfor\b.*\b(games?|weeks?|contests?)\b|\bfor (one|two|three|four|five|six|\d+) (games?|weeks?)\b"
    r"|\b(likely|probably|presumably)\b"
)
LEVEL_QUAL = re.compile(r"\bj\.?v\.?\d*\b|\b(junior varsity|freshmen|freshman|frosh|sophomore|middle school|junior high|youth|grade)\b")
# Words that may stand right before "head coach" in a varsity head coach's title; any other
# word qualifies it into a different job ("Specialist Head Coach", "Futures Head Coach").
HC_PRECEDING_OK = {"interim", "co", "acting", "varsity", "football", "and", "the", "as", "permanent", "executive", "former", "new", "&",
                   "endowed", "family", "chair"}
PLAYER_ROLE = re.compile(
    r"^\s*(player|student-athlete|letterwinner|letterman|walk-on)\b"
    r"(?!\s*(personnel|development|relations|engagement|welfare|programs?|services|evaluation|liaison|experience|performance))",
    re.I,
)
OTHER_SPORT = re.compile(r"\b(soccer|softball|baseball|basketball|wrestling|lacrosse|hockey|track|cross country|volleyball|swimming|tennis|golf|rowing|bowling|rugby)\b")
COORD = re.compile(
    r"\b(offensive|defensive|special teams|run(ning)?( game)?|pass(ing)?( game)?)\s*coordinator"
    r"|\bco-?(offensive|defensive)?[\s-]*coordinator"
    r"|\b(oc|dc|stc|co-?oc|co-?dc)\b"
    r"|\b(assistant|associate|asst\.?|assoc\.?)[\s-]+head (football )?coach"
)
NON_UNIT_COORD = re.compile(r"\b(video|recruiting|academic|camp|community|social media|operations|equipment|travel|personnel|on-campus|game day|instant replay)\b")
GA = re.compile(r"graduate assistant|\bga\b|\bg\.a\.|analyst|quality control|\bqc\b|\bintern\b|internship|student assistant|student coach|volunteer|\bfellow\b")
MANAGER = re.compile(r"student manager|team manager|equipment manager")


def _top_level_split(s: str, seps: str = "/|;") -> list[str]:
    """Split on separators that are not inside parentheses."""
    out, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return [x.strip() for x in out if x.strip()]


def _outside_parens(s: str) -> str:
    out, depth = [], 0
    for ch in s:
        if ch == "(":
            depth += 1
            out.append(" ")
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def _paren_text(s: str) -> str:
    return " ".join(re.findall(r"\(([^()]*)\)", s))


YEAR_PAREN = re.compile(r"\([^()]*\b(?:19|20)\d{2}\b[^()]*\)|\([^()]*\b\d+\s*(?:years?|seasons?)\b[^()]*\)|\([^()]*\b\d+(?:st|nd|rd|th)\s+season[^()]*\)", re.I)


# "(now Offensive Coordinator)", "(previously Linebackers)": notes about other periods of a stint
TEMPORAL_PAREN = re.compile(r"\(\s*(?:now|currently|previously|formerly|later|then|eventually|most recently)\b[^()]*\)", re.I)

# Extractor annotations inside a role's parentheses: '(bio text: Wide Receivers Coach)', '(per bio)',
# '(role not stated)', '(bio says safeties)', '(head coach implied)', '(current title: ...)'. They say
# what the extractor saw or guessed, not the role; the substantive parts of the same parenthesis stay
# ('Assistant Coach (Defensive Line; bio says Offensive Line)' -> 'Assistant Coach (Defensive Line)').
ANNOTATION = re.compile(
    r"\bbio\b|\bper\b|\bnot (?:stated|specified|explicit|named|given|listed)\b|\bunspecified\b|\bimpl(?:ied|ying|ies)\b|"
    r"\blikely\b|\bpresumabl|\bprobabl|\bapparently\b|\bdescrib|\binferred\b|\bunclear\b|\bheader\b|\bcurrent title\b",
    re.I,
)


def strip_annotations(role: str | None) -> str:
    """Drop the extractor-annotation parts of every parenthesis (';'-separated) and empty parentheses."""
    s = role or ""

    def repl(m: re.Match) -> str:
        keep = [seg.strip() for seg in m.group(1).split(";") if seg.strip() and not ANNOTATION.search(seg)]
        return f"({'; '.join(keep)})" if keep else " "

    prev = None
    while prev != s:
        prev, s = s, re.sub(r"\(([^()]*)\)", repl, s)
    return re.sub(r"\s+", " ", s).strip()


CURRENT_TITLE_NOTE = re.compile(r"\((?:[^();]*;\s*)*[^();]*\b(?:current|header) title\b(?:\s+adds)?\s*:?\s*([^();]*)", re.I)
PER_TITLE_NOTE = re.compile(r"[(;]\s*([^();]+?)\s+per (?:the )?(?:staff[- ]page |current |header )?title\b", re.I)


def current_title_note(role: str) -> str | None:
    """The title an extractor note says the staff page gives this stint ('(current title: X)',
    '(header title: X)', '(current title adds X)', '(X per title; ...)'), or None."""
    m = CURRENT_TITLE_NOTE.search(role or "") or PER_TITLE_NOTE.search(role or "")
    return (m.group(1).strip() or None) if m else None


# A role that names no job at all: 'Coach', 'Staff', 'Staff member', 'Coaching staff (under X)',
# 'unspecified'. Kept as roleGroup 'other' (never upgraded to a position coach).
PLACEHOLDER_ONLY = re.compile(
    r"^(?:(?:football|coaching|team|program)\s+)*"
    r"(?:coach(?:ing)?|staff(?:\s+member)?|member|role|position|unspecified|unknown|not stated|(?:role|position|title) not stated|n/?a)"
    r"(?:\s+(?:role|position|staff|member))?(?:\s+under\s+.+)?$",
    re.I,
)


def is_head_coach(role: str) -> bool:
    """Varsity football head coach. The phrase must sit in the title itself, not in a
    parenthetical note, and not be qualified (assistant/associate head coach, JV,
    freshman, flag football, 'to the head coach', 'interim for two games')."""
    r = (role or "").lower()
    if re.search(r"flag football|touch football|women'?s (tackle )?football|women'?s flag", r):
        return False  # a different football program
    for seg in _top_level_split(r):
        out = _outside_parens(seg)
        m = HC_PHRASE.search(out)
        if not m or HC_NOT.search(out):
            continue
        before = re.findall(r"[a-z&]+", out[: m.start()].replace("co-", "co "))
        explicit = re.search(r"head football coach|head coach of football", out)  # named chairs: "Fish Family Head Coach of Football"
        if before and before[-1] not in HC_PRECEDING_OK and not explicit:
            continue
        if LEVEL_QUAL.search(_paren_text(seg)) or re.search(r"\bfor (one|two|three|four|five|six|\d+) (games?|weeks?)", _paren_text(seg)):
            continue
        if OTHER_SPORT.search(out) and "football" not in out:
            continue
        return True
    return False


def classify(role: str, as_player: bool = False) -> tuple[str, str | None]:
    """(roleGroup, unit) for one football role title.

    - head_coach only for the varsity football head coach (see is_head_coach);
      'Head Coach / Assistant AD' is a head coach.
    - 'assistant/associate head coach', offensive/defensive/special teams,
      run game and passing game coordinators are coordinators.
    - a title that names only a position ('Running Backs', 'Defensive Line', 'Fullbacks') is a
      position coach, as is a support title that also names a position.
    - extractor annotations ('(bio says wide receivers)', '(head coach implied)') are not the role.
    - a placeholder that names no job ('Coach', 'Staff', 'unspecified') stays 'other'.
    """
    if as_player:
        return "player", None
    r = re.sub(r"\s+", " ", strip_annotations((role or "").replace("\xa0", " "))).lower().strip()
    if PLAYER_ROLE.match(r):
        return "player", None
    r2 = TEMPORAL_PAREN.sub(" ", YEAR_PAREN.sub(" ", r))  # notes about other seasons do not define this stint's role
    unit = None
    if re.search(ST, r2):
        unit = "special_teams"
    if re.search(DEF, r2):
        unit = "defense"
    if re.search(OFF, r2) and not re.search(r"defens", r2):
        unit = "offense"
    if is_head_coach(r):
        return "head_coach", None
    core = _outside_parens(r2).strip(" .,;:-–")
    if (not core or PLACEHOLDER_ONLY.match(core)) and not unit and not (
            COORD.search(r2) or GA.search(r2) or MANAGER.search(r2) or re.search(SUPPORT, r2)):
        return "other", None
    for seg in _top_level_split(r2):
        if COORD.search(seg) and not LEVEL_QUAL.search(seg):
            m = COORD.search(seg)
            if m.group(0).startswith("co") and NON_UNIT_COORD.search(seg):
                continue  # 'Video Co-Coordinator'
            return "coordinator", unit
    if GA.search(r2):
        return "ga_analyst", unit
    if MANAGER.search(r2) and not re.search(r"\bcoach", r2):
        return "support", "staff"
    if re.search(SUPPORT, r2) and not unit:
        return "support", "staff"
    if re.search(r"coach|coordinator|assistant", r2):
        return "position_coach", unit
    if unit:
        return "position_coach", unit
    return "other", unit


EXCLUDE_TITLES = re.compile(r"student manager|student assistant manager|team manager|^manager$|student worker|intern \(student\)", re.I)

# ------------------------------------------------------------------ role and title strings
_YEAR = r"(?:19|20)\d{2}"
_YEAR_RANGE = rf"{_YEAR}(?:\s*[-–]\s*(?:{_YEAR}|\d{{2}})?|\s*[-–]?\s*present)?"
_COUNT_WORDS = r"one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|several|many"
NOTE_PAREN = re.compile(
    r"\(([^()]*(?:\b(?:19|20)\d{2}\b|\b\d+\s*(?:years?|seasons?)\b|\b\d+(?:st|nd|rd|th)\s+(?:season|year)|"
    rf"\b(?:{_COUNT_WORDS})\s+(?:full\s+)?(?:seasons?|years?)\b|"
    r"\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|final|last)\s+(?:season|year)s?\b|"
    r"not stated|not specified|unspecified|role not|title not|position not|bio (?:also )?says|likely|header|"
    r"part-time|first season)[^()]*)\)",
    re.I,
)
PLACEHOLDER_ROLE = re.compile(r"^(coaching position|not stated|(?:role|position|title) not stated|unknown|unspecified)$", re.I)
ROLE_WORDS = re.compile(
    r"coach|coordinator|assistant|director|analyst|intern|manager|player|staff|line|backs?|receivers?|ends?\b|"
    r"quarterback|linebacker|safet|corner|special teams|kick|punt|snap|offens|defens|scout|video|recruit|strength|"
    r"conditioning|operations|trainer|chief|consultant|advis|head|\bga\b|\bqc\b|fellow|volunteer|secondary|"
    r"specialist|\bol\b|\bdl\b|\blb|\bdb|\bwr|\bte\b|\brb|\bqb|founder|president|owner|teacher|athlet|captain\b",
    re.I,
)
COMMENTARY = re.compile(r"^(position|title|role|sport)?\s*(not stated|not specified|unspecified|unknown)|^team captain$|^captain\b|^bio says|^see ", re.I)
TEMPORAL_PREFIX = re.compile(r"^(?:and\s+)?(now|currently|previously|formerly|later|then|also|eventually|most recently)\b[\s,:]*", re.I)


def _tidy(s: str) -> str:
    s = re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"\s*([/|])\s*", r" \1 ", s)
    s = re.sub(r"(\s*[/|]\s*)+$", "", s)
    s = re.sub(r"^(\s*[/|]\s*)+", "", s)
    s = re.sub(r"(\s/\s)(\s*/\s)+", " / ", s)
    s = re.sub(r"\s+([,;:)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+", " ", s).strip(" ,;:-–")
    return s


def clean_role(raw: str | None) -> str:
    """Display form of a role: no year ranges or season counts (they live in startYear/endYear),
    no extraction notes or extractor annotations ('(bio text: ...)', '(per bio)', '(role not stated)'),
    no trailing '/ coach' artifact, semicolon-joined parts joined with ' / '. A placeholder role
    ('Staff', 'Coach') is kept as written; one that says nothing ('unspecified') becomes ''."""
    s = strip_annotations(re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip())
    s = s.replace("|", "/")
    for _ in range(2):
        s = TEMPORAL_PAREN.sub(" ", NOTE_PAREN.sub(" ", s))
    # year expressions outside parentheses: 'in 2024-25', 'from 2016', '2017-18', '(2025- )'
    s = re.sub(rf"\b(?:in|from|since|by|starting|beginning|through|until)\s+(?:(?:spring|fall|summer)\s+)?{_YEAR_RANGE}", " ", s, flags=re.I)
    s = re.sub(rf"(?:(?:spring|fall|summer)\s+)?\b{_YEAR_RANGE}", " ", s, flags=re.I)
    s = re.sub(r"\b\d+\s*(?:years?|seasons?)\b", " ", s, flags=re.I)
    parts = []
    segs = _top_level_split(s, ";")
    for seg in segs:
        seg = TEMPORAL_PREFIX.sub("", seg.strip())
        seg = re.sub(r"\(([^()]*)\)", lambda m: "(" + m.group(1).replace(";", ",") + ")", seg)
        if not seg or COMMENTARY.search(seg) or (len(segs) > 1 and not ROLE_WORDS.search(seg)):
            continue  # notes such as 'team captain' or 'position not stated' next to the role
        parts.append(seg)
    s = " / ".join(parts)
    s = _tidy(s)
    if re.search(r"coach", re.sub(r"[/|]\s*coach\.?\s*$", "", s, flags=re.I), re.I):
        s = re.sub(r"\s*[/|]\s*coach\.?\s*$", "", s, flags=re.I)  # 'Head Football Coach / coach'
    s = re.sub(r",\s*(?=/)", " ", s)
    s = _tidy(re.sub(r"\s*,\s*$", "", s))
    if not s or PLACEHOLDER_ROLE.match(s):
        return ""
    return s[0].upper() + s[1:] if s[0].islower() else s


def clean_title(raw: str | None) -> str:
    """Current title from a staff page: no '(2025- )', season counts or recruiting territory."""
    s = re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip()
    s = re.sub(r"\s*\bRecruiting (?:States|Area|Areas|Territory|Territories|Regions?)\b\s*[-:–].*$", "", s, flags=re.I)
    s = NOTE_PAREN.sub(" ", s)
    s = re.sub(rf"\(\s*{_YEAR_RANGE}\s*\)", " ", s)
    s = s.replace(" | ", " / ").replace("|", "/")
    return _tidy(s)


def _own_years(seg: str) -> tuple[int, int | None] | None:
    """Years that belong to this role segment as a whole: '(2017-18)', '(from 2023)', '(2026-)',
    '(2022, 2023)', or a trailing 'in 2024-25'. Notes like '(Kickers 2012-2025)' are not."""
    years: list[tuple[int, int | None]] = []
    for m in re.finditer(r"\(\s*([^()]*)\)", seg):
        inner = m.group(1).strip()
        mm = re.fullmatch(rf"(?:from |since |in |starting )?(?:(?:spring|fall|summer) )?({_YEAR})\s*(?:([-–])\s*(?:({_YEAR})|(\d{{2}}))?\s*(?:present)?)?", inner, re.I)
        if mm:
            s = int(mm.group(1))
            if mm.group(3):
                e = int(mm.group(3))
            elif mm.group(4):
                e = int(mm.group(1)[:2] + mm.group(4))
            elif mm.group(2) or re.match(r"(from|since|starting)", inner, re.I):
                e = None
            else:
                e = s
            years.append((s, e))
            continue
        ys = re.fullmatch(rf"{_YEAR}(?:\s*,\s*{_YEAR})+", inner)
        if ys:
            vals = [int(y) for y in re.findall(_YEAR, inner)]
            years.append((min(vals), max(vals)))
    mm = re.search(rf"(?:\b(?:in|from|since)\s+|\s)(?:(?:spring|fall|summer)\s+)?({_YEAR})(?:\s*[-–]\s*({_YEAR}|\d{{2}}))?\s*$", seg, re.I)
    if mm and not years:
        s = int(mm.group(1))
        e2 = mm.group(2)
        e = (int(e2) if e2 and len(e2) == 4 else int(mm.group(1)[:2] + e2) if e2 else (None if re.search(r"(from|since)\s+" + mm.group(1), seg, re.I) else s))
        years.append((s, e))
    if not years:
        return None
    s = min(y[0] for y in years)
    ends = [y[1] for y in years]
    e = None if any(x is None for x in ends) else max(ends)  # type: ignore[type-var]
    return s, e


def split_stint(stint: dict) -> list[dict]:
    """Split a stint whose role joins several roles with ';' into separate stints.

    Segments that carry their own years become stints with those years. Undated
    segments keep the stint's span, except that 'now X' starts after the last dated
    segment and 'previously X' ends before the first one. Without any dated segment
    the stint stays whole (its role is joined with ' / ' by clean_role)."""
    role = (stint.get("role") or "").strip()
    raw_segs = _top_level_split(role, ";")
    keep = [(r, TEMPORAL_PREFIX.sub("", r)) for r in raw_segs]
    keep = [(r, x) for r, x in keep if x and not COMMENTARY.search(x) and ROLE_WORDS.search(x)]
    if len(keep) <= 1:
        return [dict(stint, role_raw=role)]
    start, end = stint.get("start_year"), stint.get("end_year")
    dated, rest, now, before = [], [], [], []
    for raw_seg, seg in keep:
        yrs = _own_years(seg)
        if yrs:
            dated.append((seg, yrs))
        elif re.match(r"^(?:and\s+)?(now|currently)\b", raw_seg, re.I):
            now.append(seg)
        elif re.match(r"^(?:and\s+)?(previously|formerly)\b", raw_seg, re.I):
            before.append(seg)
        else:
            rest.append(seg)
    if not dated:
        return [dict(stint, role_raw=role)]
    out = []
    for seg, (s, e) in dated:
        e2 = e if e is not None else end
        if e2 is not None and e2 < s:
            e2 = s
        out.append(dict(stint, role=seg, role_raw=seg, start_year=s, end_year=e2, split_from=role))
    if rest:
        out.append(dict(stint, role=" / ".join(rest), role_raw=" / ".join(rest), split_from=role))
    if before:
        first = min(s for _, (s, _) in dated)
        e_before = first - 1 if start is None or first - 1 >= start else end
        out.append(dict(stint, role=" / ".join(before), role_raw=" / ".join(before), start_year=start, end_year=e_before, split_from=role))
    if now:
        closed = [e for _, (_, e) in dated if e is not None]
        s_now = start
        if closed and (end is None or max(closed) + 1 <= end):
            s_now = max(closed) + 1
        out.append(dict(stint, role=" / ".join(now), role_raw=" / ".join(now), start_year=s_now, end_year=end, split_from=role))
    return out


# ------------------------------------------------------------------ names
HONORIFIC = re.compile(r"^(?:dr|mr|mrs|ms|coach|rev|reverend|fr|father|pastor|capt|captain|cpt|maj|col|colonel|lt|ltc|lcdr|cdr|cmdr|sgt|ret)\.?\s+", re.I)
SUFFIX = re.compile(r"^(jr|sr|ii|iii|iv)\.?$", re.I)
PARTICLES = {"de", "la", "del", "della", "der", "van", "von", "da", "di", "du", "le", "st.", "st", "mac", "bin", "al"}


def parse_name(raw: str) -> dict:
    """Clean a staff-page name. Returns display fullName (suffix kept, class years,
    credentials and honorifics removed), firstName, lastName and the slug base."""
    s = re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip()
    s = re.split(r"\s*,?\s*[‘’'`]\d{2}(?!\d)", s)[0]  # "Mike Smith '09", "Tucker Buzzell '24, '24G", "Tim Viall '23M"
    s = re.sub(r",\s*(?:ph\.?\s?d|ed\.?\s?d|dpt|m\.?s|m\.?a|mba|m\.?ed|atc|lat|cscs|rscc|usaw|sccc|pt|md|esq)\b\.?.*$", "", s, flags=re.I)
    while HONORIFIC.match(s) and len(s.split()) > 2:
        s = HONORIFIC.sub("", s, count=1)
    s = re.sub(r"\.\s+(jr|sr)\b", r" \1", s, flags=re.I)  # "Roy Dangel. Jr."
    s = re.sub(r",\s*(jr|sr|ii|iii|iv)\b", r" \1", s, flags=re.I)  # "Chris Rutledge, Jr."
    s = s.strip(" ,")
    tokens = s.split(" ")
    core = [t for t in tokens if not SUFFIX.match(t) and not re.match(r"^[\"“”(].*[\"“”)]$", t)]
    if not core:
        core = tokens
    first = core[0] if core else None
    if first and first.lower().rstrip(".") == "st" and len(core) > 2:  # "St. Clair Ryan"
        first, core = f"{core[0]} {core[1]}", [f"{core[0]} {core[1]}"] + core[2:]
    last = None
    if len(core) > 1:
        i = len(core) - 1
        while i > 1 and core[i - 1].lower() in PARTICLES:
            i -= 1
        last = " ".join(core[i:])
    return {"fullName": s, "firstName": first, "lastName": last, "slug": slugify(" ".join(core)) or slugify(s)}


# ------------------------------------------------------------------ years
NUMBER_WORDS = ("one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|"
                "seventeen|eighteen|nineteen|twenty|thirty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|"
                "tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|twentieth")
DURATION = re.compile(rf"\b(?:\d+|{NUMBER_WORDS}|\d+(?:st|nd|rd|th))[- ](?:full |straight |consecutive |more |plus )?(?:seasons?|years?|campaigns?)\b", re.I)


def evidence_has_year(evidence: str | None, year: int | None) -> bool:
    if not evidence or year is None:
        return False
    if str(year) in evidence:
        return True
    yy = str(year)[2:]
    return bool(re.search(rf"[‘’']{yy}\b|\b(?:19|20)\d\d\s*[-–/]\s*{yy}\b|\b{yy}\s*[-–/]\s*\d\d\b", evidence))


def years_explicit(stint: dict) -> bool:
    """The extractor's years_explicit, unless the evidence quote lacks the start year and the
    year was derived from a duration ('third season', '11 years')."""
    flag = bool(stint.get("years_explicit"))
    start, ev = stint.get("start_year"), stint.get("evidence") or ""
    if not flag:
        return False
    if start is None:
        return stint.get("end_year") is not None and evidence_has_year(ev, stint.get("end_year"))
    if not evidence_has_year(ev, start) and DURATION.search(ev):
        return False
    return True


# ------------------------------------------------------------------ bio excerpt
LABEL_LINE = re.compile(r"^(title|phone|email|e-mail|alma mater|hometown|education|experience|career|coaching career|playing career|highlights|at a glance|personal)\b.*:?$|:$", re.I)
INLINE_LABEL = re.compile(r"^[A-Z][\w'’/&.\- ]{1,32}:\s")  # 'Favorite Verse: ...', 'Hometown: ...'
YEAR_LINE = re.compile(r"^(\d{4}|[•\-*])")
CONTINUES = re.compile(r"\b(the|a|an|of|at|and|in|for|with|to|as|on|by|from|his|her|their|its|was|is|has|had|named|under|coach)$", re.I)


def _paragraphs(body: str) -> list[str]:
    """Re-join lines that inline tags split apart ('Bill Culpepper' / 'joined the staff ...')."""
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    out: list[str] = []
    for line in lines:
        if out:
            prev = out[-1]
            joins = (not re.search(r"[.!?:;\"”)]$", prev)) and (
                re.match(r"^[a-z0-9,;:.)’'\-]", line) or CONTINUES.search(prev) or (len(prev) < 40 and re.match(r"^[a-z]", line))
            )
            if joins and not LABEL_LINE.search(prev) and not INLINE_LABEL.match(line):
                out[-1] = f"{prev} {line}"
                continue
        out.append(line)
    return out


def bio_excerpt(bio_file: Path | None, first: str | None = None, last: str | None = None, max_len: int = 280) -> str | None:
    """First narrative sentence(s) of a bio that mention the person, verbatim, at most max_len characters."""
    if not bio_file or not bio_file.exists():
        return None
    text = bio_file.read_text()
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    names = [n for n in (first, last) if n and len(n) > 1]
    name_re = re.compile(r"\b(" + "|".join(re.escape(n.strip(".")) for n in names) + r")\b", re.I) if names else None
    for line in _paragraphs(body):
        if len(line) < 90 or LABEL_LINE.search(line) or INLINE_LABEL.match(line) or YEAR_LINE.match(line) or "@" in line:
            continue
        if not re.match(r"^[A-Z0-9\"“]", line):
            continue  # a fragment that starts mid-sentence
        if not re.search(r"\b[a-z]{2,} [a-z]{2,} [a-z]{2,}\b", line):  # prose, not a run of titles
            continue
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z\"“])", line)
        out = ""
        for sent in sentences:
            if len(out) + len(sent) + 1 > max_len:
                break
            out = f"{out} {sent}".strip()
        if not out:
            cut = line[:max_len].rsplit(" ", 1)[0]
            out = cut.rstrip(",;:") + "…"
        if name_re is not None and not name_re.search(out):
            continue  # team stats, scripture, program blurbs: not about this person
        return out
    return None


# ------------------------------------------------------------------ organizations
GENERIC_WORDS = {"university", "college", "colleges", "the", "of", "at", "and", "institute", "school", "high", "hs"}
FUZZY_GENERIC = {"university", "college", "colleges", "the", "of", "at", "and", "institute"}
HS_NAME = re.compile(r"high school|\bhs\b|preparatory|\bprep\b|middle school|junior high|school district|\bisd\b", re.I)
RANK = {"strong": 3, "weak": 2, "prefix": 1}
LEAGUE_TAG = re.compile(
    r"^(nfl|cfl|xfl|usfl|ufl|aaf|ifl|afl|af2|nal|ecfl|wfa|nfl europe|nfl europa|arena league|arena football league|"
    r"indoor football league|german football league|gfl|mason-dixon league|national arena league|elf)$",
    re.I,
)
PLACEHOLDER_ORG = re.compile(r"\b(unnamed|unknown|unspecified|not specified|not named|not stated|undisclosed)\b|^various\b|^multiple\b", re.I)
PLACEHOLDERS = {
    "high_school": ("org-unknown-high-school", "Unnamed high school", "high school"),
    "college": ("org-unknown-college", "Unnamed college", None),
    "pro": ("org-unknown-pro", "Unnamed professional team", "pro/semi-pro"),
    "other": ("org-unknown-other", "Unnamed organization", None),
}
COLLEGE_LEVELS = ("NAIA", "NJCAA/JUCO", "NCAA D-I FBS", "NCAA D-I FCS", "NCAA D-II", "NCAA D-III")
YOUNGER = re.compile(r"middle school|junior high|intermediate school|elementary|\bjr\.? high\b|\bgrade\b", re.I)
NOT_A_SCHOOL = re.compile(
    r"athletic association|activities association|federation|recruiting|prospects|scouting|sports performance|"
    r"\bperformance\b|\btraining\b|fitness|\bgym\b|\bspeed\b|\bcamps?\b|clinic|youth academy|youth football|pop warner|"
    r"\baau\b|all-star|\bbowl\b|combine|sports info",
    re.I,
)
PRO_WORDS = re.compile(r"\b(nfl|cfl|xfl|usfl|ufl|aaf|ifl|afl|arena|indoor football|football league|semi-pro|professional|league)\b", re.I)
NON_FOOTBALL_PRO = re.compile(r"\b(soccer|baseball|basketball|hockey|lacrosse|softball|rugby|mlb|nba|nhl|mls|wnba|ironpigs)\b", re.I)
HS_WORDS = re.compile(r"high school|\bhs\b|preparatory|\bprep\b|secondary school|christian school|catholic school|school district|\bisd\b|academy", re.I)
COLLEGE_WORDS = re.compile(r"university|college|community college|institute of technology|states military academy|naval academy|air force academy|coast guard academy|merchant marine academy|maritime academy", re.I)


def org_query(raw: str) -> dict:
    """Pieces of an extracted org name used for matching and for unmatched keys."""
    raw = re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip()
    hint = None
    keep_parens = []
    for inner in re.findall(r"\(([^()]*)\)", raw):
        st = state_code(inner.split(",")[-1])
        if st and hint is None:
            hint = st
        elif not st and not LEAGUE_TAG.match(inner.strip()):
            keep_parens.append(inner)
    no_tags = re.sub(r"\s*\(([^()]*)\)", lambda m: "" if (state_code(m.group(1).split(",")[-1]) or LEAGUE_TAG.match(m.group(1).strip())) else m.group(0), raw).strip()
    base = re.sub(r"\s*\(.*?\)", "", raw).strip()
    n_full = norm_org(raw)
    n_state = n_full
    for k, v in STATE_ABBR.items():
        n_state = re.sub(rf"\b{k}$", v, n_state)
    n_key = norm_org(RENAMED.get(norm_org(no_tags), no_tags))
    # "Clarion University of Pennsylvania" and "Clarion University" are one name (as in the alias rules);
    # the stripped state is a state hint. Not when what remains is a state name ("Indiana University").
    m = re.match(r"^(.*\S) (?:of )?(pennsylvania|new jersey|new york|illinois)$", n_key)
    if m and not (set(m.group(1).split()) - FUZZY_GENERIC) <= set(" ".join(US_STATES).split()):
        n_key = m.group(1)
        hint = hint or US_STATES[m.group(2)]
    return {"raw": raw, "hint": hint, "n_full": n_full, "n_state": n_state, "n_base": norm_org(base),
            "key_name": no_tags, "n_key": n_key}


def distinctive(n: str) -> frozenset:
    return frozenset(w for w in n.split() if w not in FUZZY_GENERIC)


class OrgIndex:
    def __init__(self, registry: list[dict], members: list[dict], mfb: list[dict] | None = None):
        self.orgs: dict[str, dict] = {}
        self.alias: dict[str, dict[str, str]] = defaultdict(dict)
        self.by_tokens: dict[frozenset, set[str]] = defaultdict(set)
        self.flags: dict[str, set[str]] = defaultdict(set)
        football = {m["orgId"]: m for m in (mfb or [])}
        reg_by_ncaa = {p["ncaa_org_id"]: p for p in registry}
        for m in members:
            reg = reg_by_ncaa.get(m["orgId"])
            oid = f"ncaa-{m['orgId']}"
            name = re.sub(r"\s+", " ", m["nameOfficial"]).strip()
            short = reg["short_name"] if reg else re.sub(r"^(the )?", "", name, flags=re.I)
            state = (m["memberOrgAddress"]["state"] or "").strip() or None
            org = {
                "id": oid, "slug": reg["slug"] if reg else slugify(name), "name": name,
                "shortName": short, "nickname": reg["nickname"] if reg else None, "kind": "college",
                "level": level_of(football.get(m["orgId"]) or m),  # football division when the school sponsors football
                "conference": (m.get("conferenceName") or "").strip() or None,
                "conferenceAbbr": clean_conference_abbr(reg["conference_abbr"]) if reg else None,
                "state": state, "athleticsUrl": reg["athletics_url"] if reg else (
                    f"https://{m['athleticWebUrl'].replace('https://', '').replace('http://', '').strip('/')}" if m.get("athleticWebUrl") else None),
                "ncaaOrgId": m["orgId"], "inRegistry": bool(reg),
            }
            self.orgs[oid] = org
            for alias, kind in self._aliases(name, short, state or "").items():
                self._add(alias, oid, kind)
            for n in (norm_org(re.sub(r"\s*\(.*?\)", "", name)), norm_org(re.sub(r"\s*\(.*?\)", "", short))):
                if distinctive(n):
                    self.by_tokens[distinctive(n)].add(oid)
        for alias, official in MANUAL_ALIASES.items():
            for o in list(self.orgs.values()):
                if o["name"] == official:
                    self._add(norm_org(alias), o["id"], "strong")
        self._slugs = {o["slug"] for o in self.orgs.values()}
        self.stats: Counter = Counter()

    def _add(self, alias: str, oid: str, kind: str) -> None:
        if len(alias) <= 2:
            return
        cur = self.alias[alias].get(oid)
        if cur is None or RANK[kind] > RANK[cur]:
            self.alias[alias][oid] = kind

    @staticmethod
    def _aliases(official: str, short: str, state: str) -> dict[str, str]:
        """Normalized alias -> 'strong' (names the school), 'weak' (derived; needs the level or a
        state to agree) or 'prefix' ('University of X' -> 'X'; never matched by stripped queries)."""
        out: dict[str, str] = {}

        def add(a: str, kind: str) -> None:
            if a and len(a) > 2 and (a not in out or RANK[kind] > RANK[out[a]]):
                out[a] = kind

        base = re.sub(r"\s*\(.*?\)", "", official).strip()  # "Central College (Iowa)" -> "Central College"
        short_base = re.sub(r"\s*\(.*?\)", "", short).strip()
        add(norm_org(official), "strong")
        add(norm_org(short), "strong")
        add(norm_org(base), "weak" if base != official else "strong")
        add(norm_org(short_base), "weak" if short_base != short else "strong")
        if "," in base:  # "Buffalo State, State University of New York" -> "Buffalo State"
            head = norm_org(base.split(",")[0])
            add(head, "weak" if head.startswith("university") else "strong")
        o = norm_org(base)
        m = re.match(r"state university new york (at |college at |college )?(.+)$", o)
        if m:
            x = m.group(2)
            for a in (f"suny {x}", f"{x} state", f"suny college {x}", f"state university new york college {x}"):
                add(a, "strong")
            add(x, "weak")
        m = re.match(r"university (\w+) (\w+)$", o)  # "university wisconsin whitewater" -> "wisconsin whitewater"
        if m:
            add(f"{m.group(1)} {m.group(2)}", "weak")
        if o.startswith("university wisconsin "):
            add("uw " + o.split("university wisconsin ")[1], "weak")
        for suffix in (" university", " college", " colleges"):
            if o.endswith(suffix):
                add(o[: -len(suffix)], "weak")
        if o.startswith("university "):
            add(o[len("university "):], "prefix")
        if state:
            add(f"{norm_org(short)} {state.lower()}", "strong")
            add(f"{norm_org(short_base)} {state.lower()}", "strong")
            add(f"{norm_org(base)} {state.lower()}", "strong")  # "King's College (Pa.)" -> "kings college pa"
        stripped = re.sub(r" (of )?(pennsylvania|new jersey|new york|illinois)$", "", norm_org(base))
        if stripped != norm_org(base):
            add(stripped, "weak")  # "East Stroudsburg University of Pennsylvania" -> "east stroudsburg university"
        return out

    @staticmethod
    def query_variants(n: str) -> list[str]:
        """Query-side forms that mirror the alias rules (renamed 'Utica College' -> 'utica')."""
        out = []
        m = re.match(r"^(?:suny|state university new york)(?: college)?(?: at)? (.+)$", n)
        if m:
            out += [m.group(1), f"suny {m.group(1)}"]
        for suffix in (" colleges", " college", " university"):
            if n.endswith(suffix):
                out.append(n[: -len(suffix)])
        stripped = re.sub(r" (of )?(pennsylvania|new jersey|new york|illinois)$", "", n)
        if stripped != n:
            out.append(stripped)
        return [v for v in out if len(v) > 2 and v != n]

    def _pick(self, cands: dict[str, str], level: str | None, hint_name: str | None, hint_ev: str | None,
              tier: str) -> tuple[str | None, str]:
        def st(o: str) -> str:
            return (self.orgs[o]["state"] or "").lower()

        if hint_name:
            cands = {o: k for o, k in cands.items() if st(o) == hint_name}
        elif hint_ev and not (tier == "exact" and any(k == "strong" for k in cands.values()) and len(cands) == 1):
            cands = {o: k for o, k in cands.items() if st(o) == hint_ev}
        if not cands:
            return None, "state-mismatch"
        hint = hint_name or hint_ev

        def confirmed(o: str, k: str) -> bool:
            if tier == "exact" and k == "strong":
                return True
            return self.orgs[o]["level"] == level or bool(hint and st(o) == hint)

        good = {o: k for o, k in cands.items() if confirmed(o, k)}
        if not good:
            return None, "unconfirmed"
        if len(good) == 1:
            return next(iter(good)), tier
        strong = [o for o, k in good.items() if k == "strong"]
        if len(strong) == 1:
            return strong[0], tier
        pool = strong or list(good)
        same = [o for o in pool if self.orgs[o]["level"] == level]
        if len(same) == 1:
            return same[0], tier
        if hint:
            by_state = [o for o in (same or pool) if st(o) == hint]
            if len(by_state) == 1:
                return by_state[0], tier
        return None, "ambiguous"

    def match(self, raw: str, level: str | None, hint_ev: str | None = None) -> tuple[str | None, str]:
        """(ncaa org id, how) or (None, why not). Never guesses between tied candidates."""
        q = org_query(raw)
        if level == "high school" or HS_NAME.search(q["raw"]):
            return None, "none"  # a school below college level is never an NCAA member
        hint_name = q["hint"]
        exact: dict[str, str] = {}
        keys = [q["n_full"], q["n_state"], q["n_base"]] + ([f"{q['n_base']} {hint_name}"] if hint_name else [])
        for key in keys:
            for oid, kind in self.alias.get(key, {}).items():
                if oid not in exact or RANK[kind] > RANK[exact[oid]]:
                    exact[oid] = kind
        why = "none"
        if exact:
            oid, why = self._pick(exact, level, hint_name, hint_ev, "exact")
            if oid:
                return oid, "exact"
            if why == "ambiguous":
                return None, why
        variants: dict[str, str] = {}
        for key in self.query_variants(q["n_base"]):
            for oid, kind in self.alias.get(key, {}).items():
                if kind != "prefix":
                    variants[oid] = max(kind, variants.get(oid, kind), key=lambda k: RANK[k])
        if variants:
            oid, why2 = self._pick(variants, level, hint_name, hint_ev, "variant")
            if oid:
                return oid, "variant"
            why = why2 if why == "none" else why
        toks = distinctive(q["n_base"])
        fuzzy = {o: "weak" for o in self.by_tokens.get(toks, set())} if toks else {}
        if fuzzy:
            oid, why3 = self._pick(fuzzy, level, hint_name, hint_ev, "fuzzy")
            if oid:
                return oid, "fuzzy"
            why = why3 if why == "none" else why
        return None, why


def org_kind(name: str, levels: list[str]) -> str:
    """Kind of an unmatched org: name rules that override the level (middle schools and junior
    highs, associations, recruiting services, training businesses, camps and all-star games are
    'other'; non-football pro teams stay 'pro' but are flagged), then the level its stints were
    given, then the name."""
    known = [l for l in levels if l and l not in ("unknown", "other")]
    top = Counter(known).most_common(1)[0][0] if known else None
    if YOUNGER.search(name):
        return "other"
    if NOT_A_SCHOOL.search(name):
        return "pro" if top == "pro/semi-pro" and PRO_WORDS.search(name) else "other"
    if top == "high school":
        return "high_school"
    if top in COLLEGE_LEVELS:
        return "college"
    if top == "pro/semi-pro":
        return "pro"
    if HS_WORDS.search(name) and not re.search(r"university|college\b", name, re.I):
        return "high_school"
    if COLLEGE_WORDS.search(name):
        return "college"
    if PRO_WORDS.search(name):
        return "pro"
    return "other"


def org_level(kind: str, levels: list[str]) -> str | None:
    known = [l for l in levels if l and l not in ("unknown", "other")]
    if kind == "high_school":
        return "high school"
    if kind == "pro":
        return "pro/semi-pro"
    if kind == "college":
        col = [l for l in known if l in COLLEGE_LEVELS]
        return Counter(col).most_common(1)[0][0] if col else None
    return None


def placeholder_kind(raw: str, level: str | None) -> str:
    if level == "high school" or re.search(r"high school|\bhs\b|scholastic|school", raw, re.I):
        return "high_school"
    if level in COLLEGE_LEVELS or re.search(r"college|university|ncaa|conference", raw, re.I):
        return "college"
    if level == "pro/semi-pro" or PRO_WORDS.search(raw):
        return "pro"
    return "other"


def assign_unmatched(core: str, infos: list[dict]) -> None:
    """Give every unmatched stint of one normalized name an org key (id, state).

    Stints with a state hint go to '<name>-<state>'. For a college name with a single
    hinted state, unhinted stints join it unless their level disagrees. Otherwise the
    unhinted stints share '<name>' (split by level when the levels conflict), and that org
    is marked ambiguous when the name is known to belong to several schools (different
    states hinted, conflicting levels, or tied NCAA candidates): it gets no tree edges."""
    base_id = "org-" + (slugify(core)[:80] or "unnamed")
    names = Counter(i["q"]["key_name"] for i in infos)
    kind = org_kind(names.most_common(1)[0][0], [i["level"] for i in infos])
    states = sorted({i["hint"] for i in infos if i["hint"]})
    for i in infos:
        if i["hint"]:
            i["key"] = (base_id + "-" + i["hint"], i["hint"])
    nostate = [i for i in infos if not i["hint"]]
    if not nostate:
        return
    tied = any(i["how"] == "ambiguous" for i in nostate)
    if kind == "college" and len(states) == 1 and not tied:
        st = states[0]
        bucket = {i["level"] for i in infos if i["hint"] == st and i["level"] in COLLEGE_LEVELS}
        rest = []
        for i in nostate:
            if i["level"] not in COLLEGE_LEVELS or not bucket or i["level"] in bucket:
                i["key"] = (base_id + "-" + st, st)
            else:
                rest.append(i)
        nostate = rest
        if not nostate:
            return
    known = sorted({i["level"] for i in nostate if i["level"] in COLLEGE_LEVELS})
    if kind == "college" and len(known) > 1:  # Southwestern College (KS, NAIA) and (CA, NJCAA): never one org
        for i in nostate:
            lvl = i["level"] if i["level"] in COLLEGE_LEVELS else None
            i["key"] = (base_id + ("-" + slugify(lvl) if lvl else ""), None)
            i["ambiguous"] = not lvl or tied
        return
    for i in nostate:
        i["key"] = (base_id, None)
        i["ambiguous"] = bool(states) or tied


# ------------------------------------------------------------------ spans and edges
def span(t: dict) -> tuple[int, int] | None:
    """Seasons a tenure covers. Being on the current staff page means the current season even
    when the start year is unknown; a past stint with only one year covers that year."""
    s, e = t.get("startYear"), t.get("endYear")
    if t.get("isCurrent"):
        s = CURRENT_SEASON if s is None else min(s, CURRENT_SEASON)
        return s, CURRENT_SEASON
    if s is None and e is None:
        return None
    if s is None:
        return e, e
    if e is None:
        return s, s
    return (s, e) if e >= s else (s, s)


def intervals(years: set[int]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for y in sorted(years):
        if out and y == out[-1][1] + 1:
            out[-1] = (out[-1][0], y)
        else:
            out.append((y, y))
    return out


def edge_eligible(t: dict, no_edge_orgs: set[str]) -> bool:
    return (not t["asPlayer"] and t.get("sport", "football") == "football"
            and t["roleGroup"] not in ("other", "player") and t["orgId"] not in no_edge_orgs)


def build_edges(tenures: list[dict], no_edge_orgs: set[str] = frozenset()) -> list[dict]:
    """worked_under: seasons the mentor was head coach and the mentee was on that staff (not
    also head coach). worked_alongside: seasons both were on staff and neither was head coach.
    One row per contiguous run of seasons; never both kinds for the same pair and season."""
    seasons: dict[str, dict[str, list[set[int]]]] = defaultdict(lambda: defaultdict(lambda: [set(), set()]))
    for t in tenures:
        if not edge_eligible(t, no_edge_orgs):
            continue
        sp = span(t)
        if not sp:
            continue
        seasons[t["orgId"]][t["personId"]][0 if t["roleGroup"] == "head_coach" else 1] |= set(range(sp[0], sp[1] + 1))
    edges = []
    for oid in sorted(seasons):
        ppl = seasons[oid]
        ids = sorted(ppl)
        for a in ids:
            hc_a, st_a = ppl[a]
            for b in ids:
                if a == b:
                    continue
                hc_b, st_b = ppl[b]
                for lo, hi in intervals((hc_a & st_b) - hc_b):
                    edges.append({"kind": "worked_under", "mentorId": a, "menteeId": b, "orgId": oid, "startYear": lo, "endYear": hi})
                if a < b:
                    for lo, hi in intervals((st_a & st_b) - hc_a - hc_b):
                        edges.append({"kind": "worked_alongside", "mentorId": a, "menteeId": b, "orgId": oid, "startYear": lo, "endYear": hi})
    return edges


# ------------------------------------------------------------------ people
def _norm_text(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


TITLE_STOP = {"coach", "coaches", "assistant", "asst", "football", "and", "of", "the", "coordinator"}


def _title_tokens(s: str) -> set[str]:
    return set(_norm_text(s).split()) - TITLE_STOP


def _title_overlap(role: str, title: str) -> float:
    """Share of the role's distinctive words that the staff-page title also uses."""
    a, b = _title_tokens(role), _title_tokens(title)
    return len(a & b) / len(a) if a else 0.0


def _stint_key(s: dict) -> tuple:
    return (_norm_text(s.get("org")), _norm_text(s.get("role")), s.get("start_year"), s.get("end_year"), bool(s.get("as_player")))


QUALITY = {"full": 2, "thin": 1, "none": 0, None: 0}


def merge_records(records: list[dict]) -> dict:
    """One coach object from several bio pages of the same person."""
    records = sorted(records, key=lambda c: (-QUALITY.get(c.get("bio_quality"), 0), -len(c.get("stints") or [])))
    primary = dict(records[0])
    stints = list(primary.get("stints") or [])
    seen = {_stint_key(s) for s in stints}
    for other in records[1:]:
        for s in other.get("stints") or []:
            if _stint_key(s) not in seen:
                seen.add(_stint_key(s))
                stints.append(s)
        if not primary.get("alma_mater") and other.get("alma_mater"):
            primary["alma_mater"] = other["alma_mater"]
    primary["stints"] = stints
    primary["merged_urls"] = [c.get("bio_url") for c in records[1:]]
    return primary


def same_person_across_programs(a: dict, b: dict) -> bool:
    """Two bio pages at different programs describe one person when they share the alma mater
    or a dated stint (same org and years)."""
    if a.get("alma_mater") and _norm_text(a["alma_mater"]) == _norm_text(b.get("alma_mater")):
        return True
    dated = {(_norm_text(s.get("org")), s.get("start_year"), s.get("end_year")) for s in a.get("stints") or [] if s.get("start_year")}
    return any((_norm_text(s.get("org")), s.get("start_year"), s.get("end_year")) in dated for s in b.get("stints") or [] if s.get("start_year"))


# ------------------------------------------------------------------ slugs
# Slugs other records depend on: the coach demo account is p-justin-leatherman (web/scripts/seed.ts,
# docs/ARCHITECTURE.md). The pinned person keeps the bare slug even if a namesake appears.
PINNED_SLUGS = {"justin-leatherman": "ncaa-2751"}


def assign_slugs(people: list[tuple[str, str, str, str]]) -> list[str]:
    """Stable person slugs from (name slug, name suffix like 'jr' or '', program slug, program id).

    A name slug that only one person has stays bare ('justin-leatherman'). When two or more people
    share it, EVERY one of them gets a program suffix ('liam-murphy-nichols', 'liam-murphy-hobart'),
    so a bare slug never changes meaning between runs as people are added or reordered. Namesakes at
    the same program are told apart by the name suffix ('mike-smith-jr-hobart'). Pinned slugs
    (PINNED_SLUGS) keep the bare form for the pinned person."""
    count = Counter(base for base, _, _, _ in people)
    pinned_owner = {}
    for i, (base, _, _, prog_id) in enumerate(people):
        if PINNED_SLUGS.get(base) == prog_id and base not in pinned_owner:
            pinned_owner[base] = i
    want = []
    for i, (base, suffix, prog_slug, _) in enumerate(people):
        if pinned_owner.get(base) == i or (count[base] == 1 and base not in pinned_owner):
            want.append(base)
        else:
            want.append(f"{base}-{prog_slug}")
    # namesakes at one program ('Mike Smith' and 'Mike Smith Jr.'): add the name suffix
    dup = Counter(want)
    for i, (base, suffix, prog_slug, _) in enumerate(people):
        if dup[want[i]] > 1 and suffix:
            want[i] = f"{base}-{suffix}-{prog_slug}"
    out, used = [None] * len(people), set()
    # suffixed slugs first, so a bare slug can never take a namesake's program-suffixed slug
    for i in sorted(range(len(people)), key=lambda i: (want[i] == people[i][0], i)):
        slug = want[i]
        while slug in used:
            slug += "-x"
        used.add(slug)
        out[i] = slug
    return out  # type: ignore[return-value]


# ------------------------------------------------------------------ current stint
def choose_current(rows: list[dict], prog_id: str, title: str, pid: str, url: str | None) -> tuple[dict, bool]:
    """Pick (and mark) the current stint among a person's tenure rows; returns (current, staff_page_only).

    The current stint is the latest dated open football stint at the person's program (the staff-page
    title breaks ties). The other open stints there are no longer held, except a concurrent role the
    title still names (it runs to the current season). A superseded stint keeps the end year the source
    states; when the source gives none, its end stays unknown (None): we never invent continuous tenure
    up to the season before the current role, so its span is only its known season(s).
    Without an open bio stint, the staff page alone gives an undated current stint."""
    open_rows = [r for r in rows if r["orgId"] == prog_id and not r["asPlayer"] and r["sport"] == "football"
                 and r["roleGroup"] != "other" and r["endYear"] in (None, CURRENT_SEASON)
                 and (r["startYear"] is None or r["startYear"] <= CURRENT_SEASON)]
    if not open_rows:  # e.g. only 'Staff (role not stated)': still listed on the staff page
        open_rows = [r for r in rows if r["orgId"] == prog_id and not r["asPlayer"] and r["sport"] == "football"
                     and r["endYear"] in (None, CURRENT_SEASON) and (r["startYear"] is None or r["startYear"] <= CURRENT_SEASON)]
    if not open_rows:
        g, u = classify(title, False)
        current = {"personId": pid, "orgId": prog_id, "role": title or "Coach", "roleGroup": g, "unit": u,
                   "sport": "football", "startYear": None, "endYear": None, "isCurrent": True, "asPlayer": False,
                   "yearsExplicit": False, "evidence": f"Listed on the current staff page as {title}" if title else None,
                   "sourceUrl": url, "verified": False, "_fromBio": False}
        rows.append(current)
        return current, True
    title_is_hc = is_head_coach(title)
    current = max(open_rows, key=lambda r: (
        (r["roleGroup"] == "head_coach") == title_is_hc if title else True,  # agrees with the staff page on head coach
        _title_overlap(r["role"], title) >= 0.5,  # names the current title
        r["startYear"] is not None, r["startYear"] or 0, _title_overlap(r["role"], title),
        len(_title_tokens(r["role"]) & _title_tokens(title))))
    for r in open_rows:
        if r is current:
            continue
        if r["startYear"] is not None and _title_overlap(r["role"], title) >= 0.6:
            r["endYear"] = CURRENT_SEASON  # a concurrent role the staff-page title still names
        elif (r["startYear"] is not None and r["endYear"] is None and r.get("_splitFrom")
              and r.get("_splitFrom") == current.get("_splitFrom") and r.get("evidence") == current.get("evidence")):
            # another part of the current stint's own open-ended source role
            # ('Wide Receivers / Tight Ends; Recruiting Coordinator (since 2023)', 2019-): the source says it is still held
            r["endYear"] = CURRENT_SEASON
        # else: no longer held. Its endYear is what the source says (None: when it ended is unknown,
        # which is not the season before the current role started)
    current["isCurrent"] = True
    current["endYear"] = None
    return current, False


def apply_staff_title(current: dict, title: str) -> list[str]:
    """The staff page is the current source. The current stint takes the staff-page title (role,
    roleGroup and unit) when the bio's role for it disagrees on head coach ('head_coach'), when the
    extractor noted that the staff page names a different job ('noted': 'Running Backs Coach (current
    title: Co-Offensive Coordinator)'), or when the bio names no job ('placeholder': 'Staff', 'Coach
    (role not stated)'). Returns the reasons applied."""
    if not title:
        return []
    reasons = []
    note = current.get("_titleNote")
    if note:
        g, u = classify(note, False)
        g, u = (g, u) if g != "other" else classify(title, False)
        if g != "other" and (g, u) != (current["roleGroup"], current["unit"]):
            current["role"], current["roleGroup"], current["unit"] = title, g, u
            reasons.append("noted")
    hc_conflict = is_head_coach(title) != (current["roleGroup"] == "head_coach")
    placeholder = current["roleGroup"] == "other" and classify(title, False)[0] != "other"
    if hc_conflict or placeholder:
        current["role"] = title
        current["roleGroup"], current["unit"] = classify(title, False)
        reasons.append("head_coach" if hc_conflict else "placeholder")
    return reasons


# ------------------------------------------------------------------ main
def main(extract_dir: Path) -> dict:
    registry = json.loads((WORK / "registry.json").read_text())
    for p in registry:
        p["conference_abbr"] = clean_conference_abbr(p.get("conference_abbr"))
    reg_by_id = {p["id"]: p for p in registry}
    reg_by_short = {p["short_name"].lower(): p for p in registry}
    members = json.loads((ROOT / "ncaa_members.json").read_text())
    mfb = json.loads((ROOT / "ncaa_mfb.json").read_text())
    bios = {b["url"]: b for b in json.loads((WORK / "bios_index.json").read_text())} if (WORK / "bios_index.json").exists() else {}
    staff_rows = json.loads((WORK / "staff.json").read_text()) if (WORK / "staff.json").exists() else []
    staff_title = {s["url"]: s["title"] for r in staff_rows for s in r["staff"]}
    staff_listed = {(r["program_id"], s["url"]) for r in staff_rows for s in r["staff"]}
    idx = OrgIndex(registry, members, mfb)
    stats_extra: Counter = Counter()

    # ------------------------------------------------------------ coach objects
    coaches, seen_urls, duplicate_urls = [], set(), []
    for f in sorted(extract_dir.glob("*.json")):
        for c in json.loads(f.read_text()):
            url = c.get("bio_url")
            if url in seen_urls:
                duplicate_urls.append(url)  # validate_extract reports these; keep the first, but say so
                continue
            seen_urls.add(url)
            coaches.append(c)
    if duplicate_urls:
        print(f"warning: {len(duplicate_urls)} duplicate coach objects for one bio_url were skipped: {duplicate_urls[:5]}", file=sys.stderr)

    excluded = 0
    records = []
    for c in coaches:
        url = c.get("bio_url")
        title = clean_title(staff_title.get(url) or c.get("current_title") or "")
        if EXCLUDE_TITLES.search(title) or c.get("exclude"):
            excluded += 1
            continue
        prog = reg_by_id.get(bios.get(url, {}).get("program_id") or c.get("program_id") or "") or reg_by_short.get((c.get("program") or "").lower().replace("_", " "))
        if not prog:
            continue
        nm = parse_name(c["name"])
        records.append({**c, "_prog": prog, "_title": title, "_name": nm, "_key": (nm["slug"], (nm["fullName"].split()[-1].lower() if SUFFIX.match(nm["fullName"].split()[-1]) else ""))})

    # one person per (program, name): two bio pages for one coach become one record
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in records:
        groups[(r["_prog"]["id"], r["_key"])].append(r)
    merged = []
    for (_, _), rs in groups.items():
        if len(rs) > 1:
            stats_extra["people_merged_same_program"] += len(rs) - 1
            m = merge_records(rs)
            if not m["_title"]:
                m["_title"] = next((x["_title"] for x in rs if x["_title"]), "")
            merged.append(m)
        else:
            merged.append(rs[0])
    # the same person at two programs (shared alma mater or dated stints)
    by_name: dict[tuple, list[dict]] = defaultdict(list)
    for r in merged:
        by_name[r["_key"]].append(r)
    final = []
    for key, rs in by_name.items():
        used = [False] * len(rs)
        for i, r in enumerate(rs):
            if used[i]:
                continue
            group = [r]
            for j in range(i + 1, len(rs)):
                if not used[j] and rs[j]["_prog"]["id"] != r["_prog"]["id"] and same_person_across_programs(r, rs[j]):
                    group.append(rs[j])
                    used[j] = True
            if len(group) > 1:
                stats_extra["people_merged_across_programs"] += len(group) - 1

                def latest_open(x: dict) -> int:
                    ys = [s.get("start_year") or 0 for s in x.get("stints") or [] if s.get("end_year") in (None, CURRENT_SEASON)]
                    return max(ys) if ys else 0
                group.sort(key=lambda x: -latest_open(x))
                m = merge_records(group)
                m["_prog"], m["_title"], m["_name"] = group[0]["_prog"], group[0]["_title"], group[0]["_name"]
                final.append(m)
            else:
                final.append(r)
    final.sort(key=lambda r: (r["_prog"]["id"], r.get("bio_url") or ""))
    # extraction order (slugs do not depend on it: see assign_slugs)
    order = {c.get("bio_url"): i for i, c in enumerate(coaches)}
    final.sort(key=lambda r: order.get(r.get("bio_url"), 0))

    # ------------------------------------------------------------ stints and org matching (phase 1)
    pending = []  # (person index, stint dict, query info)
    people_src = []
    for pi, c in enumerate(final):
        prog = c["_prog"]
        stints = []
        for s in c.get("stints", []):
            if not s.get("org"):
                continue
            if not s.get("as_player") and PLAYER_ROLE.match(s.get("role") or ""):
                s = dict(s, as_player=True)
            for part in split_stint(s):
                if part is not s and part.get("split_from"):
                    stats_extra["stints_split_from_semicolon_roles"] += 1
                stints.append(part)
        people_src.append(c)
        for s in stints:
            raw, level = s["org"], s.get("level")
            if PLACEHOLDER_ORG.search(raw):
                kind = placeholder_kind(raw, level)
                pending.append((pi, s, {"placeholder": kind}))
                continue
            q = org_query(raw)
            hint_ev = evidence_state_hint(raw, s.get("evidence")) or state_hint_in(s.get("role"))
            oid, how = idx.match(raw, level, hint_ev)
            idx.stats[how] += 1
            pending.append((pi, s, {"oid": oid, "how": how, "q": q, "hint": q["hint"] or hint_ev, "level": level}))

    # ------------------------------------------------------------ unmatched orgs (phase 2)
    groups_u: dict[str, list[dict]] = defaultdict(list)
    for _, _, info in pending:
        if "placeholder" in info or info["oid"]:
            continue
        groups_u[info["q"]["n_key"] or norm_org(info["q"]["raw"])].append(info)
    for core, infos in groups_u.items():
        assign_unmatched(core, infos)
    unmatched: dict[str, dict] = {}
    for _, s, info in pending:
        if "key" not in info:
            continue
        oid, st = info["key"]
        u = unmatched.setdefault(oid, {"names": Counter(), "levels": [], "state": st, "ambiguous": False})
        u["names"][info["q"]["key_name"]] += 1
        u["levels"].append(info["level"])
        u["ambiguous"] = u["ambiguous"] or bool(info.get("ambiguous"))
        info["oid"] = oid
    for oid, u in unmatched.items():
        name = sorted(u["names"].items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        canonical = RENAMED.get(norm_org(name))
        if canonical:
            name = canonical
        kind = org_kind(name, u["levels"])
        slug = slugify(name + (f" {u['state']}" if u["state"] else ""))[:80] or oid[4:]
        while slug in idx._slugs:
            slug += "-x"
        idx._slugs.add(slug)
        idx.orgs[oid] = {"id": oid, "slug": slug, "name": name, "shortName": name, "nickname": None,
                         "kind": kind, "level": org_level(kind, u["levels"]),
                         "conference": None, "conferenceAbbr": None, "state": u["state"].upper() if u["state"] else None,
                         "athleticsUrl": None, "ncaaOrgId": None, "inRegistry": False}
        idx.stats["new"] += 1
        if u["ambiguous"]:
            idx.flags[oid].add("ambiguous")
        if kind == "pro" and NON_FOOTBALL_PRO.search(name):
            idx.flags[oid].add("non_football")
    for _, s, info in pending:
        if "placeholder" in info:
            oid, name, level = PLACEHOLDERS[info["placeholder"]]
            if oid not in idx.orgs:
                idx.orgs[oid] = {"id": oid, "slug": oid[4:], "name": name, "shortName": name, "nickname": None,
                                 "kind": info["placeholder"], "level": level, "conference": None, "conferenceAbbr": None,
                                 "state": None, "athleticsUrl": None, "ncaaOrgId": None, "inRegistry": False}
                idx._slugs.add(oid[4:])
            idx.flags[oid].add("placeholder")
            info["oid"] = oid
            idx.stats["placeholder"] += 1

    # ------------------------------------------------------------ people and tenures
    stints_by_person: dict[int, list[tuple[dict, dict]]] = defaultdict(list)
    for pi, s, info in pending:
        stints_by_person[pi].append((s, info))
    people, tenures = [], []
    hc_title_conflicts = []
    slugs = assign_slugs([(c["_name"]["slug"], c["_key"][1], c["_prog"]["slug"], c["_prog"]["id"]) for c in people_src])
    stats_extra["people_with_program_suffixed_slug"] = sum(1 for c, s in zip(people_src, slugs) if s != c["_name"]["slug"])
    for base, prog_id in PINNED_SLUGS.items():
        owners = [s for c, s in zip(people_src, slugs) if c["_name"]["slug"] == base and c["_prog"]["id"] == prog_id]
        if not owners:
            print(f"warning: pinned person {base} ({prog_id}) is missing; the demo seed needs p-{base}", file=sys.stderr)
        assert not owners or owners[0] == base, f"pinned slug {base} changed to {owners[0]}"
    for pi, c in enumerate(people_src):
        prog, title, nm = c["_prog"], c["_title"], c["_name"]
        url = c.get("bio_url")
        slug = slugs[pi]
        pid = "p-" + slug
        rows = []
        for s, info in stints_by_person[pi]:
            oid = info["oid"]
            as_player = bool(s.get("as_player"))
            sport = normalize_sport(s.get("sport"))
            role_raw = s.get("role_raw") or s.get("role") or ""
            role = clean_role(s.get("role") or "") or ("Player" if as_player else "Coach")
            if as_player:
                g, u = "player", None
            elif sport != "football":
                g, u = "other", None  # kept, but never a football role, edge or head coach
            else:
                g, u = classify(role_raw, False)
            ye = years_explicit(s)
            if bool(s.get("years_explicit")) and not ye:
                stats_extra["years_explicit_downgraded"] += 1
            rows.append({
                "personId": pid, "orgId": oid, "role": role, "roleGroup": g, "unit": u, "sport": sport,
                "startYear": s.get("start_year"), "endYear": s.get("end_year"), "isCurrent": False, "asPlayer": as_player,
                "yearsExplicit": ye, "evidence": s.get("evidence"), "sourceUrl": url, "verified": False,
                "_fromBio": True, "_splitFrom": s.get("split_from"), "_titleNote": current_title_note(s.get("role") or ""),
            })
        current, staff_only = choose_current(rows, prog["id"], title, pid, url)
        if staff_only:
            stats_extra["current_from_staff_page_only"] += 1
        if title and is_head_coach(title) != (current["roleGroup"] == "head_coach"):
            hc_title_conflicts.append({"personId": pid, "title": title, "currentRole": current["role"], "roleGroup": current["roleGroup"]})
        for reason in apply_staff_title(current, title):
            stats_extra[f"current_role_from_staff_title_{reason}"] += 1
        # corroboration: the bio's current stint and the program's staff page agree
        if current["_fromBio"] and ((prog["id"], url) in staff_listed or any((prog["id"], u) in staff_listed for u in c.get("merged_urls") or [])):
            current["verified"] = True
        rows.sort(key=lambda r: (not r["isCurrent"], -(r["startYear"] or 0)))
        for i, r in enumerate(rows):
            r["sortOrder"] = i
        people.append({
            "id": pid, "slug": slug, "fullName": nm["fullName"], "firstName": nm["firstName"], "lastName": nm["lastName"],
            "currentOrgId": prog["id"], "currentTitle": title or None, "roleGroup": current["roleGroup"], "unit": current["unit"],
            "almaMater": c.get("alma_mater"), "hometown": None, "about": None,
            "bioExcerpt": bio_excerpt(ROOT / bios[url]["file"], nm["firstName"], nm["lastName"]) if url in bios else None,
            "bioQuality": c.get("bio_quality"), "sourceUrl": url, "claimed": False, "isDemo": False,
        })
        tenures += rows

    # ------------------------------------------------------------ cross-bio corroboration
    # A stint is also verified when another coach's evidence at the same org, in overlapping
    # seasons, names this person: by full name, or by a last name that no other coach there in
    # those seasons shares ("served as an assistant under Girardi" -> Girardi's stint).
    names = {p["id"]: p for p in people}
    by_org = defaultdict(list)
    for t in tenures:
        by_org[t["orgId"]].append(t)
    for oid, ts in by_org.items():
        if oid in idx.flags and idx.flags[oid] & {"placeholder", "ambiguous"}:
            continue
        for a in ts:
            p = names[a["personId"]]
            sa = span(a)
            if a["verified"] or not p["lastName"] or a["asPlayer"] or a["sport"] != "football" or not sa:
                continue
            full = re.compile(rf"\b{re.escape(p['firstName'])}\s+(?:\w\.\s+)?{re.escape(p['lastName'])}\b", re.I)
            last = re.compile(rf"\b{re.escape(p['lastName'])}\b(?!['\u2019]s? (?:son|daughter|brother|father))")
            for b in ts:
                if b["personId"] == a["personId"] or not b.get("evidence"):
                    continue
                sb = span(b)
                if not sb or max(sa[0], sb[0]) > min(sa[1], sb[1]):
                    continue
                ev = b["evidence"]
                if full.search(ev):
                    a["verified"] = True
                elif len(p["lastName"]) >= 4 and last.search(ev) and names[b["personId"]]["lastName"] != p["lastName"]:
                    lo, hi = max(sa[0], sb[0]), min(sa[1], sb[1])
                    namesakes = {t["personId"] for t in ts if names[t["personId"]]["lastName"] == p["lastName"]
                                 and span(t) and max(span(t)[0], lo) <= min(span(t)[1], hi)}
                    a["verified"] = namesakes == {a["personId"]}
                if a["verified"]:
                    stats_extra["verified_by_other_bio"] += 1
                    break
    for t in tenures:
        t.pop("_fromBio", None)

    # ------------------------------------------------------------ org flags, kinds and levels
    org_sports = defaultdict(set)
    for t in tenures:
        org_sports[t["orgId"]].add(t["sport"])
    for oid, sports in org_sports.items():
        if oid.startswith("org-") and "football" not in sports and idx.orgs[oid]["kind"] == "pro":
            idx.flags[oid].add("non_football")
    no_edge_orgs = {oid for oid, f in idx.flags.items() if f & {"placeholder", "ambiguous", "non_football"}}

    # ------------------------------------------------------------ tree edges
    tree = build_edges(tenures, no_edge_orgs)

    # ------------------------------------------------------------ head-coach invariant
    staffed = defaultdict(list)
    for p in people:
        staffed[p["currentOrgId"]].append(p)
    exceptions = []
    for oid, ppl in sorted(staffed.items()):
        hcs = [p for p in ppl if p["roleGroup"] == "head_coach"]
        if len(hcs) == 1:
            continue
        if not hcs:
            near = [p["currentTitle"] for p in ppl if p["currentTitle"] and re.search(r"head (football )?coach", p["currentTitle"], re.I)]
            reason = ("no varsity head coach on the staff page" + (f"; head-coach-like titles that are not the varsity head coach: {near}" if near else ""))
        elif any(re.search(r"\bco-?head\b", (p["currentTitle"] or "") + " " + next((t["role"] for t in tenures if t["personId"] == p["id"] and t["isCurrent"]), ""), re.I) for p in hcs):
            reason = "co-head coaches: " + "; ".join(f"{p['fullName']} ({p['currentTitle']})" for p in hcs)
        else:
            reason = "staff page lists more than one head coach: " + "; ".join(f"{p['fullName']} ({p['currentTitle']})" for p in hcs)
        exceptions.append({"programId": oid, "program": idx.orgs[oid]["name"], "headCoaches": [p["id"] for p in hcs], "count": len(hcs), "reason": reason})

    # ------------------------------------------------------------ write
    used_orgs = {t["orgId"] for t in tenures} | {p["currentOrgId"] for p in people}
    orgs = [o for o in idx.orgs.values() if o["id"] in used_orgs or o["inRegistry"]]
    DATA.mkdir(exist_ok=True)
    tenure_keys = ["personId", "orgId", "role", "roleGroup", "unit", "sport", "startYear", "endYear", "isCurrent", "asPlayer",
                   "yearsExplicit", "evidence", "sourceUrl", "verified", "sortOrder"]
    tenures_out = [{k: t[k] for k in tenure_keys} for t in tenures]
    for name, rows in (("organizations", orgs), ("people", people), ("tenures", tenures_out), ("tree_edges", tree)):
        (DATA / f"{name}.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    coach_t = [t for t in tenures if not t["asPlayer"]]
    prior = Counter(t["personId"] for t in coach_t)
    stats = {
        "programs_in_registry": len(registry),
        "programs_with_staff": len(staffed),
        "people": len(people), "excluded_non_coaches": excluded,
        "people_with_prior_stop": sum(1 for p in people if prior[p["id"]] >= 2),
        "tenures": len(tenures), "coaching_tenures": len(coach_t),
        "coaching_tenures_with_start_year": sum(1 for t in coach_t if t["startYear"]),
        "football_tenures": sum(1 for t in tenures if t["sport"] == "football"),
        "non_football_tenures": sum(1 for t in tenures if t["sport"] != "football"),
        "organizations": len(orgs), "org_match": dict(idx.stats),
        "orgs_without_edges": {"placeholder": sum(1 for o in no_edge_orgs if "placeholder" in idx.flags[o]),
                               "ambiguous": sum(1 for o in no_edge_orgs if "ambiguous" in idx.flags[o]),
                               "non_football": sum(1 for o in no_edge_orgs if "non_football" in idx.flags[o])},
        "edges_worked_under": sum(1 for e in tree if e["kind"] == "worked_under"),
        "edges_worked_alongside": sum(1 for e in tree if e["kind"] == "worked_alongside"),
        "people_without_edges": len(people) - len({e["mentorId"] for e in tree} | {e["menteeId"] for e in tree}),
        "role_groups_people": dict(Counter(p["roleGroup"] for p in people)),
        "programs_with_one_current_head_coach": sum(1 for oid, ppl in staffed.items() if sum(p["roleGroup"] == "head_coach" for p in ppl) == 1),
        "head_coach_exceptions": exceptions,
        "staff_title_vs_bio_head_coach_conflicts": hc_title_conflicts,
        "duplicate_bio_objects_skipped": len(duplicate_urls),
        **dict(stats_extra),
        "verified_tenures": sum(1 for t in tenures if t["verified"]),
        "bio_quality": dict(Counter(p["bioQuality"] for p in people)),
        "people_with_bio_excerpt": sum(1 for p in people if p["bioExcerpt"]),
        "current_season": CURRENT_SEASON,
    }
    (DATA / "stats.json").write_text(json.dumps(stats, indent=1))
    print(json.dumps(stats, indent=1))
    return stats


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else WORK / "extract")
