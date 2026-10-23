"""Crawl NCAA Division III football coaching staffs and coach bios.

Stage 1 builds the program registry from the NCAA directory (football sponsors,
division 3) joined to the Wikipedia D-III program list for nicknames.
Stage 2 fetches each program's football coaching staff page.
Stage 3 fetches every coach bio and saves its text for extraction.

Polite by design:
  - robots.txt is honoured for our product token (CoachGraphResearch), and a
    robots.txt that cannot be read because of a server or network error means
    "disallow everything" for that host until it can be re-read (RFC 9309);
  - at most one request per host per second, or the site's Crawl-delay /
    Request-rate when it asks for more, counting the robots.txt request itself;
  - 429 and 5xx responses honour Retry-After, otherwise back off exponentially,
    and a host that asks for a longer pause than we are willing to wait is
    skipped for the rest of the run;
  - a descriptive user agent, and every response is cached on disk so reruns
    never refetch a page that already succeeded.

Usage: python3 -I pipeline/crawl.py [registry|staff|bios|all] [--cache-only]
  --cache-only   never touch the network: cached pages are reused and anything
                 not cached is reported as "not-cached" (used to re-parse).
"""
import concurrent.futures as cf
import difflib
import email.utils
import hashlib
import json
import re
import sys
import threading
import time
import urllib.robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"  # raw crawl cache, gitignored
CACHE = WORK / "cache"
BIOS = WORK / "bios"
for d in (WORK, CACHE, BIOS):
    d.mkdir(parents=True, exist_ok=True)

# Product token: what robots.txt groups are matched against. It is also the
# last product in the user agent string so site owners can see who we are.
BOT_TOKEN = "CoachGraphResearch"
UA = f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 {BOT_TOKEN}/0.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
STAFF_PATHS = [
    "/sports/football/coaches",
    "/sports/fball/coaches",
    "/sports/football/roster/coaches",
    "/sports/fball/coaches/index",
    "/sports/m-footbl/coaches/index",
    "/sports/football/staff",
]

MIN_INTERVAL = 1.0  # seconds between requests to one host
MAX_ATTEMPTS = 3
BACKOFF_BASE = 2.0  # seconds; doubles per attempt when the server gives no Retry-After
MAX_WAIT = 120.0  # never sleep longer than this for one host; beyond it the host is skipped
ROBOTS_RETRY = 600.0  # re-read an unreachable robots.txt after this many seconds
CACHE_ONLY = False  # set by --cache-only: no network access at all

_host_locks: dict[str, threading.Lock] = {}
_host_last: dict[str, float] = {}  # time the last request to the host finished
_host_next: dict[str, float] = {}  # earliest time the host may be contacted again (Retry-After / backoff)
_robots: dict[str, "urllib.robotparser.RobotFileParser | None | tuple[str, float]"] = {}
_meta_lock = threading.Lock()


def _host(url: str) -> str:
    return urlparse(url).netloc.lower()


def _lock_for(host: str) -> threading.Lock:
    with _meta_lock:
        return _host_locks.setdefault(host, threading.Lock())


