"""Unit tests for the resolve rules (and the crawl fixes they depend on).

Run: python3 -I pipeline/test_resolve.py
Covers: role classification (cases from audit 1), sport handling, name cleaning, role and
title cleaning, semicolon splitting, yearsExplicit, spans and edge intervals, org matching
(ties, renamed schools, guarded fuzzy matches, state hints), unmatched-org keys, org kinds,
bio excerpts, and crawl.py's robots/429 handling and header-aware staff parsing.
"""
import json
import sys
import tempfile
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crawl  # noqa: E402
import resolve as R  # noqa: E402
from resolve import (  # noqa: E402
    CURRENT_SEASON, assign_unmatched, bio_excerpt, build_edges, classify, clean_conference_abbr, clean_role,
    clean_title, normalize_sport, norm_org, org_kind, org_query, parse_name, span, split_stint, state_hint_in,
    years_explicit,
)

CASES = [
    # existing behaviour
    ("Head Coach", ("head_coach", None)),
    ("Head Football Coach", ("head_coach", None)),
    ("Associate Head Coach/Defensive Coordinator", ("coordinator", "defense")),
    ("Assistant Head Coach/Run Game Coordinator/Offensive Line Coach", ("coordinator", "offense")),
    ("Offensive Coordinator/QB/TE", ("coordinator", "offense")),
    ("Defensive Backs Coach", ("position_coach", "defense")),
    ("Linebackers Coach / Recruiting Coordinator", ("position_coach", "defense")),
    ("Wide Receivers Coach", ("position_coach", "offense")),
    ("Special Teams Coordinator/Recruiting Coordinator", ("coordinator", "special_teams")),
    ("Graduate Assistant - Defense", ("ga_analyst", "defense")),
    ("Offensive Quality Control / Assistant WR", ("ga_analyst", "offense")),
    ("Director of Football Operations", ("support", "staff")),
    ("Head Strength and Conditioning Coach", ("support", "staff")),
    # F3: bare position titles and support titles that name a position are position coaches
    ("Wide Receivers", ("position_coach", "offense")),
    ("Defensive Line", ("position_coach", "defense")),
    ("Running Backs", ("position_coach", "offense")),
    ("Tight Ends", ("position_coach", "offense")),
    ("Secondary", ("position_coach", "defense")),
    ("Cornerbacks / Strength & Conditioning", ("position_coach", "defense")),
    ("Director of Football Operations/Outside Linebackers", ("position_coach", "defense")),
    ("Defensive G.A. / Defensive Line", ("ga_analyst", "defense")),
    # F4: head coach only for the varsity football head coach
    ("Junior Varsity Head Coach", ("position_coach", None)),
    ("Special Teams Coordinator / Junior Varsity Head Coach", ("coordinator", "special_teams")),
    ("JV head coach (2019)", ("position_coach", None)),
    ("Special Teams Coordinator / Secondary Coach / Freshman Head Coach", ("coordinator", "defense")),
    ("Senior Consultant to the Head Coach and Staff", ("support", "staff")),
    ("Advisor to the Head Coach / Talent Scout", ("support", "staff")),
    ("Defensive Coordinator / Linebackers (interim head coach for two games in 2024)", ("coordinator", "defense")),
    ("Head Coach (also Associate Director of Athletics for External Relations)", ("head_coach", None)),
    ("Head Football Coach / Assistant Athletic Director", ("head_coach", None)),
    ("Head Coach / Assistant AD", ("head_coach", None)),
    ("Interim Head Coach", ("head_coach", None)),
    ("Co-Head Coach (Def. Coordinator / Defensive Backs)", ("head_coach", None)),
    ("Fish Family Head Coach of Football", ("head_coach", None)),
    ("Assistant Head Coach", ("coordinator", None)),
    ("Associate Head Coach", ("coordinator", None)),
    ("Assistant Head Coach / Offensive Line", ("coordinator", "offense")),
    ("Specialist Head Coach / Strength and Speed Assistant", ("position_coach", "special_teams")),
    ("Futures Head Coach / Chief Advisor for Player Experience / Asst. Defensive Line", ("position_coach", "defense")),
    ("Not stated (described as his tenure leading the program; likely Head Coach)", ("position_coach", None)),
    # one rule for run and passing game coordinators
    ("Passing Game Coordinator", ("coordinator", "offense")),
    ("Run Game Coordinator", ("coordinator", "offense")),
    ("Quarterbacks / Passing Game Coordinator", ("coordinator", "offense")),
    # player vs player-personnel
    ("Player Personnel / Offensive Line Assistant", ("position_coach", "offense")),
    ("Student Manager (offensive line)", ("support", "staff")),
    # notes about other periods do not define the stint's role
    ("Defensive Backs Coach (now Co-Defensive Coordinator)", ("position_coach", "defense")),
    ("Defensive Assistant (Defensive Coordinator in 2011)", ("position_coach", "defense")),
]
NOT_HEAD_COACH = [
    "Head Coach, Women's Flag Football",
    "Head Coach (inaugural women's flag football program)",
    "Head Men's Soccer Coach",
    "Head Softball Coach",
    "Middle School Head Coach",
    "Head Coach (middle school)",
    "Eighth-Grade Head Coach",
]


