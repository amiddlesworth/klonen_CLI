"use client";
import { useLayoutEffect, useRef } from "react";
import type { ButtonProps } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DemoSubmitButton } from "./DemoSubmitButton";

type DemoStartButtonProps = Omit<ButtonProps, "type" | "loading" | "onClick"> & {
  /** switchDemoAccount bound to the role and destination (bound in a server component). */
  action: (formData: FormData) => void | Promise<void>;
  /** The person the session becomes ("Justin Leatherman"), named in the toast like the Me menu's switch. */
  viewAs: string;
  formClassName?: string;
};

/**
 * Demo sign-in from the landing: a form posting the bound switchDemoAccount server action (it
 * works without JavaScript too: the server answers with a redirect). With JavaScript it confirms
 * the identity with the same toast as the Me menu's switch (§8.2, "Now viewing as …"; the toast
 * lives in the app shell, so it stays up across the redirect), and puts the new page at the top: a
 * server-action redirect keeps the old scroll position, which opened the pipeline scrolled past its
 * header when the button was clicked low on the landing.
 */
export function DemoStartButton({ action, viewAs, formClassName, ...button }: DemoStartButtonProps) {
  const toast = useToast();
  const started = useRef(false);

  // Runs when the landing unmounts, i.e. when the redirect's page replaces it.
  useLayoutEffect(
    () => () => {
      if (started.current) window.scrollTo(0, 0);
    },
    [],
  );

  return (
    <form
      action={action}
      className={formClassName}
      onSubmit={() => {
        // No preventDefault: React still runs the action.
        started.current = true;
        toast.show(`Now viewing as ${viewAs}`);
      }}
    >
      <DemoSubmitButton {...button} />
    </form>
  );
}
