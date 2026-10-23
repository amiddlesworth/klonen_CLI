import { ButtonLink } from "@/components/ui/Button";
import { switchDemoAccount } from "@/lib/actions/session";
import { BRAND } from "@/lib/brand";
import { DemoSubmitButton } from "./DemoSubmitButton";
import { LandingSearch } from "./LandingSearch";

// Bound with both arguments: the form's FormData arrives third and is ignored.
const startCoachDemo = switchDemoAccount.bind(null, "coach", "/feed");

type LandingHeroProps = {
  /** The coach demo account ("Justin Leatherman", "Pacific (OR)"), named under the demo button. */
  demoAccount?: { name: string; org: string | null } | null;
};

/**
 * Hero (§8.10): centered, max 640. h1 text-hero (phone hero-sm) with the one-line value prop from
 * BRAND, the sub line, the 48px people + programs search, then two secondary CTAs: Find your
 * profile (search) and Try the demo (signs in as the coach demo account). The search button is the
 * view's one primary action.
 */
export function LandingHero({ demoAccount }: LandingHeroProps) {
  return (
    <section aria-labelledby="landing-title" className="mx-auto w-full max-w-[640px] px-4 pt-10 text-center md:px-0 md:pb-4 md:pt-16 lg:pb-6 lg:pt-20">
      <h1 id="landing-title" className="balance text-hero-sm md:text-hero">
        {BRAND.tagline}
      </h1>
      <p className="mx-auto mt-3 max-w-[560px] text-subtitle text-fg-2">{BRAND.description}</p>
      <LandingSearch className="mx-auto mt-6 max-w-[560px] md:mt-8" />
      <div className="mx-auto mt-3 grid max-w-[560px] grid-cols-2 gap-2 md:mt-4 md:flex md:justify-center">
        <ButtonLink href="/search" phone="large">
          Find your profile
        </ButtonLink>
        <form action={startCoachDemo} className="contents">
          <DemoSubmitButton phone="large">Try the demo</DemoSubmitButton>
        </form>
      </div>
      {demoAccount && (
        <p className="mt-3 text-caption text-fg-3">
          The demo shows the coach view as {demoAccount.name}
          {demoAccount.org ? ` · ${demoAccount.org}` : ""}.
        </p>
      )}
    </section>
  );
}
