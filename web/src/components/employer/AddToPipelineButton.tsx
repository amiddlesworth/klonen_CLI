import { cache } from "react";
import type { ButtonPhone, ButtonSize } from "@/components/ui/Button";
import { getPersonName, getPipelineStatusMap } from "@/lib/queries/employer";
import { getSession } from "@/lib/session";
import { AddToPipelineControl } from "./AddToPipelineControl";

export type AddToPipelineButtonProps = {
  personId: string;
  /** Skips a lookup when the caller already has the name. */
  name?: string;
  size?: ButtonSize;
  phone?: ButtonPhone;
  fullWidth?: boolean;
  className?: string;
};

/** One session read per request, however many buttons a page renders. */
const readSession = cache(() => getSession().catch(() => null));

/**
 * "Add to pipeline" for employer sessions (server component). Drop it on a profile header or a
 * search result: it renders nothing unless the viewer is the athletic director demo account, and
 * shows "In pipeline · {stage}" when the coach is already shortlisted. The pipeline status is read
 * once per request (cached), so a page of results costs one query.
 *
 *   <AddToPipelineButton personId={person.id} />
 *   <AddToPipelineButton personId={r.id} name={r.fullName} size="sm" />
 *
 * Inside a client component, render AddToPipelineControl instead and pass the stage yourself.
 */
export async function AddToPipelineButton({ personId, name, size, phone, fullWidth, className }: AddToPipelineButtonProps) {
  const session = await readSession();
  if (session?.user.kind !== "employer") return null;
  const [statuses, fullName] = await Promise.all([getPipelineStatusMap(session.user.id), name ? Promise.resolve(name) : getPersonName(personId)]);
  if (!fullName) return null;
  const status = statuses.get(personId);
  return (
    <AddToPipelineControl
      personId={personId}
      name={fullName}
      initialStage={status?.stage ?? null}
      shortlistId={status?.shortlistId ?? null}
      size={size}
      phone={phone}
      fullWidth={fullWidth}
      className={className}
    />
  );
}
