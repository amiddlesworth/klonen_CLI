"use client";
import { RotateCw } from "lucide-react";
import { LANDING_SUB } from "@/components/landing/copy";
import { LandingFrame } from "@/components/landing/LandingFrame";
import { LandingSearch } from "@/components/landing/LandingSearch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { BRAND } from "@/lib/brand";

/**
 * Error state for / (§8.0): the value prop and the search stay usable; the failure is one sentence
 * with "Try again", inline in a card.
 */
export default function LandingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <LandingFrame>
      <section aria-labelledby="landing-title" className="mx-auto w-full max-w-[640px] px-4 pt-10 text-center md:px-0 md:pb-4 md:pt-16 lg:pb-6 lg:pt-20">
        <h1 id="landing-title" className="balance text-hero-sm md:text-hero">
          {BRAND.tagline}
        </h1>
        <p className="mx-auto mt-3 max-w-[560px] text-subtitle text-fg-2">{LANDING_SUB}</p>
        <LandingSearch className="mx-auto mt-6 max-w-[560px] md:mt-8" />
      </section>
      <Card className="mx-auto w-full max-w-[640px] px-4 py-3 md:px-6">
        <ErrorState
          message="We couldn't load this page. Search still works."
          action={
            <Button variant="ghost" size="sm" icon={RotateCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </LandingFrame>
  );
}
