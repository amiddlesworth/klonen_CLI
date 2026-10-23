import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/db";
import { CURRENT_SEASON } from "@/lib/brand";
import { getMoves } from "@/lib/queries/feed";
import { listJobs } from "@/lib/queries/jobs";
import { getAlumni, getStaff, listConferences, searchOrgs } from "@/lib/queries/orgs";
import { aggregateTree, getProfile, getTree, groupExperience, type OrgSummary, type PersonSummary, type TenureRow, type TreeEdgeRow } from "@/lib/queries/people";
import { facetOptions, searchPeople } from "@/lib/queries/search";

/*
 * groupExperience is pure. The rest runs against the seeded database (npm run db:reset) and is skipped
 * when Postgres is not reachable, so the pure tests still run anywhere.
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

const org = (id: string): OrgSummary => ({
  id,
  slug: id,
  name: id,
  shortName: id,
  nickname: null,
  level: "NCAA D-III",
  conference: null,
  conferenceAbbr: null,
  state: null,
  inRegistry: true,
  kind: "college",
});
let nextId = 1;
const stint = (orgId: string, startYear: number | null, endYear: number | null, isCurrent = false): TenureRow => ({
  id: nextId++,
  role: "Assistant Coach",
  roleGroup: "position_coach",
  unit: null,
  startYear,
  endYear,
  isCurrent,
  asPlayer: false,
  yearsExplicit: true,
  evidence: null,
  sourceUrl: null,
  verified: false,
  org: org(orgId),
});

describe("groupExperience", () => {
  it("does not stretch an old start year to Present across an undated current role", () => {
    // duane-russell: Azusa Pacific current (no start), 1993–1995, 1984. Was "1984–Present · 43 seasons".
    const [g] = groupExperience([stint("azusa", null, null, true), stint("azusa", 1993, 1995), stint("azusa", 1984, null)]);
    expect(g.isCurrent).toBe(true);
    expect(g.startYear).toBeNull();
    expect(g.endYear).toBeNull();
    expect(g.seasons).toBe(5);
  });
  it("starts a gapped current group at its latest run and counts only covered seasons", () => {
    // bill-giovino-88: Lebanon Valley 2014–current and 1995–1996. Was "1995–Present · 32 seasons".
    const [g] = groupExperience([stint("lvc", 2014, null, true), stint("lvc", 1995, 1996)]);
    expect(g).toMatchObject({ startYear: 2014, endYear: null, isCurrent: true, seasons: 15 });
  });
  it("keeps one continuous span when the roles connect", () => {
    const [g] = groupExperience([stint("pacific", 2021, null, true), stint("pacific", 2017, 2020)]);
    expect(g).toMatchObject({ startYear: 2017, endYear: null, isCurrent: true, seasons: CURRENT_SEASON - 2017 + 1 });
    const [h] = groupExperience([stint("pacific", null, null, true), stint("pacific", 2018, 2025)]);
    expect(h).toMatchObject({ startYear: 2018, endYear: null, isCurrent: true, seasons: CURRENT_SEASON - 2018 + 1 });
  });
  it("counts a non-contiguous past group by distinct seasons", () => {
    const [g] = groupExperience([stint("lc", 2006, 2009), stint("lc", 2003, 2003)]);
    expect(g).toMatchObject({ startYear: 2006, endYear: 2009, isCurrent: false, seasons: 5 });
  });
  it("leaves an undated group undated", () => {
    const [g, h] = groupExperience([stint("a", null, null, true), stint("b", null, 2020)]);
    expect(g).toMatchObject({ startYear: null, endYear: null, isCurrent: true, seasons: null });
    expect(h).toMatchObject({ startYear: null, endYear: 2020, isCurrent: false, seasons: null });
  });
});

const summary = (id: string): PersonSummary => ({
  id,
  slug: id,
  fullName: id,
  currentTitle: null,
  roleGroup: "position_coach",
  claimed: false,
  isDemo: false,
  org: null,
});
const edge = (kind: TreeEdgeRow["kind"], mentorId: string, menteeId: string, startYear: number, endYear: number, org = "Hendrix"): TreeEdgeRow => ({
  kind,
  mentorId,
  menteeId,
  startYear,
  endYear,
  orgSlug: org.toLowerCase(),
  orgShortName: org,
});

describe("aggregateTree", () => {
  const people = new Map(["simmons", "buchanan", "neal", "packard"].map((id) => [id, summary(id)]));
  it("keeps every overlap period per person, not only the latest row", () => {
    // Hendrix (audit F10): Buchanan -> Simmons is two rows, 2015 and 2023-2026.
    const tree = aggregateTree("buchanan", [edge("worked_under", "buchanan", "simmons", 2015, 2015), edge("worked_under", "buchanan", "simmons", 2023, CURRENT_SEASON)], people);
    expect(tree.mentees).toHaveLength(1);
    const [link] = tree.mentees;
    expect(link.periods).toEqual([
      { startYear: 2023, endYear: CURRENT_SEASON, orgShortName: "Hendrix" },
      { startYear: 2015, endYear: 2015, orgShortName: "Hendrix" },
    ]);
    // startYear/endYear/org stay the most recent period for existing callers
    expect(link).toMatchObject({ startYear: 2023, endYear: CURRENT_SEASON, org: { slug: "hendrix", shortName: "Hendrix" } });
  });
  it("sorts periods most recent first whatever order the rows come in, across programs", () => {
    const tree = aggregateTree(
      "simmons",
      [edge("worked_alongside", "neal", "simmons", 2010, 2012, "Central Arkansas"), edge("worked_alongside", "neal", "simmons", 2015, 2015), edge("worked_alongside", "neal", "simmons", 2023, 2024)],
      people,
    );
    expect(tree.peers.map((l) => l.person.id)).toEqual(["neal"]);
    expect(tree.peers[0].periods.map((p) => [p.startYear, p.endYear, p.orgShortName])).toEqual([
      [2023, 2024, "Hendrix"],
      [2015, 2015, "Hendrix"],
      [2010, 2012, "Central Arkansas"],
    ]);
    expect(tree.peers[0]).toMatchObject({ startYear: 2023, endYear: 2024, org: { shortName: "Hendrix" } });
  });
  it("aggregates per (bucket, person): the same person can be a mentor in one period and a peer in another", () => {
    const tree = aggregateTree(
      "simmons",
      [edge("worked_under", "buchanan", "simmons", 2023, CURRENT_SEASON), edge("worked_alongside", "buchanan", "simmons", 2010, 2011), edge("worked_under", "simmons", "packard", 2020, 2021)],
      people,
    );
    expect(tree.mentors.map((l) => [l.person.id, l.periods.length])).toEqual([["buchanan", 1]]);
    expect(tree.peers.map((l) => [l.person.id, l.periods.length])).toEqual([["buchanan", 1]]);
    expect(tree.mentees.map((l) => [l.person.id, l.startYear])).toEqual([["packard", 2020]]);
  });
  it("orders people in a bucket by their most recent period and skips unknown people", () => {
    const tree = aggregateTree(
      "buchanan",
      [edge("worked_under", "buchanan", "neal", 2015, 2018), edge("worked_under", "buchanan", "ghost", 2024, 2025), edge("worked_under", "buchanan", "simmons", 2015, 2015), edge("worked_under", "buchanan", "simmons", 2023, CURRENT_SEASON)],
      people,
    );
    expect(tree.mentees.map((l) => l.person.id)).toEqual(["simmons", "neal"]);
  });
});

describe("getTree", () => {
  it("returns all of a pair's periods from the seeded edges", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { rows } = await pool.query<{ mentor_id: string; mentee_id: string; n: number }>(
      "select mentor_id, mentee_id, count(*)::int as n from tree_edges where kind = 'worked_under' group by 1, 2 having count(*) > 1 order by 1, 2 limit 1",
    );
    if (!rows.length) return ctx.skip();
    const tree = await getTree(rows[0].mentor_id);
    const link = tree.mentees.find((l) => l.person.id === rows[0].mentee_id);
    expect(link?.periods.length).toBe(rows[0].n);
    expect(link?.endYear).toBe(Math.max(...link!.periods.map((p) => p.endYear ?? -Infinity)));
  });
});

describe("profile stats", () => {
  it("counts seasons coached as covered seasons, not first season to now", async (ctx) => {
    if (!dbUp) ctx.skip();
    const p = await getProfile("duane-russell");
    if (!p) return ctx.skip();
    expect(p.stats.seasonsCoached).toBeLessThan(10); // was 43 (1984 through 2026)
    expect(p.stats.firstSeason).toBe(1984);
  });
});

describe("getMoves", () => {
  it("takes the previous stint by latest known season and decides promotion by org id", async (ctx) => {
    if (!dbUp) ctx.skip();
    const moves = await getMoves(1000);
    const m = moves.find((x) => x.person.slug === "matthew-szymanski");
    if (!m) return ctx.skip();
    // Brockport 2026–current, Brockport 2021, Randolph-Macon ?–2025: he joined from Randolph-Macon.
    expect(m.kind).toBe("joined");
    expect(m.previous?.orgShortName).toBe("Randolph-Macon");
  });
  it("never lists demo people", async (ctx) => {
    if (!dbUp) ctx.skip();
    expect((await getMoves(1000)).some((m) => m.person.isDemo)).toBe(false);
  });
});

describe("getAlumni", () => {
  it("orders by recency before the limit, undated stints last", async (ctx) => {
    if (!dbUp) ctx.skip();
    const all = await getAlumni("ncaa-46");
    if (all.length < 6) return ctx.skip();
    const key = (a: { startYear: number | null; endYear: number | null }) => a.endYear ?? a.startYear ?? -Infinity;
    for (let i = 1; i < all.length; i++) expect(key(all[i - 1])).toBeGreaterThanOrEqual(key(all[i]));
    expect((await getAlumni("ncaa-46", 5)).map((a) => a.person.id)).toEqual(all.slice(0, 5).map((a) => a.person.id));
  });
  it("prefers a dated past stint over an undated one for the same person", async (ctx) => {
    if (!dbUp) ctx.skip();
    const cregan = (await getAlumni("ncaa-46")).find((a) => a.person.slug === "andrew-cregan");
    if (!cregan) return ctx.skip();
    expect(cregan.endYear).not.toBeNull(); // was the undated "Student-Coach" stint
  });
});

describe("demo candidates", () => {
  it("fill the seeded pipeline, and no real coach is in it", async (ctx) => {
    if (!dbUp) ctx.skip();
    // Seeded searches only: a browser's own copy (demo_scope set) may hold the coaches it added itself.
    const { rows } = await pool.query<{ is_demo: boolean }>(
      "select p.is_demo from shortlist_entries e join shortlists s on s.id = e.shortlist_id join people p on p.id = e.person_id where s.demo_scope is null",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.is_demo)).toBe(true);
  });
  it("stay off program staff and alumni lists", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { rows } = await pool.query<{ org_id: string }>("select distinct t.org_id from tenures t join people p on p.id = t.person_id where p.is_demo");
    for (const { org_id } of rows) {
      expect((await getStaff(org_id)).flatMap((g) => g.people).some((p) => p.isDemo)).toBe(false);
      expect((await getAlumni(org_id, 500)).some((a) => a.person.isDemo)).toBe(false);
    }
  });
  it("sample jobs sit only at programs with no staff on the network", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from jobs j where j.source = 'sample' and exists (select 1 from people p where p.current_org_id = j.org_id)",
    );
    expect(rows[0].n).toBe(0);
  });
});

describe("searchPeople slug filters", () => {
  it("returns nobody for an unknown workedAt or workedUnder slug", async (ctx) => {
    if (!dbUp) ctx.skip();
    expect(await searchPeople({ workedUnder: "does-not-exist" })).toEqual({ results: [], total: 0 });
    expect(await searchPeople({ workedAt: "does-not-exist" })).toEqual({ results: [], total: 0 });
  });
  it("still filters for a known slug", async (ctx) => {
    if (!dbUp) ctx.skip();
    const all = (await searchPeople({})).total;
    const brevard = await searchPeople({ workedAt: "brevard" });
    expect(brevard.total).toBeGreaterThan(0);
    expect(brevard.total).toBeLessThan(all);
  });
});

describe("conference footnote markers", () => {
  const marked = (xs: (string | null)[]) => xs.filter((x) => x && /\[/.test(x));
  it("never split a conference in facets or the conference list", async (ctx) => {
    if (!dbUp) ctx.skip();
    expect(marked((await facetOptions()).conferences)).toEqual([]);
    const confs = await listConferences();
    expect(marked(confs)).toEqual([]);
    expect(new Set(confs).size).toBe(confs.length);
  });
  it("match marked programs in filters and org search", async (ctx) => {
    if (!dbUp) ctx.skip();
    const { rows } = await pool.query<{ abbr: string; slug: string }>(
      "select conference_abbr as abbr, slug from organizations where in_registry and conference_abbr like '%[%' limit 1",
    );
    if (!rows.length) return ctx.skip(); // the data no longer has markers
    const clean = rows[0].abbr.replace(/\[[^\]]*\]/g, "");
    expect((await searchOrgs(clean, 50)).map((o) => o.slug)).toContain(rows[0].slug);
    expect((await searchPeople({ conference: clean })).total).toBe((await searchPeople({ conference: rows[0].abbr })).total);
    expect((await listJobs({ conference: clean })).length).toBe((await listJobs({ conference: rows[0].abbr })).length);
  });
});
