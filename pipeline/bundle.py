"""Bundle each program's crawled bios into one trimmed text file for extraction.

Writes work/bundles/<program_id>.txt. Each bio is introduced by a header line
`=== BIO <n> | <name> | <title> | <url>` so the extractor can cite it.

Usage: python3 -I pipeline/bundle.py
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
OUT = WORK / "bundles"
OUT.mkdir(exist_ok=True)

NOISE = re.compile(
    r"^(phone|email|e-mail|title|twitter|x|instagram|facebook|linkedin|print|share|full bio|related|skip ad|ad blocker|"
    r"previous|next|close|opens in a new window|sidearm sports.*)\s*:?\s*$|^\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}|@\w+\.(edu|com|org)",
    re.I,
)


def clean(text: str) -> str:
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    lines = [l.strip() for l in body.split("\n")]
    keep = [l for l in lines if l and not NOISE.search(l)]
    out = "\n".join(keep)
    return out[:7000]


def main() -> None:
    bios = json.loads((WORK / "bios_index.json").read_text())
    reg = {p["id"]: p for p in json.loads((WORK / "registry.json").read_text())}
    by_prog = defaultdict(list)
    for b in bios:
        if b["status"] == 200:
            by_prog[b["program_id"]].append(b)
    sizes = []
    for pid, rows in by_prog.items():
        p = reg[pid]
        parts = [f"PROGRAM_ID: {pid}\nPROGRAM: {p['name']} ({p['short_name']} {p['nickname'] or ''}), {p['state']}, NCAA Division III\n"]
        for i, b in enumerate(rows, 1):
            txt = clean((ROOT / b["file"]).read_text())
            parts.append(f"=== BIO {i} | {b['name']} | {b['title']} | {b['url']}\n{txt or '(no bio text on page)'}\n")
        body = "\n".join(parts)
        (OUT / f"{pid}.txt").write_text(body)
        sizes.append((len(body), pid, len(rows)))
    sizes.sort()
    total = sum(s[0] for s in sizes)
    print(f"bundles: {len(sizes)} programs, {sum(s[2] for s in sizes)} bios, {total/1e6:.1f}M chars; largest {sizes[-1]}")


if __name__ == "__main__":
    main()