def test_classify() -> list[str]:
    errors = [f"classify({t!r}) = {classify(t, False)}, want {w}" for t, w in CASES if classify(t, False) != w]
    errors += [f"{t!r} must not be head_coach" for t in NOT_HEAD_COACH if classify(t, False)[0] == "head_coach"]
    if classify("Cornerback", True) != ("player", None):
        errors.append("as_player -> player")
    return errors


def test_sport() -> list[str]:
    want = {
        "football": "football", "": "football", "arena football": "football", "Indoor Football": "football",
        "sprint football": "football", "football and baseball": "football",
        "women's flag football": "women's flag football", "flag football": "flag football",
        "women's tackle football": "women's tackle football", "Baseball": "baseball", "track and field": "track and field",
    }
    return [f"normalize_sport({k!r}) = {normalize_sport(k)!r}, want {v!r}" for k, v in want.items() if normalize_sport(k) != v]


def test_names() -> list[str]:
    cases = [
        ("Mike Smith '09", "Mike Smith", "Mike", "Smith", "mike-smith"),
        ("Mike Smith Jr.", "Mike Smith Jr.", "Mike", "Smith", "mike-smith"),
        ("Tucker Buzzell '24, '24G", "Tucker Buzzell", "Tucker", "Buzzell", "tucker-buzzell"),
        ("Tim Viall '23M", "Tim Viall", "Tim", "Viall", "tim-viall"),
        ("Dr. Karl Liedtka '91", "Karl Liedtka", "Karl", "Liedtka", "karl-liedtka"),
        ("DeMontre Thomas II", "DeMontre Thomas II", "DeMontre", "Thomas", "demontre-thomas"),
        ("AJ Glines '18, DPT '21", "AJ Glines", "AJ", "Glines", "aj-glines"),
        ("Lt. Col William Atwell", "William Atwell", "William", "Atwell", "william-atwell"),
        ("LCDR Paul Puddington '16", "Paul Puddington", "Paul", "Puddington", "paul-puddington"),
        ("Chris Rutledge, Jr.", "Chris Rutledge Jr.", "Chris", "Rutledge", "chris-rutledge"),
        ("Roy Dangel. Jr.", "Roy Dangel Jr.", "Roy", "Dangel", "roy-dangel"),
        ("Jake O'Donnell", "Jake O'Donnell", "Jake", "O'Donnell", "jake-o-donnell"),
        ("Mo De La Garza", "Mo De La Garza", "Mo", "De La Garza", "mo-de-la-garza"),
        ("Joseph  Detorie IV", "Joseph Detorie IV", "Joseph", "Detorie", "joseph-detorie"),
        ("Danny “DJ” Bunn", "Danny “DJ” Bunn", "Danny", "Bunn", "danny-bunn"),
        ("Jose Muñoz-Dominguez", "Jose Muñoz-Dominguez", "Jose", "Muñoz-Dominguez", "jose-munoz-dominguez"),
        ("Justin Leatherman", "Justin Leatherman", "Justin", "Leatherman", "justin-leatherman"),
    ]
    errors = []
    for raw, full, first, last, slug in cases:
        got = parse_name(raw)
        if (got["fullName"], got["firstName"], got["lastName"], got["slug"]) != (full, first, last, slug):
            errors.append(f"parse_name({raw!r}) = {got}")
    return errors


