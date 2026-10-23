import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { keepWhole } from "./labels";

/**
 * "Austin College · TX · SCAC · Full-time" with each segment kept whole, so a line breaks only at
 * a dot, never inside "Forest Grove". A no-break space before each dot keeps it at the end of a
 * line, never starting the next. A segment may be a node (the header links the program and wraps
 * the conference in an abbr); pass its plain text as `text` so its length can be judged.
 */
export function PlaceLine({ parts, className }: { parts: (string | { node: ReactNode; text: string })[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const text = typeof p === "string" ? p : p.text;
        const node = typeof p === "string" ? p : p.node;
        return (
          <Fragment key={i}>
            {i > 0 && " · "}
            <span className={cn(keepWhole(text) && "whitespace-nowrap")}>{node}</span>
          </Fragment>
        );
      })}
    </span>
  );
}
