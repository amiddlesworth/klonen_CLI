import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/db";
import { queryRoleGroup, searchPeopleX } from "@/lib/queries/searchx";

/*
 * Search ranking for role queries (audit C01). The DB cases run against the seeded database
 * (npm run db:reset) and are skipped when Postgres is not reachable.
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

describe("queryRoleGroup", () => {
  it("maps role words to the group they mean", () => {
    expect(queryRoleGroup("coordinator")).toBe("coordinator");
    expect(queryRoleGroup("Defensive Coordinator")).toBe("coordinator");
    expect(queryRoleGroup("head coach")).toBe("head_coach");
    expect(queryRoleGroup("Head Football Coach")).toBe("head_coach");
    expect(queryRoleGroup("graduate assistant")).toBe("ga_analyst");
    expect(queryRoleGroup("analyst")).toBe("ga_analyst");
    expect(queryRoleGroup("linebackers")).toBe("position_coach");
    expect(queryRoleGroup("offensive line")).toBe("position_coach");
  });
  it("keeps staff roles and assistant head coaches out of the wrong group", () => {
    expect(queryRoleGroup("recruiting coordinator")).toBe("support");
    expect(queryRoleGroup("video coordinator")).toBe("support");
    expect(queryRoleGroup("assistant head coach")).toBeNull();
    expect(queryRoleGroup("associate head coach")).toBeNull();
  });
  it("names no group for people, programs and places", () => {
    expect(queryRoleGroup("ian falconer")).toBeNull();
    expect(queryRoleGroup("pacific")).toBeNull();
    expect(queryRoleGroup("morgan")).toBeNull();
    expect(queryRoleGroup("")).toBeNull();
  });
});

describe("searchPeopleX role ranking", () => {
  it("puts coordinators first for q='coordinator', not head coaches whose titles mention it", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { results } = await searchPeopleX({ q: "coordinator" });
    expect(results[0]?.roleGroup).toBe("coordinator");
    expect(results.every((r) => r.roleGroup === "coordinator")).toBe(true);
  });
  it("puts head coaches first for q='head coach'", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { results } = await searchPeopleX({ q: "head coach" });
    expect(results[0]?.roleGroup).toBe("head_coach");
  });
  it("ranks a title that starts with the query ahead of one that only mentions it later", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { results } = await searchPeopleX({ q: "defensive coordinator" });
    const titles = results.map((r) => r.currentTitle ?? "");
    const firstLater = titles.findIndex((t) => !/^defensive coordinator/i.test(t));
    if (firstLater >= 0) expect(titles.slice(firstLater).some((t) => /^defensive coordinator/i.test(t))).toBe(false);
  });
  it("still puts a name match first ('ian falconer')", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { results } = await searchPeopleX({ q: "ian falconer" });
    expect(results[0]?.fullName).toBe("Ian Falconer");
  });
});
