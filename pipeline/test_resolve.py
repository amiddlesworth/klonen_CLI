"""Unit tests for role classification and org-name normalization. Run: python3 -I pipeline/test_resolve.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resolve import classify, norm_org  # noqa: E402

CASES = [
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
]


def main() -> int:
    failures = 0
    for title, want in CASES:
        got = classify(title, False)
        if got != want:
            failures += 1
            print(f"FAIL classify({title!r}) = {got}, want {want}")
    assert classify("Cornerback", True) == ("player", None)
    assert norm_org("University of Wisconsin-Whitewater") == "university wisconsin whitewater"
    assert norm_org("The College of New Jersey") == "college new jersey"
    print(f"{len(CASES) - failures}/{len(CASES)} classify cases pass")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
