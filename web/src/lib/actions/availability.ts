"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { availability } from "@/db/schema";
import { AUDIENCES, REGION_VALUES, ROLE_VALUES } from "@/components/claim/options";
import { getRegistryProgramIds } from "@/lib/queries/claim";
import { getSession } from "@/lib/session";

export type AvailabilityResult = { ok: true; updatedAt: string } | { ok: false; error: string; field?: "programs" };

const AvailabilityInput = z.object({
  open: z.boolean(),
  audience: z.enum(AUDIENCES as [string, ...string[]]),
  selectedOrgIds: z.array(z.string().max(64)).max(50),
  roles: z.array(z.string()).max(10),
  regions: z.array(z.string()).max(10),
});

/**
 * Saves the demo coach's private "Open to opportunities" setting. Only the coach session can save;
 * the coach's current program can never be in the audience, so it is dropped from any selection.
 */
export async function saveAvailability(input: z.input<typeof AvailabilityInput>): Promise<AvailabilityResult> {
  const session = await getSession();
  if (session?.user.kind !== "coach" || !session.person) {
    return { ok: false, error: "Switch to the coach demo account to change this setting." };
  }
  const parsed = AvailabilityInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some choices weren't recognized. Reload the page and try again." };

  const currentOrgId = session.person.currentOrgId;
  const registry = await getRegistryProgramIds();
  const selectedOrgIds = [...new Set(parsed.data.selectedOrgIds)].filter((id) => registry.has(id) && id !== currentOrgId);
  const audience = parsed.data.audience as (typeof AUDIENCES)[number];

  if (parsed.data.open && audience === "selected_programs" && selectedOrgIds.length === 0) {
    return { ok: false, error: "Choose at least one program, or pick another audience.", field: "programs" };
  }

  const values = {
    open: parsed.data.open,
    audience,
    selectedOrgIds,
    roles: [...new Set(parsed.data.roles)].filter((r) => ROLE_VALUES.has(r)),
    regions: [...new Set(parsed.data.regions)].filter((r) => REGION_VALUES.has(r)),
    updatedAt: new Date(),
  };

  try {
    await db
      .insert(availability)
      .values({ personId: session.person.id, ...values })
      .onConflictDoUpdate({ target: availability.personId, set: values });
  } catch {
    return { ok: false, error: "We couldn't save your setting. Try again." };
  }

  // The status line appears in the shell (Me menu), the feed's mini profile and the settings index.
  revalidatePath("/", "layout");
  return { ok: true, updatedAt: values.updatedAt.toISOString() };
}
