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
  - cleaned names, roles and excerpts (no class years, year ranges, '/ coach' artifacts)

Usage: python3 -I pipeline/check_dataset.py   (exits 1 when an invariant fails)
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / "data"


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
        ex = p.get("bioExcerpt")
        if ex:
            names_ = [x for x in (p["firstName"], p["lastName"]) if x]
            if names_ and not any(re.search(rf"\b{re.escape(x.strip('.'))}\b", ex, re.I) for x in names_):
                fail("bio excerpts mention the person", (p["id"], ex[:60]))
            if re.match(r"^[a-z]", ex) or re.match(r"^[A-Z][\w'/ ]{1,30}:\s", ex):
                fail("bio excerpts are not fragments or 'Label:' lines", (p["id"], ex[:60]))

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
