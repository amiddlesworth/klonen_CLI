import { describe, expect, it } from "vitest";
import { seasonRangeMulti } from "@/lib/format";
import { programStaffUnit, staffLedger, type StaffStint, type StaffTenure } from "@/lib/queries/program";

const stint = (role: string, startYear: number | null, endYear: number | null, isCurrent = false, yearsExplicit = true): StaffStint => ({
  role,
  startYear,
  endYear,
  isCurrent,
  yearsExplicit,
  evidence: null,
});

const tenureText = (t: StaffTenure | null) =>
  !t ? null : t.kind === "runs" ? t.pieces.map((p) => (typeof p === "string" ? p : p.text)).join("") : `${t.kind} ${t.year.text}`;

describe("staffLedger (program Staff tab)", () => {
  it("shows the current role's range, with time at the program on its own line", () => {
    // Ian Falconer, Pacific (OR): head coach since 2020, on staff since 2010.
    const l = staffLedger([stint("Head Football Coach", 2020, null, true, false), stint("Assistant Coach / Offensive Line", 2010, 2019)]);
    expect(seasonRangeMulti(l.current)).toEqual({ range: "2020–Present", count: "7 seasons" });
    expect(tenureText(l.tenure)).toBe("since 2010");
    expect(l.earlierRoles).toBe(1);
    expect(l.inferred?.text).toBe("2020");
  });

  it("lists stated gaps at the program", () => {
    // Braden Layer, Allegheny: OC 2017–18, head coach 2023–.
    const l = staffLedger([stint("Head Football Coach", 2023, null, true), stint("Offensive Coordinator / Quarterbacks Coach", 2017, 2018)]);
    expect(seasonRangeMulti(l.current).range).toBe("2023–Present");
    expect(tenureText(l.tenure)).toBe("2017–2018, 2023–Present");
  });

  it("never turns an open-ended earlier stint into a stint break or a one-season count", () => {
    // Matt Wheeler, Wartburg: OC from 2010 (no end year), assistant head coach 2021–.
    const wheeler = staffLedger([stint("Assistant Head Coach", 2021, null, true, false), stint("Offensive Coordinator / Quarterbacks", 2010, null, false, false)]);
    expect(seasonRangeMulti(wheeler.current)).toEqual({ range: "2021–Present", count: "6 seasons" });
    expect(tenureText(wheeler.tenure)).toBe("first 2010");
    // Tom Hinkle, Marietta: head coach with no start year, assistant from 2017.
    const hinkle = staffLedger([stint("Head Football Coach", null, null, true, false), stint("Assistant Coach (Defensive Line)", 2017, null, false, false)]);
    expect(seasonRangeMulti(hinkle.current).range).toBe("Years not in source");
    expect(tenureText(hinkle.tenure)).toBe("first 2017");
    expect(hinkle.inferred?.text).toBe("2017");
  });

  it("says nothing extra when the program time equals the current role", () => {
    // Scott Mueller, WashU: current role 2003–, an earlier OC role from 2010 inside it.
    const l = staffLedger([stint("Assistant Coach - Recruiting Coordinator / Running Backs", 2003, null, true), stint("Offensive Coordinator", 2010, null, false, false)]);
    expect(l.tenure).toBeNull();
    expect(l.earlierRoles).toBe(1);
    expect(staffLedger([stint("Assistant Coach", 2020, null, true)]).tenure).toBeNull();
  });

  it("claims no first year or gap when an earlier stint has no start year", () => {
    const l = staffLedger([stint("Volunteer Coach", null, null, true), stint("Defensive Line Coach", 2015, null), stint("Part-Time Assistant Coach", null, 2014, false, false)]);
    expect(l.tenure).toBeNull();
    expect(l.earlierRoles).toBe(2);
  });

  it("does not count a return to the same title as an earlier role", () => {
    const l = staffLedger([stint("Assistant Coach", 2026, null, true), stint("Assistant Coach", 2015, 2018), stint("Assistant Coach", 1988, 2004)]);
    expect(l.earlierRoles).toBe(0);
    expect(tenureText(l.tenure)).toBe("1988–2004, 2015–2018, 2026–Present");
  });
});

describe("programStaffUnit", () => {
  it("files coaches by their title before a stored support unit", () => {
    expect(programStaffUnit("support", "staff", "Assistant Football Coach")).toBe("assistant");
    expect(programStaffUnit("support", "staff", "Assistant Football Coach / Recruiting Coordinator")).toBe("assistant");
    expect(programStaffUnit("support", "staff", "Recruiting Coordinator / Wide Receivers")).toBe("offense");
  });

  it("lets the title's side of the ball win over a conflicting stored unit", () => {
    expect(programStaffUnit("coordinator", "defense", "Offensive Coordinator / Equipment")).toBe("offense");
    expect(programStaffUnit("position_coach", "offense", "Assistant Football Coach - Defensive Line")).toBe("defense");
    expect(programStaffUnit("position_coach", "offense", "Assistant Coach / Running Backs / Safeties")).toBe("offense");
  });

  it("sends titles led by a non-coaching duty to Support staff", () => {
    expect(programStaffUnit("ga_analyst", null, "Football Equipment Operations / Quality Control")).toBe("support");
    expect(programStaffUnit("ga_analyst", null, "Assistant Coach - Community Outreach")).toBe("support");
    expect(programStaffUnit("support", "staff", "Director of Football Operations")).toBe("support");
    expect(programStaffUnit("support", "staff", "Special Assistant to the Head Coach / Facilities Manager")).toBe("support");
  });

  it("keeps head coaches, special teams leads and plain assistants where they were", () => {
    expect(programStaffUnit("head_coach", "staff", "Head Football Coach")).toBe("head");
    expect(programStaffUnit("coordinator", "defense", "Special Teams Coordinator / Defensive Backs Coach")).toBe("special_teams");
    expect(programStaffUnit("position_coach", null, "Assistant Coach")).toBe("assistant");
    expect(programStaffUnit("ga_analyst", null, "Graduate Assistant")).toBe("assistant");
  });
});
