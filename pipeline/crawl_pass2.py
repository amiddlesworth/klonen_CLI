"""Second pass over programs whose staff page failed in crawl.py.

Fixes the common causes: the registry URL is a university page that redirects
to a separate athletics domain, the site uses a non-standard staff path, or bio
links use a different pattern. Sites that answer 403 or disallow us in
robots.txt are left alone on purpose: we do not work around a site's wishes.

parse_staff tests every <a href> against crawl.COACH_LINK, so widening the
pattern here does take effect; directory links are kept only for rows in the
Football section of the directory (or whose title mentions football), so the
whole athletics department is not imported.

Usage: python3 -I pipeline/crawl_pass2.py [--cache-only]   (then rerun bios for new staff)
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bs4 import BeautifulSoup

import crawl
from crawl import WORK, fetch

EXTRA_LINK = re.compile(r"/(coaches|staff-directory|roster/staff|staff)/[^/?#]+/\d+")
crawl.COACH_LINK = EXTRA_LINK  # widen the bio-link pattern used by parse_staff

SKIP = {403, "robots-disallowed"}


def base_of(url: str) -> str | None:
    url = url.replace("://www.athletics.", "://athletics.").replace("/index.aspx", "")
    status, final, _ = fetch(url)
    if status != 200:
        return None
    u = urlparse(final)
    return f"{u.scheme}://{u.netloc}"


def find_staff_link(base: str) -> str | None:
    status, final, html = fetch(base + "/")
    if status != 200:
        return None
    soup = BeautifulSoup(html, "html.parser")
    best = None
    for a in soup.select("a[href]"):
        href, text = a["href"].lower(), a.get_text(" ", strip=True).lower()
        if ("football" in href or "fball" in href) and ("coach" in href or "staff" in href or "coach" in text):
            best = urljoin(final, a["href"])
            break
    return best


def retry(p: dict, prev: dict) -> dict:
    res = dict(prev)
    if prev["status"] in SKIP:
        return res
    base = base_of(p["athletics_url"]) if p["athletics_url"] else None
    if not base:
        res["status"] = prev["status"]
        return res
    candidates = [base + path for path in crawl.STAFF_PATHS]
    link = find_staff_link(base)
    if link:
        candidates.insert(0, link)
    for url in candidates:
        status, final, html = fetch(url)
        if status == 200 and html:
            staff = crawl.parse_staff(html, final)
            if staff:
                res.update(status=200, url=final, staff=staff, platform="sidearm" if "sidearm" in html.lower() else "other")
                return res
    res["status"] = "no-staff-parsed-pass2"
    return res


if __name__ == "__main__":
    crawl.CACHE_ONLY = "--cache-only" in sys.argv[1:]
    reg = {p["id"]: p for p in json.loads((WORK / "registry.json").read_text())}
    staff = json.loads((WORK / "staff.json").read_text())
    fixed = 0
    for i, s in enumerate(staff):
        if s["staff"]:
            continue
        new = retry(reg[s["program_id"]], s)
        if crawl.CACHE_ONLY and not new["staff"]:
            new["status"] = s["status"]  # nothing new in the cache: keep what the last network crawl saw
        if new["staff"]:
            fixed += 1
            print("fixed", reg[s["program_id"]]["short_name"], len(new["staff"]), new["url"])
        staff[i] = new
    (WORK / "staff.json").write_text(json.dumps(staff, indent=1))
    ok = sum(1 for s in staff if s["staff"])
    print(f"pass2 fixed {fixed}; now {ok}/{len(staff)} programs with staff")
