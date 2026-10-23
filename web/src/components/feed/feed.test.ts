import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FeedMove, PriorStint } from "@/lib/queries/feedx";
import { isMilestoneSeason, staffRun, type MilestoneStint } from "./milestones";
import { classifyMove, pastStints, recordStints, shownEnd, undatedStints, type StintFacts } from "./moves";
import { DigestSentence, UndatedLine } from "./Sentences";
import { apTitle, atOrg, inferredReason, isLeague, isStaffOnly, keepTogether, ordinal, playedAt, possessiveEnding, recordTitle, roleRank, sameTitle, unnamedOrg } from "./text";

// Components compile to React.createElement (classic JSX in tests) and Link needs no router here.
(globalThis as unknown as { React: typeof React }).React = React;
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));

/*
 * Feed copy and move classification. The apTitle table is every Division III 2026 title whose last
 * part names only a position group, has parentheses or a glued hyphen (from data/, so the copy rule
 * is checked against what the feed actually renders).
 */

const AP_CASES: [string, string][] = [
  ["Assistant Coach (Defensive Backs) / Special Teams Coordinator", "assistant coach for defensive backs and special teams coordinator"],
  ["Assistant Coach (Defensive Line)", "assistant coach for defensive line"],
  ["Assistant Coach (Inside Linebackers)", "assistant coach for inside linebackers"],
  ["Assistant Coach (Linebackers)", "assistant coach for linebackers"],
  ["Assistant Coach (Offensive Coordinator)", "assistant coach and offensive coordinator"],
  ["Assistant Coach (Wide Receivers)", "assistant coach for wide receivers"],
  ["Assistant Coach - Defensive Line", "assistant coach for defensive line"],
  ["Assistant Coach - Linebackers", "assistant coach for linebackers"],
  ["Assistant Coach - Offensive Line", "assistant coach for offensive line"],
  ["Assistant Coach - Quarterbacks", "assistant coach for quarterbacks"],
  ["Assistant Coach - Running Backs", "assistant coach for running backs"],
  ["Assistant Coach - Tight Ends", "assistant coach for tight ends"],
  ["Assistant Coach - Wide Receivers", "assistant coach for wide receivers"],
  ["Assistant Coach / Defensive Line", "assistant coach for defensive line"],
  ["Assistant Coach / Inside Linebackers", "assistant coach for inside linebackers"],
  ["Assistant Coach / Outside Linebackers", "assistant coach for outside linebackers"],
  ["Assistant Coach / Quarterbacks", "assistant coach for quarterbacks"],
  ["Assistant Coach / Running Backs", "assistant coach for running backs"],
  ["Assistant Coach / Safeties", "assistant coach for safeties"],
  ["Assistant Coach / Wide Receivers", "assistant coach for wide receivers"],
  ["Assistant Coach, Defensive Line", "assistant coach for defensive line"],
  ["Assistant Coach, Offensive Line & Tight Ends", "assistant coach for offensive line and tight ends"],
  ["Assistant Coach, Running Backs", "assistant coach for running backs"],
  ["Assistant Football Coach (Defensive Backs)", "assistant football coach for defensive backs"],
  ["Assistant Football Coach (defensive line)", "assistant football coach for defensive line"],
  ["Assistant Football Coach - Wide Receivers", "assistant football coach for wide receivers"],
  ["Assistant Head Coach / Offensive Coordinator / Quarterbacks", "assistant head coach, offensive coordinator and quarterbacks coach"],
  ["Assistant Offensive Line / Tight Ends", "assistant offensive line coach and tight ends coach"],
  ["Associate Head Coach-Defense / Defensive Coordinator", "associate head coach for defense and defensive coordinator"],
  ["Associate Head Coach-Offense / Quarterbacks", "associate head coach for offense and quarterbacks coach"],
  ["Asst. Coach / Defensive Coordinator / Linebackers", "assistant coach, defensive coordinator and linebackers coach"],
  ["Asst. Coach / Defensive Linemen", "assistant coach for defensive linemen"],
  ["Chief Advisor for Defensive Integrity / Aviation Facilitator / Corners", "chief advisor for defensive integrity, aviation facilitator and corners coach"],
  ["Co-Defensive Coordinator / Co-Special Teams Coordinator / Linebackers Coach", "co-defensive coordinator, co-special teams coordinator and linebackers coach"],
  ["Co-Defensive Coordinator / Linebackers", "co-defensive coordinator and linebackers coach"],
  ["Co-Defensive Coordinator / Safeties", "co-defensive coordinator and safeties coach"],
  ["Co-Offensive Coordinator / Quarterbacks (primary play-caller)", "co-offensive coordinator, quarterbacks coach and primary play-caller"],
  ["Cornerbacks", "cornerbacks coach"],
  ["Defensive Assistant / Co-Defensive Line Coach", "defensive assistant and co-defensive line coach"],
  ["Defensive Backs", "defensive backs coach"],
  ["Defensive Backs Coach (cornerbacks)", "defensive backs coach for cornerbacks"],
  ["Defensive Coordinator / Cornerbacks", "defensive coordinator and cornerbacks coach"],
  ["Defensive Coordinator / Defensive Backs", "defensive coordinator and defensive backs coach"],
  ["Defensive Coordinator / Defensive Line", "defensive coordinator and defensive line coach"],
  ["Defensive Coordinator / Linebackers", "defensive coordinator and linebackers coach"],
  ["Defensive Ends / Edges", "defensive ends and edges coach"],
  ["Defensive Line", "defensive line coach"],
  ["Defensive Tackles", "defensive tackles coach"],
  ["Director of Football Operations / Outside Linebackers", "director of football operations and outside linebackers coach"],
  ["Director of Player Performance / Tight Ends / H-Backs", "director of player performance, tight ends and H-backs coach"],
  ["Fullbacks / Running Backs", "fullbacks and running backs coach"],
  ["Graduate Assistant (Defense)", "graduate assistant for defense"],
  ["Graduate Assistant (Linebackers)", "graduate assistant for linebackers"],
  ["Graduate Assistant (Offense)", "graduate assistant for offense"],
  ["Graduate Assistant - Cornerbacks", "graduate assistant for cornerbacks"],
  ["Graduate Assistant - Defensive Line", "graduate assistant for defensive line"],
  ["Graduate Assistant - Nickels", "graduate assistant for nickels"],
  ["Graduate Assistant - Running Backs", "graduate assistant for running backs"],
  ["Graduate Assistant - Tight Ends", "graduate assistant for tight ends"],
  ["Graduate Assistant - Wide Receivers", "graduate assistant for wide receivers"],
  ["Graduate Assistant / Defense", "graduate assistant for defense"],
  ["Graduate Assistant / Defensive Backs", "graduate assistant for defensive backs"],
  ["Graduate Assistant / Inside Linebackers", "graduate assistant for inside linebackers"],
  ["Graduate Assistant / Outside Linebackers", "graduate assistant for outside linebackers"],
  ["Graduate Assistant / Running Backs", "graduate assistant for running backs"],
  ["Graduate Assistant / Tight Ends", "graduate assistant for tight ends"],
  ["Graduate Assistant Coach (Linebackers) / Academic Coordinator", "graduate assistant coach for linebackers and academic coordinator"],
  ["Graduate Assistant Coach (Tight Ends)", "graduate assistant coach for tight ends"],
  ["Graduate Assistant Coach (Wide Receivers) / Film Coordinator", "graduate assistant coach for wide receivers and film coordinator"],
  ["Graduate Assistant Coach - Defense", "graduate assistant coach for defense"],
  ["Graduate Assistant Coach - Defensive Backs", "graduate assistant coach for defensive backs"],
  ["Graduate Assistant Coach - Nickels", "graduate assistant coach for nickels"],
  ["Graduate Assistant Coach - Offense", "graduate assistant coach for offense"],
  ["Graduate Assistant Coach - Offensive Line", "graduate assistant coach for offensive line"],
  ["Head Coach (Offensive Coordinator)", "head coach and offensive coordinator"],
  ["Head Coach / Defensive Backs", "head coach and defensive backs coach"],
  ["Head Football Coach / Vice President for Athletics", "head football coach and vice president for athletics"],
  ["Linebackers", "linebackers coach"],
  ["Offensive Assistant Coach / Academic Co-Coordinator / WR and Return Specialists Coach / Video Co-Coordinator / Away JV Head Coach and JV Offensive Coordinator", "offensive assistant coach, academic co-coordinator, wide receivers and return specialists coach, video co-coordinator and away JV head coach and JV offensive coordinator"],
  ["Offensive Coordinator / Offensive Line", "offensive coordinator and offensive line coach"],
  ["Offensive Coordinator / Quarterbacks", "offensive coordinator and quarterbacks coach"],
  ["Offensive Coordinator / Quarterbacks / Running Backs", "offensive coordinator, quarterbacks and running backs coach"],
  ["Offensive Coordinator / Wide Receivers", "offensive coordinator and wide receivers coach"],
  ["Offensive Coordinator / Wide Receivers / Tight Ends", "offensive coordinator, wide receivers and tight ends coach"],
  ["Offensive Graduate Assistant (Wide Receivers)", "offensive graduate assistant for wide receivers"],
  ["Offensive Line", "offensive line coach"],
  ["Offensive Line (full-time assistant)", "offensive line coach and full-time assistant"],
  ["Outside Linebackers", "outside linebackers coach"],
  ["Outside Linebackers (Nickels and Sams)", "outside linebackers coach for nickels and Sams"],
  ["Outside Linebackers Coach / Equipment Manager (graduate assistant)", "outside linebackers coach, equipment manager and graduate assistant"],
  ["Quarterbacks & Wide Receivers / Passing Game", "quarterbacks, wide receivers and passing game coach"],
  ["Recruiting Coordinator / Defensive Backs", "recruiting coordinator and defensive backs coach"],
  ["Run Game Coordinator / Offensive Line", "run game coordinator and offensive line coach"],
  ["Running Backs", "running backs coach"],
  ["Running Backs / Special Teams", "running backs and special teams coach"],
  ["Safeties", "safeties coach"],
  ["Secondary", "secondary coach"],
  ["Special Teams Coordinator / Academic Co-Coordinator / Linebackers Coach / Kickers / Home JV Coach", "special teams coordinator, academic co-coordinator, linebackers coach, kickers coach and home JV coach"],
  ["Special Teams Coordinator / Defensive Backs", "special teams coordinator and defensive backs coach"],
  ["Special Teams Coordinator / Defensive Line", "special teams coordinator and defensive line coach"],
  ["Special Teams Coordinator / Linebackers", "special teams coordinator and linebackers coach"],
  ["Special Teams Coordinator / Safeties", "special teams coordinator and safeties coach"],
  ["Special Teams Coordinator / Wide Receivers", "special teams coordinator and wide receivers coach"],
  ["Special Teams Coordinator / Wide Receivers / Tight Ends", "special teams coordinator, wide receivers and tight ends coach"],
  ["Specialists", "specialists coach"],
  ["Strength and Speed Coordinator / Defensive Backs", "strength and speed coordinator and defensive backs coach"],
  ["Tight Ends", "tight ends coach"],
  ["Tight Ends / H-Backs", "tight ends and H-backs coach"],
  ["Volunteer Assistant Coach / Specialists", "volunteer assistant coach for specialists"],
  ["Volunteer Assistant Coach / Tight Ends", "volunteer assistant coach for tight ends"],
  ["Wide Receivers", "wide receivers coach"],
  ["Wide Receivers / Tight EndsAssistant Coach (Defensive Backs)", "wide receivers coach and tight EndsAssistant coach for defensive backs"],
];

