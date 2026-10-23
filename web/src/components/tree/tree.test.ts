import { describe, expect, it } from "vitest";
import { edgeYears, type YearStint } from "@/components/profile/linkYears";
import { downInLineage, lineageRuns, upInLineage } from "./lineage";
import { compactParts, treeEdgeYears, yearsDisplay, yearsInWords } from "./years";

describe("lineage time order", () => {
  // Ian Falconer worked under Jeff Ramsey at Oberlin 2004–05. Ramsey worked under Jeff Thomas at Puget
  // Sound 2014–15 and under Greg Debeljak at Case Western 2022–26, years after coaching Ian.
  const ianUnderRamsey = { startYear: 2004, endYear: 2005 };
  const ramseyUnderThomas = { startYear: 2014, endYear: 2015 };
  const ramseyUnderDebeljak = { startYear: 2022, endYear: 2026 };

  it("drops grand-mentors the mentor only worked under later (Ian → Ramsey → Debeljak)", () => {
    expect(upInLineage(ianUnderRamsey, ramseyUnderDebeljak)).toBe(false);
    expect(upInLineage(ianUnderRamsey, ramseyUnderThomas)).toBe(false);
    expect(lineageRuns("up", [ianUnderRamsey], [ramseyUnderThomas, ramseyUnderDebeljak])).toEqual([]);
  });

  it("keeps grand-mentors from before or during the first-level run", () => {
    expect(upInLineage(ianUnderRamsey, { startYear: 1998, endYear: 2001 })).toBe(true);
    expect(upInLineage(ianUnderRamsey, { startYear: 2005, endYear: 2008 })).toBe(true);
  });

  it("the same triple read downward: Ian is not in Debeljak's tree two steps down", () => {
    // Debeljak coached Ramsey 2022–26; Ramsey coached Ian 2004–05, before ever joining Debeljak's staff.
    expect(downInLineage(ramseyUnderDebeljak, ianUnderRamsey)).toBe(false);
    // Someone who coached under Ramsey at Case Western in 2024 is part of Debeljak's tree.
    expect(downInLineage(ramseyUnderDebeljak, { startYear: 2024, endYear: 2026 })).toBe(true);
  });

  it("a missing year never rules a link out", () => {
    expect(upInLineage({ startYear: 2004, endYear: null }, ramseyUnderDebeljak)).toBe(true);
    expect(downInLineage(ianUnderRamsey, { startYear: null, endYear: null })).toBe(true);
  });
});

const stint = (personId: string, o: Partial<YearStint>): YearStint => ({
  personId,
  orgId: "pacific",
  roleGroup: "position_coach",
  sport: "football",
  startYear: null,
  endYear: null,
  isCurrent: false,
  asPlayer: false,
  yearsExplicit: true,
  evidence: `${personId} evidence`,
  ...o,
});
const under = (mentorId: string, menteeId: string, startYear: number, endYear: number) =>
  ({ kind: "worked_under", mentorId, menteeId, orgId: "pacific", startYear, endYear }) as const;

describe("treeEdgeYears", () => {
  const ian = [stint("ian", { roleGroup: "head_coach", startYear: 2020, isCurrent: true, yearsExplicit: false })];

  it("reads an undated current stint as Current, never a 2026 start", () => {
    const roscoe = [stint("roscoe", { isCurrent: true, yearsExplicit: false })];
    const y = treeEdgeYears(under("ian", "roscoe", 2026, 2026), [...ian, ...roscoe]);
    expect(yearsDisplay(y)).toBe("current");
    expect(compactParts(y)).toEqual([]);
    expect(yearsInWords(y)).toBe("current (start year not in source)");
  });

  it("dots only the bound that is inferred", () => {
    // Ramsey head coach at Oberlin 2000–2010 (explicit); Ian assistant 2004–2005, end year inferred.
    const stints = [
      stint("ramsey", { orgId: "pacific", roleGroup: "head_coach", startYear: 2000, endYear: 2010 }),
      stint("ian2", { startYear: 2004, endYear: 2005 }),
      stint("ian2", { startYear: 2006, endYear: 2006, yearsExplicit: false, roleGroup: "player", asPlayer: true }),
    ];
    const explicit = treeEdgeYears(under("ramsey", "ian2", 2004, 2005), stints);
    expect(explicit).toMatchObject({ startYear: 2004, endYear: 2005, startInferred: false, endInferred: false });

    const mixed = [stints[0], stint("ian2", { startYear: 2004, endYear: 2005, yearsExplicit: false, evidence: "two seasons" })];
    const y = treeEdgeYears(under("ramsey", "ian2", 2004, 2005), mixed);
    expect(y).toMatchObject({ startInferred: true, endInferred: true });
    expect(compactParts(y)).toEqual([
      { text: "2004", inferred: true },
      { text: "–", inferred: false },
      { text: "05", inferred: true },
    ]);
  });

  it("an ongoing run with an inferred start dots the start year", () => {
    const kit = [stint("kit", { startYear: 2018, isCurrent: true })];
    const y = treeEdgeYears(under("ian", "kit", 2020, 2026), [...ian, ...kit]);
    expect(compactParts(y)).toEqual([
      { text: "2020", inferred: true },
      { text: "–", inferred: false },
    ]);
    expect(y.inferredFrom).toEqual([{ personId: "ian", evidence: "ian evidence" }]);
  });

  it("agrees with the profile's edgeYears on what is shown and whether it is inferred", () => {
    const cases: [ReturnType<typeof under>, YearStint[]][] = [
      [under("ian", "roscoe", 2026, 2026), [...ian, stint("roscoe", { isCurrent: true, yearsExplicit: false })]],
      [under("ian", "kit", 2020, 2026), [...ian, stint("kit", { startYear: 2018, isCurrent: true })]],
      [under("ian", "ben", 2022, 2024), [...ian, stint("ben", { startYear: 2022, endYear: 2024 })]],
      [under("ian", "dee", 2024, 2024), [...ian, stint("dee", { endYear: 2024 })]],
    ];
    for (const [edge, stints] of cases) {
      const mine = treeEdgeYears(edge, stints);
      const profile = edgeYears(edge, stints);
      expect({ ongoing: mine.ongoing, startYear: mine.startYear, endYear: mine.endYear, inferred: mine.startInferred || mine.endInferred }).toEqual({
        ongoing: profile.ongoing,
        startYear: profile.startYear,
        endYear: profile.endYear,
        inferred: profile.inferred,
      });
    }
  });
});
