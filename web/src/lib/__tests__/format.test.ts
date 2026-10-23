import { describe, expect, it } from "vitest";
import { hueFor, initials, levelShort, salaryRange, seasonCount, seasonRange } from "../format";

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
    expect(seasonRange(null, null, true)).toEqual({ range: "Present", count: null });
    expect(seasonRange(null, null, false)).toEqual({ range: "Dates not listed", count: null });
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