def test_roles_and_titles() -> list[str]:
    roles = {
        "Head Football Coach (16 years) / coach": "Head Football Coach",
        "Offensive Coordinator (2017-2018) / Wide Receivers Coach": "Offensive Coordinator / Wide Receivers Coach",
        "Defensive Line (2025- )": "Defensive Line",
        "Coach (role not stated)": "Coach",
        "Assistant Coach (role not stated)": "Assistant Coach",
        "Running Backs Coach; now Tight Ends / Snappers Coach": "Running Backs Coach / Tight Ends / Snappers Coach",
        "Defensive Coordinator (Linebackers); Special Teams Coordinator in 2024-25": "Defensive Coordinator (Linebackers) / Special Teams Coordinator",
        "Player (walk-on, later scholarship); position not stated": "Player (walk-on, later scholarship)",
        "Offensive Coordinator / Offensive Line (six seasons)": "Offensive Coordinator / Offensive Line",
        "Guard": "Guard",
        "wide receivers and defensive backs": "Wide receivers and defensive backs",
        "Interim Head Coach (previously Defensive Coordinator, then Associate Head Coach)": "Interim Head Coach",
    }
    titles = {
        "Head Football Coach (Quarterbacks) Recruiting States - AK, AZ, CA": "Head Football Coach (Quarterbacks)",
        "Quarterbacks (11th Season)": "Quarterbacks",
        "Offensive Assistant (2026- )": "Offensive Assistant",
        "Head Coach (14th Season, 31st on Staff)": "Head Coach",
        "Assistant Coach | Offensive Line": "Assistant Coach / Offensive Line",
        "Assistant Coach – Special Teams Coordinator / Defensive Line": "Assistant Coach – Special Teams Coordinator / Defensive Line",
    }
    errors = [f"clean_role({k!r}) = {clean_role(k)!r}, want {v!r}" for k, v in roles.items() if clean_role(k) != v]
    errors += [f"clean_title({k!r}) = {clean_title(k)!r}, want {v!r}" for k, v in titles.items() if clean_title(k) != v]
    return errors


def test_split() -> list[str]:
    errors = []

    def parts(role, s, e):
        return [(clean_role(p["role"]), p["start_year"], p["end_year"]) for p in split_stint({"role": role, "start_year": s, "end_year": e})]

    want = {
        ("Defensive Line Coach (2017-18); Linebackers Coach (2019)", 2017, 2019):
            [("Defensive Line Coach", 2017, 2018), ("Linebackers Coach", 2019, 2019)],
        ("Offensive Line; Offensive Coordinator (2019)", 2018, 2019):
            [("Offensive Coordinator", 2019, 2019), ("Offensive Line", 2018, 2019)],
        ("Special Teams Coordinator / Defensive Line Coach (2023-); previously wide receivers and defensive backs", 2018, None):
            [("Special Teams Coordinator / Defensive Line Coach", 2023, None), ("Wide receivers and defensive backs", 2018, 2022)],
        ("Running Backs Coach; now Tight Ends / Snappers Coach", 2022, None):
            [("Running Backs Coach / Tight Ends / Snappers Coach", 2022, None)],
        ("Assistant Coach - Running Backs (Kickers 2012-2025); now Offensive Assistant", 2008, None):
            [("Assistant Coach - Running Backs / Offensive Assistant", 2008, None)],
    }
    for (role, s, e), w in want.items():
        got = parts(role, s, e)
        if got != w:
            errors.append(f"split_stint({role!r}) = {got}, want {w}")
    return errors


