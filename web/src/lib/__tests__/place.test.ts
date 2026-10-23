import { describe, expect, it } from "vitest";
import { jobPlace, jobSublineParts, listingKind } from "@/components/jobs/labels";
import { parsePlace, placeLong, placeShort, stateName } from "@/lib/format";

/* One place formatter for every screen (audit X10) and the job listing labels built on it. */

describe("place formatters", () => {
  it("writes City, ST when the city is known and the state alone otherwise", () => {
    expect(placeLong("Forest Grove", "OR")).toBe("Forest Grove, OR");
    expect(placeLong(null, "or")).toBe("OR");
    expect(placeLong("Forest Grove", null)).toBe("Forest Grove");
    expect(placeLong(" ", "")).toBeNull();
    expect(placeShort("tx")).toBe("TX");
    expect(placeShort(null)).toBeNull();
  });

  it("spells a state out only on request", () => {
    expect(stateName("OR")).toBe("Oregon");
    expect(stateName("ZZ")).toBe("ZZ");
    expect(stateName(null)).toBeNull();
  });

  it("parses a posted location", () => {
    expect(parsePlace("Forest Grove, OR")).toEqual({ city: "Forest Grove", state: "OR" });
    expect(parsePlace("tx")).toEqual({ city: null, state: "TX" });
    expect(parsePlace("Sherman")).toEqual({ city: "Sherman", state: null });
    expect(parsePlace(null)).toEqual({ city: null, state: null });
  });
});

const org = { shortName: "Pacific (OR)", name: "Pacific University (Oregon)", city: null, state: "OR", conferenceAbbr: "NWC[a]" };

describe("job meta line", () => {
  it("uses the posted city with the program's state, never dropping the state", () => {
    expect(jobPlace({ location: "Forest Grove, OR", org })).toBe("Forest Grove, OR");
    expect(jobPlace({ location: "Forest Grove", org })).toBe("Forest Grove, OR");
    expect(jobPlace({ location: "OR", org })).toBe("OR");
    expect(jobPlace({ location: null, org })).toBe("OR");
  });

  it("reads short name · place · conference · type", () => {
    expect(jobSublineParts({ employmentType: "Full-time", location: null, org })).toEqual(["Pacific (OR)", "OR", "NWC", "Full-time"]);
    expect(jobSublineParts({ employmentType: "Full-time", location: "Forest Grove, OR", org }, { type: false })).toEqual(["Pacific (OR)", "Forest Grove, OR", "NWC"]);
  });

  it("labels seeded samples and demo posts apart", () => {
    expect(listingKind({ source: "sample", isDemo: true })).toBe("sample");
    expect(listingKind({ source: "native", isDemo: true })).toBe("demo");
    expect(listingKind({ source: "native", isDemo: false })).toBeNull();
  });
});
