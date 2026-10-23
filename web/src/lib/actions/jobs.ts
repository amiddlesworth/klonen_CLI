"use server";
import { and, count, eq, gt, isNotNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobs, shortlists } from "@/db/schema";
import { composeDescription, fieldErrors, postJobSchema, type PostJobState } from "@/components/jobs/post-job-schema";
import { DEMO_LISTING_SEARCH_TTL_MS, ensureDemoScope, purgeExpiredDemoSearches, readDemoScope } from "@/lib/demo-scope";
import { listingSearchName } from "@/lib/queries/jobsx";
import { getSession } from "@/lib/session";

/** Open listings one browser may publish from the demo account (counted per demo scope, not per shared account). */
const DEMO_LISTING_LIMIT = 5;
/**
 * Listings all browsers together may publish from the demo per day. A client that drops its scope
 * cookie gets a fresh scope (and a fresh per-browser allowance) on every request, so this server-side
 * cap is what bounds the table.
 */
const DEMO_LISTING_DAILY_LIMIT = 200;
const LISTING_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Publishes a job for the signed-in employer's program (§8.13). Demo only: the row is flagged
 * isDemo with source "native" (it shows the "Demo listing" chip; its posted time is real), it is
 * visible only in the browser that posted it (demoScope), and checkout is a stub, so no payment is
 * taken. With the listing it opens the listing's own search in
 * the hiring pipeline ("{title} search", empty), in one transaction, so the pipeline the athletic
 * director lands on is this listing's and not another search (§8.14 job switcher). On success it
 * returns both; the form shows the success toast and goes to that pipeline (§8.13).
 */
export async function createJob(_prev: PostJobState, formData: FormData): Promise<PostJobState> {
  const session = await getSession();
  if (!session || session.user.kind !== "employer" || !session.org) {
    return { errors: {}, formError: "Posting a job uses the athletic director demo account. Switch accounts in the Me menu and try again." };
  }
  // Server Action arguments are whatever the client sends: refuse anything that isn't form data.
  if (!(formData instanceof FormData)) return { errors: {}, formError: "Some fields need a fix before you can publish." };

  const parsed = postJobSchema.safeParse({
    title: formData.get("title") ?? "",
    roleGroup: formData.get("roleGroup") ?? "",
    unit: formData.get("unit") ?? "",
    city: formData.get("city") ?? "",
    employmentType: formData.get("employmentType") ?? "",
    salaryMin: formData.get("salaryMin") ?? "",
    salaryMax: formData.get("salaryMax") ?? "",
    description: formData.get("description") ?? "",
    howToApply: formData.get("howToApply") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), formError: "Some fields need a fix before you can publish." };

  // Demo accounts are shared by every visitor, so what one posts stays in the posting browser (its
  // demo scope): the listing and its search are shown only there, labeled "Demo listing".
  const demo = session.user.isDemo;
  const scope = demo ? await ensureDemoScope() : null;
  const now = new Date();
  if (scope) {
    // Expired demo listings (and expired demo searches: lib/demo-scope.ts) are removed, like demo messages.
    const expired = new Date(now.getTime() - LISTING_DAYS * DAY_MS);
    await db.delete(jobs).where(and(isNotNull(jobs.demoScope), lt(jobs.postedAt, expired)));
    await purgeExpiredDemoSearches(now);

    const [[mine], [everyone]] = await Promise.all([
      db.select({ n: count() }).from(jobs).where(and(eq(jobs.demoScope, scope), eq(jobs.status, "open"))),
      db.select({ n: count() }).from(jobs).where(and(isNotNull(jobs.demoScope), gt(jobs.postedAt, new Date(now.getTime() - DAY_MS)))),
    ]);
    if ((mine?.n ?? 0) >= DEMO_LISTING_LIMIT) {
      return {
        errors: {},
        formError: `The demo allows ${DEMO_LISTING_LIMIT} open listings per browser, and this one has reached it. Close a listing from its job page to post another.`,
      };
    }
    if ((everyone?.n ?? 0) >= DEMO_LISTING_DAILY_LIMIT) {
      return { errors: {}, formError: "The demo has taken all the listings it can for today. Try again tomorrow." };
    }
  }

  const v = parsed.data;
  const org = session.org;
  const userId = session.user.id;
  const { row, list } = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(jobs)
      .values({
        orgId: org.id,
        title: v.title,
        roleGroup: v.roleGroup,
        unit: v.unit,
        description: composeDescription(v.description, v.howToApply),
        // "City, ST" when the athletic director gives a city; the state always comes from the program.
        location: [v.city || org.city, org.state].filter(Boolean).join(", ") || null,
        employmentType: v.employmentType,
        salaryMin: v.salaryMin ?? null,
        salaryMax: v.salaryMax ?? null,
        postedAt: now,
        closesAt: new Date(now.getTime() + LISTING_DAYS * 86_400_000),
        status: "open",
        source: "native",
        createdByUserId: userId,
        isDemo: true,
        demoScope: scope,
      })
      .returning({ id: jobs.id, title: jobs.title });
    // Created at the listing's posted time: getListingPipelineId finds it by name from that moment on.
    const [list] = await tx
      .insert(shortlists)
      .values({
        ownerUserId: userId,
        name: listingSearchName(row.title),
        createdAt: now,
        demoScope: scope,
        demoExpiresAt: scope ? new Date(now.getTime() + DEMO_LISTING_SEARCH_TTL_MS) : null,
      })
      .returning({ id: shortlists.id });
    return { row, list };
  });

  revalidatePath("/jobs");
  revalidatePath(`/programs/${session.org.slug}`);
  revalidatePath("/employers/pipeline");
  return { errors: {}, published: { id: row.id, title: row.title, pipelineId: list.id } };
}

export type CloseJobResult = { ok: true } | { ok: false; error: string };

const JobId = z.number().int().positive().max(2_147_483_647);

/**
 * Closes a listing (status "closed"): it leaves Jobs, the feed and the program's Jobs tab, and its
 * page stays up marked closed so links keep working. Only the athletic director of the listing's
 * program may close it (the demo employer session, checked against the row). From a shared demo
 * account, only the listings this browser posted (its demo scope) can be closed.
 */
export async function closeJob(rawJobId: number): Promise<CloseJobResult> {
  const session = await getSession();
  if (!session || session.user.kind !== "employer" || !session.org) {
    return { ok: false, error: "Closing a listing uses the athletic director demo account." };
  }
  const parsedId = JobId.safeParse(rawJobId);
  if (!parsedId.success) return { ok: false, error: "That listing doesn't exist." };
  const jobId = parsedId.data;

  const [job] = await db
    .select({ id: jobs.id, orgId: jobs.orgId, createdByUserId: jobs.createdByUserId, status: jobs.status, demoScope: jobs.demoScope })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  const scope = await readDemoScope();
  // Another browser's demo listing doesn't exist as far as this one is concerned.
  if (!job || (job.demoScope !== null && job.demoScope !== scope)) return { ok: false, error: "That listing doesn't exist." };
  if (job.createdByUserId !== session.user.id && job.orgId !== session.org.id) {
    return { ok: false, error: `Only ${session.org.shortName}'s own listings can be closed from this account.` };
  }
  if (session.user.isDemo && job.demoScope === null) {
    return { ok: false, error: "The demo can close only listings posted from this browser." };
  }
  if (job.status !== "closed") {
    await db.update(jobs).set({ status: "closed" }).where(eq(jobs.id, jobId));
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/programs/${session.org.slug}`);
  return { ok: true };
}
