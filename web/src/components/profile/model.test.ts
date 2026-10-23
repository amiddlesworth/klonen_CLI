import { describe, expect, it } from "vitest";
import type { LinkYears } from "./linkYears";
import {
  buildLedger,
  byTenure,
  coachingSeasons,
  coachingStops,
  currentHeadline,
  firstSeason,
  groupText,
  levelLine,
  otherSportRoleCount,
  playingLine,
  roleTitle,
  staffOnlyRoleCount,
  stripStints,
  treeRunsView,
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
    expect(levelLine(basketball)).toBe("Head coach · Not counted in football seasons");
    expect(levelLine(row({ role: "Head Track and Field Coach", roleGroup: "other", sport: "track and field" }))).toBe("Head coach · Not counted in football seasons");
    expect(levelLine(row({ role: "Equipment Manager", roleGroup: "other", sport: "athletic department (all sports)" }))).toBe("Not counted in football seasons");
    expect(playingLine(baseballPlayer)).toBe("Baseball · Player (catcher)");
  });

  it("names the sport on the role line of a stint in another sport", () => {
    const ledger = buildLedger([...football, basketball]);
    const titles = ledger[0].items.flatMap((i) => (i.kind === "role" ? [i.title] : []));
    expect(titles).toContain("Head women's basketball coach");
    expect(titles).toContain("Assistant Coach / Outside Linebackers");
    const t = (role: string, sport: string) => roleTitle(row({ role, roleGroup: "other", sport }));
    expect(t("Assistant Coach", "basketball")).toBe("Assistant basketball coach");
    expect(t("Coach", "baseball")).toBe("Baseball coach");
    expect(t("Varsity Head Coach", "baseball")).toBe("Varsity head baseball coach");
    expect(t("Head Baseball Coach", "baseball")).toBe("Head Baseball Coach");
    expect(t("Assistant Track Coach", "track and field")).toBe("Assistant Track Coach");
    expect(t("Head Men's Lacrosse Coach", "men's lacrosse")).toBe("Head Men's Lacrosse Coach");
    expect(t("Sprints / Long Jumps Coach", "track and field")).toBe("Sprints / Long Jumps Coach · Track and field");
    expect(t("Head Coach / Offensive Coordinator", "women's tackle football")).toBe("Head Coach / Offensive Coordinator · Women's tackle football");
    expect(t("Coach", "unspecified")).toBe("Coach");
    expect(roleTitle(row({ role: "Head Coach" }))).toBe("Head Coach");
  });

  it("counts an unclassified football role only when its title names a coaching job", () => {
    const liaison = row({ role: "Faculty Liaison", roleGroup: "other", isCurrent: true, orgId: "whittier" });
    const coach = row({ role: "Coach", roleGroup: "other", startYear: 2010, endYear: 2011, orgId: "phenix" });
    expect(coachingStops([liaison])).toBe(0);
    expect(staffOnlyRoleCount([liaison, coach])).toBe(1);
    expect(coachingSeasons([liaison, coach])).toEqual([2010, 2011]);
    expect(coachingStops([liaison, coach])).toBe(1);
  });

  it("never prints a bare 'Other' for an unclassified football role, and rows without a sport count as football", () => {
    expect(levelLine(row({ role: "Faculty Liaison", roleGroup: "other" }))).toBe("Football staff, not a coaching role");
    expect(levelLine(row({ role: "Coach", roleGroup: "other" }))).toBe("Level not in source");
    expect(levelLine(row({ roleGroup: "coordinator", unit: "special_teams" }))).toBe("Coordinator · Special teams");
    const noSport = row({ startYear: 2020, endYear: 2021, sport: undefined });
    expect(coachingSeasons([noSport])).toEqual([2020, 2021]);
  });
});

describe("groupText", () => {
  it("shows gaps between stints and never stretches a start to Present", () => {
    expect(groupText([{ startYear: 2014, endYear: null, isCurrent: true }, { startYear: 1995, endYear: 1996, isCurrent: false }])).toMatchObject({
      range: "1995–1996, 2014–Present",
      count: "15 seasons · 2 stints",
    });
  });
  it("keeps the gap when a role has no start year, and says years are missing instead of counting", () => {
    expect(groupText([{ startYear: null, endYear: null, isCurrent: true }, { startYear: 1995, endYear: 1996, isCurrent: false }])).toMatchObject({
      range: "1995–1996, Present",
      count: "Some years not in source",
    });
  });
  it("words a group with no start year at all", () => {
    expect(groupText([{ startYear: null, endYear: null, isCurrent: true }, { startYear: null, endYear: 2010, isCurrent: false }])).toMatchObject({
      range: "Current",
      count: "Start year not in source",
    });
  });
});

describe("one current title per page (X19)", () => {
  const current = row({ role: "Special Teams Coordinator / Safeties Coach", startYear: 2024, isCurrent: true, orgId: "pacific" });
  const past = row({ role: "Graduate Assistant", startYear: 2020, endYear: 2023, orgId: "pacific" });
  it("shows the directory title on the current role and keeps the bio's wording for its Source", () => {
    const ledger = buildLedger([current, past], { orgId: "pacific", directoryTitle: "Special Teams Coordinator / Defensive Backs Coach" });
    const [now, before] = ledger[0].items.filter((i) => i.kind === "role");
    expect(now).toMatchObject({ title: "Special Teams Coordinator / Defensive Backs Coach", bioTitle: "Special Teams Coordinator / Safeties Coach" });
    expect(before).toMatchObject({ title: "Graduate Assistant", bioTitle: null });
    expect(currentHeadline([current, past], "pacific", "Special Teams Coordinator / Defensive Backs Coach")).toBe(now.kind === "role" ? now.title : "");
  });
  it("keeps the bio title when there is no directory title", () => {
    const ledger = buildLedger([current], { orgId: "pacific", directoryTitle: null });
    expect(ledger[0].items[0]).toMatchObject({ title: "Special Teams Coordinator / Safeties Coach", bioTitle: null });
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

describe("treeRunsView", () => {
  it("shows every period of a pair, oldest first, with Current last", () => {
    const runs = treeRunsView([years({ startYear: 2010, endYear: 2012 }), years({ startYear: 2016, endYear: 2019 }), years({ ongoing: true })], () => undefined);
    expect(runs.map((r) => r.kind)).toEqual(["range", "range", "current"]);
    expect(runs[0]).toMatchObject({ startYear: 2010, endYear: 2012 });
  });
  it("drops periods the source doesn't pin", () => {
    expect(treeRunsView([years({}), years({ startYear: 2020, endYear: 2021 })], () => undefined)).toHaveLength(1);
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
