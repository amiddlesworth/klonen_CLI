"""Re-extract bio text for every cached bio page (no network). Usage: python3 -I pipeline/reparse_bios.py"""
import concurrent.futures as cf
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crawl  # noqa: E402

ROOT = Path(__file__).resolve().parent


def one(b: dict) -> dict:
    cached = crawl.CACHE / f"{hashlib.sha1(b['url'].encode()).hexdigest()}.json"
    if not cached.exists():
        return b
    html = json.loads(cached.read_text())["html"]
    txt, photo = crawl.bio_text(html)
    path = ROOT / b["file"]
    path.write_text(f"PROGRAM_ID: {b['program_id']}\nNAME: {b['name']}\nTITLE: {b['title']}\nURL: {b['url']}\n---\n{txt[:15000]}")
    return {**b, "chars": len(txt), "photo_url": photo}


if __name__ == "__main__":
    idx = json.loads((crawl.WORK / "bios_index.json").read_text())
    with cf.ProcessPoolExecutor(max_workers=4) as ex:
        out = list(ex.map(one, idx, chunksize=20))
    (crawl.WORK / "bios_index.json").write_text(json.dumps(out, indent=1))
    import statistics
    print(f"reparsed {len(out)}; median chars {statistics.median(b['chars'] for b in out)}; under 300: {sum(1 for b in out if b['chars'] < 300)}")
