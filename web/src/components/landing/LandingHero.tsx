import { switchDemoAccount } from "@/lib/actions/session";
import { BRAND } from "@/lib/brand";
import { LANDING_SUB } from "./copy";
import { HeroSearch } from "./HeroSearch";

// Bound with both arguments: the form's FormData arrives third and is ignored.
const startCoachDemo = switchDemoAccount.bind(null, "coach", "/feed");

type LandingHeroProps = {
  /** The coach demo account ("Justin Leatherman", "Pacific (OR)"), named under the demo button. */
  demoAccount?: { name: string; org: string | null } | null;
};

/**
 * Hero (§8.10): centered, max 640. h1 text-hero (phone hero-sm) with the one-line value prop from
 * BRAND, a sub line that describes the model (no adoption claim), the 48px people + programs
 * search, then two secondary actions (HeroSearch). The search button is the view's one primary.
 */
export function LandingHero({ demoAccount = null }: LandingHeroProps) {
  return (
    <section aria-labelledby="landing-title" className="mx-auto w-full max-w-[640px] px-4 pt-10 text-center md:px-0 md:pb-4 md:pt-16 lg:pb-6 lg:pt-20">
      <h1 id="landing-title" className="balance text-hero-sm md:text-hero">
        {BRAND.tagline}
      </h1>
      <p className="mx-auto mt-3 max-w-[560px] text-subtitle text-fg-2">{LANDING_SUB}</p>
      <HeroSearch demoAction={startCoachDemo} demoAccount={demoAccount} />
    </section>
  );
}
