"""Resolve extracted careers into seed data for the app.

Inputs
  work/registry.json        D-III football programs (crawl.py)
  work/staff.json           current staff per program (crawl.py)
  work/bios_index.json      one row per crawled bio (crawl.py)
  ncaa_members.json         all NCAA members, for matching other colleges
  <extract dir>/*.json      extraction output: one array of coach objects per program

Outputs (committed, loaded by `npm run db:seed`)
  data/organizations.json  data/people.json  data/tenures.json
  data/tree_edges.json     data/stats.json

Usage: python3 -I pipeline/resolve.py [extract_dir]
"""
import difflib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
DATA = ROOT.parent / "data"
CURRENT_SEASON = 2026

# ------------------------------------------------------------------ helpers
STATE_ABBR = {
    "ala": "al", "ariz": "az", "ark": "ar", "calif": "ca", "colo": "co", "conn": "ct", "del": "de", "fla": "fl",
    "ga": "ga", "ill": "il", "ind": "in", "kan": "ks", "kans": "ks", "ky": "ky", "la": "la", "md": "md",
    "mass": "ma", "mich": "mi", "minn": "mn", "miss": "ms", "mo": "mo", "mont": "mt", "neb": "ne", "nev": "nv",
    "n h": "nh", "n j": "nj", "n m": "nm", "n y": "ny", "n c": "nc", "n d": "nd", "okla": "ok", "ore": "or",
    "pa": "pa", "r i": "ri", "s c": "sc", "s d": "sd", "tenn": "tn", "tex": "tx", "va": "va", "vt": "vt",
    "wash": "wa", "wis": "wi", "w va": "wv", "wyo": "wy", "ohio": "oh", "iowa": "ia", "maine": "me",
}


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_org(s: str) -> str:
    s = s.lower().replace("&", " and ")
    s = re.sub(r"\buniv\b\.?", "university", s)
    s = re.sub(r"\bst\.\s", "saint ", s) if re.match(r"^st\.\s", s) else s
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\b(the|of|at|football|program|team)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def level_of(member: dict) -> str:
    d, sub = member["division"], member.get("subdivision")
    if d == 1:
        return "NCAA D-I FBS" if sub == 1 else ("NCAA D-I FCS" if sub == 2 else "NCAA D-I")
    return {2: "NCAA D-II", 3: "NCAA D-III"}[d]


# ------------------------------------------------------------------ role classification
OFF = r"offens|quarterback|\bqbs?\b|running back|\brbs?\b|wide receiver|receivers|\bwrs?\b|tight end|\btes?\b|offensive line|\bol\b|o-line|h-back|slot|pass game coordinator \(off|run game"
DEF = r"defens|linebacker|\blbs?\b|defensive back|secondary|safet|cornerback|\bcbs?\b|\bdbs?\b|defensive line|\bdl\b|d-line|edge|nickel|outside linebacker|inside linebacker|defensive end|defensive tackle"
ST = r"special teams|kicker|punter|kicking|\bst coordinator"
SUPPORT = r"strength|conditioning|performance|operations|\bops\b|director of|equipment|video|athletic train|manager|personnel|recruiting|administrative|nutrition|creative|social media|chaplain|academic"


def classify(role: str, as_player: bool) -> tuple[str, str | None]:
    r = (role or "").lower()
    if as_player:
        return "player", None
    unit = None
    if re.search(ST, r):
        unit = "special_teams"
    if re.search(DEF, r):
        unit = "defense"
    if re.search(OFF, r) and not re.search(r"defens", r):
        unit = "offense"
    head = re.search(r"\bhead (football )?coach\b|^head coach|\bhc\b", r) and not re.search(r"assistant|associate|asst|assoc", r)
    if head:
        return "head_coach", None
    if re.search(r"(offensive|defensive|special teams|run game|pass game|co-?)\s*coordinator|\boc\b|\bdc\b", r) or re.search(r"associate head coach", r):
        return "coordinator", unit
    if re.search(r"graduate assistant|\bga\b|analyst|quality control|\bqc\b|intern|student assistant|volunteer", r):
        return "ga_analyst", unit
    if re.search(SUPPORT, r) and not unit:
        return "support", "staff"
    if re.search(r"coach|coordinator|assistant", r):
        return "position_coach", unit
    return "other", unit


EXCLUDE_TITLES = re.compile(r"student manager|student assistant manager|team manager|^manager$|student worker|intern \(student\)", re.I)


