import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeasonStrip, type StripStint } from "./SeasonStrip";
import { keepParen } from "./TitleOrg";

// Vitest compiles the component's JSX with the classic runtime (React.createElement).
Object.assign(globalThis, { React });

const stint = (shortName: string, startYear: number, endYear: number | null, isCurrent = false): StripStint => ({
  orgId: shortName,
  shortName,
  name: shortName,
  roleGroup: "position_coach",
  startYear,
  endYear,
  isCurrent,
});

/** The phone-only labels (md:hidden spans) and axis years hidden on phone (max-md:hidden). */
function phoneParts(stints: StripStint[]) {
  const html = renderToStaticMarkup(React.createElement(SeasonStrip, { stints, currentSeason: 2026 }));
  const labels = [...html.matchAll(/<span[^>]*class="([^"]*md:hidden[^"]*)"[^>]*>([^<]*)<\/span>/g)]
    .filter(([, cls]) => /(^|\s)md:hidden/.test(cls))
    .map(([, cls, text]) => ({ text, end: cls.includes("text-right") }));
  const hiddenYears = [...html.matchAll(/<span[^>]*class="num [^"]*max-md:hidden[^"]*"[^>]*>(\d{4})<\/span>/g)].map((m) => Number(m[1]));
  return { labels, hiddenYears };
}

describe("SeasonStrip on phone", () => {
  it("shows a program's short name when it fits from its first season to the end of the strip", () => {
    const { labels } = phoneParts([stint("West Linn", 2002, 2002), stint("Lewis & Clark", 2003, 2009), stint("Pacific (OR)", 2010, null, true)]);
    expect(labels.map((l) => l.text)).toEqual(["West Linn", "Lewis &amp; Clark", "Pacific (OR)"]);
    expect(labels.every((l) => !l.end)).toBe(true);
  });

  it("end-aligns a label that would run past the last season", () => {
    const { labels } = phoneParts([stint("Concordia (WI)", 2005, 2024), stint("Franklin & Marshall", 2025, null, true)]);
    expect(labels.find((l) => l.text.startsWith("Franklin"))?.end).toBe(true);
  });

  it("skips a decade label that would run into the current season's", () => {
    const { hiddenYears } = phoneParts([stint("Long Career", 1985, null, true)]);
    expect(hiddenYears).toContain(2020);
    expect(hiddenYears).not.toContain(2026);
    expect(hiddenYears).not.toContain(1985);
  });
});

describe("keepParen", () => {
  it("never lets a program name break inside or before its parenthetical", () => {
    expect(keepParen("Pacific (OR)")).toBe("Pacific (OR)");
    expect(keepParen("Saint John's (New York)")).toBe("Saint John's (New York)");
    expect(keepParen("Lewis & Clark")).toBe("Lewis & Clark");
  });
});
