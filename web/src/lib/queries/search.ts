import "server-only";
import { and, asc, eq, exists, ilike, or, sql, type SQL } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";
import { escapeLike, searchOrgs } from "./orgs";

export type PeopleFilters = {
  q?: string;
  division?: string; // org level, e.g. "NCAA D-III"
  conference?: string; // conference abbreviation
  state?: string;
  roleGroup?: string;
  workedAt?: string; // organization slug
  workedUnder?: string; // person slug
  page?: number;
};

export const PAGE_SIZE = 20;

/** Head coaches first, then coordinators, position coaches, everyone else. */
const ROLE_GROUP_ORDER = sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 else 3 end`;

export async function searchPeople(f: PeopleFilters): Promise<{ results: (PersonSummary & { context: string | null })[]; total: number }> {
  const where: SQL[] = [eq(people.isDemo, false)];
  if (f.q?.trim()) {
    const terms = f.q.trim().split(/\s+/).slice(0, 4);
    for (const t of terms) {
      const like = `%${escapeLike(t)}%`;
      where.push(or(ilike(people.fullName, like), ilike(people.currentTitle, like), ilike(organizations.shortName, like), ilike(organizations.nickname, like))!);
    }
  }
  if (f.division) where.push(eq(organizations.level, f.division));
  if (f.conference) where.push(eq(organizations.conferenceAbbr, f.conference));
  if (f.state) where.push(eq(organizations.state, f.state));
  if (f.roleGroup) where.push(sql`${people.roleGroup} = ${f.roleGroup}`);
  let contextOrg: string | null = null;
  if (f.workedAt) {
    const at = aliasedTable(organizations, "worked_at_org");
    const [org] = await db.select({ id: organizations.id, shortName: organizations.shortName }).from(organizations).where(eq(organizations.slug, f.workedAt)).limit(1);
    if (org) {
      contextOrg = org.shortName;
      where.push(
        exists(db.select({ one: sql`1` }).from(tenures).innerJoin(at, eq(at.id, tenures.orgId)).where(and(eq(tenures.personId, people.id), eq(tenures.orgId, org.id), eq(tenures.asPlayer, false)))),
      );
    }
  }
  if (f.workedUnder) {
    const [mentor] = await db.select({ id: people.id }).from(people).where(eq(people.slug, f.workedUnder)).limit(1);
    if (mentor) {
      where.push(exists(db.select({ one: sql`1` }).from(treeEdges).where(and(eq(treeEdges.kind, "worked_under"), eq(treeEdges.mentorId, mentor.id), eq(treeEdges.menteeId, people.id)))));
    }
  }
  const page = Math.max(1, f.page ?? 1);
  const base = db.select(personSummaryCols).from(people).leftJoin(organizations, eq(organizations.id, people.currentOrgId)).where(and(...where));
  const [rows, [{ total }]] = await Promise.all([
    base
      .orderBy(ROLE_GROUP_ORDER, asc(people.fullName))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(people).leftJoin(organizations, eq(organizations.id, people.currentOrgId)).where(and(...where)),
  ]);
  return { results: rows.map((r) => ({ ...toSummary(r), context: contextOrg ? `Coached at ${contextOrg}` : null })), total };
}

/**
 * Typeahead for the global search box: up to 6 people and 4 programs. People are ranked before the
 * limit: exact name, then name prefix ("tan" → Tanner Kingsley), then a later word of the name
 * ("ian" → Ian Falconer before Adrian Saterstad), then any substring; then head coaches first;
 * then alphabetical.
 */
export async function typeahead(q: string) {
  const term = q.trim();
  if (term.length < 2) return { people: [], orgs: [] };
  const e = escapeLike(term);
  const rank = sql`case
    when lower(${people.fullName}) = ${term.toLowerCase()} then 0
    when ${people.fullName} ilike ${`${e}%`} then 1
    when ${people.fullName} ilike ${`% ${e}%`} or ${people.fullName} ilike ${`%-${e}%`} then 2
    else 3 end`;
  const [ppl, orgs] = await Promise.all([
    db
      .select(personSummaryCols)
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(eq(people.isDemo, false), ilike(people.fullName, `%${e}%`)))
      .orderBy(rank, ROLE_GROUP_ORDER, asc(people.fullName))
      .limit(6),
    searchOrgs(term, 4),
  ]);
  return { people: ppl.map(toSummary), orgs };
}

export async function facetOptions() {
  const [conferences, states, divisions] = await Promise.all([
    db.selectDistinct({ v: organizations.conferenceAbbr }).from(organizations).innerJoin(people, eq(people.currentOrgId, organizations.id)).orderBy(asc(organizations.conferenceAbbr)),
    db.selectDistinct({ v: organizations.state }).from(organizations).innerJoin(people, eq(people.currentOrgId, organizations.id)).orderBy(asc(organizations.state)),
    db.selectDistinct({ v: organizations.level }).from(organizations).innerJoin(people, eq(people.currentOrgId, organizations.id)).orderBy(asc(organizations.level)),
  ]);
  const clean = (rows: { v: string | null }[]) => rows.map((r) => r.v).filter((v): v is string => !!v);
  return { conferences: clean(conferences), states: clean(states), divisions: clean(divisions) };
}