# ------------------------------------------------------------------ bio excerpt
LABEL_LINE = re.compile(r"^(title|phone|email|e-mail|alma mater|hometown|education|experience|career|coaching career|playing career|highlights|at a glance|personal)\b.*:?$|:$", re.I)
YEAR_LINE = re.compile(r"^(\d{4}|[\u2022\-*])")


def bio_excerpt(bio_file: Path | None, max_len: int = 280) -> str | None:
    """First narrative sentence(s) of a bio, verbatim, at most max_len characters."""
    if not bio_file or not bio_file.exists():
        return None
    text = bio_file.read_text()
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    for line in body.split("\n"):
        line = line.strip()
        if len(line) < 90 or LABEL_LINE.search(line) or YEAR_LINE.match(line) or "@" in line:
            continue
        if not re.search(r"\b[a-z]{2,} [a-z]{2,} [a-z]{2,}\b", line):  # prose, not a run of titles
            continue
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z\"\u201c])", line)
        out = ""
        for sent in sentences:
            if len(out) + len(sent) + 1 > max_len:
                break
            out = f"{out} {sent}".strip()
        if not out:
            cut = line[:max_len].rsplit(" ", 1)[0]
            out = cut.rstrip(",;:") + "\u2026"
        return out
    return None


# ------------------------------------------------------------------ organizations
class OrgIndex:
    def __init__(self, registry: list[dict], members: list[dict]):
        self.orgs: dict[str, dict] = {}
        self.by_norm: dict[str, str] = {}
        self.names: list[str] = []
        reg_by_ncaa = {p["ncaa_org_id"]: p for p in registry}
        for m in members:
            reg = reg_by_ncaa.get(m["orgId"])
            oid = f"ncaa-{m['orgId']}"
            short = reg["short_name"] if reg else re.sub(r"^(the )?", "", m["nameOfficial"], flags=re.I)
            org = {
                "id": oid, "slug": reg["slug"] if reg else slugify(m["nameOfficial"]), "name": m["nameOfficial"],
                "shortName": short, "nickname": reg["nickname"] if reg else None, "kind": "college", "level": level_of(m),
                "conference": (m.get("conferenceName") or "").strip() or None,
                "conferenceAbbr": reg["conference_abbr"] if reg else None,
                "state": m["memberOrgAddress"]["state"], "athleticsUrl": reg["athletics_url"] if reg else (
                    f"https://{m['athleticWebUrl'].replace('https://', '').replace('http://', '').strip('/')}" if m.get("athleticWebUrl") else None),
                "ncaaOrgId": m["orgId"], "inRegistry": bool(reg),
            }
            self.orgs[oid] = org
            for alias in self._aliases(m["nameOfficial"], short, m["memberOrgAddress"]["state"]):
                self.by_norm.setdefault(alias, oid)
        self.names = list(self.by_norm)
        self._slugs = {o["slug"] for o in self.orgs.values()}
        self.stats = Counter()

    @staticmethod
    def _aliases(official: str, short: str, state: str) -> set[str]:
        out = {norm_org(official), norm_org(short)}
        o = norm_org(official)
        # "university wisconsin whitewater" -> "wisconsin whitewater", "uw whitewater"
        m = re.match(r"university (\w+) (\w+)$", o)
        if m:
            out.add(f"{m.group(1)} {m.group(2)}")
        if o.startswith("university wisconsin "):
            out.add("uw " + o.split("university wisconsin ")[1])
        for suffix in (" university", " college"):
            if o.endswith(suffix):
                out.add(o[: -len(suffix)])
        if o.startswith("university "):
            out.add(o[len("university "):])
        out.add(f"{norm_org(short)} {state.lower()}")
        return {a for a in out if len(a) > 2}

    def resolve(self, raw: str, level: str | None) -> str:
        n = norm_org(raw)
        # strip a trailing state hint like "(mo.)" -> already removed punctuation: "westminster college mo"
        n_state = n
        for k, v in STATE_ABBR.items():
            n_state = re.sub(rf"\b{k}$", v, n_state)
        for key in (n, n_state):
            if key in self.by_norm:
                self.stats["exact"] += 1
                return self.by_norm[key]
        is_college_level = level and (level.startswith("NCAA") or level in ("unknown",))
        if is_college_level or re.search(r"university|college|institute|academy", n):
            best = difflib.get_close_matches(n_state, self.names, n=1, cutoff=0.9)
            if best:
                self.stats["fuzzy"] += 1
                return self.by_norm[best[0]]
        # Unmatched: a lightweight org keyed by its normalized name
        oid = "org-" + slugify(n_state or raw)[:80]
        if oid not in self.orgs:
            kind = ("high_school" if level == "high school" or re.search(r"high school|\bhs\b|academy|prep", n)
                    else "pro" if level == "pro/semi-pro" else "college" if level in ("NAIA", "NJCAA/JUCO", "NCAA D-I FBS", "NCAA D-I FCS", "NCAA D-II", "NCAA D-III") or re.search(r"university|college", n)
                    else "other")
            slug = slugify(raw)[:80] or oid
            while slug in self._slugs:
                slug += "-x"
            self._slugs.add(slug)
            self.orgs[oid] = {"id": oid, "slug": slug, "name": raw.strip(), "shortName": raw.strip(), "nickname": None,
                              "kind": kind, "level": None if level in (None, "unknown", "other") else level,
                              "conference": None, "conferenceAbbr": None, "state": None, "athleticsUrl": None,
                              "ncaaOrgId": None, "inRegistry": False}
            self.stats["new"] += 1
        else:
            self.stats["new-reused"] += 1
        return oid


