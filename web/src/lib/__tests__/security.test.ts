import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { jobs, organizations, people, shortlistEntries, shortlists } from "@/db/schema";
import {
  copyShortlistForScope,
  jobVisibleTo,
  purgeExpiredDemoSearches,
  readableShortlistId,
  shortlistPublicId,
  shortlistVisibleTo,
  touchScopedSearch,
} from "@/lib/demo-scope";
import { listJobs } from "@/lib/queries/jobs";
import { cookieOptions, isDemoRole } from "@/lib/session";
import { absoluteUrl, parseSiteUrl, SITE_URL, safeRedirectPath } from "@/lib/site";
import nextConfig, { contentSecurityPolicy } from "../../../next.config";

describe("safeRedirectPath (switchDemoAccount redirectTo)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirectPath("/feed")).toBe("/feed");
    expect(safeRedirectPath("/jobs?role=head_coach#top")).toBe("/jobs?role=head_coach#top");
    expect(safeRedirectPath("/in/ian-falconer/tree")).toBe("/in/ian-falconer/tree");
    expect(safeRedirectPath("/a/../programs/adrian")).toBe("/programs/adrian");
  });

  it("refuses absolute, protocol-relative and malformed targets", () => {
    for (const bad of [
      "https://evil.example/phish",
      "http://localhost:3000/feed",
      "//evil.example/x",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "feed",
      "",
      " /feed",
    ]) {
      expect(safeRedirectPath(bad), bad).toBe("/feed");
    }
    expect(safeRedirectPath(42)).toBe("/feed");
    expect(safeRedirectPath(null, "/")).toBe("/");
    expect(safeRedirectPath({ toString: () => "/feed" })).toBe("/feed");
  });
});

describe("site origin", () => {
  it("comes from configuration, with a safe default", () => {
    expect(parseSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(parseSiteUrl("https://coaches.example/some/path")).toBe("https://coaches.example");
    expect(parseSiteUrl("ftp://coaches.example")).toBe("http://localhost:3000");
    expect(parseSiteUrl("not a url")).toBe("http://localhost:3000");
    expect(absoluteUrl("/programs/adrian")).toBe(`${SITE_URL}/programs/adrian`);
    expect(absoluteUrl("in/x")).toBe(`${SITE_URL}/in/x`);
  });
});

describe("demo session role", () => {
  it("accepts only the demo roles, never prototype keys", () => {
    expect(isDemoRole("coach")).toBe(true);
    expect(isDemoRole("employer")).toBe(true);
    for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "signed_out", "admin", "", undefined, null, 1]) {
      expect(isDemoRole(bad), String(bad)).toBe(false);
    }
  });
});

describe("cookies and headers", () => {
  it("sets httpOnly, SameSite=Lax cookies that are Secure in production", () => {
    expect(cookieOptions(60)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60, secure: false });
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(cookieOptions(60).secure).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sends the security headers on every route and hides X-Powered-By", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const byKey = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("allows eval only in development", () => {
    const prod = contentSecurityPolicy(false);
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).not.toContain("ws:");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });
});

/* ---------------------------------------------------------- against the seeded database */

let dbUp = false;
beforeAll(async () => {
  dbUp = await pool
    .query("select demo_scope from jobs limit 1")
    .then(() => true)
    .catch(() => false);
});
afterAll(async () => {
  await pool.end().catch(() => undefined);
});

const SCOPE_A = "a".repeat(24);
const SCOPE_B = "b".repeat(24);

describe("demo listings stay in the posting browser", () => {
  it("are hidden from every other browser and from public lists", async () => {
    if (!dbUp) return;
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.inRegistry, true)).limit(1);
    const title = `Security test listing ${Date.now()}`;
    const [row] = await db
      .insert(jobs)
      .values({ orgId: org.id, title, roleGroup: "position_coach", description: "Scoped demo listing used by a test.", source: "native", isDemo: true, demoScope: SCOPE_A })
      .returning({ id: jobs.id });
    try {
      // Outside a request there is no scope cookie: public queries leave scoped listings out.
      expect((await listJobs({ q: title })).length).toBe(0);
      const seen = async (scope: string | null) =>
        (await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, row.id), jobVisibleTo(scope)))).length;
      expect(await seen(SCOPE_A)).toBe(1);
      expect(await seen(SCOPE_B)).toBe(0);
      expect(await seen(null)).toBe(0);
    } finally {
      await db.delete(jobs).where(eq(jobs.id, row.id));
    }
  });
});

describe("pipeline entries", () => {
  it("keep one row per (search, person) when adds race", async () => {
    if (!dbUp) return;
    const [list] = await db
      .insert(shortlists)
      .values({ ownerUserId: "u-demo-ad", name: "Security test search", demoScope: SCOPE_A })
      .returning({ id: shortlists.id });
    try {
      expect((await db.select({ id: shortlists.id }).from(shortlists).where(and(eq(shortlists.id, list.id), shortlistVisibleTo(SCOPE_B)))).length).toBe(0);
      const [person] = await db.select({ id: people.id }).from(people).where(eq(people.isDemo, false)).limit(1);
      const add = () =>
        db
          .insert(shortlistEntries)
          .values({ shortlistId: list.id, personId: person.id, stage: "sourced", position: 0 })
          .onConflictDoNothing({ target: [shortlistEntries.shortlistId, shortlistEntries.personId] })
          .returning({ id: shortlistEntries.id });
      const results = await Promise.all([add(), add(), add(), add()]);
      expect(results.filter((r) => r.length === 1)).toHaveLength(1);
      const rows = await db.select({ id: shortlistEntries.id }).from(shortlistEntries).where(inArray(shortlistEntries.shortlistId, [list.id]));
      expect(rows).toHaveLength(1);
    } finally {
      await db.delete(shortlists).where(eq(shortlists.id, list.id));
    }
  });
});