def test_years_explicit() -> list[str]:
    cases = [
        ({"years_explicit": True, "start_year": 2023, "evidence": "Joseph Federico enters his fourth season with the Falcons in 2026"}, False),
        ({"years_explicit": True, "start_year": 2001, "end_year": 2017, "evidence": "Prior to coming to University Hill, Ruzicka spent 17 years at Cedar Hill High School"}, False),
        ({"years_explicit": True, "start_year": 2019, "evidence": "He joined the staff in 2019 as the linebackers coach"}, True),
        ({"years_explicit": True, "start_year": 2019, "evidence": "linebackers coach ('19-20) after three seasons as a GA"}, True),
        ({"years_explicit": True, "start_year": 2015, "evidence": "Smith coached at Brown from 2015-17"}, True),
        ({"years_explicit": True, "start_year": 2022, "evidence": "Green was hired at Greensboro as the Quarterbacks Coach"}, True),  # not from a duration
        ({"years_explicit": False, "start_year": 2019, "evidence": "in 2019"}, False),
    ]
    return [f"years_explicit({s}) != {w}" for s, w in cases if years_explicit(s) != w]


def _t(pid, org, rg, s, e, cur=False, sport="football", player=False):
    return {"personId": pid, "orgId": org, "roleGroup": rg, "startYear": s, "endYear": e, "isCurrent": cur,
            "sport": sport, "asPlayer": player}


def test_spans_and_edges() -> list[str]:
    errors = []
    if span(_t("a", "o", "position_coach", None, None, cur=True)) != (CURRENT_SEASON, CURRENT_SEASON):
        errors.append("undated current stint covers the current season")
    if span(_t("a", "o", "position_coach", None, 2012)) != (2012, 2012):
        errors.append("end-only stint covers its one season")
    if span(_t("a", "o", "position_coach", 2015, None, cur=True)) != (2015, CURRENT_SEASON):
        errors.append("current stint runs to the current season")
    if span(_t("a", "o", "position_coach", None, None)) is not None:
        errors.append("undated past stint has no span")

    def rows(ts, no_edge=frozenset()):
        return sorted((e["kind"], e["mentorId"], e["menteeId"], e["orgId"], e["startYear"], e["endYear"]) for e in build_edges(ts, set(no_edge)))

    # F10: separate head-coach stints give one row per contiguous overlap (Franklin: Leonard / Rock)
    got = rows([_t("leonard", "fr", "head_coach", 2003, 2019), _t("leonard", "fr", "head_coach", 2025, None, cur=True),
                _t("rock", "fr", "position_coach", 2007, None, cur=True)])
    if got != [("worked_under", "leonard", "rock", "fr", 2007, 2019), ("worked_under", "leonard", "rock", "fr", 2025, CURRENT_SEASON)]:
        errors.append(f"split worked_under intervals: {got}")
    # gap in the mentee's stints (Hendrix: Simmons 2015 and 2023-)
    got = rows([_t("hc", "h", "head_coach", 2010, None, cur=True), _t("s", "h", "position_coach", 2015, 2015),
                _t("s", "h", "position_coach", 2023, None, cur=True)])
    if got != [("worked_under", "hc", "s", "h", 2015, 2015), ("worked_under", "hc", "s", "h", 2023, CURRENT_SEASON)]:
        errors.append(f"mentee gap: {got}")
    # F2: undated current assistant under a dated current head coach
    got = rows([_t("etter", "cuw", "head_coach", 2008, None, cur=True), _t("dewindt", "cuw", "position_coach", None, None, cur=True)])
    if got != [("worked_under", "etter", "dewindt", "cuw", CURRENT_SEASON, CURRENT_SEASON)]:
        errors.append(f"undated current assistant: {got}")
    # interim head coach for one season: worked_under that season, worked_alongside around it, never both
    got = rows([_t("mc", "f", "coordinator", 2018, 2023), _t("mc", "f", "head_coach", 2019, 2019), _t("rock", "f", "position_coach", 2018, 2023)])
    if got != [("worked_alongside", "mc", "rock", "f", 2018, 2018), ("worked_alongside", "mc", "rock", "f", 2020, 2023),
               ("worked_under", "mc", "rock", "f", 2019, 2019)]:
        errors.append(f"interim head coach: {got}")
    # no self edges, nothing from players, non-football or 'other' stints, nothing at no-edge orgs
    got = rows([_t("a", "o", "head_coach", 2010, 2012), _t("a", "o", "position_coach", 2008, 2012)])
    if got:
        errors.append(f"self edge: {got}")
    got = rows([_t("hc", "o", "head_coach", 2010, 2012), _t("x", "o", "position_coach", 2010, 2012, sport="softball"),
                _t("y", "o", "player", 2010, 2012, player=True), _t("z", "o", "other", 2010, 2012)])
    if got:
        errors.append(f"non-football/player/other edges: {got}")
    got = rows([_t("hc", "amb", "head_coach", 2010, 2012), _t("x", "amb", "position_coach", 2010, 2012)], {"amb"})
    if got:
        errors.append(f"edges at a no-edge org: {got}")
    # two head coaches in the same season (co-head coaches) are not mentor and mentee
    got = rows([_t("a", "o", "head_coach", 2020, 2021), _t("b", "o", "head_coach", 2020, 2021)])
    if got:
        errors.append(f"co-head coaches: {got}")
    return errors