def retry_after_seconds(value: str | None, now: float | None = None) -> float | None:
    """Parse a Retry-After header: delta-seconds or an HTTP date. None when absent or unparseable."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when is None:
        return None
    return max(0.0, when.timestamp() - (time.time() if now is None else now))


def _wait_turn(host: str, interval: float) -> None:
    """Sleep until the host may be contacted. Caller holds the host lock."""
    ready = max(_host_next.get(host, 0.0), _host_last.get(host, 0.0) + interval)
    wait = ready - time.time()
    if wait > 0:
        time.sleep(wait)


def _get(url: str, host: str) -> requests.Response:
    """One request; records when it happened so the next one to the host waits. Caller holds the host lock."""
    try:
        return requests.get(url, headers=HEADERS, timeout=30)
    finally:
        _host_last[host] = time.time()


def _back_off(host: str, r: requests.Response | None, attempt: int) -> float:
    delay = retry_after_seconds(r.headers.get("Retry-After")) if r is not None else None
    if delay is None:
        delay = BACKOFF_BASE * (2 ** attempt)
    _host_next[host] = max(_host_next.get(host, 0.0), time.time() + delay)
    return delay


def _robots_for(host: str):
    """RobotFileParser, None (no robots.txt: allow all) or ("unreachable", until). Caller holds the host lock."""
    cur = _robots.get(host, "missing")
    if not (cur == "missing" or (isinstance(cur, tuple) and time.time() >= cur[1])):
        return cur
    _wait_turn(host, MIN_INTERVAL)
    rp: "urllib.robotparser.RobotFileParser | None | tuple[str, float]"
    try:
        r = _get(f"https://{host}/robots.txt", host)
    except requests.RequestException:
        rp = ("unreachable", time.time() + ROBOTS_RETRY)  # RFC 9309 2.3.1.4: assume complete disallow
    else:
        if r.status_code == 200:
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(r.text.splitlines())
        elif r.status_code == 429 or r.status_code >= 500:
            _back_off(host, r, 0)
            rp = ("unreachable", time.time() + ROBOTS_RETRY)
        else:  # 4xx: robots.txt is unavailable, which RFC 9309 treats as no restrictions
            rp = None
    _robots[host] = rp
    return rp


def _interval_for(rp, min_interval: float) -> float:
    if not isinstance(rp, urllib.robotparser.RobotFileParser):
        return min_interval
    interval = min_interval
    delay = rp.crawl_delay(BOT_TOKEN)
    if delay:
        interval = max(interval, float(delay))
    rate = rp.request_rate(BOT_TOKEN)
    if rate and rate.requests:
        interval = max(interval, rate.seconds / rate.requests)
    return interval


def robots_allows(rp, url: str) -> bool:
    """Decision for one URL given what _robots_for returned."""
    if rp is None:
        return True
    if isinstance(rp, tuple):
        return False
    return rp.can_fetch(BOT_TOKEN, url)


def fetch(url: str, *, min_interval: float = MIN_INTERVAL) -> tuple[int | str, str, str]:
    """Return (status, final_url, html); cached on disk by URL."""
    key = hashlib.sha1(url.encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        c = json.loads(cached.read_text())
        return c["status"], c["final_url"], c["html"]
    if CACHE_ONLY:
        return "not-cached", url, ""
    host = _host(url)
    with _lock_for(host):
        if _host_next.get(host, 0.0) - time.time() > MAX_WAIT:
            return "host-backoff", url, ""
        rp = _robots_for(host)
        if isinstance(rp, tuple):
            return "robots-unreachable", url, ""
        if not robots_allows(rp, url):
            return "robots-disallowed", url, ""
        interval = _interval_for(rp, min_interval)
        status, final, html = "error", url, ""
        for attempt in range(MAX_ATTEMPTS):
            if _host_next.get(host, 0.0) - time.time() > MAX_WAIT:
                break  # the site asked for a longer pause than we wait; leave it alone this run
            _wait_turn(host, interval)
            try:
                r = _get(url, host)
            except requests.RequestException as e:
                status = f"error: {type(e).__name__}"
                _back_off(host, None, attempt)
                continue
            status, final, html = r.status_code, r.url, r.text
            if r.status_code == 429 or r.status_code >= 500:
                _back_off(host, r, attempt)
                continue
            break
    if status == 200:
        cached.write_text(json.dumps({"status": status, "final_url": final, "html": html}))
    return status, final, html


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---------------------------------------------------------------- registry
def build_registry() -> list[dict]:
    ncaa = [x for x in json.loads((ROOT / "ncaa_mfb.json").read_text()) if x["division"] == 3]
    wiki = json.loads((ROOT / "wiki_d3_list.json").read_text())
    states = {
        "AL": "Alabama", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut",
        "DC": "District of Columbia", "DE": "Delaware", "FL": "Florida", "GA": "Georgia", "IA": "Iowa",
        "IL": "Illinois", "IN": "Indiana", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
        "MA": "Massachusetts", "MD": "Maryland", "ME": "Maine", "MI": "Michigan", "MN": "Minnesota",
        "MO": "Missouri", "MS": "Mississippi", "NC": "North Carolina", "NH": "New Hampshire",
        "NJ": "New Jersey", "NY": "New York", "OH": "Ohio", "OR": "Oregon", "PA": "Pennsylvania",
        "RI": "Rhode Island", "SC": "South Carolina", "TN": "Tennessee", "TX": "Texas", "VA": "Virginia",
        "VT": "Vermont", "WA": "Washington", "WI": "Wisconsin", "WV": "West Virginia",
    }
    out = []
    used = set()
    for x in ncaa:
        state = x["memberOrgAddress"]["state"]
        cands = [w for w in wiki if w["state"] == states.get(state, state) and w["team"] not in used]
        official = x["nameOfficial"]
        best, score = None, 0.0
        for w in cands:
            short = w["team"].replace("^", "").replace("*", "").strip()
            core = re.sub(r"\s*\(.*?\)", "", short)
            s = difflib.SequenceMatcher(None, core.lower(), official.lower()).ratio()
            if core.lower() in official.lower():
                s += 0.6
            if s > score:
                best, score = w, s
        if best and score >= 0.45:
            used.add(best["team"])
        else:
            best = None
        ath = (x["athleticWebUrl"] or "").replace("https://", "").replace("http://", "").strip("/")
        ath = ath.split("/landing")[0]
        short = best["team"].replace("^", "").replace("*", "").strip() if best else official
        out.append({
            "id": f"ncaa-{x['orgId']}",
            "ncaa_org_id": x["orgId"],
            "name": official,
            "short_name": short,
            "nickname": best["nick"] if best else None,
            "conference": (x["conferenceName"] or "").strip(),
            "conference_abbr": best["conf"] if best else None,
            "state": state,
            "city": None,
            "private": x["privateFlag"] == "Y",
            "division": "NCAA D-III",
            "athletics_url": f"https://{ath}" if ath else None,
            "school_url": f"https://{(x['webSiteUrl'] or '').replace('https://', '').replace('http://', '').strip('/')}",
            "slug": slugify(short),
        })
    apply_overrides(out)
    (ROOT / "work" / "registry.json").write_text(json.dumps(out, indent=1))
    unmatched = [p["name"] for p in out if not p["nickname"]]
    print(f"registry: {len(out)} programs, {len(unmatched)} without a Wikipedia match: {unmatched[:12]}")
    return out


# Programs the Wikipedia join gets wrong or misses: official name -> (short name, nickname)
OVERRIDES = {
    "Massachusetts Institute of Technology": ("MIT", "Engineers"),
    "Massachusetts Maritime Academy": ("Massachusetts Maritime", "Buccaneers"),
    "State University of New York Maritime College": ("SUNY Maritime", "Privateers"),
    "Nebraska Wesleyan University": ("Nebraska Wesleyan", "Prairie Wolves"),
    "The College of New Jersey": ("TCNJ", "Lions"),
    "Rensselaer Polytechnic Institute": ("RPI", "Engineers"),
    "University of the South": ("Sewanee", "Tigers"),
    "Worcester Polytechnic Institute": ("WPI", "Engineers"),
    "Worcester State University": ("Worcester State", "Lancers"),
}


def clean_conference_abbr(abbr: str | None) -> str | None:
    """Drop Wikipedia footnote markers: 'NACC[g]' -> 'NACC'."""
    if not abbr:
        return abbr
    return re.sub(r"\s*\[[^\]]*\]", "", abbr).strip() or None


def apply_overrides(registry: list[dict]) -> None:
    for p in registry:
        p["short_name"] = re.sub(r"\s*\[.*?\]", "", p["short_name"]).strip()
        p["conference_abbr"] = clean_conference_abbr(p["conference_abbr"])
        if p["name"] in OVERRIDES:
            p["short_name"], p["nickname"] = OVERRIDES[p["name"]]
            p["conference_abbr"] = None
        p["slug"] = slugify(p["short_name"])
    abbr = {p["conference"]: p["conference_abbr"] for p in registry if p["conference_abbr"] and not p["conference_abbr"].isdigit()}
    for p in registry:
        if not p["conference_abbr"] or p["conference_abbr"].isdigit():
            p["conference_abbr"] = abbr.get(p["conference"])


# ---------------------------------------------------------------- staff pages
# Bio links parse_staff accepts. crawl_pass2 widens this to staff-directory links.
COACH_LINK = re.compile(r"/coaches/[^/?#]+/\d+")
# Link patterns that point into the whole athletics department's directory rather
# than the football coaching staff: only football rows are kept from these.
DIRECTORY_LINK = re.compile(r"/(staff-directory|staff)/[^/?#]+/\d+")
TITLE_HEADER = re.compile(r"^(title|position)\b", re.I)
NAME_HEADER = re.compile(r"^(name|staff member|coach)$", re.I)
# Link text that is a label or a job title, not a person's name ("Full Bio", "Head Coach").
NOT_A_NAME = re.compile(
    r"^(full bio|view|bio|read more|more|email|e-mail)\b|"
    r"\b(coach(es)?|coordinator|director|assistant|manager|trainer|staff|analyst|intern|graduate|coaching|football)\b",
    re.I,
)
PHONE = re.compile(r"\d{3}.\d{4}")


def _slug_of(url: str) -> str:
    m = re.search(r"/([^/?#]+)/\d+/?$", urlparse(url).path)
    return m.group(1).lower() if m else url


def _name_from_slug(slug: str) -> str:
    return " ".join(w.capitalize() for w in slug.split("-") if w and not w.isdigit())


def _bio_links(scope) -> list:
    """Every anchor whose href matches COACH_LINK (read at call time so crawl_pass2's override applies)."""
    return [a for a in scope.select("a[href]") if COACH_LINK.search(a["href"])]


def _is_directory_link(href: str) -> bool:
    return "/coaches/" not in href and bool(DIRECTORY_LINK.search(href))


def _row_cells(tr) -> list:
    cells = tr.find_all(["td", "th"], recursive=False)
    return cells or tr.find_all(["td", "th"])


def _table_header(table) -> list[str] | None:
    """Header texts of a staff table: <thead>, else a first row made only of <th> cells."""
    row = table.select_one("thead tr")
    if row is None:
        first = table.find("tr")
        if first is not None and first.find_all("th") and not first.find_all("td"):
            row = first
    if row is None:
        return None
    texts = [c.get_text(" ", strip=True) for c in _row_cells(row)]
    return texts if any(texts) else None


def _section_label(tr) -> str | None:
    """Nearest category row above this row (SIDEARM staff directory: 'Football', 'Softball', ...)."""
    for prev in tr.find_previous_siblings("tr"):
        classes = prev.get("class") or []
        if "sidearm-staff-category" in classes or (len(_row_cells(prev)) == 1 and not prev.select_one("a[href]")):
            return prev.get_text(" ", strip=True)
    return None


def _fallback_title(cells: list[str], name: str) -> str:
    return next((c for c in cells if c and c != name and "@" not in c and not PHONE.search(c)), "")


def parse_staff(html: str, base: str) -> list[dict]:
    """Coaches on a staff page: [{url, name, title}].

    Table view: the title is read from the column headed Title/Position, so a
    table laid out [Name, Alma Mater, Title, ...] does not store the alma mater
    as the title; without a usable header the first non-name cell is used.
    Directory links (/staff-directory/...) are kept only for rows in the
    Football section or whose title mentions football.
    """
    soup = BeautifulSoup(html, "html.parser")
    staff: dict[str, dict] = {}
    # SIDEARM table view: each row has the coach link plus title cells
    for table in soup.select("table"):
        header = _table_header(table)
        title_idx = next((i for i, h in enumerate(header or []) if TITLE_HEADER.match(h)), None)
        for tr in table.find_all("tr"):
            if tr.find_parent("table") is not table:
                continue  # rows of a nested table are handled with that table
            links = _bio_links(tr)
            if not links:
                continue
            a = next((x for x in links if x.get_text(strip=True)), links[0])
            url = urljoin(base, a["href"]).split("?")[0]
            cell_els = _row_cells(tr)
            cells = [c.get_text(" ", strip=True) for c in cell_els]
            name = a.get_text(" ", strip=True)
            if title_idx is not None and header is not None and len(cells) == len(header):
                title = cells[title_idx]
            else:
                title = _fallback_title(cells, name)
            if _is_directory_link(a["href"]):
                section = _section_label(tr) or ""
                if not (re.search(r"football", section, re.I) or re.search(r"football", title, re.I)):
                    continue
            staff.setdefault(url, {"url": url, "name": name, "title": title})
    # SIDEARM card view and other layouts: any coach-bio link
    for a in _bio_links(soup):
        url = urljoin(base, a["href"]).split("?")[0]
        name = a.get_text(" ", strip=True)
        if url not in staff:
            card = a.find_parent(["li", "div", "article"])
            title_el = card.select_one('[class*="title"], [class*="position"]') if card else None
            title = title_el.get_text(" ", strip=True) if title_el else ""
            if _is_directory_link(a["href"]) and not re.search(r"football", title, re.I):
                continue
            staff[url] = {"url": url, "name": name, "title": title}
        elif name and len(name) > len(staff[url]["name"]) and not NOT_A_NAME.search(name):
            staff[url]["name"] = name
    # Link text that is a label or a title ("Head Coach") is not a name: take the
    # name from the URL slug, and keep the text as the title when there is none.
    for s in staff.values():
        if not s["name"] or NOT_A_NAME.search(s["name"]):
            label = s["name"]
            s["name"] = _name_from_slug(_slug_of(s["url"]))
            if not s["title"] and label and not re.match(r"^(full bio|view|bio|read more|more|email|e-mail)\b", label, re.I):
                s["title"] = label
    # One person linked under two bio URLs (/calvin-ruzicka/1086 and /508): keep one entry.
    out: dict[str, dict] = {}
    for s in staff.values():
        key = _slug_of(s["url"])
        cur = out.get(key)
        if cur is None:
            out[key] = s
        elif re.sub(r"\W", "", cur["name"].lower()) == re.sub(r"\W", "", s["name"].lower()):
            if not cur["title"] and s["title"]:
                cur["title"] = s["title"]
        else:
            out[s["url"]] = s  # same slug but a different name: a different person
    return [s for s in out.values() if s["name"]]


def crawl_staff_one(p: dict, prior: dict | None = None) -> dict:
    """Find and parse a program's staff page. `prior` is this program's previous
    staff.json row: its URL (which crawl_pass2 may have found) is tried too, and
    with --cache-only its status is kept when nothing for the program is cached."""
    res = {"program_id": p["id"], "status": None, "url": None, "staff": [], "platform": None}
    candidates = [p["athletics_url"] + path for path in STAFF_PATHS] if p["athletics_url"] else []
    if prior and prior.get("url") and prior["url"] not in candidates:
        candidates.append(prior["url"])
    if not candidates:
        res["status"] = "no-url"
        return res
    for url in candidates:
        status, final, html = fetch(url)
        if status == 200 and html:
            staff = parse_staff(html, final)
            res.update(status=200, url=final, platform="sidearm" if "sidearm" in html.lower() else ("presto" if "prestosports" in html.lower() else "other"))
            if staff:
                res["staff"] = staff
                return res
        elif res["status"] in (None, 404, "not-cached") and status != "not-cached":
            res["status"] = status
        elif res["status"] is None:
            res["status"] = status
    if res["status"] == 200 and not res["staff"]:
        res["status"] = "no-staff-parsed"
    if res["status"] == "not-cached" and prior:
        res["status"] = prior.get("status")  # nothing cached for this program: keep what the last crawl saw
    return res


def crawl_staff(registry: list[dict]) -> list[dict]:
    prior_path = WORK / "staff.json"
    prior = {r["program_id"]: r for r in json.loads(prior_path.read_text())} if prior_path.exists() else {}
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(lambda p: crawl_staff_one(p, prior.get(p["id"])), registry))
    (WORK / "staff.json").write_text(json.dumps(results, indent=1))
    ok = sum(1 for r in results if r["staff"])
    print(f"staff: {ok}/{len(results)} programs parsed, {sum(len(r['staff']) for r in results)} staff entries")
    from collections import Counter
    print("statuses:", Counter(str(r["status"]) for r in results if not r["staff"]))
    return results


