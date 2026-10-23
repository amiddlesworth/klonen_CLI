import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/**
 * Page title type (§4, audit X01). Two h1 sizes exist, by kind of page:
 * - entity pages (profile, program, job detail, coaching tree) put the subject's name in their own
 *   header card at text-display (24/32; 20/28 on phone);
 * - every other page (Jobs, Search, Messaging, Notifications, Hiring pipeline, Post a job,
 *   Settings, Claim, About) uses this one size at every width: text-display-sm, 20/28 600, the same
 *   token as the landing page's section headings, so a page title never reads as a card title (16).
 */
export const PAGE_TITLE = "text-display-sm";

type PageHeaderProps = {
  title: ReactNode;
  /** Id for the h1 (aria-labelledby on the card or form). */
  id?: string;
  /** Short meta after the title on its line ("3 new", "1 unread"), 13px --fg-3. */
  meta?: ReactNode;
  /** One 13px --fg-2 line under the title. */
  description?: ReactNode;
  /** Top-right: the page's actions (buttons); they wrap under the title when there is no room. */
  actions?: ReactNode;
  /** Extra attributes for the h1 (focus target after an action, live region). */
  headingProps?: { tabIndex?: number; "aria-live"?: "polite"; ref?: Ref<HTMLHeadingElement> };
  className?: string;
};

/**
 * Page header for every page that is not an entity page (see PAGE_TITLE): the h1, an optional meta
 * and one description line, and the actions on the right. It sits at the top of the page's first
 * card (pages put their h1 inside that card), so it has no padding of its own.
 */
export function PageHeader({ title, id, meta, description, actions, headingProps, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 id={id} {...headingProps} className={cn(PAGE_TITLE, "outline-none")}>
            {title}
          </h1>
          {meta && <span className="num text-small text-fg-3">{meta}</span>}
        </div>
        {description && <p className="mt-0.5 max-w-prose text-small text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