_IDX = None


def idx():
    global _IDX
    if _IDX is None:
        _IDX = R.OrgIndex(json.loads((R.WORK / "registry.json").read_text()), json.loads((R.ROOT / "ncaa_members.json").read_text()),
                          json.loads((R.ROOT / "ncaa_mfb.json").read_text()))
    return _IDX


def test_org_matching() -> list[str]:
    errors = []
    i = idx()

    def name(raw, level, hint=None):
        oid, how = i.match(raw, level, hint)
        return (i.orgs[oid]["name"] if oid else None), how

    # F1: no unguarded fuzzy matches to a different school
    wrong = {
        ("Southern Illinois University", "NCAA D-I FCS"): "Northern Illinois University",
        ("Becker College", "NCAA D-III"): "Eckerd College",
        ("Clarion University of Pennsylvania", "NCAA D-II"): "Lincoln University (Pennsylvania)",
        ("Wesley College", "NCAA D-III"): "Wellesley College",
        ("Taylor University", "NAIA"): "Baylor University",
        ("Iowa Wesleyan University", "unknown"): "Ohio Wesleyan University",
        ("Allegany College", "unknown"): "Allegheny College",
        ("Southeastern University", "NAIA"): "Southwestern University (Texas)",
        ("Tennessee Tech University", "NCAA D-I FCS"): "Tennessee State University",
        ("Mississippi College", "NCAA D-II"): "University of Mississippi",
        ("Notre Dame College", "NCAA D-II"): "University of Notre Dame",
        ("Southwestern College", "NAIA"): "Southwestern University (Texas)",
        ("Liberty High School (Bedford, VA)", "high school"): "Liberty University",
        ("Wooster High School", "high school"): "The College of Wooster",
        ("Saint Joseph's College", "NCAA D-II"): "Saint Joseph's College (Maine)",
    }
    for (raw, level), bad in wrong.items():
        got, how = name(raw, level)
        if got == bad:
            errors.append(f"{raw!r} ({level}) matched the wrong school {bad}")
    # ties without a level or state to break them are unmatched, never ids[0]
    for raw, level in (("Westminster College", "NCAA D-III"), ("University of Nevada", "NCAA D-I FBS")):
        got, how = name(raw, level)
        if got is not None or how != "ambiguous":
            errors.append(f"{raw!r} tie -> {got} ({how}), want unmatched/ambiguous")
    # a state hint or the level breaks the tie
    if name("Westminster College (Pa.)", "NCAA D-III")[0] != "Westminster College (Pennsylvania)":
        errors.append("Westminster College (Pa.) -> Westminster (PA)")
    if name("Westminster College", "NCAA D-III", "mo")[0] != "Westminster College (Missouri)":
        errors.append("Westminster College + evidence hint MO -> Westminster (MO)")
    # F8: query-side normalization mirrors the alias rules: renamed schools merge
    renamed = {
        ("Utica College", "NCAA D-III"): "Utica University",
        ("St. John Fisher College", "NCAA D-III"): "St. John Fisher University",
        ("Elmhurst College", "NCAA D-III"): "Elmhurst University",
        ("Delaware Valley College", "NCAA D-III"): "Delaware Valley University",
        ("SUNY Buffalo State", "NCAA D-III"): "Buffalo State, State University of New York",
        ("Claremont-Mudd-Scripps Colleges", "NCAA D-III"): "Claremont McKenna-Harvey Mudd-Scripps Colleges",
        ("College of Mount St. Joseph", "NCAA D-III"): "Mount St. Joseph University",
        ("United States Military Academy (Army West Point)", "NCAA D-I FBS"): "U.S. Military Academy",
        ("Clarion University of Pennsylvania", "NCAA D-II"): "Pennsylvania Western University, Clarion",
        ("Castleton University", "NCAA D-III"): "Vermont State University Castleton",
    }
    for (raw, level), want in renamed.items():
        got, how = name(raw, level)
        if got != want:
            errors.append(f"{raw!r} -> {got} ({how}), want {want}")
    # an unconfirmed suffix variant stays unmatched (level unknown)
    if name("Utica College", "unknown")[0] is not None:
        errors.append("Utica College with unknown level must not be guessed")
    # synthetic tie: same name in two states, broken only by level
    members = [
        {"orgId": 1, "nameOfficial": "Alpha College (Ohio)", "division": 3, "memberOrgAddress": {"state": "OH"}},
        {"orgId": 2, "nameOfficial": "Alpha College (Iowa)", "division": 2, "memberOrgAddress": {"state": "IA"}},
    ]
    j = R.OrgIndex([], members, [])
    if j.match("Alpha College", "NCAA D-II")[0] != "ncaa-2":
        errors.append("level breaks a tie")
    if j.match("Alpha College", "NAIA") != (None, "unconfirmed"):
        errors.append(f"no level match -> unmatched, got {j.match('Alpha College', 'NAIA')}")
    if j.match("Alpha College (Ohio)", "NAIA")[0] != "ncaa-1":
        errors.append("strong name with state matches regardless of level")
    return errors


