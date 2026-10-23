"use server";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { fieldErrors, postJobSchema, type PostJobState } from "@/components/jobs/post-job-schema";
import { getSession } from "@/lib/session";

/** Listings one demo account may publish, so the shared demo can't be flooded. */
const DEMO_LISTING_LIMIT = 25;
const LISTING_DAYS = 30;

/**
 * Publishes a job for the signed-in employer's program (§8.13). Demo only: the row is flagged
 * isDemo (it shows the "Sample listing" chip), source "native", and checkout is a stub, so no
 * payment is taken. On success it redirects to the new job page.
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
    employmentType: formData.get("employmentType") ?? "",
    salaryMin: formData.get("salaryMin") ?? "",
    salaryMax: formData.get("salaryMax") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), formError: "Some fields need a fix before you can publish." };

  const [{ n }] = await db
    .select({ n: count() })
    .from(jobs)
    .where(and(eq(jobs.createdByUserId, session.user.id), eq(jobs.status, "open")));
  if (n >= DEMO_LISTING_LIMIT) {
    return { errors: {}, formError: `The demo allows ${DEMO_LISTING_LIMIT} open listings per account, and this one has reached it.` };
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
      description: v.description,
      location: [session.org.city, session.org.state].filter(Boolean).join(", ") || null,
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
    .returning({ id: jobs.id });

  revalidatePath("/jobs");
  redirect(`/jobs/${row.id}?posted=1`);
}
