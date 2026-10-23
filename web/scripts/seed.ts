/**
 * Load the committed dataset in ../data into Postgres, then add clearly
 * labeled demo records (demo accounts, sample job listings, demo messages).
 *
 * Usage: npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool, schema } from "../src/db";

const DATA = join(__dirname, "..", "..", "data");
const load = <T>(name: string): T[] => JSON.parse(readFileSync(join(DATA, `${name}.json`), "utf8"));

type Org = typeof schema.organizations.$inferInsert;
type Person = typeof schema.people.$inferInsert;
type Tenure = typeof schema.tenures.$inferInsert;
type Edge = typeof schema.treeEdges.$inferInsert;

async function insertChunks<T>(table: Parameters<typeof db.insert>[0], rows: T[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

/** Deterministic pseudo-random generator so demo data is stable across seeds. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SAMPLE_ROLES: { title: string; roleGroup: Tenure["roleGroup"]; unit: Tenure["unit"]; min: number; max: number }[] = [
  { title: "Defensive Coordinator", roleGroup: "coordinator", unit: "defense", min: 52000, max: 64000 },
  { title: "Offensive Coordinator / Quarterbacks Coach", roleGroup: "coordinator", unit: "offense", min: 54000, max: 66000 },
  { title: "Offensive Line Coach", roleGroup: "position_coach", unit: "offense", min: 42000, max: 50000 },
  { title: "Defensive Backs Coach", roleGroup: "position_coach", unit: "defense", min: 40000, max: 48000 },
  { title: "Linebackers Coach / Recruiting Coordinator", roleGroup: "position_coach", unit: "defense", min: 41000, max: 49000 },
  { title: "Wide Receivers Coach", roleGroup: "position_coach", unit: "offense", min: 38000, max: 46000 },
  { title: "Special Teams Coordinator / Tight Ends", roleGroup: "coordinator", unit: "special_teams", min: 43000, max: 52000 },
  { title: "Graduate Assistant – Defense", roleGroup: "ga_analyst", unit: "defense", min: 12000, max: 16000 },
  { title: "Director of Football Operations", roleGroup: "support", unit: "staff", min: 45000, max: 55000 },
  { title: "Assistant Strength & Conditioning Coach", roleGroup: "support", unit: "staff", min: 36000, max: 44000 },
];

function jobDescription(title: string, org: Org) {
  return [
    `${org.name} is hiring a ${title} for the ${org.nickname ? `${org.shortName} ${org.nickname}` : org.shortName} football program, a member of the ${org.conference ?? "NCAA Division III"}.`,
    "",
    "**Responsibilities**",
    "- Coach, develop and evaluate position players in practice, film study and games",
    "- Recruit prospective student-athletes within NCAA Division III rules",
    "- Support academic success, community service and the department's mission",
    "",
    "**Qualifications**",
    "- Bachelor's degree required; college coaching experience preferred",
    "- Working knowledge of NCAA compliance",
    "",
    "_This is a sample listing created for the demo. It is not a real opening._",
  ].join("\n");
}

async function main() {
  const orgs = load<Org>("organizations");
  const people = load<Person>("people");
  const tenures = load<Tenure>("tenures");
  const edges = load<Edge>("tree_edges");

  console.log("truncating…");
  await db.execute(sql`TRUNCATE profile_views, notifications, messages, shortlist_entries, shortlists, claims, availability,
    connections, jobs, users, tree_edges, tenures, people, organizations RESTART IDENTITY CASCADE`);

  console.log(`inserting ${orgs.length} orgs, ${people.length} people, ${tenures.length} tenures, ${edges.length} edges`);
  await insertChunks(schema.organizations, orgs);
  await insertChunks(schema.people, people);
  await insertChunks(schema.tenures, tenures);
  await insertChunks(schema.treeEdges, edges);

  // ------------------------------------------------------------ demo records
  const rand = rng(2026);
  const registry = orgs.filter((o) => o.inRegistry);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  // Demo accounts (docs/ARCHITECTURE.md "Demo accounts"; DESIGN.md §8.2 and the reference mockups):
  // the coach demo views the product as Justin Leatherman, Pacific (OR) special teams coordinator.
  // We never mark a real person's record as claimed: the public profile stays Unclaimed, and only
  // the demo session sees an owner view, labeled Demo. The athletic director is fictional.
  const DEMO_COACH_ID = "p-justin-leatherman";
  const DEMO_AD_ORG_ID = "ncaa-2751"; // Pacific (OR)
  const demoCoach = people.find((p) => p.id === DEMO_COACH_ID);
  const employerOrg = orgs.find((o) => o.id === DEMO_AD_ORG_ID);
  if (!demoCoach || !employerOrg) throw new Error(`demo accounts: ${DEMO_COACH_ID} or ${DEMO_AD_ORG_ID} is missing from data/`);

  await db.insert(schema.users).values([
    { id: "u-demo-coach", email: "demo-coach@example.com", name: demoCoach.fullName, kind: "coach", personId: DEMO_COACH_ID, isDemo: true },
    { id: "u-demo-ad", email: "demo-ad@example.com", name: "Morgan Ellis", kind: "employer", orgId: employerOrg.id, isDemo: true },
  ]);
  // Private and off by default, as in the reference ("Off · only you see this").
  await db.insert(schema.availability).values({ personId: DEMO_COACH_ID, open: false, audience: "all_except_current", roles: [], regions: [] });

  // Sample job listings at real programs, labeled as samples in the UI.
  const now = Date.now();
  const jobRows: (typeof schema.jobs.$inferInsert)[] = [];
  for (let i = 0; i < 28; i++) {
    const org = pick(registry);
    const role = pick(SAMPLE_ROLES);
    jobRows.push({
      orgId: org.id!,
      title: role.title,
      roleGroup: role.roleGroup!,
      unit: role.unit,
      description: jobDescription(role.title, org),
      location: org.state ? `${org.state}` : null,
      employmentType: role.roleGroup === "ga_analyst" ? "Graduate assistantship" : "Full-time",
      salaryMin: role.min,
      salaryMax: role.max,
      postedAt: new Date(now - Math.floor(rand() * 21) * 86400000 - Math.floor(rand() * 86400000)),
      source: "sample",
      isDemo: true,
      createdByUserId: org.id === employerOrg.id ? "u-demo-ad" : null,
    });
  }
  await db.insert(schema.jobs).values(jobRows);

  // Hiring pipeline for the demo AD.
  const [list] = await db.insert(schema.shortlists).values({ ownerUserId: "u-demo-ad", name: "Defensive Coordinator search" }).returning();
  const candidates = people.filter((p) => (p.roleGroup === "coordinator" || p.roleGroup === "position_coach") && p.currentOrgId !== employerOrg.id).slice(0, 9);
  const stages = ["sourced", "sourced", "sourced", "contacted", "contacted", "interview", "interview", "offer", "sourced"] as const;
  await db.insert(schema.shortlistEntries).values(
    candidates.map((c, i) => ({ shortlistId: list.id, personId: c.id!, stage: stages[i], position: i, note: i === 5 ? "Strong references from the head coach." : null })),
  );

  // Notifications for the demo coach.
  await db.insert(schema.notifications).values([
    { userId: "u-demo-coach", kind: "profile_view", payload: { count: 14 } },
    { userId: "u-demo-coach", kind: "job_match", payload: { jobTitle: jobRows[0].title } },
    { userId: "u-demo-coach", kind: "tree", payload: { text: "A coach from your tree changed jobs" } },
  ]);

  const counts = await db.execute(sql`SELECT
    (SELECT count(*) FROM organizations) AS orgs, (SELECT count(*) FROM people) AS people,
    (SELECT count(*) FROM tenures) AS tenures, (SELECT count(*) FROM tree_edges) AS edges, (SELECT count(*) FROM jobs) AS jobs`);
  console.log("seeded:", counts.rows[0]);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