def test_unmatched_keys() -> list[str]:
    errors = []

    def info(raw, level, hint=None, how="none"):
        q = org_query(raw)
        return {"q": q, "level": level, "hint": q["hint"] or hint, "how": how}

    # Portsmouth (Ohio) vs an unhinted Portsmouth: never one org; the unhinted one is ambiguous
    a, b = info("Portsmouth High School", "high school", "oh"), info("Portsmouth High School", "high school")
    assign_unmatched("portsmouth high school", [a, b])
    if a["key"][0] == b["key"][0] or a["key"][1] != "oh" or not b.get("ambiguous"):
        errors.append(f"Portsmouth keys {a['key']} {b['key']} {b.get('ambiguous')}")
    # one college name with a single hinted state: unhinted stints of the same level join it
    a, b = info("St. Ambrose University", "NAIA", "ia"), info("St. Ambrose University", "NAIA")
    assign_unmatched(a["q"]["n_key"], [a, b])
    if a["key"] != b["key"] or b.get("ambiguous"):
        errors.append(f"St. Ambrose keys {a['key']} {b['key']}")
    # Southwestern College: KS (NAIA) and an unhinted NJCAA school stay apart
    a, b, c = info("Southwestern College (Kansas)", "NAIA"), info("Southwestern College", "NAIA"), info("Southwestern College", "NJCAA/JUCO")
    assign_unmatched("southwestern college", [a, b, c])
    if not (a["key"] == b["key"] != c["key"]):
        errors.append(f"Southwestern keys {a['key']} {b['key']} {c['key']}")
    # league tags and 'of Pennsylvania' do not split a name
    if org_query("Houston Gamblers (USFL)")["n_key"] != org_query("Houston Gamblers")["n_key"]:
        errors.append("league tag splits a pro team")
    q = org_query("Cheyney University of Pennsylvania")
    if q["n_key"] != norm_org("Cheyney University") or q["hint"] != "pa":
        errors.append(f"'of Pennsylvania' -> {q['n_key']} {q['hint']}")
    if org_query("Indiana University of Pennsylvania")["n_key"] != norm_org("Indiana University of Pennsylvania"):
        errors.append("'Indiana University of Pennsylvania' must keep its state words")
    # state hints from names, roles and evidence
    for text, want in (("Portsmouth (Ohio) High School", "oh"), ("Liberty High School in Bethlehem, Pa.", "pa"),
                       ("Central High School (Independence, Ore.)", "or"), ("Holy Cross High School (Flushing, NY)", "ny"),
                       ("Oak Hills High School in Cincinnati", None), ("served in 2019, IN his first year", None)):
        if state_hint_in(text) != want:
            errors.append(f"state_hint_in({text!r}) = {state_hint_in(text)}, want {want}")
    if org_query("Westminster College (Pa.)")["hint"] != "pa":
        errors.append("'(Pa.)' is a state hint")
    return errors


