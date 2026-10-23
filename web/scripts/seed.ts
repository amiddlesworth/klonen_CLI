/**
 * Load the committed dataset in ../data into Postgres, then add clearly
 * labeled demo records (demo accounts, sample job listings, fictional pipeline
 * candidates, demo messages).
 *
 * Usage: npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool, schema } from "../src/db";
import { CURRENT_SEASON } from "../src/lib/brand";

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

type Stage = (typeof schema.pipelineStage.enumValues)[number];
type DemoStint = { role: string; roleGroup: Tenure["roleGroup"]; start: number; end: number | null };

/**
 * Fictional candidates for the demo AD's hiring pipeline. The people are invented (isDemo, "demo-" slugs,
 * made-up names) and so are their modest careers, newest stint first, the first one current. The programs
 * are real D-III schools assigned at seed time, and every tenure says it is a demo record. Queries keep
 * isDemo people off program pages, search and the feed, and they get no tree edges, so no real coach is
 * ever linked to them or put into this search.
 */
const DEMO_CANDIDATES: { first: string; last: string; stage: Stage; note: string | null; career: DemoStint[] }[] = [
  { first: "Avery", last: "Fieldstone", stage: "sourced", note: null, career: [
    { role: "Defensive Graduate Assistant", roleGroup: "ga_analyst", start: 2025, end: null },
    { role: "Student Assistant Coach", roleGroup: "ga_analyst", start: 2023, end: 2024 },
  ] },
  { first: "Jordan", last: "Larkspur", stage: "sourced", note: null, career: [
    { role: "Linebackers Coach", roleGroup: "position_coach", start: 2024, end: null },
    { role: "Graduate Assistant (Defense)", roleGroup: "ga_analyst", start: 2022, end: 2023 },
  ] },
  { first: "Casey", last: "Thornbury", stage: "sourced", note: null, career: [
    { role: "Defensive Quality Control", roleGroup: "ga_analyst", start: 2025, end: null },
    { role: "Volunteer Assistant Coach", roleGroup: "ga_analyst", start: 2024, end: 2024 },
  ] },
  { first: "Riley", last: "Ashgrove", stage: "contacted", note: "Demo note: left a voicemail, follow up next week.", career: [
    { role: "Defensive Backs Coach", roleGroup: "position_coach", start: 2023, end: null },
    { role: "Graduate Assistant (Secondary)", roleGroup: "ga_analyst", start: 2021, end: 2022 },
  ] },
  { first: "Taylor", last: "Brightwater", stage: "contacted", note: null, career: [
    { role: "Defensive Line Coach", roleGroup: "position_coach", start: 2022, end: null },
    { role: "Assistant Defensive Line Coach", roleGroup: "position_coach", start: 2020, end: 2021 },
  ] },
  { first: "Devon", last: "Oakhurst", stage: "interview", note: "Demo note: phone screen done, set up a campus visit.", career: [
    { role: "Safeties Coach / Video Coordinator", roleGroup: "position_coach", start: 2024, end: null },
    { role: "Student Assistant Coach", roleGroup: "ga_analyst", start: 2022, end: 2023 },
  ] },
  { first: "Parker", last: "Wrenfield", stage: "interview", note: null, career: [
    { role: "Defensive Analyst", roleGroup: "ga_analyst", start: 2024, end: null },
    { role: "Graduate Assistant (Linebackers)", roleGroup: "ga_analyst", start: 2022, end: 2023 },
  ] },
  { first: "Emerson", last: "Hollowell", stage: "offer", note: "Demo note: verbal offer made, waiting on an answer.", career: [
    { role: "Outside Linebackers Coach", roleGroup: "position_coach", start: 2021, end: null },
    { role: "Graduate Assistant (Defense)", roleGroup: "ga_analyst", start: 2019, end: 2020 },
  ] },
];
const DEMO_ABOUT =
  "Demo candidate. A fictional coach created for the hiring pipeline demo: the name and career are invented, and the programs are real schools used only as a setting.";
