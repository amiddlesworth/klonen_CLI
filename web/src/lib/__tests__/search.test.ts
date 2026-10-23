import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/db";
import { escapeLike } from "@/lib/queries/orgs";
import { typeahead } from "@/lib/queries/search";

/*
 * Typeahead ranking against the seeded database (npm run db:reset). Skipped when Postgres is not
 * reachable, so the pure unit tests still run anywhere.
 */
let dbUp = false;
beforeAll(async () => {
  dbUp = await pool
    .query("select 1 from people limit 1")
    .then(() => true)
    .catch(() => false);
});
afterAll(async () => {
  await pool.end().catch(() => undefined);
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("typeahead ranking", () => {
  it("puts an exact first-name match ahead of substring matches ('ian' → Ian Falconer)", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { people } = await typeahead("ian");
    expect(people[0]?.fullName).toBe("Ian Falconer");
    expect(people.every((p) => /^ian\b/i.test(p.fullName))).toBe(true);
  });

  it("puts a name prefix ahead of later-word matches ('tan' finds Tanner Kingsley)", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { people } = await typeahead("tan");
    expect(people.map((p) => p.fullName)).toContain("Tanner Kingsley");
    const firstWordStart = people.findIndex((p) => !/^tan/i.test(p.fullName));
    if (firstWordStart >= 0) expect(people.slice(firstWordStart).every((p) => !/^tan/i.test(p.fullName))).toBe(true);
  });

  it("puts an exact program short name first ('mit' → MIT)", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { orgs } = await typeahead("mit");
    expect(orgs[0]?.shortName).toBe("MIT");
  });

  it("puts a name prefix ahead of a later word ('pacific' → Pacific (OR) before Azusa Pacific)", async (ctx) => {
    if (!dbUp) ctx.skip();
    const names = (await typeahead("pacific")).orgs.map((o) => o.shortName);
    expect(names[0]).toBe("Pacific (OR)");
    expect(names.indexOf("Azusa Pacific")).toBeGreaterThan(names.indexOf("Pacific Lutheran"));
  });

  it("matches an exact conference abbreviation ('nwc')", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { orgs } = await typeahead("nwc");
    expect(orgs.length).toBeGreaterThan(0);
    expect(orgs.every((o) => o.conferenceAbbr === "NWC")).toBe(true);
  });
});
