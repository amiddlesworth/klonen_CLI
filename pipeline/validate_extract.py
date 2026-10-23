"""Validate one extraction output file against its bundle.

Checks the schema (every stint carries a sport), that every bio in the bundle
has exactly one coach object (a missing object and a second object for the same
bio_url are both problems), and that every evidence quote appears in that bio's
text. Prints problems and exits non-zero if any are found.

Usage: python3 -I pipeline/validate_extract.py work/extract/<program_id>.json
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEVELS = {"NCAA D-I FBS", "NCAA D-I FCS", "NCAA D-II", "NCAA D-III", "NAIA", "NJCAA/JUCO", "high school", "pro/semi-pro", "other", "unknown"}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def main(path: Path) -> int:
    pid = path.stem
    bundle = (ROOT / "work" / "bundles" / f"{pid}.txt").read_text()
    bios = {}
    for chunk in bundle.split("\n=== BIO ")[1:]:
        head, _, body = chunk.partition("\n")
        url = head.split(" | ")[-1].strip()
        bios[url] = norm(head + " " + body)
    problems = []
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        print(f"INVALID JSON: {e}")
        return 1
    if not isinstance(data, list):
        print("top level must be a JSON array")
        return 1
    seen = set()
    for i, c in enumerate(data):
        where = f"[{i}] {c.get('name')}"
        for k in ("name", "program_id", "current_title", "bio_url", "bio_quality", "stints"):
            if k not in c:
                problems.append(f"{where}: missing {k}")
        if c.get("program_id") != pid:
            problems.append(f"{where}: program_id must be {pid}")
        if c.get("bio_quality") not in ("none", "thin", "full"):
            problems.append(f"{where}: bad bio_quality")
        url = c.get("bio_url")
        if url not in bios:
            problems.append(f"{where}: bio_url not in bundle")
            continue
        if url in seen:
            problems.append(f"{where}: duplicate coach object for bio {url}")
        seen.add(url)
        for j, s in enumerate(c.get("stints", [])):
            sw = f"{where} stint {j} ({s.get('org')})"
            for k in ("org", "level", "role", "sport", "start_year", "end_year", "as_player", "years_explicit", "evidence"):
                if k not in s:
                    problems.append(f"{sw}: missing {k}")
            if s.get("level") not in LEVELS:
                problems.append(f"{sw}: bad level {s.get('level')!r}")
            for k in ("start_year", "end_year"):
                v = s.get(k)
                if v is not None and not (isinstance(v, int) and 1950 <= v <= 2027):
                    problems.append(f"{sw}: bad {k} {v!r}")
            if isinstance(s.get("start_year"), int) and isinstance(s.get("end_year"), int) and s["end_year"] < s["start_year"]:
                problems.append(f"{sw}: end_year before start_year")
            ev = norm(s.get("evidence"))
            if ev and ev not in bios[url]:
                problems.append(f"{sw}: evidence not found verbatim in the bio")
    missing = set(bios) - seen
    for u in missing:
        problems.append(f"no coach object for bio {u}")
    for p in problems:
        print(p)
    print(f"{path.name}: {len(data)} coaches, {sum(len(c.get('stints', [])) for c in data)} stints, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