# ---------------------------------------------------------------- bios
def bio_text(html: str) -> tuple[str, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    img = soup.select_one('meta[property="og:image"]')
    photo = img["content"] if img and img.get("content") else None
    # Note: SIDEARM wraps the whole page in an ASP.NET <form>, so forms are kept.
    for x in soup(["script", "style", "nav", "header", "footer", "noscript", "aside"]):
        x.decompose()
    candidates = [soup.select_one(sel) for sel in (".sidearm-common-bio", ".sidearm-coach-bio", ".sidearm-roster-coach-bio",
                                                    '[class*="coach-bio"]', '[class*="bio"]', "article", "main")]
    texts = [c.get_text("\n", strip=True) for c in candidates if c]
    good = [t for t in texts if len(t) >= 120 and "Ad Blocker Detected" not in t[:400]]
    txt = good[0] if good else (max(texts, key=len) if texts else (soup.body.get_text("\n", strip=True) if soup.body else ""))
    return re.sub(r"\n{2,}", "\n", txt), photo


def crawl_bio_one(args: tuple[dict, dict]) -> dict:
    prog, s = args
    status, final, html = fetch(s["url"])
    txt, photo = bio_text(html) if status == 200 else ("", None)
    fid = hashlib.sha1(s["url"].encode()).hexdigest()[:12]
    path = BIOS / f"{prog['program_id']}__{fid}.txt"
    path.write_text(f"PROGRAM_ID: {prog['program_id']}\nNAME: {s['name']}\nTITLE: {s['title']}\nURL: {s['url']}\n---\n{txt[:15000]}")
    return {"program_id": prog["program_id"], "name": s["name"], "title": s["title"], "url": s["url"],
            "status": status, "chars": len(txt), "photo_url": photo, "file": str(path.relative_to(ROOT))}


def crawl_bios(staff: list[dict]) -> list[dict]:
    # Round-robin across programs so concurrent workers hit different hosts
    # (each host is rate-limited to one request per second).
    queues = [[(p, s) for s in p["staff"]] for p in staff if p["staff"]]
    jobs = []
    while any(queues):
        for q in queues:
            if q:
                jobs.append(q.pop(0))
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        out = list(ex.map(crawl_bio_one, jobs))
    (WORK / "bios_index.json").write_text(json.dumps(out, indent=1))
    ok = sum(1 for b in out if b["status"] == 200)
    thin = sum(1 for b in out if b["chars"] < 300)
    print(f"bios: {ok}/{len(out)} fetched, {thin} under 300 chars")
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    CACHE_ONLY = "--cache-only" in sys.argv[1:]
    stage = args[0] if args else "all"
    reg = build_registry() if stage in ("registry", "all") else json.loads((WORK / "registry.json").read_text())
    st = crawl_staff(reg) if stage in ("staff", "all") else (json.loads((WORK / "staff.json").read_text()) if stage == "bios" else None)
    if stage in ("bios", "all"):
        crawl_bios(st)