def test_org_kinds() -> list[str]:
    cases = [
        ("Franklin Junior High School", ["other"], "other"),
        ("North Ridge Middle School", ["high school"], "other"),
        ("Michigan High School Athletic Association", ["other"], "other"),
        ("National High School Recruiting Prospects (NHR Prospects)", ["high school"], "other"),
        ("Fast Twitch Sports Performance", ["other"], "other"),
        ("Hargrave Military Academy", ["high school"], "high_school"),
        ("Becker College", ["NCAA D-III"], "college"),
        ("Lehigh Valley IronPigs", ["pro/semi-pro"], "pro"),
        ("Lodz Wolves (Polish League of American Football)", ["pro/semi-pro"], "pro"),
        ("Phillips Academy", [], "high_school"),
    ]
    errors = [f"org_kind({n!r}) = {org_kind(n, l)}, want {w}" for n, l, w in cases if org_kind(n, l) != w]
    if clean_conference_abbr("NACC[g]") != "NACC" or clean_conference_abbr("SAA[m]") != "SAA" or crawl.clean_conference_abbr("NJAC[r]") != "NJAC":
        errors.append("conference footnotes are removed")
    i = idx()
    if any(o["conferenceAbbr"] and "[" in o["conferenceAbbr"] for o in i.orgs.values()):
        errors.append("registry conference abbreviations carry footnotes")
    lvl = {o["ncaaOrgId"]: o["level"] for o in i.orgs.values()}
    if lvl.get(30146) != "NCAA D-III" or lvl.get(600) != "NCAA D-III" or lvl.get(493) != "NCAA D-I FBS":
        errors.append("NCAA levels come from the football list (Azusa Pacific, Saint Francis, NDSU)")
    if i.orgs["ncaa-600"]["name"] != "Saint Francis University":
        errors.append("org names are trimmed")
    return errors


def test_bio_excerpt() -> list[str]:
    errors = []
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "bio.txt"
        f.write_text("PROGRAM_ID: x\nNAME: Bill Culpepper\n---\nSpecial Teams Coordinator\nBill Culpepper\n"
                     "joined the Cal Lutheran football staff in the fall of 2015 and is the Special Teams Coordinator for the Kingsmen.\n")
        got = bio_excerpt(f, "Bill", "Culpepper")
        if not got or not got.startswith("Bill Culpepper joined the Cal Lutheran"):
            errors.append(f"wrapped lines are joined: {got!r}")
        f.write_text("PROGRAM_ID: x\n---\nFavorite Verse: \"Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged.\" - Joshua 1:9\n"
                     "The 2024 Tigers led Division III in rushing defense by allowing just 32.9 rushing yards per game and were third in total defense.\n"
                     "Larry Harmon was promoted to Head Football Coach in January 2022 after spending the previous 20 seasons as defensive coordinator.\n")
        got = bio_excerpt(f, "Larry", "Harmon")
        if not got or not got.startswith("Larry Harmon was promoted"):
            errors.append(f"'Label:' lines and paragraphs without the name are skipped: {got!r}")
        f.write_text("---\nThe 2025 Scots were once again of the premier offenses in DIII football with seven all-conference selections and more.\n")
        if bio_excerpt(f, "Zach", "Riepma") is not None:
            errors.append("an excerpt must mention the person")
    return errors


