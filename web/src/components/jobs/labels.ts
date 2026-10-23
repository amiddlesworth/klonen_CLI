import { CURRENT_SEASON } from "@/lib/brand";
import { ROLE_GROUP_LABEL, conferenceShort, timeAgo, type RoleGroup } from "@/lib/format";

/* Plain helpers shared by the jobs pages and components (safe on server and client). */

/** Role groups a job can have, most senior first (the jobs filters and the list order). */
export const JOB_ROLE_GROUPS = ["head_coach", "coordinator", "position_coach", "ga_analyst", "support"] as const;
export type JobRoleGroup = (typeof JOB_ROLE_GROUPS)[number];

export function isJobRoleGroup(v: string): v is JobRoleGroup {
  return (JOB_ROLE_GROUPS as readonly string[]).includes(v);
}

export const UNIT_LABEL: Record<string, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special teams",
  staff: "Staff and operations",
};

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Graduate assistantship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export function roleGroupLabel(v: string | null | undefined): string {
  return (v && ROLE_GROUP_LABEL[v as RoleGroup]) || "Other";
}

/** A job is a sample when it is demo data or seeded as a sample listing (§6.4: "Sample listing"). */
export function isSampleJob(j: { isDemo: boolean; source: string }): boolean {
  return j.isDemo || j.source === "sample";
}

type SublineJob = {
  employmentType: string;
  location?: string | null;
  org: { shortName: string; city: string | null; state: string | null; conferenceAbbr: string | null };
};

/**
 * Where the job is: the posted "City, ST" when there is one, else the program's city and state.
 * Registry short names already carry the state ("Pacific (OR)"), so the state is dropped when it
 * would only repeat it ("Pacific (OR) · Forest Grove", not "Pacific (OR) · Forest Grove, OR · OR").
 */
export function jobPlace(j: Pick<SublineJob, "location" | "org">): string | null {
  const state = j.org.state;
  const posted = j.location?.trim() || null;
  const city = posted ? (posted.includes(",") ? posted.split(",")[0].trim() : posted === state ? null : posted) : j.org.city;
  const stateInName = !!state && j.org.shortName.trim().endsWith(`(${state})`);
  return [city, stateInName ? null : state].filter(Boolean).join(", ") || null;
}

/** "Allegheny · PA · PAC · Full-time", "Pacific (OR) · NWC · Full-time". */
export function jobSubline(j: SublineJob, opts: { org?: boolean; type?: boolean } = {}): string {
  const { org = true, type = true } = opts;
  return [org ? j.org.shortName : null, jobPlace(j), conferenceShort(j.org.conferenceAbbr), type ? j.employmentType : null].filter(Boolean).join(" · ");
}

/**
 * Only a listing someone posted on the network (source "native") has a real posted time. Seeded
 * sample listings carry invented timestamps, so they never show one (§6.3, §11 rule 6).
 */
export function hasRealPostedAt(j: { source: string; postedAt: Date | null }): j is { source: string; postedAt: Date } {
  return j.source === "native" && !!j.postedAt;
}

/** The season a listing without a real timestamp is shown in: "2026 season". */
export const LISTING_SEASON = `${CURRENT_SEASON} season`;

/** "Posted 3d ago" from the listing's real timestamp; the full date goes in the <time> title. */
export function postedLabel(d: Date, now = new Date()): string {
  return `Posted ${timeAgo(d, now)} ago`;
}

export function postedTitle(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** "an Offensive Line Coach", "a Defensive Coordinator", "a coach". */
export function withArticle(phrase: string): string {
  const p = phrase.trim();
  const an = /^[aeiou]/i.test(p) && !/^(uni|use|usu|one|once|eu)/i.test(p);
  return `${an ? "an" : "a"} ${p}`;
}

/* ---------- URL filters ---------- */

export type JobsQuery = {
  roles: string[];
  states: string[];
  conferences: string[];
  q: string;
  page: number;
  id: number | null;
};

type Params = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v.join(",") : (v ?? "");
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
}

/** Reads `?role=&state=&conf=&q=&page=&id=` (comma-separated lists). */
export function parseJobsQuery(p: Params): JobsQuery {
  const one = (k: string) => (Array.isArray(p[k]) ? p[k]![0] : (p[k] as string | undefined)) ?? "";
  const page = Number.parseInt(one("page"), 10);
  const id = Number.parseInt(one("id"), 10);
  return {
    // Unknown values are dropped here, so a bogus ?role= neither filters nor counts as a filter.
    roles: list(p.role).filter(isJobRoleGroup),
    states: list(p.state)
      .map((s) => s.toUpperCase())
      .filter((s) => /^[A-Z]{2}$/.test(s)),
    conferences: list(p.conf),
    q: one("q").slice(0, 80),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    id: Number.isFinite(id) && id > 0 ? id : null,
  };
}

/** Builds a /jobs URL from a query, dropping empty values. `page` resets unless given. */
export function jobsHref(q: Partial<JobsQuery>, patch: Partial<JobsQuery> = {}): string {
  const m = { ...q, ...patch };
  const sp = new URLSearchParams();
  if (m.q) sp.set("q", m.q);
  if (m.roles?.length) sp.set("role", m.roles.join(","));
  if (m.states?.length) sp.set("state", m.states.join(","));
  if (m.conferences?.length) sp.set("conf", m.conferences.join(","));
  if (m.page && m.page > 1) sp.set("page", String(m.page));
  if (m.id) sp.set("id", String(m.id));
  const s = sp.toString();
  return s ? `/jobs?${s}` : "/jobs";
}

export function hasFilters(q: Pick<JobsQuery, "roles" | "states" | "conferences" | "q">): boolean {
  return q.roles.length + q.states.length + q.conferences.length > 0 || !!q.q.trim();
}
