"""Crawl NCAA Division III football coaching staffs and coach bios.

Stage 1 builds the program registry from the NCAA directory (football sponsors,
division 3) joined to the Wikipedia D-III program list for nicknames.
Stage 2 fetches each program's football coaching staff page.
Stage 3 fetches every coach bio and saves its text for extraction.

Polite by design: robots.txt is honoured, one request per host per second,
a descriptive user agent, and every response is cached on disk so reruns
never refetch a page that already succeeded.

Usage: python3 -I pipeline/crawl.py [registry|staff|bios|all]
"""
import concurrent.futures as cf
import difflib
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

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 CoachGraphResearch/0.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
STAFF_PATHS = [
    "/sports/football/coaches",
    "/sports/fball/coaches",
    "/sports/football/roster/coaches",
    "/sports/fball/coaches/index",
    "/sports/m-footbl/coaches/index",
    "/sports/football/staff",
]

_host_locks: dict[str, threading.Lock] = {}
_host_last: dict[str, float] = {}
_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
_meta_lock = threading.Lock()


def _host(url: str) -> str:
    return urlparse(url).netloc.lower()


def _robots_allows(url: str) -> bool:
    host = _host(url)
    with _meta_lock:
        if host not in _robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                r = requests.get(f"https://{host}/robots.txt", headers=HEADERS, timeout=15)
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                else:
                    rp = None  # no robots.txt: everything allowed
            except requests.RequestException:
                rp = None
            _robots[host] = rp
        rp = _robots[host]
    return True if rp is None else rp.can_fetch(UA, url)


def fetch(url: str, *, min_interval: float = 1.0) -> tuple[int | str, str, str]:
    """Return (status, final_url, html); cached on disk by URL."""
    key = hashlib.sha1(url.encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        c = json.loads(cached.read_text())
        return c["status"], c["final_url"], c["html"]
    if not _robots_allows(url):
        return "robots-disallowed", url, ""
    host = _host(url)
    with _meta_lock:
        lock = _host_locks.setdefault(host, threading.Lock())
    with lock:
        wait = min_interval - (time.time() - _host_last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        status, final, html = "error", url, ""
        for attempt in range(3):
            try:
                r = requests.get(url, headers=HEADERS, timeout=30)
                status, final, html = r.status_code, r.url, r.text
                if r.status_code < 500:
                    break
            except requests.RequestException as e:
                status = f"error: {type(e).__name__}"
            time.sleep(2 * (attempt + 1))
        _host_last[host] = time.time()
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
    (ROOT / "work" / "registry.json").write_text(json.dumps(out, indent=1))
    unmatched = [p["name"] for p in out if not p["nickname"]]
    print(f"registry: {len(out)} programs, {len(unmatched)} without a Wikipedia match: {unmatched[:12]}")
    return out


# ---------------------------------------------------------------- staff pages
COACH_LINK = re.compile(r"/coaches/[^/?#]+/\d+")


def parse_staff(html: str, base: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    staff: dict[str, dict] = {}
    # SIDEARM table view: each row has the coach link plus title cells
    for tr in soup.select("table tr"):
        a = tr.select_one('a[href*="/coaches/"]')
        if not a or not COACH_LINK.search(a["href"]):
            continue
        url = urljoin(base, a["href"]).split("?")[0]
        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        name = a.get_text(" ", strip=True)
        title = next((c for c in cells if c and c != name and "@" not in c and not re.search(r"\d{3}.\d{4}", c)), "")
        staff[url] = {"url": url, "name": name, "title": title}
    # SIDEARM card view and other layouts: any coach-bio link
    for a in soup.select('a[href*="/coaches/"]'):
        if not COACH_LINK.search(a["href"]):
            continue
        url = urljoin(base, a["href"]).split("?")[0]
        name = a.get_text(" ", strip=True)
        if url not in staff:
            card = a.find_parent(["li", "div", "article"])
            title_el = card.select_one('[class*="title"], [class*="position"]') if card else None
            staff[url] = {"url": url, "name": name, "title": title_el.get_text(" ", strip=True) if title_el else ""}
        elif name and len(name) > len(staff[url]["name"]):
            staff[url]["name"] = name
    return [s for s in staff.values() if s["name"] and not s["name"].lower().startswith(("full bio", "view", "bio"))] or list(staff.values())


def crawl_staff_one(p: dict) -> dict:
    res = {"program_id": p["id"], "status": None, "url": None, "staff": [], "platform": None}
    if not p["athletics_url"]:
        res["status"] = "no-url"
        return res
    for path in STAFF_PATHS:
        url = p["athletics_url"] + path
        status, final, html = fetch(url)
        if status == 200 and html:
            staff = parse_staff(html, final)
            res.update(status=200, url=final, platform="sidearm" if "sidearm" in html.lower() else ("presto" if "prestosports" in html.lower() else "other"))
            if staff:
                res["staff"] = staff
                return res
        elif res["status"] in (None, 404):
            res["status"] = status
    if res["status"] == 200 and not res["staff"]:
        res["status"] = "no-staff-parsed"
    return res


def crawl_staff(registry: list[dict]) -> list[dict]:
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(crawl_staff_one, registry))
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
    for x in soup(["script", "style", "nav", "header", "footer", "noscript", "form"]):
        x.decompose()
    main = (soup.select_one(".sidearm-coach-bio") or soup.select_one(".sidearm-roster-coach-bio")
            or soup.select_one('[class*="coach-bio"]') or soup.select_one("main") or soup.body)
    txt = main.get_text("\n", strip=True) if main else ""
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
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    reg = build_registry() if stage in ("registry", "all") else json.loads((WORK / "registry.json").read_text())
    st = crawl_staff(reg) if stage in ("staff", "all") else (json.loads((WORK / "staff.json").read_text()) if stage == "bios" else None)
    if stage in ("bios", "all"):
        crawl_bios(st)
