import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PAGE_TITLE } from "@/components/ui/PageHeader";

/** The page title (PAGE_TITLE, as every non-entity page), in the same place in every state of /employers/pipeline. */
export const PIPELINE_H1 = PAGE_TITLE;

/**
 * Phone stage tabs at the bottom of the header card (Tabs className; the skeleton draws the same
 * classes): a divider above instead of below, each tab grows from its label width with at least
 * 12px a side so all four fit from 360px, and no negative margin, so the active 2px underline sits
 * on the card's bottom border.
 */
export const STAGE_TABS = "border-b-0 border-t [&>a]:mb-0 [&>a]:grow [&>a]:justify-center [&>a]:px-3";

/**
 * Header card for the states without a board (gate, not found, error): the h1 sits exactly where
 * the board's header card puts it, so the page title never jumps between states; the state's
 * message sits under it in the same card.
 */
export function PipelineFrame({ children }: { children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby="pipeline-title">
      <div className="px-4 pt-4 md:px-6 md:pt-5">
        <h1 id="pipeline-title" className={PIPELINE_H1}>
          Hiring pipeline
        </h1>
      </div>
      <div className="px-4 md:px-6">{children}</div>
    </Card>
  );
}
