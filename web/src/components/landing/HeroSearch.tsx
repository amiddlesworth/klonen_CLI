"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { startCoachDemo } from "@/lib/actions/landing";
import { DemoStartButton } from "./DemoStartButton";
import { LandingSearch } from "./LandingSearch";

type HeroSearchProps = {
  /** The coach demo account ("Justin Leatherman", "Pacific (OR)"), named under the buttons. */
  demoAccount: { name: string; org: string | null } | null;
};

/**
 * The hero's search and its two secondary actions. "Find your profile" is not a second search: it
 * focuses the field above and asks for a name ("Search your name"). "Try the demo" signs in as the
 * coach demo account, named in the caption. The Search button stays the view's one primary.
 */
export function HeroSearch({ demoAccount }: HeroSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [findingProfile, setFindingProfile] = useState(false);

  return (
    <>
      <LandingSearch
        inputRef={inputRef}
        placeholder={findingProfile ? "Search your name" : undefined}
        className="mx-auto mt-6 max-w-[560px] md:mt-8"
      />
      <div className="mx-auto mt-3 grid max-w-[560px] grid-cols-2 gap-2 md:mt-4 md:flex md:justify-center">
        <Button
          phone="large"
          onClick={() => {
            setFindingProfile(true);
            inputRef.current?.focus();
          }}
        >
          Find your profile
        </Button>
        <DemoStartButton action={startCoachDemo} viewAs={demoAccount?.name ?? "the coach demo account"} phone="large" formClassName="contents">
          Try the demo
        </DemoStartButton>
      </div>
      {demoAccount && (
        <p className="balance mt-3 text-caption text-fg-3">
          The demo shows the coach view as{" "}
          <span className="whitespace-nowrap">
            {demoAccount.name}
            {demoAccount.org ? ` · ${demoAccount.org}` : ""}
          </span>
          .
        </p>
      )}
    </>
  );
}
