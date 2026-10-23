import { describe, expect, it } from "vitest";
import type { LinkYears } from "./linkYears";
import {
  buildLedger,
  byTenure,
  coachingSeasons,
  coachingStops,
  currentHeadline,
  firstSeason,
  levelLine,
  otherSportRoleCount,
  playingLine,
  stripStints,
  treeYearsView,
  undatedRoleCount,
  type SportRow,
} from "./model";

let nextId = 1;
const org = (id: string) => ({
  id,
  slug: id,
  name: id,
  shortName: id,
  nickname: null,
  level: "NCAA D-III",
  conference: null,
  conferenceAbbr: null,
  state: null,
  inRegistry: true,
  kind: "college" as const,
});
const row = (o: Partial<SportRow> & { orgId?: string }): SportRow => ({
  id: nextId++,
  role: "Assistant Coach",
  roleGroup: "position_coach",
  unit: null,
  startYear: null,
  endYear: null,
  isCurrent: false,
  asPlayer: false,
  yearsExplicit: true,
  evidence: null,
  sourceUrl: null,
  verified: false,
  sport: "football",
  org: org(o.orgId ?? "stout"),
  ...o,
});

// Mark Thomas, as at Wisconsin-Stout: football assistant 2019–present, an assistant stint ending 2012,
// and 31 seasons as the women's basketball head coach.
const football = [
  row({ role: "Assistant Coach / Outside Linebackers", startYear: 2019, isCurrent: true }),
  row({ role: "Assistant Coach", endYear: 2012 }),
];
const basketball = row({ role: "Head Coach", roleGroup: "other", sport: "women's basketball", startYear: 1987, endYear: 2017, orgId: "stout" });
const baseballPlayer = row({ role: "Player (catcher)", roleGroup: "player", sport: "baseball", asPlayer: true, orgId: "college" });

describe("football coaching only", () => {
  it("a basketball head-coach stint changes no season count, first season, stop count or strip", () => {
    const without = [...football];
    const withIt = [...football, basketball, baseballPlayer];
    expect(coachingSeasons(withIt)).toEqual(coachingSeasons(without));
    expect(coachingSeasons(withIt)).toHaveLength(8);
    expect(firstSeason(withIt)).toEqual(firstSeason(without));
    expect(firstSeason(withIt)?.year).toBe(2019);
    expect(stripStints(withIt)).toEqual(stripStints(without));
    expect(undatedRoleCount(withIt)).toBe(undatedRoleCount(without));
    expect(coachingStops([basketball, row({ orgId: "olympia", role: "Coach", roleGroup: "other", sport: "boxing" })])).toBe(0);
    expect(coachingStops(withIt)).toBe(1);
    expect(otherSportRoleCount(withIt)).toBe(1);
  });

  it("keeps the other sport's role in Experience, named by its sport", () => {
    const ledger = buildLedger([...football, basketball]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].roleCount).toBe(3);
    expect(levelLine(basketball)).toBe("Women's basketball · Head coach");
    expect(levelLine(row({ role: "Head Track and Field Coach", roleGroup: "other", sport: "track and field" }))).toBe("Track and field · Head coach");
    expect(levelLine(row({ role: "Equipment Manager", roleGroup: "other", sport: "athletic department (all sports)" }))).toBe("Athletic department (all sports)");
    expect(playingLine(baseballPlayer)).toBe("Baseball · Player (catcher)");
  });

  it("never prints a bare 'Other' for an unclassified football role, and rows without a sport count as football", () => {
    expect(levelLine(row({ role: "Faculty Liaison", roleGroup: "other" }))).toBe("Level not in source");
    expect(levelLine(row({ roleGroup: "coordinator", unit: "special_teams" }))).toBe("Coordinator · Special teams");
    const noSport = row({ startYear: 2020, endYear: 2021, sport: undefined });
    expect(coachingSeasons([noSport])).toEqual([2020, 2021]);
  });
});

describe("currentHeadline", () => {
  const stint = row({ role: "Special Teams Coordinator / Safeties Coach", startYear: 2023, isCurrent: true, orgId: "pacific" });
  it("uses the directory title every other surface shows", () => {
    expect(currentHeadline([stint], "pacific", "Special Teams Coordinator / Defensive Backs Coach")).toBe("Special Teams Coordinator / Defensive Backs Coach");
  });
  it("falls back to the current football coaching stint", () => {
    expect(currentHeadline([stint], "pacific", null)).toBe("Special Teams Coordinator / Safeties Coach");
    expect(currentHeadline([row({ ...basketball, isCurrent: true, endYear: null, orgId: "pacific" })], "pacific", null)).toBeNull();
  });
});

const years = (o: Partial<LinkYears>): LinkYears => ({ ongoing: false, startYear: null, endYear: null, inferred: false, inferredFrom: null, ...o });

describe("treeYearsView", () => {
  it("marks only the inferred bound", () => {
    const v = treeYearsView(
      years({ startYear: 2016, endYear: 2019, inferred: true, startInferred: false, endInferred: true, endFrom: { personId: "a", evidence: "two years" } }),
      () => "Ann Lee",
    );
    expect(v).toMatchObject({ kind: "range", startInferred: false, endInferred: true, inferred: true });
    expect(v.kind === "range" && v.endReason).toContain("two years");
  });
  it("never marks the end of an ongoing run", () => {
    const v = treeYearsView(years({ ongoing: true, startYear: 2020, inferred: true, startInferred: true, endInferred: false }), () => undefined);
    expect(v).toMatchObject({ kind: "range", endYear: null, startInferred: true, endInferred: false });
  });
});

describe("byTenure", () => {
  const link = (name: string, y: Partial<LinkYears>) => ({ person: { fullName: name }, years: years(y) });
  it("lists current staff first, then past links by end year, then links without years", () => {
    const sorted = [
      link("Lukkes Gilgan", { startYear: 2020, endYear: 2024 }),
      link("Ben LoPrimo", { ongoing: true }),
      link("Declan Brown", { startYear: 2021, endYear: 2022 }),
      link("Jay Williams", { ongoing: true, startYear: 2023 }),
      link("Zed Nobody", {}),
      link("Jesse Browning", { ongoing: true, startYear: 2021 }),
      link("Abe Current", { ongoing: true }),
    ].sort(byTenure);
    expect(sorted.map((l) => l.person.fullName)).toEqual([
      "Jesse Browning",
      "Jay Williams",
      "Abe Current",
      "Ben LoPrimo",
      "Lukkes Gilgan",
      "Declan Brown",
      "Zed Nobody",
    ]);
  });
});