def test_crawl_politeness() -> list[str]:
    errors = []
    import urllib.robotparser
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(["User-agent: CoachGraphResearch", "Disallow: /"])
    if crawl.robots_allows(rp, "https://x.edu/sports/football/coaches"):
        errors.append("a group for our product token applies")
    rp2 = urllib.robotparser.RobotFileParser()
    rp2.parse(["User-agent: Mozilla", "Disallow: /"])
    if not crawl.robots_allows(rp2, "https://x.edu/sports/football/coaches"):
        errors.append("a 'Mozilla' group does not apply to our product token")
    if crawl.robots_allows(("unreachable", 0.0), "https://x.edu/"):
        errors.append("unreachable robots.txt (5xx / network error) means disallow")
    if not crawl.robots_allows(None, "https://x.edu/"):
        errors.append("no robots.txt (4xx) means allow")
    rp3 = urllib.robotparser.RobotFileParser()
    rp3.parse(["User-agent: *", "Crawl-delay: 30"])
    if crawl._interval_for(rp3, 1.0) != 30.0:
        errors.append("Crawl-delay is honoured")
    if crawl.retry_after_seconds("120") != 120.0 or crawl.retry_after_seconds(None) is not None:
        errors.append("Retry-After seconds")
    if crawl.retry_after_seconds("Wed, 21 Oct 2026 07:28:00 GMT", now=1792567660.0) != 20.0:
        errors.append("Retry-After HTTP date")
    return errors


def test_parse_staff() -> list[str]:
    errors = []
    html = """<table><thead><tr><th>Name</th><th>Alma Mater</th><th>Title</th><th>Email Address</th></tr></thead><tbody>
      <tr><td><a href="/sports/football/roster/coaches/eric-treske/936">Eric Treske</a></td><td>Wisconsin Lutheran College 2008</td><td>Head Coach</td><td>e@x.edu</td></tr>
      <tr><td><a href="/sports/football/roster/coaches/kyle-kubacki/946">Kyle Kubacki</a></td><td>Wisconsin Lutheran College 2024</td><td>Defensive Line Coach</td><td></td></tr>
    </tbody></table>"""
    got = {s["name"]: s["title"] for s in crawl.parse_staff(html, "https://wlcsports.com/sports/football/coaches")}
    if got != {"Eric Treske": "Head Coach", "Kyle Kubacki": "Defensive Line Coach"}:
        errors.append(f"title comes from the Title column: {got}")
    html = """<div><li><a href="/sports/football/roster/coaches/calvin-ruzicka/1086">Calvin Ruzicka</a><span class="title">Head Coach</span></li>
      <li><a href="/sports/football/roster/coaches/calvin-ruzicka/508">Head Coach</a></li></div>"""
    got = crawl.parse_staff(html, "https://goetbutigers.com/sports/football/coaches")
    if [(s["name"], s["title"], s["url"].rsplit("/", 1)[-1]) for s in got] != [("Calvin Ruzicka", "Head Coach", "1086")]:
        errors.append(f"title-like link text is not a person; one entry per slug: {got}")
    html = """<table><tr><th>Name</th><th>Title</th></tr>
      <tr class="sidearm-staff-category"><td>Softball</td></tr>
      <tr><td><a href="/staff-directory/jane-doe/1">Jane Doe</a></td><td>Head Coach</td></tr>
      <tr class="sidearm-staff-category"><td>Football</td></tr>
      <tr><td><a href="/staff-directory/john-roe/2">John Roe</a></td><td>Head Coach</td></tr></table>"""
    old = crawl.COACH_LINK
    try:
        crawl.COACH_LINK = __import__("re").compile(r"/(coaches|staff-directory|roster/staff|staff)/[^/?#]+/\d+")
        got = [s["name"] for s in crawl.parse_staff(html, "https://x.edu/sports/football/staff")]
    finally:
        crawl.COACH_LINK = old
    if got != ["John Roe"]:
        errors.append(f"directory pages keep only the Football section: {got}")
    return errors


TESTS = [test_classify, test_sport, test_names, test_roles_and_titles, test_split, test_years_explicit, test_spans_and_edges,
         test_org_matching, test_unmatched_keys, test_org_kinds, test_bio_excerpt, test_crawl_politeness, test_parse_staff]


def main() -> int:
    failed = 0
    for t in TESTS:
        try:
            errors = t()
        except Exception:  # noqa: BLE001 - report and keep going
            errors = [traceback.format_exc()]
        status = "ok  " if not errors else "FAIL"
        print(f"{status} {t.__name__}" + (f" ({len(CASES)} classify cases)" if t is test_classify else ""))
        for e in errors:
            print(f"     {e}")
        failed += bool(errors)
    print(f"{len(TESTS) - failed}/{len(TESTS)} test groups pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