# ------------------------------------------------------------------ main
def main(extract_dir: Path) -> None:
    registry = json.loads((WORK / "registry.json").read_text())
    reg_by_id = {p["id"]: p for p in registry}
    reg_by_short = {p["short_name"].lower(): p for p in registry}
    members = json.loads((ROOT / "ncaa_members.json").read_text())
    bios = {b["url"]: b for b in json.loads((WORK / "bios_index.json").read_text())} if (WORK / "bios_index.json").exists() else {}
    idx = OrgIndex(registry, members)

    coaches = []
    for f in sorted(extract_dir.glob("*.json")):
        coaches += json.loads(f.read_text())

    people, tenures, used_slugs = [], [], set()
    seen_urls = set()
    excluded = 0
    for c in coaches:
        url = c.get("bio_url")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        title = (c.get("current_title") or "").strip()
        if EXCLUDE_TITLES.search(title) or c.get("exclude"):
            excluded += 1
            continue
        prog = reg_by_id.get(bios.get(url, {}).get("program_id") or c.get("program_id") or "") or reg_by_short.get((c.get("program") or "").lower().replace("_", " "))
        if not prog:
            continue
        name = re.sub(r"\s+", " ", c["name"]).strip()
        slug = slugify(name)
        if slug in used_slugs:
            slug = f"{slug}-{prog['slug']}"
        used_slugs.add(slug)
        pid = "p-" + slug
        rg, un = classify(title, False)
        parts = name.split(" ")
        people.append({
            "id": pid, "slug": slug, "fullName": name, "firstName": parts[0], "lastName": parts[-1] if len(parts) > 1 else None,
            "currentOrgId": prog["id"], "currentTitle": title or None, "roleGroup": rg, "unit": un,
            "almaMater": c.get("alma_mater"), "hometown": None, "about": None,
            "bioExcerpt": bio_excerpt(ROOT / bios[url]["file"]) if url in bios else None, "bioQuality": c.get("bio_quality"),
            "sourceUrl": url, "claimed": False, "isDemo": False,
        })
        has_current = False
        rows = []
        for s in c.get("stints", []):
            if not s.get("org"):
                continue
            oid = idx.resolve(s["org"], s.get("level"))
            if s.get("level") and idx.orgs[oid]["level"] is None and s["level"] not in ("unknown", "other"):
                idx.orgs[oid]["level"] = s["level"]
            as_player = bool(s.get("as_player"))
            g, u = classify(s.get("role") or "", as_player)
            start, end = s.get("start_year"), s.get("end_year")
            is_current = (not as_player) and oid == prog["id"] and end in (None, CURRENT_SEASON)
            if is_current:
                if has_current:  # keep one current stint per person; earlier roles at the same program stay historical
                    is_current = False
                    end = end or (start if start else None)
                has_current = has_current or is_current
            rows.append({
                "personId": pid, "orgId": oid, "role": (s.get("role") or "").strip() or ("Player" if as_player else "Coach"),
                "roleGroup": g, "unit": u, "startYear": start, "endYear": None if is_current else end,
                "isCurrent": is_current, "asPlayer": as_player, "yearsExplicit": bool(s.get("years_explicit")),
                "evidence": s.get("evidence"), "sourceUrl": url, "verified": False,
            })
        if not has_current:
            rows.append({"personId": pid, "orgId": prog["id"], "role": title or "Coach", "roleGroup": rg, "unit": un,
                         "startYear": None, "endYear": None, "isCurrent": True, "asPlayer": False, "yearsExplicit": False,
                         "evidence": f"Listed on the current staff page as {title}" if title else None, "sourceUrl": url, "verified": False})
        rows.sort(key=lambda r: (not r["isCurrent"], -(r["startYear"] or 0)))
        for i, r in enumerate(rows):
            r["sortOrder"] = i
        tenures += rows

    # ---------------------------------------------------------------- corroboration
    # A stint at a registry program is "verified" when that person is (or was) on that program's
    # current staff page, or another coach's bio places them there in the same seasons.
    current_at = {(p["id"], p["currentOrgId"]) for p in people}
    for t in tenures:
        if (t["personId"], t["orgId"]) in current_at and t["isCurrent"]:
            t["verified"] = True

    # ---------------------------------------------------------------- tree edges
    def span(t):
        s = t["startYear"]
        if s is None:
            return None
        e = CURRENT_SEASON if t["isCurrent"] else (t["endYear"] or s)
        return (s, e) if e >= s else (s, s)

    by_org = defaultdict(list)
    for t in tenures:
        if not t["asPlayer"] and t["roleGroup"] not in ("other",):
            sp = span(t)
            if sp:
                by_org[t["orgId"]].append((t, sp))
    edges = {}
    for oid, rows in by_org.items():
        for i in range(len(rows)):
            for j in range(len(rows)):
                if i >= j and not (rows[i][0]["roleGroup"] == "head_coach" or rows[j][0]["roleGroup"] == "head_coach"):
                    continue
                (a, sa), (b, sb) = rows[i], rows[j]
                if a["personId"] == b["personId"]:
                    continue
                lo, hi = max(sa[0], sb[0]), min(sa[1], sb[1])
                if lo > hi:
                    continue
                if a["roleGroup"] == "head_coach" and b["roleGroup"] != "head_coach":
                    key = ("worked_under", a["personId"], b["personId"], oid)
                elif a["roleGroup"] != "head_coach" and b["roleGroup"] != "head_coach" and i < j:
                    m, n = sorted([a["personId"], b["personId"]])
                    key = ("worked_alongside", m, n, oid)
                else:
                    continue
                cur = edges.get(key)
                edges[key] = (min(lo, cur[0]), max(hi, cur[1])) if cur else (lo, hi)
    tree = [{"kind": k[0], "mentorId": k[1], "menteeId": k[2], "orgId": k[3], "startYear": v[0], "endYear": v[1]} for k, v in edges.items()]

    # ---------------------------------------------------------------- write
    used_orgs = {t["orgId"] for t in tenures} | {p["currentOrgId"] for p in people}
    orgs = [o for o in idx.orgs.values() if o["id"] in used_orgs or o["inRegistry"]]
    DATA.mkdir(exist_ok=True)
    for name, rows in (("organizations", orgs), ("people", people), ("tenures", tenures), ("tree_edges", tree)):
        (DATA / f"{name}.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    coach_t = [t for t in tenures if not t["asPlayer"]]
    prior = Counter(t["personId"] for t in coach_t)
    stats = {
        "programs_in_registry": len(registry),
        "programs_with_staff": len({p["currentOrgId"] for p in people}),
        "people": len(people), "excluded_non_coaches": excluded,
        "people_with_prior_stop": sum(1 for p in people if prior[p["id"]] >= 2),
        "tenures": len(tenures), "coaching_tenures": len(coach_t),
        "coaching_tenures_with_start_year": sum(1 for t in coach_t if t["startYear"]),
        "organizations": len(orgs), "org_match": dict(idx.stats),
        "edges_worked_under": sum(1 for e in tree if e["kind"] == "worked_under"),
        "edges_worked_alongside": sum(1 for e in tree if e["kind"] == "worked_alongside"),
        "bio_quality": dict(Counter(p["bioQuality"] for p in people)),
        "current_season": CURRENT_SEASON,
    }
    (DATA / "stats.json").write_text(json.dumps(stats, indent=1))
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else WORK / "extract")
