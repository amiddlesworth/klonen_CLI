"""Assert the invariants of the committed seed data and print counts.

Checks data/{organizations,people,tenures,tree_edges,stats}.json, independently of
resolve.py's internals:
  - every staffed program has exactly one current varsity head coach, or is listed in
    stats.json head_coach_exceptions with a reason
  - no self edges; no duplicate person names within a program
  - no stint with endYear < startYear or a year after the current season
  - every edge season is covered by both people's football stints at that org (no edge
    between non-overlapping spans); worked_under only while the mentor was head coach
    and the mentee was on staff; never both edge kinds for one pair, org and season;
    one row per contiguous interval
  - no conference abbreviation containing '['
  - referential integrity, unique ids and slugs, one current stint per person
  - non-football stints never carry a football role group
  - cleaned names, roles and excerpts (no class years, year ranges, '/ coach' artifacts,
    extractor annotations such as '(bio text: ...)' or '(role not stated)')
  - placeholder roles ('Coach', 'Staff') are roleGroup 'other'; 'Fullbacks' is a position
  - end years are stated in the source (pipeline/work/extract, when present): a superseded stint
    whose source gives no end keeps an unknown end, never the season before the current role
  - edge rows are exactly the contiguous runs of seasons the pair overlapped (recomputed from
    the tenures), so separate overlap periods are separate rows (audit F10)
  - football-staff support work (strength and conditioning, athletic training, sports
    performance, football operations) is sport 'football' unless it names another sport
  - slugs: every person who shares a name slug carries a program suffix; the demo person
    p-justin-leatherman (web/scripts/seed.ts) keeps its slug
  - named regressions: Buchanan -> Simmons at Hendrix (F10), Chad Trudo's history and edges

Usage: python3 -I pipeline/check_dataset.py   (exits 1 when an invariant fails)
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / "data"
EXTRACT = ROOT / "work" / "extract"
DEMO_PERSON = ("p-justin-leatherman", "justin-leatherman", "ncaa-2751")

# Extractor annotations that must not survive in a role string
ANNOTATION_IN_ROLE = re.compile(
    r"\([^()]*\b(?:bio|per bio|not stated|not specified|unspecified|implied|implying|likely|presumably|"
    r"current title|header title|per title)\b[^()]*\)|^(?:role|position|title) not stated$", re.I)
# Roles that name no job: they are roleGroup 'other'
PLACEHOLDER = re.compile(
    r"^(?:(?:football|coaching|team|program)\s+)*(?:coach(?:ing)?|staff(?:\s+member)?|member|role|position|unspecified|"
    r"unknown|not stated)(?:\s+(?:role|position|staff|member))?(?:\s+under\s+.+)?$", re.I)
SUPPORT_SPORT = re.compile(r"strength|conditioning|athletic (?:performance )?training|(?:sports?|athletic|human) performance|"
                           r"performance training|football operations", re.I)
OTHER_SPORT = re.compile(r"basketball|baseball|softball|soccer|hockey|lacrosse|track|cross country|wrestling|volleyball|swimming|"
                         r"diving|tennis|golf|rowing|bowling|rugby|powerlifting|weightlifting|boxing|handball|bobsled|"
                         r"flag|touch|7v7|\bwomen|\bgirls|unified", re.I)


def intervals(years: set[int]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for y in sorted(years):
        if out and y == out[-1][1] + 1:
            out[-1] = (out[-1][0], y)
        else:
            out.append((y, y))
    return out


def source_stints() -> dict[str, list[dict]] | None:
    """Extracted stints by evidence quote (tenures copy it verbatim), or None without an extract dir."""
    if not EXTRACT.is_dir():
        return None
    by_ev: dict[str, list[dict]] = defaultdict(list)
    for f in sorted(EXTRACT.glob("*.json")):
        for c in json.loads(f.read_text()):
            for s in c.get("stints") or []:
                if s.get("evidence"):
                    by_ev[s["evidence"]].append(s)
    return by_ev


def stated_end_years(stints: list[dict]) -> set:
    """End years a source stint states: its end_year, and years its role names (split segments
    '(2017-18)', 'previously X' ending the season before a dated segment)."""
    out = {s.get("end_year") for s in stints}
    for s in stints:
        role = s.get("role") or ""
        for y in re.findall(r"\b(?:19|20)\d{2}\b", role):
            out |= {int(y), int(y) - 1}
        for m in re.finditer(r"\b((?:19|20)\d{2})\s*[-–]\s*(\d{2})\b", role):
            out.add(int(m.group(1)[:2] + m.group(2)))
    return out


def load(name: str):
    return json.loads((DATA / f"{name}.json").read_text())


def span(t: dict, season: int) -> tuple[int, int] | None:
    s, e = t["startYear"], t["endYear"]
    if t["isCurrent"]:
        return (season if s is None else min(s, season)), season
    if s is None and e is None:
        return None
    if s is None:
        return e, e
    if e is None:
        return s, s
    return (s, e) if e >= s else (s, s)


def norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def main() -> int:
    orgs, people, tenures, edges, stats = load("organizations"), load("people"), load("tenures"), load("tree_edges"), load("stats")
    season = stats.get("current_season", 2026)
    org_by = {o["id"]: o for o in orgs}
    person_by = {p["id"]: p for p in people}
    failures: dict[str, list] = defaultdict(list)

    def fail(check: str, item) -> None:
        failures[check].append(item)

    # ---------------------------------------------------------------- integrity
    for name, rows in (("organization", orgs), ("person", people)):
        for field in ("id", "slug"):
            dup = [k for k, n in Counter(r[field] for r in rows).items() if n > 1]
            for d in dup:
                fail(f"unique {name} {field}", d)
    for t in tenures:
        if t["personId"] not in person_by:
            fail("tenure person exists", t["personId"])
        if t["orgId"] not in org_by:
            fail("tenure org exists", t["orgId"])
    for p in people:
        if p["currentOrgId"] not in org_by:
            fail("person current org exists", p["id"])
    for e in edges:
        for k in ("mentorId", "menteeId"):
            if e[k] not in person_by:
                fail("edge person exists", e[k])
        if e["orgId"] not in org_by:
            fail("edge org exists", e["orgId"])

    # ---------------------------------------------------------------- stints
    current = defaultdict(list)
    for t in tenures:
        s, e = t["startYear"], t["endYear"]
        if s is not None and e is not None and e < s:
            fail("no stint with end < start", (t["personId"], t["orgId"], s, e))
        if (s is not None and s > season) or (e is not None and e > season):
            fail(f"no stint after {season}", (t["personId"], t["orgId"], s, e))
        if t["isCurrent"]:
            current[t["personId"]].append(t)
        if t.get("sport", "football") != "football" and t["roleGroup"] not in ("other", "player"):
            fail("non-football stints carry no football role group", (t["personId"], t["role"], t["sport"], t["roleGroup"]))
        role = t["role"]
        if re.search(r"\b(19|20)\d{2}\b", role) or re.search(r"\(\s*\d+\s*(years?|seasons?)\s*\)", role, re.I):
            fail("roles carry no years or season counts", role)
        if re.search(r"[/|]\s*coach\.?\s*$", role, re.I) or ";" in re.sub(r"\([^()]*\)", "", role):
            fail("roles carry no '/ coach' artifact or semicolon-joined roles", role)
        if ANNOTATION_IN_ROLE.search(role):
            fail("roles carry no extractor annotations", role)
        core = re.sub(r"\s+", " ", re.sub(r"\([^()]*\)", " ", role)).strip(" .,;:-–")
        bare_role = core == role.strip()  # no parenthetical detail ('Coach (offense)' names a unit)
        if bare_role and PLACEHOLDER.match(core) and t["roleGroup"] not in ("other", "player"):
            fail("placeholder roles ('Coach', 'Staff') are roleGroup other", (t["personId"], role, t["roleGroup"]))
        if re.search(r"\bfull ?backs?\b", role, re.I) and not t["asPlayer"] and t.get("sport", "football") == "football" \
                and t["roleGroup"] in ("other",):
            fail("'Fullbacks' is a position", (t["personId"], role, t["roleGroup"]))
        sport = t.get("sport", "football")
        if sport != "football" and SUPPORT_SPORT.search(sport) and not OTHER_SPORT.search(sport):
            fail("football-staff support work is sport football", (t["personId"], role, sport))
    for p in people:
        cs = current.get(p["id"], [])
        if len(cs) != 1:
            fail("exactly one current stint per person", (p["id"], len(cs)))
            continue
        c = cs[0]
        if c["orgId"] != p["currentOrgId"]:
            fail("current stint is at the person's current org", p["id"])
        if c["roleGroup"] != p["roleGroup"]:
            fail("person roleGroup equals the current stint's", (p["id"], p["roleGroup"], c["roleGroup"]))
        if c.get("sport", "football") != "football":
            fail("current stint is a football stint", p["id"])

    # ---------------------------------------------------------------- end years against the source
    src = source_stints()
    current_org = {p["id"]: p["currentOrgId"] for p in people}
    if src is not None:
        for t in tenures:
            e = t["endYear"]
            if t["isCurrent"] or e is None or not t.get("evidence") or t["evidence"] not in src:
                continue
            allowed = stated_end_years(src[t["evidence"]])
            if t["orgId"] == current_org.get(t["personId"]):
                allowed.add(season)  # a concurrent role at the current program (the staff page names it)
            if e not in allowed:
                fail("end years are stated in the source (no invented continuous tenure)",
                     (t["personId"], t["orgId"], t["role"], t["startYear"], e))

    # ---------------------------------------------------------------- people
    by_prog = defaultdict(Counter)
    for p in people:
        by_prog[p["currentOrgId"]][norm_name(p["fullName"])] += 1
    for prog, names in by_prog.items():
        for n, k in names.items():
            if k > 1:
                fail("no duplicate person names within a program", (prog, n))
    for p in people:
        if re.search(r"[‘’'`]\d{2}(?!\d)", p["fullName"]):
            fail("names carry no class year", p["fullName"])
        if p["lastName"] and re.match(r"^([‘’']?\d|(jr|sr|ii|iii|iv)\.?$)", p["lastName"], re.I):
            fail("lastName is not a class year or suffix", (p["id"], p["lastName"]))
        if p["firstName"] and re.match(r"^(dr|coach|mr|mrs|ms|rev|lt|lcdr|capt)\.?$", p["firstName"], re.I):
            fail("firstName is not an honorific", (p["id"], p["firstName"]))
        if re.search(r"-\d{2}[a-z]?(-|$)", p["slug"]):
            fail("slugs carry no class year", p["slug"])
        if p["id"] != "p-" + p["slug"]:
            fail("person id is p-<slug>", (p["id"], p["slug"]))
        ex = p.get("bioExcerpt")
        if ex:
            names_ = [x for x in (p["firstName"], p["lastName"]) if x]
            if names_ and not any(re.search(rf"\b{re.escape(x.strip('.'))}\b", ex, re.I) for x in names_):
                fail("bio excerpts mention the person", (p["id"], ex[:60]))
            if re.match(r"^[a-z]", ex) or re.match(r"^[A-Z][\w'/ ]{1,30}:\s", ex):
                fail("bio excerpts are not fragments or 'Label:' lines", (p["id"], ex[:60]))

    # ---------------------------------------------------------------- slugs of namesakes
    # A program-suffixed slug '<base>-<program slug>' marks a namesake; no other person may then hold
    # the bare '<base>' (it would change meaning between runs). The demo person keeps its slug.
    bases: dict[str, list[str]] = defaultdict(list)
    for p in people:
        org_slug = org_by.get(p["currentOrgId"], {}).get("slug")
        suffix = f"-{org_slug}" if org_slug else None
        if suffix and p["slug"].endswith(suffix) and len(p["slug"]) > len(suffix):
            base = re.sub(r"-(jr|sr|ii|iii|iv)$", "", p["slug"][: -len(suffix)])
            bases[base].append(p["id"])
    demo_id, demo_slug, demo_org = DEMO_PERSON
    for p in people:
        if p["slug"] in bases and p["id"] != demo_id:
            fail("every namesake has a program-suffixed slug", (p["slug"], bases[p["slug"]]))
    demo = person_by.get(demo_id)
    if not demo or demo["slug"] != demo_slug or demo["currentOrgId"] != demo_org:
        fail("demo person p-justin-leatherman keeps its slug (web/scripts/seed.ts)", demo and (demo["slug"], demo["currentOrgId"]))

    # ---------------------------------------------------------------- head coaches
    exceptions = {x["programId"]: x for x in stats.get("head_coach_exceptions", [])}
    staffed = defaultdict(list)
    for p in people:
        staffed[p["currentOrgId"]].append(p)
    one_hc = 0
    for prog, ppl in staffed.items():
        hcs = [p for p in ppl if p["roleGroup"] == "head_coach"]
        if len(hcs) == 1:
            one_hc += 1
            if prog in exceptions:
                fail("head-coach exceptions are real", prog)
        elif prog not in exceptions or not exceptions[prog].get("reason"):
            fail("one current head coach per staffed program (or documented exception)", (prog, [p["id"] for p in hcs]))
        elif exceptions[prog]["count"] != len(hcs):
            fail("head-coach exception counts match", prog)

    # ---------------------------------------------------------------- edges
    seasons = defaultdict(lambda: defaultdict(lambda: [set(), set()]))  # org -> person -> [hc years, staff years]
    for t in tenures:
        if t["asPlayer"] or t.get("sport", "football") != "football" or t["roleGroup"] in ("other", "player"):
            continue
        sp = span(t, season)
        if sp:
            seasons[t["orgId"]][t["personId"]][0 if t["roleGroup"] == "head_coach" else 1] |= set(range(sp[0], sp[1] + 1))
    pair_years = defaultdict(lambda: defaultdict(set))  # (org, unordered pair) -> kind -> years
    key_rows = defaultdict(list)
    for e in edges:
        a, b, oid, lo, hi = e["mentorId"], e["menteeId"], e["orgId"], e["startYear"], e["endYear"]
        if a == b:
            fail("no self edges", e)
            continue
        if lo is None or hi is None or hi < lo:
            fail("edges have a valid year range", e)
            continue
        if oid.startswith("org-unknown-"):
            fail("no edges at placeholder orgs", e)
        years = set(range(lo, hi + 1))
        hc_a, st_a = seasons[oid][a]
        hc_b, st_b = seasons[oid][b]
        cov_a, cov_b = hc_a | st_a, hc_b | st_b
        if not years <= cov_a or not years <= cov_b:
            fail("no edge between non-overlapping spans", e)
        if e["kind"] == "worked_under":
            if not years <= hc_a:
                fail("worked_under only while the mentor was head coach", e)
            if not years <= st_b or years & hc_b:
                fail("worked_under only while the mentee was on staff and not head coach", e)
        elif e["kind"] == "worked_alongside":
            if a > b:
                fail("worked_alongside stores the smaller id as mentorId", e)
            if not (years <= st_a and years <= st_b) or years & (hc_a | hc_b):
                fail("worked_alongside only while both were on staff under someone else", e)
        else:
            fail("edge kind is known", e)
        pair = (oid, tuple(sorted((a, b))))
        if pair_years[pair][e["kind"]] & years:
            fail("one row per contiguous interval (no overlapping rows)", e)
        pair_years[pair][e["kind"]] |= years
        key_rows[(e["kind"], a, b, oid)].append((lo, hi))
    for pair, kinds in pair_years.items():
        if kinds["worked_under"] & kinds["worked_alongside"]:
            fail("never both edge kinds for one pair, org and season", pair)
    for key, rows in key_rows.items():
        rows.sort()
        for (l1, h1), (l2, h2) in zip(rows, rows[1:]):
            if l2 <= h1 + 1:
                fail("intervals of one edge key are not contiguous with each other", (key, rows))
    # Every edge key's rows are exactly the contiguous runs of the pair's overlap seasons (F10): one
    # row per run, none merged across a gap, none missing. Orgs with no edges in the data (placeholder,
    # ambiguous, non-football) are skipped.
    edge_orgs = {e["orgId"] for e in edges}
    for oid in edge_orgs:
        ppl = seasons[oid]
        for a in ppl:
            for b in ppl:
                if a == b:
                    continue
                (hc_a, st_a), (hc_b, st_b) = ppl[a], ppl[b]
                want = {("worked_under", a, b, oid): intervals((hc_a & st_b) - hc_b)}
                if a < b:
                    want[("worked_alongside", a, b, oid)] = intervals((st_a & st_b) - hc_a - hc_b)
                for key, iv in want.items():
                    if sorted(key_rows.get(key, [])) != iv:
                        fail("edge rows are exactly the contiguous overlap runs", (key, sorted(key_rows.get(key, [])), iv))

    # ---------------------------------------------------------------- named regressions
    # F10: Simmons' Hendrix stints are 2015 (end not in the source) and 2023-current; Buchanan has been
    # head coach since 2013. The edge must not claim 2016-2022.
    if "p-buck-buchanan" in person_by and "p-noah-simmons" in person_by:
        got = sorted(key_rows.get(("worked_under", "p-buck-buchanan", "p-noah-simmons", "ncaa-1124"), []))
        if got != [(2015, 2015), (2023, season)]:
            fail("F10: Buchanan -> Simmons at Hendrix is split at the 2016-2022 gap", got)
    # Chad Trudo's strength and conditioning stints are football staff work: dated history and edges
    trudo = [t for t in tenures if t["personId"] == "p-chad-trudo"]
    trudo_cur = [t for t in trudo if t["isCurrent"]]
    if not trudo or not trudo_cur or trudo_cur[0]["startYear"] is None \
            or trudo_cur[0]["sport"] != "football" \
            or not any(e["mentorId"] == "p-chad-trudo" or e["menteeId"] == "p-chad-trudo" for e in edges if e["startYear"] < season):
        fail("Chad Trudo keeps his strength and conditioning history and edges", [(t["role"], t["sport"], t["startYear"], t["isCurrent"]) for t in trudo])

    # ---------------------------------------------------------------- organizations
    for o in orgs:
        if o.get("conferenceAbbr") and "[" in o["conferenceAbbr"]:
            fail("no conference abbr containing '['", (o["id"], o["conferenceAbbr"]))
        if o["name"] != o["name"].strip():
            fail("org names are trimmed", o["id"])
        if o["kind"] == "high_school" and re.search(r"middle school|junior high", o["name"], re.I):
            fail("middle schools and junior highs are not high schools", o["id"])
        if o["id"].startswith("ncaa-") and o["kind"] != "college":
            fail("NCAA members are colleges", o["id"])
    mfb = {m["orgId"]: m for m in json.loads((ROOT / "ncaa_mfb.json").read_text())}
    for o in orgs:
        m = mfb.get(o.get("ncaaOrgId"))
        if m:
            want = ("NCAA D-I FBS" if m["subdivision"] == 1 else "NCAA D-I FCS") if m["division"] == 1 else f"NCAA D-{'I' * m['division']}"
            if o["level"] != want:
                fail("NCAA football levels come from ncaa_mfb.json", (o["id"], o["level"], want))

    # ---------------------------------------------------------------- report
    kinds = Counter(e["kind"] for e in edges)
    print(f"organizations {len(orgs)}  people {len(people)}  tenures {len(tenures)}  edges {len(edges)} "
          f"(worked_under {kinds['worked_under']}, worked_alongside {kinds['worked_alongside']})")
    print(f"staffed programs {len(staffed)}: {one_hc} with exactly one current head coach, "
          f"{len(exceptions)} documented exceptions: " + "; ".join(f"{k} ({v['reason']})" for k, v in exceptions.items()))
    print(f"non-football tenures {sum(1 for t in tenures if t.get('sport', 'football') != 'football')}, "
          f"current tenures {sum(1 for t in tenures if t['isCurrent'])}, "
          f"people without edges {len(people) - len({e['mentorId'] for e in edges} | {e['menteeId'] for e in edges})}")
    checks = [
        "unique organization id", "unique person id", "unique organization slug", "unique person slug",
        "tenure person exists", "tenure org exists", "person current org exists", "edge person exists", "edge org exists",
        "no stint with end < start", f"no stint after {season}", "exactly one current stint per person",
        "current stint is at the person's current org", "person roleGroup equals the current stint's",
        "current stint is a football stint", "non-football stints carry no football role group",
        "roles carry no years or season counts", "roles carry no '/ coach' artifact or semicolon-joined roles",
        "no duplicate person names within a program", "names carry no class year", "lastName is not a class year or suffix",
        "firstName is not an honorific", "slugs carry no class year", "bio excerpts mention the person",
        "bio excerpts are not fragments or 'Label:' lines",
        "one current head coach per staffed program (or documented exception)", "head-coach exceptions are real",
        "head-coach exception counts match", "no self edges", "edges have a valid year range", "no edges at placeholder orgs",
        "no edge between non-overlapping spans", "worked_under only while the mentor was head coach",
        "worked_under only while the mentee was on staff and not head coach",
        "worked_alongside only while both were on staff under someone else", "worked_alongside stores the smaller id as mentorId",
        "edge kind is known", "one row per contiguous interval (no overlapping rows)",
        "never both edge kinds for one pair, org and season", "intervals of one edge key are not contiguous with each other",
        "edge rows are exactly the contiguous overlap runs", "end years are stated in the source (no invented continuous tenure)",
        "roles carry no extractor annotations", "placeholder roles ('Coach', 'Staff') are roleGroup other", "'Fullbacks' is a position",
        "football-staff support work is sport football", "person id is p-<slug>", "every namesake has a program-suffixed slug",
        "demo person p-justin-leatherman keeps its slug (web/scripts/seed.ts)",
        "F10: Buchanan -> Simmons at Hendrix is split at the 2016-2022 gap",
        "Chad Trudo keeps his strength and conditioning history and edges",
        "no conference abbr containing '['", "org names are trimmed", "middle schools and junior highs are not high schools",
        "NCAA members are colleges", "NCAA football levels come from ncaa_mfb.json",
    ]
    for c in checks:
        n = len(failures.get(c, []))
        print(f"  {'ok  ' if not n else 'FAIL'} {c}" + (f": {n} e.g. {failures[c][:3]}" if n else ""))
    unknown = set(failures) - set(checks)
    for c in unknown:
        print(f"  FAIL {c}: {len(failures[c])} e.g. {failures[c][:3]}")
    if failures:
        print(f"{sum(len(v) for v in failures.values())} violations in {len(failures)} checks")
        return 1
    print("all invariants hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