const DEMO_TENURE_EVIDENCE = "Demo tenure: invented for the hiring pipeline demo, not taken from any source.";

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

  // Programs with staff on the network (anyone currently there) vs. registry D-III programs without:
  // the ~48 whose staff pages we could not read.
  const staffed = new Set<string>([
    ...people.map((p) => p.currentOrgId).filter((id): id is string => !!id),
    ...tenures.filter((t) => t.isCurrent && !t.asPlayer).map((t) => t.orgId),
  ]);
  const d3 = registry.filter((o) => o.level === "NCAA D-III");
  const unreadPrograms = d3.filter((o) => !staffed.has(o.id!));
  if (!unreadPrograms.length) throw new Error("sample jobs: no registry program without staff on the network");

  // Sample job listings, labeled "Sample listing" in the UI. They go only to programs with no staff on
  // the network, so no listing reads as a real coach's job coming open.
  const now = Date.now();
  const jobRows: (typeof schema.jobs.$inferInsert)[] = [];
  for (let i = 0; i < 28; i++) {
    const org = pick(unreadPrograms);
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

  // Hiring pipeline for the demo AD: fictional candidates only (DEMO_CANDIDATES), never real coaches.
  // An analyst search, because a coordinator search at Pacific (OR) would imply its real coordinator is leaving.
  // Each demo stint goes to a different staffed D-III program (not Pacific, not the unread ones that hold the
  // sample jobs), and a current demo title never repeats one a real coach holds at that program.
  const titlesAt = new Map<string, Set<string>>();
  const holdTitle = (orgId: string | null | undefined, title: string | null | undefined) => {
    if (!orgId || !title) return;
    if (!titlesAt.has(orgId)) titlesAt.set(orgId, new Set());
    titlesAt.get(orgId)!.add(title.trim().toLowerCase());
  };
  for (const p of people) holdTitle(p.currentOrgId, p.currentTitle);
  for (const t of tenures) if (t.isCurrent) holdTitle(t.orgId, t.role);
  const demoPool = d3.filter((o) => staffed.has(o.id!) && o.id !== employerOrg.id).sort((a, b) => a.id!.localeCompare(b.id!));
  const demoRand = rng(8);
  const usedDemoOrgs = new Set<string>();
  const demoOrgFor = (currentTitle: string | null) => {
    const free = demoPool.filter((o) => !usedDemoOrgs.has(o.id!) && !(currentTitle && titlesAt.get(o.id!)?.has(currentTitle.toLowerCase())));
    if (!free.length) throw new Error("demo candidates: ran out of staffed D-III programs");
    const org = free[Math.floor(demoRand() * free.length)];
    usedDemoOrgs.add(org.id!);
    return org.id!;
  };
  const realSlugs = new Set(people.map((p) => p.slug));
  const demoPeople: Person[] = [];
  const demoTenures: Tenure[] = [];
  for (const c of DEMO_CANDIDATES) {
    const slug = `demo-${c.first}-${c.last}`.toLowerCase();
    if (realSlugs.has(slug)) throw new Error(`demo candidates: slug ${slug} collides with a real person`);
    const id = `p-${slug}`;
    const orgIds = c.career.map((s) => demoOrgFor(s.end === null ? s.role : null));
    const current = c.career[0];
    demoPeople.push({
      id, slug, fullName: `${c.first} ${c.last}`, firstName: c.first, lastName: c.last,
      currentOrgId: orgIds[0], currentTitle: current.role, roleGroup: current.roleGroup, unit: "defense",
      about: DEMO_ABOUT, bioExcerpt: null, bioQuality: "none", sourceUrl: null, claimed: false, isDemo: true,
    });
    c.career.forEach((s, j) =>
      demoTenures.push({
        personId: id, orgId: orgIds[j], role: s.role, roleGroup: s.roleGroup, unit: "defense", startYear: s.start, endYear: s.end,
        isCurrent: s.end === null, asPlayer: false, yearsExplicit: true, evidence: DEMO_TENURE_EVIDENCE, sourceUrl: null, verified: false, sortOrder: j,
      }),
    );
  }
  await db.insert(schema.people).values(demoPeople);
  await db.insert(schema.tenures).values(demoTenures);
  const [list] = await db.insert(schema.shortlists).values({ ownerUserId: "u-demo-ad", name: "Defensive analyst search (demo)" }).returning();
  await db.insert(schema.shortlistEntries).values(
    DEMO_CANDIDATES.map((c, i) => ({ shortlistId: list.id, personId: demoPeople[i].id!, stage: c.stage, position: i, note: c.note })),
  );

  // Notifications for the demo coach. Tree notifications name a real, sourced move: someone in the
  // coach's tree (tree_edges) whose football stint started in CURRENT_SEASON, so the row reads
  // "{Name} joined {Program} as {title}" with "2026 season" and the source, as the feed does (audit X09).
  // The profile-view count and the job match (a sample listing) are labeled sample data in the UI.
  const treeIds = new Set(edges.flatMap((e) => (e.mentorId === DEMO_COACH_ID ? [e.menteeId] : e.menteeId === DEMO_COACH_ID ? [e.mentorId] : [])));
  const treeMoveSlugs = [
    ...new Set(
      tenures
        .filter((t) => treeIds.has(t.personId) && t.startYear === CURRENT_SEASON && !t.asPlayer && (t.sport ?? "football") === "football")
        .map((t) => people.find((p) => p.id === t.personId)?.slug)
        .filter((slug): slug is string => !!slug),
    ),
  ].slice(0, 2);
  await db.insert(schema.notifications).values([
    { userId: "u-demo-coach", kind: "profile_view", payload: { count: 14 } },
    { userId: "u-demo-coach", kind: "job_match", payload: { jobTitle: jobRows[0].title } },
    ...(treeMoveSlugs.length ? treeMoveSlugs : [null]).map((personSlug) => ({
      userId: "u-demo-coach",
      kind: "tree",
      payload: personSlug ? { personSlug, text: "A coach from your tree changed jobs" } : { text: "A coach from your tree changed jobs" },
    })),
  ]);

  // demo messages ---------------------------------------------------------------------------------
  // A few short, labeled demo conversations for /messaging, all with the demo coach. Every other person
  // is fictional and none of them speaks for a real program: a consultant at a fictional search firm
  // (no organization, no opening anywhere), two of the fictional pipeline candidates above (a fellow
  // DB coach and a graduate assistant, neither naming a school), and the demo AD Morgan Ellis about
  // the profile itself. No message announces a job, a search or any event at a real program, and the
  // demo coach's words stay mundane and make no claim about the real person's career or plans.
  {
    const riley = demoPeople.find((p) => p.slug === "demo-riley-ashgrove")!;
    const avery = demoPeople.find((p) => p.slug === "demo-avery-fieldstone")!;
    await db.insert(schema.users).values([
      // A search firm account has no program (orgId null); the inbox titles it "Search consultant".
      { id: "u-demo-search", email: "demo-search@example.com", name: "Quinn Harlow", kind: "employer", orgId: null, isDemo: true },
      { id: "u-demo-riley", email: "demo-riley@example.com", name: riley.fullName, kind: "coach", personId: riley.id!, isDemo: true },
      { id: "u-demo-avery", email: "demo-avery@example.com", name: avery.fullName, kind: "coach", personId: avery.id!, isDemo: true },
    ]);
    const COACH = "u-demo-coach";
    const thread = (other: string) => [COACH, other].sort().join(":");
    const ago = (minutes: number) => new Date(now - minutes * 60_000);
    type Msg = typeof schema.messages.$inferInsert;
    const msg = (from: string, to: string, minutesAgo: number, body: string, readAfter: number | null): Msg => ({
      threadId: thread(from === COACH ? to : from),
      fromUserId: from,
      toUserId: to,
      body,
      sentAt: ago(minutesAgo),
      readAt: readAfter === null ? null : ago(minutesAgo - readAfter),
      isDemo: true,
    });
    await db.insert(schema.messages).values([
      // A consultant at a fictional search firm, introducing the firm in general terms. Unread.
      msg("u-demo-search", COACH, 125,
        "Hi Justin, I'm Quinn Harlow with Larkmoor Search, a coaching search firm. We help athletic departments put staffs together. Nothing specific to share today: just introducing myself in case you ever want to compare notes on how searches work.",
        null),
      // A fictional fellow DB coach proposing a film swap. Unread. It claims no role on a real staff:
      // program pages list real coaches only, so that claim would be contradicted one click away.
      msg("u-demo-riley", COACH, 60 * 26,
        `Hey Justin, ${riley.firstName} here. I'm putting together an offseason film swap with a few DB coaches. Interested? I can send some press coverage teaching tape first.`,
        null),
      // The demo AD, about the profile itself (no event at the real program). Read, with a reply.
      msg("u-demo-ad", COACH, 60 * 74, "Hi Justin, checking in from the athletic director side of the demo.", 30),
      msg("u-demo-ad", COACH, 60 * 74 - 2, "If anything in your coaching record looks off, let me know.", 28),
      msg(COACH, "u-demo-ad", 60 * 74 - 40, "Will do. Thanks, Morgan.", null),
      // A fictional graduate assistant asking for advice, naming no school. Read.
      msg("u-demo-avery", COACH, 60 * 24 * 9 + 300,
        "Coach Leatherman, I'm a defensive graduate assistant hoping to coach defensive backs full time after this season. If you ever have 15 minutes, I'd value your advice on what to focus on.",
        90),
    ]);
  }
  // end demo messages -----------------------------------------------------------------------------

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
