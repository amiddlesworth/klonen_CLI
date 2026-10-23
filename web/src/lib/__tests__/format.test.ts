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
  seasonSpans,
  seasonsCovered,
  sourceDomain,
  tintFor,
  titleShort,
} from "../format";
import { CURRENT_SEASON } from "../brand";

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
  it("skips generational suffixes in initials", () => {
    expect(initials("Gerald Harrison Jr.")).toBe("GH");
    expect(initials("Bob Smith III")).toBe("BS");
    expect(initials("DeMontre Thomas II")).toBe("DT");
    expect(initials("Brandon Renford Sr.")).toBe("BR");
    expect(initials("Chris Rutledge, Jr.")).toBe("CR");
    expect(initials("Mike Lago, Sr.")).toBe("ML");
    expect(initials("Roy Dangel. Jr.")).toBe("RD");
  });
  it("skips class years and degrees in initials", () => {
    expect(initials("Dan Galante '87")).toBe("DG");
    expect(initials("Dan Galante ’87")).toBe("DG");
    expect(initials("Tim Viall '23M")).toBe("TV");
    expect(initials("Jason Lebeau '10/'16")).toBe("JL");
    expect(initials("Brenton Miller '21 '24")).toBe("BM");
    expect(initials("Hugh Kirwan '24 MS")).toBe("HK");
    expect(initials("Donald Leach III '25")).toBe("DL");
    expect(initials("AJ Glines '18, DPT '21")).toBe("AG");
    expect(initials("Tucker Buzzell '24, '24G")).toBe("TB");
  });
  it("skips honorifics, ranks and nicknames in initials", () => {
    expect(initials("Dr. Karl Liedtka '91")).toBe("KL");
    expect(initials("Dr. Eric Calhoun")).toBe("EC");
    expect(initials("LCDR Paul Puddington '16")).toBe("PP");
    expect(initials("Lt. Col William Atwell")).toBe("WA");
    expect(initials("LT Anthony Kostek")).toBe("AK");
    expect(initials('Carl "Oz" Reinholz')).toBe("CR");
  });
  it("keeps ordinary names with apostrophes, periods and particles", () => {
    expect(initials("De'Queze Fryer")).toBe("DF");
    expect(initials("T.J. Lockett")).toBe("TL");
    expect(initials("Jake O'Donnell")).toBe("JO");
    expect(initials("Clement S. Hong")).toBe("CH");
    expect(initials("St. Clair Ryan")).toBe("SR");
    expect(initials("Dr.")).toBe("D");
    expect(initials("")).toBe("");
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
  it("never stretches an old start year to Present across an undated current role", () => {
    // duane-russell at Azusa Pacific: current role with no start year, 1993–1995, 1984.
    const azusa = [
      { startYear: null, endYear: null, isCurrent: true },
      { startYear: 1993, endYear: 1995, isCurrent: false },
      { startYear: 1984, endYear: null, isCurrent: false },
    ];
    expect(seasonRangeMulti(azusa)).toEqual({ range: "1984, 1993–1995, Present", count: "5 seasons · 3 stints" });
    expect(seasonsCovered(azusa)).toBe(5);
  });
  it("shows a gap before a dated current stint", () => {
    // bill-giovino-88 at Lebanon Valley: 1995–1996, then 2014–Present.
    const lvc = [
      { startYear: 2014, endYear: null, isCurrent: true },
      { startYear: 1995, endYear: 1996, isCurrent: false },
    ];
    expect(seasonRangeMulti(lvc)).toEqual({ range: "1995–1996, 2014–Present", count: "15 seasons · 2 stints" });
    expect(seasonsCovered(lvc)).toBe(15);
  });
  it("joins roles that connect, including an undated current role right after a dated one", () => {
    const promoted = [
      { startYear: null, endYear: null, isCurrent: true },
      { startYear: 2018, endYear: 2025, isCurrent: false },
    ];
    expect(seasonRangeMulti(promoted)).toEqual({ range: "2018–Present", count: "9 seasons" });
    expect(seasonSpans(promoted)).toEqual([{ start: 2018, end: CURRENT_SEASON, isCurrent: true, undatedCurrent: false }]);
    const adjacent = [
      { startYear: 2021, endYear: null, isCurrent: true },
      { startYear: 2017, endYear: 2020, isCurrent: false },
    ];
    expect(seasonRangeMulti(adjacent)).toEqual({ range: "2017–Present", count: "10 seasons" });
  });
  it("keeps a dated start when a role starts this season alongside an undated current one", () => {
    const spans = seasonSpans([
      { startYear: null, endYear: null, isCurrent: true },
      { startYear: CURRENT_SEASON, endYear: null, isCurrent: true },
    ]);
    expect(spans).toEqual([{ start: CURRENT_SEASON, end: CURRENT_SEASON, isCurrent: true, undatedCurrent: false }]);
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

describe("seasonsCovered", () => {
  it("counts distinct seasons, not first-to-last", () => {
    expect(seasonsCovered([{ startYear: 2003, endYear: 2003, isCurrent: false }, { startYear: 2006, endYear: 2009, isCurrent: false }])).toBe(5);
  });
  it("counts concurrent and overlapping roles once", () => {
    expect(
      seasonsCovered([
        { startYear: 2015, endYear: 2019, isCurrent: false },
        { startYear: 2017, endYear: 2018, isCurrent: false },
        { startYear: 2019, endYear: 2020, isCurrent: false },
      ]),
    ).toBe(6);
  });
  it("counts an undated current role as one season, not a span", () => {
    expect(seasonsCovered([{ startYear: null, endYear: null, isCurrent: true }, { startYear: 1984, endYear: null, isCurrent: false }])).toBe(2);
  });
  it("counts a stint known only by its end year as that season", () => {
    // matthew-szymanski: Brockport 2026–current, Brockport 2021, Randolph-Macon ?–2025.
    expect(
      seasonsCovered([
        { startYear: CURRENT_SEASON, endYear: null, isCurrent: true },
        { startYear: 2021, endYear: 2021, isCurrent: false },
        { startYear: null, endYear: 2025, isCurrent: false },
      ]),
    ).toBe(3);
  });
  it("ignores undated past stints and is null when nothing has a start year", () => {
    expect(seasonsCovered([{ startYear: 2010, endYear: 2012, isCurrent: false }, { startYear: null, endYear: null, isCurrent: false }])).toBe(3);
    expect(seasonsCovered([{ startYear: null, endYear: null, isCurrent: true }])).toBeNull();
    expect(seasonsCovered([{ startYear: null, endYear: 2020, isCurrent: false }])).toBeNull();
    expect(seasonsCovered([])).toBeNull();
    expect(seasonRangeMulti([{ startYear: null, endYear: null, isCurrent: true }])).toEqual({ range: "Years not in source", count: null });
  });
  it("counts a dated current role through the current season", () => {
    expect(seasonsCovered([{ startYear: 2024, endYear: null, isCurrent: true }])).toBe(CURRENT_SEASON - 2024 + 1);
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
