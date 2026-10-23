import { ROLE_GROUP_LABEL, conferenceShort, timeAgo, type RoleGroup } from "@/lib/format";

/* Plain helpers shared by the jobs pages and components (safe on server and client). */

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

/** "Allegheny · PA · PAC · Full-time" (city is not in the dataset yet; it slots in before the state). */
export function jobSubline(j: { employmentType: string; org: { shortName: string; city: string | null; state: string | null; conferenceAbbr: string | null } }, opts: { org?: boolean; type?: boolean } = {}): string {
  const { org = true, type = true } = opts;
  const place = [j.org.city, j.org.state].filter(Boolean).join(", ");
  return [org ? j.org.shortName : null, place || null, conferenceShort(j.org.conferenceAbbr), type ? j.employmentType : null].filter(Boolean).join(" · ");
}

/** "Posted 3d ago" from the listing's real timestamp; the full date goes in the <time> title. */
export function postedLabel(d: Date, now = new Date()): string {
  return `Posted ${timeAgo(d, now)} ago`;
}

export function postedTitle(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
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
    roles: list(p.role),
    states: list(p.state).map((s) => s.toUpperCase()),
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
