import type { Session } from "@/lib/session";

/* Who is looking at a job, from the session only (ARCHITECTURE "Demo accounts": personal copy comes from the session). */

/** The coach viewer's person and current program (null for employers and visitors). */
export function viewerContext(session: Session): { viewerPersonId: string | null; viewerOrgId: string | null } {
  if (session?.user.kind !== "coach" || !session.person) return { viewerPersonId: null, viewerOrgId: null };
  return { viewerPersonId: session.person.id, viewerOrgId: session.person.currentOrgId ?? session.org?.id ?? null };
}

/**
 * The signed-in athletic director owns the listing: they posted it, or it is their program's. They
 * get the owner view (hiring tools, Close listing) instead of Apply and Save.
 */
export function isJobOwner(session: Session, job: { createdByUserId: string | null; org: { id: string } }): boolean {
  if (session?.user.kind !== "employer") return false;
  return job.createdByUserId === session.user.id || (!!session.org && session.org.id === job.org.id);
}
