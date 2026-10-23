import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { Block, DescriptionSection, Inline } from "./description";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((i, k) =>
        i.bold ? (
          <strong key={k} className="font-semibold text-fg-1">
            {i.text}
          </strong>
        ) : (
          <Fragment key={k}>{i.text}</Fragment>
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