describe("apTitle", () => {
  it.each(AP_CASES)("%s", (title, expected) => {
    expect(apTitle(title)).toBe(expected);
  });

  it("never leaves slashes, parentheses or a role-less position group", () => {
    for (const [title] of AP_CASES) {
      const out = apTitle(title);
      expect(out).not.toMatch(/[/()]/);
      // Ends on a role noun, unless the position group is a "for" phrase ("assistant coach for defensive line").
      expect(out).toMatch(/((coach|coordinator|assistant|director|analyst|intern|manager|caller|control|athletics)| for [\w ,'-]+)$/);
    }
  });

  it("joins parts AP style", () => {
    expect(apTitle("Offensive Coordinator / Quarterbacks")).toBe("offensive coordinator and quarterbacks coach");
    expect(apTitle("Head Coach (Offensive Coordinator)")).toBe("head coach and offensive coordinator");
    expect(apTitle("Associate Head Coach-Defense / Defensive Coordinator")).toBe("associate head coach for defense and defensive coordinator");
    expect(apTitle("Graduate Assistant (Offense)")).toBe("graduate assistant for offense");
    expect(apTitle("Wide Receivers / Tight Ends")).toBe("wide receivers and tight ends coach");
    expect(apTitle("Asst. QB Coach")).toBe("assistant quarterbacks coach");
    expect(apTitle("Assistant (under Nick Saban)")).toBe("assistant under Nick Saban");
    expect(apTitle("")).toBe("staff member");
  });

  it("gives bare quality control a role noun", () => {
    expect(apTitle("Quality Control")).toBe("quality control coach");
    expect(apTitle("Defensive Quality Control")).toBe("defensive quality control coach");
    expect(apTitle("Apparatus Liaison / Defensive Quality Control")).toBe("apparatus liaison and defensive quality control coach");
    expect(apTitle("Quality Control Coach")).toBe("quality control coach");
    expect(apTitle("Offensive Quality Control Analyst")).toBe("offensive quality control analyst");
  });
});

describe("recordTitle", () => {
  it("uses the headline's clean-up in sentence case, with commas", () => {
    expect(recordTitle("Head Coach (Offensive Coordinator)")).toBe("Head coach, offensive coordinator");
    expect(recordTitle("Associate Head Coach-Defense / Defensive Coordinator")).toBe("Associate head coach for defense, defensive coordinator");
    expect(recordTitle("Associate Head Coach / (Co-)Offensive Coordinator")).toBe("Associate head coach, co-offensive coordinator");
    expect(recordTitle("Offensive Coordinator / Quarterbacks")).toBe("Offensive coordinator, quarterbacks");
    expect(recordTitle("Assistant Coach - Wide Receivers")).toBe("Assistant coach, wide receivers");
    expect(recordTitle("Asst. QB Coach")).toBe("Assistant quarterbacks coach");
    expect(recordTitle("Assistant (under Nick Saban)")).toBe("Assistant under Nick Saban");
    expect(recordTitle("Linebackers")).toBe("Linebackers");
  });
  it("keeps no parentheses (the row adds its own '(player)')", () => {
    expect(recordTitle("Defensive Back (player)")).toBe("Defensive back");
    expect(recordTitle("Linebacker / Special Teams")).toBe("Linebacker, special teams");
    for (const [title] of AP_CASES) expect(recordTitle(title)).not.toMatch(/[()/]/);
  });
});

describe("organizations in prose", () => {
  const org = (id: string, shortName: string, level: string | null = "NCAA D-III") => ({ id, shortName, level });
  it("names placeholder organizations without a proper noun", () => {
    expect(unnamedOrg("org-unknown-high-school")?.label).toBe("High school");
    expect(unnamedOrg("ncaa-2751")).toBeNull();
    expect(atOrg(org("org-unknown-high-school", "Unnamed high school", "high school"))).toBe("at a high school");
    expect(atOrg(org("org-unknown-pro", "Unnamed professional team", "pro/semi-pro"))).toBe("with a pro team");
    expect(atOrg(org("org-unknown-other", "Unnamed organization", null))).toBe("at another program");
    expect(playedAt(org("org-unknown-pro", "Unnamed professional team", "pro/semi-pro"))).toBe("played for a pro team");
  });
  it("plays for pro teams, in leagues and at schools", () => {
    expect(playedAt(org("org-atlanta-falcons", "Atlanta Falcons", "pro/semi-pro"))).toBe("played for the Atlanta Falcons");
    expect(playedAt(org("org-cfl", "Canadian Football League", "pro/semi-pro"))).toBe("played in the Canadian Football League");
    expect(playedAt(org("org-tsl", "The Spring League", "pro/semi-pro"))).toBe("played in The Spring League");
    expect(playedAt(org("ncaa-1", "George Fox"))).toBe("played at George Fox");
    expect(isLeague("Lodz Wolves (Polish League of American Football)")).toBe(false);
    expect(isLeague("New York franchise, World Football League")).toBe(false);
    expect(atOrg(org("org-atlanta-falcons", "Atlanta Falcons", "pro/semi-pro"))).toBe("with the Atlanta Falcons");
  });
  it("writes AP possessives and ordinals", () => {
    expect(possessiveEnding("Joe Doyle")).toBe("’s");
    expect(possessiveEnding("E.J. Mills")).toBe("’");
    expect(ordinal(42)).toBe("42nd");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(10)).toBe("10th");
    expect(ordinal(3)).toBe("third");
  });
});

describe("sameTitle", () => {
  it("ignores case, order, 'coach' and 'football'", () => {
    expect(sameTitle("Head Coach", "Head coach")).toBe(true);
    expect(sameTitle("Head Football Coach", "Head Coach")).toBe(true);
    expect(sameTitle("Defensive Coordinator / Linebackers", "Defensive Coordinator / Linebackers Coach")).toBe(true);
    expect(sameTitle("Assistant Coach - Linebackers", "Linebackers Coach")).toBe(true);
    expect(sameTitle("Wide Receivers / Tight Ends", "Tight Ends / Wide Receivers")).toBe(true);
  });
  it("tells different roles apart", () => {
    expect(sameTitle("Safeties coach", "Cornerbacks coach")).toBe(false);
    expect(sameTitle("Special Teams Coordinator / Linebackers", "Special Teams Coordinator / Defensive Backs")).toBe(false);
  });
});

describe("roleRank", () => {
  it("orders the coaching ladder", () => {
    expect(roleRank("Head Coach")).toBe(0);
    expect(roleRank("Interim Head Coach")).toBe(0);
    expect(roleRank("Associate Head Coach-Offense / Quarterbacks")).toBe(1);
    expect(roleRank("Defensive Coordinator")).toBe(2);
    expect(roleRank("Special Teams Coordinator / Linebackers")).toBe(3);
    expect(roleRank("Linebackers")).toBe(4);
    expect(roleRank("Assistant Coach - Wide Receivers")).toBe(4);
    expect(roleRank("Assistant Defensive Line")).toBe(4.5);
    expect(roleRank("Graduate Assistant (Offense)")).toBe(5);
    expect(roleRank("Student Assistant")).toBe(5);
  });
  it("leaves staff roles and JV roles off the ladder", () => {
    expect(roleRank("Director of Football Operations")).toBeNull();
    expect(roleRank("Recruiting coordinator")).toBeNull();
    expect(roleRank("JV Defensive Coordinator")).toBeNull();
    expect(roleRank("Special Assistant to the Head Coach / Facilities Manager")).toBeNull();
  });
});

describe("copy helpers", () => {
  it("glues a parenthetical to the name", () => {
    expect(keepTogether("St. Thomas (Minnesota)")).toBe("St. Thomas\u00a0(Minnesota)");
    expect(keepTogether("William & Mary")).toBe("William\u00a0& Mary");
  });
  it("spots staff-only titles", () => {
    expect(isStaffOnly("Coaching staff")).toBe(true);
    expect(isStaffOnly("Staff member")).toBe(true);
    expect(isStaffOnly("Staff Assistant")).toBe(false);
  });
  it("quotes evidence only without gendered pronouns", () => {
    expect(inferredReason("Joined the staff in 2019 after two seasons at Linfield", "https://www.goboxers.com/x")).toBe(
      "from the goboxers.com staff bio, which says “Joined the staff in 2019 after two seasons at Linfield”",
    );
    expect(inferredReason("He joined the staff in 2019", "https://goboxers.com/x")).toBe("not stated in the goboxers.com staff bio; worked out from other details in it");
  });
});

/* ---------- Moves ---------- */

let nextId = 1;
function stint(orgId: string, role: string, startYear: number | null, endYear: number | null, extra: Partial<StintFacts> = {}): StintFacts {
  return { id: nextId++, orgId, role, startYear, endYear, isCurrent: false, asPlayer: false, sport: "football", sortOrder: nextId, ...extra };
}
function classify(current: StintFacts, past: StintFacts[]) {
  return classifyMove(current, pastStints([current, ...past], current.id, 2026, false), 2026);
}
const now = (orgId: string, role: string) => stint(orgId, role, 2026, null, { isCurrent: true });

describe("classifyMove", () => {
  it("drops a role the source only restates (Chris Villarrial, Saint Francis)", () => {
    expect(classify(now("sf", "Head Coach"), [stint("sf", "Head Coach", 2010, 2025), stint("sf", "Offensive Coordinator", 2009, 2009)])).toBe("continued");
    expect(classify(now("sf", "Defensive Coordinator"), [stint("sf", "Defensive Coordinator", 2024, 2025)])).toBe("continued");
  });
  it("calls a more senior role at the same program a promotion (Mike Smith, Pacific Lutheran)", () => {
    expect(classify(now("plu", "Defensive Coordinator"), [stint("plu", "Defensive Line Coach", 2023, 2025)])).toBe("promoted");
    expect(classify(now("thiel", "Interim Head Coach"), [stint("thiel", "Offensive Coordinator", 2025, null)])).toBe("promoted");
  });
  it("never calls a sideways move or a step back a promotion", () => {
    expect(classify(now("central", "Cornerbacks coach"), [stint("central", "Safeties coach", 2018, 2025), stint("central", "Cornerbacks coach", 2014, 2017)])).toBe("moved");
    expect(classify(now("geneva", "Assistant Coach - Quarterbacks"), [stint("geneva", "Head Coach", 1993, 2025)])).toBe("moved");
  });
  it("reads time away as a return (Steve Brown, Tracy Branch, Pat Delaney)", () => {
    expect(classify(now("wp", "Assistant Coach"), [stint("wp", "Assistant Coach", 2015, 2018), stint("wp", "Assistant Coach", 2006, 2006)])).toBe("returned");
    expect(classify(now("utica", "Assistant Coach, Defensive Line"), [stint("utica", "Defensive Line Coach", 2014, 2020)])).toBe("returned");
    expect(classify(now("owu", "Linebackers Coach"), [stint("owu", "Defensive Coordinator / Linebackers", 1995, 2024)])).toBe("returned");
    expect(classify(now("mary", "Defensive Backs / Special Teams Coordinator"), [stint("mary", "Running Backs", 2021, null)])).toBe("returned");
  });
  it("ignores other sports and second jobs that start this season (Isaiah Harris, Antonio Young)", () => {
    expect(classify(now("apu", "Defensive Backs Coach (cornerbacks)"), [stint("apu", "Assistant Coach", null, null, { sport: "track and field" })])).toBe("joined");
    expect(classify(now("dean", "Defensive Coordinator"), [stint("dean", "Head Coach", 2026, null, { sport: "women's flag football" }), stint("amherst", "Assistant Coach - Wide Receivers", 2025, 2025)])).toBe("joined");
  });
  it("is a hire when the coach comes from another program", () => {
    expect(classify(now("lawrence", "Wide Receivers Coach"), [stint("sac", "Assistant Cornerbacks Coach", null, null)])).toBe("joined");
  });
  it("reads an undated earlier role here plus last season elsewhere as a return (Kappas, Smith, Money)", () => {
    // Chris Kappas: Louisville HS head coach 2023–2025, Mount Union defensive coordinator (undated).
    expect(classify(now("mount-union", "Defensive Coordinator / Defensive Line"), [stint("louisville-hs", "Head Coach", 2023, 2025), stint("mount-union", "Defensive Coordinator", null, null)])).toBe("returned");
    // Dontavius Smith: Greensboro 2025, Keystone offensive coordinator (undated).
    expect(classify(now("keystone", "Offensive Coordinator"), [stint("greensboro", "Offensive Coordinator / Quarterbacks Coach", 2025, 2025), stint("keystone", "Offensive Coordinator / Associate Head Coach", null, null)])).toBe("returned");
    // Jaxson Money: Texas A&M-Kingsville 2023–2025, a Hardin-Simmons graduate assistant (undated).
    expect(classify(now("hsu", "Tight Ends / Assistant Strength Coach"), [stint("tamuk", "Running Backs, then Wide Receivers", 2023, 2025), stint("hsu", "Graduate Assistant (Wide Receivers and Running Backs)", null, null)])).toBe("returned");
  });
  it("is only a different role when the earlier role here is undated and nothing places the coach elsewhere", () => {
    expect(classify(now("x", "Linebackers Coach"), [stint("x", "Safeties Coach", null, null)])).toBe("moved");
  });
});

describe("recordStints", () => {
  it("keeps undated stints out of the record and puts dated ones oldest first", () => {
    const a = stint("x", "A", 2010, 2012);
    const b = stint("y", "B", null, null);
    const c = stint("z", "C", 2015, 2025);
    expect(recordStints([c, a, b], 2).map((s) => s.role)).toEqual(["A", "C"]);
    expect(recordStints([c, b], 2).map((s) => s.role)).toEqual(["C"]);
    expect(recordStints([b], 2)).toEqual([]);
    expect(undatedStints([c, a, b]).map((s) => s.role)).toEqual(["B"]);
  });
  it("never shows a past stint ending in the hire season", () => {
    expect(shownEnd(2026, 2026)).toBe(2025);
    expect(shownEnd(2024, 2026)).toBe(2024);
    expect(shownEnd(null, 2026)).toBeNull();
  });
});

/* ---------- Sentences ---------- */

function prior(p: Partial<PriorStint> & Pick<PriorStint, "role" | "orgId" | "orgShortName">): PriorStint {
  return { orgLevel: "NCAA D-III", startYear: null, endYear: null, inferred: false, inferredReason: null, asPlayer: false, ...p };
}

function move(p: Partial<FeedMove> & Pick<FeedMove, "role">): FeedMove {
  return {
    key: "p-x",
    kind: "joined",
    person: { id: "p-x", slug: "x", fullName: "Pat Example", firstName: "Pat", almaMater: null, claimed: false },
    roleGroup: "position_coach",
    org: { id: "ncaa-1", slug: "x", name: "X", shortName: "X", conference: null, conferenceAbbr: null, level: "NCAA D-III", city: null, state: null, inRegistry: true },
    sourceUrl: null,
    quote: null,
    record: [],
    previous: null,
    undated: [],
    priorOrgs: {},
    recordInferred: false,
    previousInferred: false,
    ...p,
  };
}

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/\u00a0/g, " ");

describe("DigestSentence", () => {
  it("names quality control as a role", () => {
    expect(text(React.createElement(DigestSentence, { move: move({ person: { ...move({ role: "" }).person, fullName: "Brendan Joyce" }, role: "Quality Control" }) }))).toBe("Named Brendan Joyce quality control coach.");
  });
  it("plays for a pro team", () => {
    const m = move({
      person: { ...move({ role: "" }).person, fullName: "Brandon Bailey" },
      role: "Cornerbacks",
      previous: prior({ role: "Cornerback", orgId: "org-atlanta-falcons", orgShortName: "Atlanta Falcons", orgLevel: "pro/semi-pro", startYear: 2018, endYear: 2018, asPlayer: true }),
    });
    expect(text(React.createElement(DigestSentence, { move: m }))).toBe("Named Brandon Bailey cornerbacks coach; played for the Atlanta Falcons (2018).");
  });
  it("doesn't stack parentheses after a name that has its own", () => {
    const m = move({
      role: "Linebackers",
      previous: prior({ role: "Defensive Quality Control", orgId: "ncaa-st-thomas", orgShortName: "University of St. Thomas (Minnesota)", orgLevel: "NCAA D-I FCS", startYear: 2024, endYear: 2025 }),
    });
    expect(text(React.createElement(DigestSentence, { move: m }))).toBe("Named Pat Example linebackers coach; previously defensive quality control coach at University of St. Thomas (Minnesota) in 2024–2025.");
  });
  it("shows a previous stint the source runs into the hire season as ending the season before", () => {
    // Clamped by the query (shownEnd): Midland Valley High School 2021–2026 reads 2021–2025.
    const m = move({
      role: "Defensive Line",
      previous: prior({ role: "Defensive Line Coach", orgId: "org-midland-valley", orgShortName: "Midland Valley High School", orgLevel: "high school", startYear: 2021, endYear: shownEnd(2026, 2026) }),
    });
    expect(text(React.createElement(DigestSentence, { move: m }))).toBe("Named Pat Example defensive line coach; previously defensive line coach at Midland Valley High School (2021–2025).");
  });
  it("never names a placeholder organization", () => {
    const m = move({ role: "Linebackers", previous: prior({ role: "Head Coach", orgId: "org-unknown-high-school", orgShortName: "Unnamed high school", orgLevel: "high school" }) });
    expect(text(React.createElement(DigestSentence, { move: m }))).toBe("Named Pat Example linebackers coach; previously head coach at a high school.");
  });
});

describe("UndatedLine", () => {
  it("names an undated earlier role at the program (a return)", () => {
    const el = React.createElement(UndatedLine, { orgId: "mount-union", stints: [prior({ role: "Defensive Coordinator", orgId: "mount-union", orgShortName: "Mount Union" })] });
    expect(text(el)).toBe("Previously defensive coordinator at Mount Union · years not in source");
  });
  it("lists undated stops elsewhere in bio order, without implying a timeline", () => {
    const stints = ["Sacramento State", "Eastern New Mexico", "La Verne", "Northwestern State"].map((n, i) => prior({ role: "Assistant Coach", orgId: `o${i}`, orgShortName: n }));
    expect(text(React.createElement(UndatedLine, { orgId: "lawrence", stints }))).toBe("Previously at Sacramento State, Eastern New Mexico and two other programs · years not in source");
  });
});

/* ---------- Milestones ---------- */

function mstint(orgId: string, role: string, startYear: number | null, endYear: number | null, extra: Partial<MilestoneStint> = {}): MilestoneStint {
  return { ...stint(orgId, role, startYear, endYear), yearsExplicit: true, ...extra };
}

describe("milestones", () => {
  it("counts a run of roles on one staff (Joe Doyle, Williams since 1985; Andy Frye, Centre since 1989)", () => {
    const doyle = mstint("williams", "Assistant Coach", 1985, null, { isCurrent: true });
    expect(staffRun(doyle, [doyle, mstint("hoosac", "Head Coach", 1968, 1984)], 2026)?.seasons).toBe(42);
    const frye = mstint("centre", "Head Coach", 1998, null, { isCurrent: true });
    const run = staffRun(frye, [frye, mstint("centre", "Associate Head Coach / Defensive Coordinator", 1989, 1997)], 2026);
    expect(run?.firstSeason).toBe(1989);
    expect(run?.seasons).toBe(38);
  });
  it("claims no count the source doesn't state", () => {
    const cur = mstint("x", "Head Coach", 2010, null, { isCurrent: true });
    expect(staffRun({ ...cur, yearsExplicit: false }, [], 2026)).toBeNull();
    // An inferred earlier role in the run (Steve Wiser, 1974–1976 inferred).
    expect(staffRun(cur, [cur, mstint("x", "Assistant", 2005, 2009, { yearsExplicit: false })], 2026)).toBeNull();
    // An undated or open-ended earlier role at the program may belong to the run.
    expect(staffRun(cur, [cur, mstint("x", "Assistant", null, null)], 2026)).toBeNull();
    expect(staffRun(cur, [cur, mstint("x", "Assistant", 1999, null)], 2026)).toBeNull();
    // Time away: "Nth season on the staff" would be ambiguous.
    expect(staffRun(cur, [cur, mstint("x", "Assistant", 1993, 1997)], 2026)).toBeNull();
    // Playing there and other sports don't count against it.
    expect(staffRun(cur, [cur, mstint("x", "Player", 2000, 2003, { asPlayer: true }), mstint("x", "Throwers Coach", null, null, { sport: "track and field" })], 2026)?.seasons).toBe(17);
  });
  it("marks the 10th, 15th, 20th and every season from the 25th", () => {
    expect([9, 10, 11, 15, 20, 24, 25, 42].map(isMilestoneSeason)).toEqual([false, true, false, true, true, false, true, true]);
  });
});
