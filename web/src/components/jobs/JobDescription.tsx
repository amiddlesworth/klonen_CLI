import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Block, DescriptionSection, Inline } from "./description";

/** Web addresses and email addresses in a description (the "How to apply" line), made into links. */
const LINKABLE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)'])|([^\s@<>()"]+@[^\s@<>()"]+\.[a-z]{2,})/gi;

/** Plain text with its web and email addresses as links (§8.1 Link: inside prose, always underlined). */
function Linkified({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINKABLE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [match, url, email] = m;
    const cls = "font-medium text-link underline decoration-1 underline-offset-2 hover:decoration-2 break-words";
    out.push(
      url ? (
        // A listing is user-written content: the link opens in a new tab and passes no ranking or referrer.
        <a key={at} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className={cn(cls, "inline-flex items-center gap-[3px]")}>
          {url}
          <Icon icon={ExternalLink} size={12} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <a key={at} href={`mailto:${email}`} className={cls}>
          {email}
        </a>
      ),
    );
    last = at + match.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((i, k) =>
        i.bold ? (
          <strong key={k} className="font-semibold text-fg-1">
            {i.text}
          </strong>
        ) : (
          <Fragment key={k}>
            <Linkified text={i.text} />
          </Fragment>
        ),
      )}
    </>
  );
}

/** One section's blocks: prose 14/22 (max 68ch), bullets with a hanging indent, notes as 12px footnotes. */
export function DescriptionBlocks({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div className={cn("flex max-w-prose flex-col gap-3", className)}>
      {blocks.map((b, i) => {
        if (b.kind === "ul") {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 text-prose text-fg-1 marker:text-fg-3">
              {b.items.map((it, k) => (
                <li key={k} className="pl-0.5">
                  <Inlines items={it} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "note") {
          return (
            <p key={i} className="text-caption text-fg-3">
              <Inlines items={b.inlines} />
            </p>
          );
        }
        return (
          <p key={i} className="text-prose text-fg-1">
            <Inlines items={b.inlines} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * The whole description in one card body: sections split by dividers, each with an h3 (the
 * /jobs detail pane, where the job title is the pane's h2).
 */
export function JobDescriptionInline({ sections, headingLevel = "h3" }: { sections: DescriptionSection[]; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <div className="divide-y divide-divider">
      {sections.map((s, i) => (
        <section key={i} className="py-4 first:pt-0 last:pb-0">
          <H className="mb-2 text-body font-semibold">{s.heading ?? "About the role"}</H>
          <DescriptionBlocks blocks={s.blocks} />
        </section>
      ))}
    </div>
  );
}
