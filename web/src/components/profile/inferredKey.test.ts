import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INFERRED_LEGEND, InferredKey } from "@/components/data/InferredYear";
import { playingDottedYear } from "./CareerEntries";
import { ledgerDottedYear } from "./ExperienceCard";
import { dottedYear } from "./LedgerRange";
import type { LedgerGroup, RangeText, SportRow } from "./model";

// Vitest compiles the components' JSX with the classic runtime (React.createElement).
Object.assign(globalThis, { React });

/* Audit C03: the inferred-year key quotes a year the card actually dots, never a literal "2004". */

const text = (range: string, extra: Partial<RangeText> = {}): RangeText => ({ range, count: null, undated: false, ...extra });

describe("dottedYear (LedgerRange's mark)", () => {
  it("is the start of a current range and the first year of a closed one", () => {
    expect(dottedYear(text("2017–Present"), true)).toBe(2017);
    expect(dottedYear(text("2010–2019"), true)).toBe(2010);
    expect(dottedYear(text("2003, 2006–2009"), true)).toBe(2003);
    expect(dottedYear(text("2000", { lead: "Through " }), true)).toBe(2000);
  });
  it("is null when nothing is dotted", () => {
    expect(dottedYear(text("2017–Present"), false)).toBeNull();
    expect(dottedYear(text("Years not in source", { undated: true }), true)).toBeNull();
    expect(dottedYear(text("Current", { noYear: true }), true)).toBeNull();
  });
});

const org = { id: "o", slug: "o", name: "O", shortName: "O", nickname: null, level: null, conference: null, conferenceAbbr: null, state: null, inRegistry: false, kind: "college" };
const group = (range: RangeText, inferred: boolean, roles: { range: RangeText; inferred: boolean }[] = [], dated = true): LedgerGroup =>
  ({
    org,
    items: roles.map((r, i) => ({ kind: "role", role: { id: i }, title: "Coach", bioTitle: null, range: r.range, inferred: r.inferred, reason: "", awayAfter: false })),
    roleCount: Math.max(1, roles.length),
    range,
    inferred,
    reason: "",
    isCurrent: false,
    dated,
  }) as unknown as LedgerGroup;

describe("ledgerDottedYear", () => {
  it("takes the first dotted year in display order", () => {
    const groups = [group(text("2021–Present"), false), group(text("2017–2020"), true), group(text("2012–2016"), true)];
    expect(ledgerDottedYear(groups)).toBe(2017);
  });
  it("reads role ranges only when the program has two or more roles", () => {
    const multi = group(text("2015–2020"), false, [
      { range: text("2018–2020"), inferred: true },
      { range: text("2015–2017"), inferred: false },
    ]);
    expect(ledgerDottedYear([multi])).toBe(2018);
  });
  it("lists undated programs last and is null when no year is dotted", () => {
    expect(ledgerDottedYear([group(text("Years not in source", { undated: true }), true, [], false), group(text("2019–2022"), false)])).toBeNull();
  });
});

describe("playingDottedYear", () => {
  it("is the first inferred playing season", () => {
    const row = (startYear: number, endYear: number, yearsExplicit: boolean) => ({ startYear, endYear, isCurrent: false, yearsExplicit }) as unknown as SportRow;
    expect(playingDottedYear([row(1993, 1996, true), row(1997, 2000, false)])).toBe(1997);
    expect(playingDottedYear([row(1993, 1996, true)])).toBeNull();
  });
});

describe("InferredKey", () => {
  it("shows the given year with the legend wording", () => {
    const html = renderToStaticMarkup(React.createElement(InferredKey, { year: 2017 }));
    expect(html).toContain(">2017<");
    expect(html).toContain(INFERRED_LEGEND);
    expect(html).not.toContain("2004");
  });
  it("without a year, marks the word 'Dotted' in the footnote wording", () => {
    const html = renderToStaticMarkup(React.createElement(InferredKey));
    expect(html).toContain('<span class="inf cursor-default">Dotted</span> years are inferred from the staff bio, not stated in it.');
  });
});