describe("seeded hiring searches are copied, never written, from the demo", () => {
  it("gives each browser its own copy, hidden from every other browser, that expires", async () => {
    if (!dbUp) return;
    // A stand-in for a seeded search, owned by an account that has no pipeline page (never on screen).
    const [seeded] = await db
      .insert(shortlists)
      .values({ ownerUserId: "u-demo-coach", name: "Security test seeded search" })
      .returning({ id: shortlists.id });
    try {
      const demoPeople = await db.select({ id: people.id }).from(people).where(eq(people.isDemo, true)).limit(2);
      expect(demoPeople).toHaveLength(2);
      await db.insert(shortlistEntries).values([
        { shortlistId: seeded.id, personId: demoPeople[0].id, stage: "contacted", position: 0, note: "Seeded note" },
        { shortlistId: seeded.id, personId: demoPeople[1].id, stage: "offer", position: 1 },
      ]);

      // The first writes race (double click, two tabs): one copy, and every caller gets it.
      const copies = await Promise.all([1, 2, 3].map(() => copyShortlistForScope(seeded.id, SCOPE_A)));
      expect(copies.every((c) => c.ok)).toBe(true);
      const ids = new Set(copies.map((c) => (c.ok ? c.id : 0)));
      expect(ids.size).toBe(1);
      const copyId = [...ids][0];
      expect(copyId).not.toBe(seeded.id);
      const copyRows = await db.select({ id: shortlists.id }).from(shortlists).where(eq(shortlists.clonedFromId, seeded.id));
      expect(copyRows).toHaveLength(1);

      // The copy holds the same candidates, stages, order and notes.
      const entriesOf = (id: number) =>
        db
          .select({ personId: shortlistEntries.personId, stage: shortlistEntries.stage, position: shortlistEntries.position, note: shortlistEntries.note })
          .from(shortlistEntries)
          .where(eq(shortlistEntries.shortlistId, id))
          .orderBy(shortlistEntries.position);
      expect(await entriesOf(copyId)).toEqual(await entriesOf(seeded.id));

      // Browser A sees only its copy, under the seeded search's id; everyone else sees the seeded search.
      const seen = async (scope: string | null) =>
        db
          .select({ id: shortlists.id, publicId: shortlistPublicId() })
          .from(shortlists)
          .where(and(inArray(shortlists.id, [seeded.id, copyId]), shortlistVisibleTo(scope)));
      expect(await seen(SCOPE_A)).toEqual([{ id: copyId, publicId: seeded.id }]);
      expect(await seen(SCOPE_B)).toEqual([{ id: seeded.id, publicId: seeded.id }]);
      expect(await seen(null)).toEqual([{ id: seeded.id, publicId: seeded.id }]);
      expect(await readableShortlistId(seeded.id, SCOPE_A)).toBe(copyId);
      expect(await readableShortlistId(seeded.id, SCOPE_B)).toBe(seeded.id);
      expect(await readableShortlistId(seeded.id, null)).toBe(seeded.id);

      // A write to the copy (a note, a removal) leaves the seeded search as it was.
      await db.update(shortlistEntries).set({ note: "Typed by browser A" }).where(and(eq(shortlistEntries.shortlistId, copyId), eq(shortlistEntries.personId, demoPeople[0].id)));
      await db.delete(shortlistEntries).where(and(eq(shortlistEntries.shortlistId, copyId), eq(shortlistEntries.personId, demoPeople[1].id)));
      const seededNow = await entriesOf(seeded.id);
      expect(seededNow).toHaveLength(2);
      expect(seededNow[0].note).toBe("Seeded note");

      // Writes keep the copy alive; once it is past its date the purge deletes it with its candidates.
      const [{ demoExpiresAt: before }] = await db.select({ demoExpiresAt: shortlists.demoExpiresAt }).from(shortlists).where(eq(shortlists.id, copyId));
      expect(before).not.toBeNull();
      await db.update(shortlists).set({ demoExpiresAt: new Date(Date.now() - 60_000) }).where(eq(shortlists.id, copyId));
      await touchScopedSearch(copyId);
      const [{ demoExpiresAt: touched }] = await db.select({ demoExpiresAt: shortlists.demoExpiresAt }).from(shortlists).where(eq(shortlists.id, copyId));
      expect(touched!.getTime()).toBeGreaterThan(Date.now());
      await db.update(shortlists).set({ demoExpiresAt: new Date(Date.now() - 60_000) }).where(eq(shortlists.id, copyId));
      await purgeExpiredDemoSearches();
      expect(await db.select({ id: shortlists.id }).from(shortlists).where(eq(shortlists.id, copyId))).toHaveLength(0);
      expect(await entriesOf(copyId)).toHaveLength(0);
      expect(await entriesOf(seeded.id)).toHaveLength(2);
      // With its copy gone, browser A sees the seeded search again.
      expect(await seen(SCOPE_A)).toEqual([{ id: seeded.id, publicId: seeded.id }]);

      // Only seeded searches are copied, and only for a well-formed scope.
      expect(await copyShortlistForScope(seeded.id, "not-a-scope")).toEqual({ ok: false, reason: "missing" });
    } finally {
      await db.delete(shortlists).where(eq(shortlists.id, seeded.id));
    }
  });
});
