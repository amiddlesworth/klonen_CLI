import { describe, expect, it } from "vitest";
import { edgeYears, linkYearsDisplay, playedUnder, type YearStint } from "./linkYears";

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

// Ian: assistant 2010–2019 (explicit), head coach 2020– (inferred), as at Pacific (OR).
const ian = [
  stint("ian", { roleGroup: "head_coach", startYear: 2020, isCurrent: true, yearsExplicit: false }),
  stint("ian", { startYear: 2010, endYear: 2019 }),
];
const under = (menteeId: string, startYear: number, endYear: number) =>
  ({ kind: "worked_under", mentorId: "ian", menteeId, orgId: "pacific", startYear, endYear }) as const;

describe("edgeYears", () => {
  it("never shows a filled-in current season as a start year", () => {
    const ben = [stint("ben", { isCurrent: true, yearsExplicit: false })];
    const y = edgeYears(under("ben", 2026, 2026), [...ian, ...ben]);
    expect(y).toMatchObject({ ongoing: true, startYear: null, inferred: false });
    expect(linkYearsDisplay(y)).toBe("current");
  });

  it("keeps a real start year that ties with an undated current stint", () => {
    // Tanner (undated current) and a peer who started in 2026: they share 2026 for certain.
    const tanner = [stint("tanner", { orgId: "cal", isCurrent: true, yearsExplicit: false })];
    const peer = [stint("peer", { orgId: "cal", startYear: 2026, isCurrent: true })];
    const y = edgeYears({ kind: "worked_alongside", mentorId: "peer", menteeId: "tanner", orgId: "cal", startYear: 2026, endYear: 2026 }, [...tanner, ...peer]);
    expect(y).toMatchObject({ ongoing: true, startYear: 2026, inferred: false });
  });

  it("is not known when only the undated side starts the run", () => {
    const tanner = [stint("tanner", { orgId: "cal", isCurrent: true, yearsExplicit: false })];
    const bill = [stint("bill", { orgId: "cal", startYear: 2015, isCurrent: true })];
    const y = edgeYears({ kind: "worked_alongside", mentorId: "bill", menteeId: "tanner", orgId: "cal", startYear: 2026, endYear: 2026 }, [...tanner, ...bill]);
    expect(linkYearsDisplay(y)).toBe("current");
  });

  it("marks the start inferred when it comes from an inferred stint", () => {
    const justin = [stint("justin", { roleGroup: "coordinator", startYear: 2023, isCurrent: true, yearsExplicit: false })];
    const y = edgeYears(under("justin", 2023, 2026), [...ian, ...justin]);
    expect(y).toMatchObject({ startYear: 2023, inferred: true, inferredFrom: { personId: "justin" } });
  });

  it("uses the head coach's inferred start when the assistant was already on staff", () => {
    const kit = [stint("kit", { startYear: 2021, isCurrent: true }), stint("kit", { startYear: 2018, endYear: 2020 })];
    const y = edgeYears(under("kit", 2020, 2026), [...ian, ...kit]);
    expect(y).toMatchObject({ startYear: 2020, inferred: true, inferredFrom: { personId: "ian" } });
  });

  it("is plain when the deciding stint is explicit", () => {
    const nic = [stint("nic", { startYear: 2025, isCurrent: true })];
    expect(edgeYears(under("nic", 2025, 2026), [...ian, ...nic])).toMatchObject({ startYear: 2025, inferred: false });
  });

  it("dots a closed alongside run from an inferred stint (Jim Craft 2010–12)", () => {
    const jim = [stint("jim", { startYear: 2010, endYear: 2012, yearsExplicit: false }), stint("jim", { roleGroup: "coordinator", startYear: 2020, isCurrent: true })];
    const y = edgeYears({ kind: "worked_alongside", mentorId: "ian", menteeId: "jim", orgId: "pacific", startYear: 2010, endYear: 2012 }, [...ian, ...jim]);
    expect(y).toMatchObject({ ongoing: false, startYear: 2010, endYear: 2012, inferred: true });
  });

  it("shows no range when the end is only a filled-in start year", () => {
    const sam = [stint("sam", { startYear: 2014 })];
    const y = edgeYears({ kind: "worked_alongside", mentorId: "ian", menteeId: "sam", orgId: "pacific", startYear: 2014, endYear: 2014 }, [...ian, ...sam]);
    expect(linkYearsDisplay(y)).toBe("none");
  });
});

describe("playedUnder", () => {
  it("finds the seasons a player overlapped the head coach", () => {
    const rylan = [stint("rylan", { roleGroup: "player", asPlayer: true, startYear: 2024, endYear: 2025 }), stint("rylan", { roleGroup: "ga_analyst", startYear: 2026, isCurrent: true })];
    expect(playedUnder("rylan", "ian", [...ian, ...rylan])).toMatchObject({ ongoing: false, startYear: 2024, endYear: 2025, inferred: false });
  });

  it("is null when they never overlapped", () => {
    const old = [stint("old", { roleGroup: "player", asPlayer: true, startYear: 2012, endYear: 2015 })];
    expect(playedUnder("old", "ian", [...ian, ...old])).toBeNull();
  });
});
