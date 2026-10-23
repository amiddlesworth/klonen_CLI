import { describe, expect, it } from "vitest";
import {
  availabilityStatus,
  conferenceShort,
  hueFor,
  initials,
  levelFull,
  levelShort,
  orgInitials,
  salaryRange,
  seasonCount,
  seasonRange,
  seasonRangeCompact,
  seasonRangeMulti,
  sourceDomain,
  tintFor,
  titleShort,
} from "../format";

describe("seasonRange", () => {
  it("formats a closed span with an en dash and season count", () => {
    expect(seasonRange(2019, 2022, false)).toEqual({ range: "2019–2022", count: "4 seasons" });
  });
  it("formats a current span through the current season", () => {
    expect(seasonRange(2024, null, true)).toEqual({ range: "2024–Present", count: "3 seasons" });
  });
  it("collapses a single season", () => {
    expect(seasonRange(2021, 2021, false)).toEqual({ range: "2021", count: "1 season" });
    expect(seasonRange(2021, null, false)).toEqual({ range: "2021", count: "1 season" });
  });
  it("handles unknown dates", () => {
    expect(seasonRange(null, null, true)).toEqual({ range: "Years not in source", count: null });
    expect(seasonRange(null, null, false)).toEqual({ range: "Years not in source", count: null });
  });
});

describe("helpers", () => {
  it("counts seasons", () => {
    expect(seasonCount(2010, 2019, false)).toBe(10);
    expect(seasonCount(null, 2019, false)).toBeNull();
  });
  it("builds initials", () => {
    expect(initials("Ian Falconer")).toBe("IF");
    expect(initials("Cher")).toBe("C");
    expect(initials("Jordan Reyes (demo)")).toBe("JR");
  });
  it("gives a stable hue", () => {
    expect(hueFor("abc")).toBe(hueFor("abc"));
    expect(hueFor("abc")).toBeGreaterThanOrEqual(0);
    expect(hueFor("abc")).toBeLessThan(360);
  });
  it("shortens levels and salaries", () => {
    expect(levelShort("NCAA D-III")).toBe("D-III");
    expect(levelShort(null)).toBeNull();
    expect(salaryRange(42000, 50000)).toBe("$42K–$50K");
    expect(salaryRange(null, null)).toBeNull();
  });
});

describe("DESIGN.md §2.3 / §6 helpers", () => {
  it("picks a stable tint 1..6", () => {
    for (const slug of ["ian-falconer", "justin-leatherman", "a", ""]) {
      const t = tintFor(slug);
      expect(t).toBe(tintFor(slug));
      expect(t).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(6);
    }
  });
  it("formats compact ranges", () => {
    expect(seasonRangeCompact(2010, 2019, false)).toBe("2010–19");
    expect(seasonRangeCompact(2020, null, true)).toBe("2020–");
    expect(seasonRangeCompact(2003, 2003, false)).toBe("2003");
    expect(seasonRangeCompact(1998, 2003, false)).toBe("1998–2003");
  });
  it("formats non-contiguous stints at one program", () => {
    expect(
      seasonRangeMulti([
        { startYear: 2003, endYear: 2003, isCurrent: false },
        { startYear: 2006, endYear: 2009, isCurrent: false },
      ]),
    ).toEqual({ range: "2003, 2006–2009", count: "5 seasons · 2 stints" });
    expect(seasonRangeMulti([{ startYear: 2010, endYear: 2019, isCurrent: false }])).toEqual({ range: "2010–2019", count: "10 seasons" });
  });
  it("shortens long titles only", () => {
    expect(titleShort("Head Football Coach")).toBe("Head Football Coach");
    expect(titleShort("Associate Head Coach for Defense / Defensive Coordinator")).toBe("Assoc. HC for Defense / DC");
  });
  it("derives org initials", () => {
    expect(orgInitials("MIT")).toBe("MIT");
    expect(orgInitials("Pacific (OR)", "Pacific University (Oregon)")).toBe("PU");
    expect(orgInitials("Lewis & Clark", "Lewis & Clark College")).toBe("LC");
    expect(orgInitials("Oberlin")).toBe("OB");
  });
  it("labels sources and levels", () => {
    expect(sourceDomain("https://www.goboxers.com/sports/football/roster/coaches/ian-falconer/1")).toBe("goboxers.com");
    expect(levelFull("NCAA D-III")).toBe("NCAA Division III");
    expect(levelFull("NCAA D-I FCS")).toBe("NCAA Division I FCS");
    expect(conferenceShort("NACC[g]")).toBe("NACC");
    expect(conferenceShort("NWC")).toBe("NWC");
  });
});

describe("availabilityStatus", () => {
  it("says who can see it", () => {
    expect(availabilityStatus(false, "search_firms")).toBe("Off · only you see this");
    expect(availabilityStatus(true, "search_firms")).toBe("On · visible to search firms");
    expect(availabilityStatus(true, "selected_programs")).toBe("On · visible to programs you chose");
    expect(availabilityStatus(true, "all_except_current", "Pacific (OR)")).toBe("On · visible to employers except Pacific (OR)");
    expect(availabilityStatus(true)).toBe("On · visible to employers except your program");
  });
});
