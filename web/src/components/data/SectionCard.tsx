import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

type SectionCardProps = {
  /** Used for the heading id and aria-labelledby. */
  id: string;
  title: ReactNode;
  /** Right side of the header: one meta ("4 programs · 25 seasons")… */
  meta?: ReactNode;
  /** …and one link ("Explore tree →"). */
  action?: ReactNode;
  subtitle?: ReactNode;
  /** "main" (20/24px padding, text-title) or "rail" (16px padding, 14/600 title). */
  size?: "main" | "rail";
  headingLevel?: "h1" | "h2" | "h3";
  /** Real chrome plus 3 line blocks. */
  loading?: boolean;
  /** Renders an EmptyState inside the card instead of children. */
  empty?: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode } | null;
  className?: string;
  children?: ReactNode;
};

/** A card with a header row (title, meta, link) and its loading and empty states (§8.1 Card). */
export function SectionCard({ id, title, meta, action, subtitle, size = "main", headingLevel = "h2", loading, empty, className, children }: SectionCardProps) {
  const headingId = `${id}-title`;
  return (
    <Card id={id} padding={size === "main" ? "main" : "rail"} aria-labelledby={headingId} className={className}>
      <CardHeader id={headingId} as={headingLevel} title={title} meta={meta} action={action} subtitle={subtitle} size={size} />
      {loading ? (
        <SkeletonRegion>
          <SkeletonText lines={3} widths={["82%", "64%", "73%"]} />
        </SkeletonRegion>
      ) : empty ? (
        <EmptyState {...empty} spacing="sm" align={size === "rail" ? "start" : "center"} />
      ) : (
        children
      )}
    </Card>
  );
}
