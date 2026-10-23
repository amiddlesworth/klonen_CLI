"use server";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { composeDescription, fieldErrors, postJobSchema, type PostJobState } from "@/components/jobs/post-job-schema";
import { getSession } from "@/lib/session";

/** Listings one demo account may publish, so the shared demo can't be flooded. */
const DEMO_LISTING_LIMIT = 25;
const LISTING_DAYS = 30;

/**
 * Publishes a job for the signed-in employer's program (§8.13). Demo only: the row is flagged
 * isDemo (it shows the "Sample listing" chip), source "native" (its posted time is real), and
 * checkout is a stub, so no payment is taken. On success it returns the new listing; the form
 * shows the success toast and takes the athletic director to the hiring pipeline (§8.13).
 */
export async function createJob(_prev: PostJobState, formData: FormData): Promise<PostJobState> {
  const session = await getSession();
  if (!session || session.user.kind !== "employer" || !session.org) {
    return { errors: {}, formError: "Posting a job uses the athletic director demo account. Switch accounts in the Me menu and try again." };
  }

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

  const [{ n }] = await db
    .select({ n: count() })
    .from(jobs)
    .where(and(eq(jobs.createdByUserId, session.user.id), eq(jobs.status, "open")));
  if (n >= DEMO_LISTING_LIMIT) {
    return {
      errors: {},
      formError: `The demo allows ${DEMO_LISTING_LIMIT} open listings per account, and this one has reached it. Close a listing from its job page to post another.`,
    };
  }

  const v = parsed.data;
  const now = new Date();
  const [row] = await db
    .insert(jobs)
    .values({
      orgId: session.org.id,
      title: v.title,
      roleGroup: v.roleGroup,
      unit: v.unit,
      description: composeDescription(v.description, v.howToApply),
      // "City, ST" when the athletic director gives a city; the state always comes from the program.
      location: [v.city || session.org.city, session.org.state].filter(Boolean).join(", ") || null,
      employmentType: v.employmentType,
      salaryMin: v.salaryMin ?? null,
      salaryMax: v.salaryMax ?? null,
      postedAt: now,
      closesAt: new Date(now.getTime() + LISTING_DAYS * 86_400_000),
      status: "open",
      source: "native",
      createdByUserId: session.user.id,
      isDemo: true,
    })
    .returning({ id: jobs.id, title: jobs.title });

  revalidatePath("/jobs");
  revalidatePath(`/programs/${session.org.slug}`);
  return { errors: {}, published: { id: row.id, title: row.title } };
}

export type CloseJobResult = { ok: true } | { ok: false; error: string };

/**
 * Closes a listing (status "closed"): it leaves Jobs, the feed and the program's Jobs tab, and its
 * page stays up marked closed so links keep working. Only the athletic director of the listing's
 * program may close it (the demo employer session, checked against the row).
 */
export async function closeJob(jobId: number): Promise<CloseJobResult> {
  const session = await getSession();
  if (!session || session.user.kind !== "employer" || !session.org) {
    return { ok: false, error: "Closing a listing uses the athletic director demo account." };
  }
  if (!Number.isSafeInteger(jobId) || jobId < 1) return { ok: false, error: "That listing doesn't exist." };

  const [job] = await db
    .select({ id: jobs.id, orgId: jobs.orgId, createdByUserId: jobs.createdByUserId, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job) return { ok: false, error: "That listing doesn't exist." };
  if (job.createdByUserId !== session.user.id && job.orgId !== session.org.id) {
    return { ok: false, error: `Only ${session.org.shortName}'s own listings can be closed from this account.` };
  }
  if (job.status !== "closed") {
    await db.update(jobs).set({ status: "closed" }).where(eq(jobs.id, jobId));
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/programs/${session.org.slug}`);
  return { ok: true };
}
