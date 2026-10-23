"use client";
import { useLayoutEffect, useRef } from "react";
import type { ButtonProps } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DemoSubmitButton } from "./DemoSubmitButton";

type DemoStartButtonProps = Omit<ButtonProps, "type" | "loading" | "onClick"> & {
  /** startCoachDemo or startEmployerDemo (lib/actions/landing): no arguments, a fixed destination. */
  action: () => Promise<void>;
  /** The person the session becomes ("Justin Leatherman"), named in the toast like the Me menu's switch. */
  viewAs: string;
  formClassName?: string;
};

/**
 * Demo sign-in from the landing: a form posting a landing server action (it works without
 * JavaScript too: the server answers with a redirect). The button shows its loading state while the
 * action runs. With JavaScript, the identity is confirmed with the same toast as the Me menu's
 * switch (§8.2, "Now viewing as …"), shown once the destination has replaced the landing, so the
 * 5 second toast is up when the new page appears however long the switch took. A failed action
 * leaves the URL on "/" (the landing's error boundary replaces the page), so no toast claims a
 * switch that didn't happen. The new page also opens at the top: a server-action redirect keeps the
 * old scroll position, which opened the pipeline scrolled past its header when the button was
 * clicked low on the landing.
 */
export function DemoStartButton({ action, viewAs, formClassName, ...button }: DemoStartButtonProps) {
  const { show } = useToast();
  const started = useRef(false);

  // The cleanup runs when the landing unmounts, i.e. when the redirect's page replaces it. `show`
  // is stable and `viewAs` is a fixed name, so it doesn't run before that.
  useLayoutEffect(
    () => () => {
      if (!started.current) return;
      window.scrollTo(0, 0);
      // After the commit that swapped the pages, the router has written the new URL.
      window.setTimeout(() => {
        if (window.location.pathname !== "/") show(`Now viewing as ${viewAs}`);
      }, 0);
    },
    [show, viewAs],
  );

  return (
    <form
      action={action}
      className={formClassName}
      onSubmit={() => {
        // No preventDefault: React still runs the action.
        started.current = true;
      }}
    >
      <DemoSubmitButton {...button} />
    </form>
  );
}
