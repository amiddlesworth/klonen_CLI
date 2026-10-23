"use client";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { setProgramJobAlert } from "@/lib/actions/program";

/**
 * "Set a job alert" (secondary) on a program's empty Jobs tab (§8.6) → "Alert set" (check,
 * aria-pressed). A demo alert, stored per demo account like follows; optimistic, reverts with a toast
 * when the action fails. Signed-out visitors are pointed to the demo accounts in the Me menu.
 */
export function JobAlertButton({ orgId, shortName, initialOn }: { orgId: string; shortName: string; initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await setProgramJobAlert(orgId, next).catch(() => null);
      if (res?.ok) {
        toast.show(next ? `Job alert set for ${shortName}` : `Job alert for ${shortName} removed`);
        return;
      }
      setOn(!next);
      toast.show(res?.reason === "signed_out" ? "Choose a demo account in the Me menu to set job alerts." : "Couldn't update. Try again.");
    });
  }

  return (
    <Button variant="secondary" icon={Bell} phone="large" pressed={on} aria-busy={pending || undefined} onClick={toggle}>
      {on ? "Alert set" : "Set a job alert"}
    </Button>
  );
}
