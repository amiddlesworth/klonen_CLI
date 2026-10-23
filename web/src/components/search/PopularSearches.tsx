import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { plural } from "./params";
import type { PopularSearch } from "./popular";

/** "Popular searches" card: each row is one link (44px+) with a real result count. */
export function PopularSearches({ items, title = "Popular searches", headingLevel = "h2", className }: { items: PopularSearch[]; title?: string; headingLevel?: "h2" | "h3"; className?: string }) {
  if (!items.length) return null;
  return (
    <Card padding="none" className={cn("pt-4 md:pt-5", className)}>
      <CardHeader title={title} as={headingLevel} className="mb-1 px-4 md:px-6" />
      <ul className="pb-2">
        {items.map((p) => (
          <li key={p.key}>
            <Link
              href={p.href}
              className="group/row flex min-h-12 items-center gap-3 px-4 py-2 transition-colors hover:bg-hover focus-visible:-outline-offset-2 md:px-6"
            >
              <Icon icon={Search} size={16} className="text-fg-2" />
              <span className="min-w-0 flex-1">
                <span className="text-body font-medium text-fg-1 underline-offset-2 group-hover/row:underline">{p.label}</span>
                {p.note && <span className="text-small text-fg-3"> · {p.note}</span>}
              </span>
              <span className="num shrink-0 text-caption text-fg-3">{plural(p.count, p.noun, p.noun === "coach" ? "coaches" : "programs")}</span>
              <Icon icon={ChevronRight} size={16} className="text-fg-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
