import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, type AvatarSize } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

export type PersonRowProps = {
  name: string;
  /** Profile link; omit for an unlisted person (named in a source, no profile). */
  href?: string | null;
  /** Avatar tint key: the person's slug. */
  tintKey?: string;
  /** Current title (truncates; a range or count beside it never does). */
  title?: ReactNode;
  /** Program or organization, joined to the title with " · ". */
  org?: ReactNode;
  /** Chips after the name (Unclaimed, Demo). */
  chips?: ReactNode;
  /** Right-aligned text on the name line (compact range in tree rows). */
  aside?: ReactNode;
  /** A ContextLine ("Via Rob Hutchins · coached Chris at Colorado"). */
  context?: ReactNode;
  /** Right-side action (Connect icon button). Not allowed with linkRow. */
  action?: ReactNode;
  /** Content under the text column (an "Invite to claim" button). */
  footer?: ReactNode;
  /** Unlisted person: dashed avatar, name not linked. */
  unlisted?: boolean;
  avatarSize?: AvatarSize;
  /** "md": name 14/20, title 13/18. "sm": name 13/18, title 12/16 (rails, tree rows). */
  size?: "md" | "sm";
  /** The whole row is one link (at least 44px tall); hover underlines the name. */
  linkRow?: boolean;
  /** Truncate title and org to one line (default true). */
  truncate?: boolean;
  className?: string;
};

/** Person row (§8.3): avatar, name, title · org, optional context line and action. */
export function PersonRow({
  name,
  href,
  tintKey,
  title,
  org,
  chips,
  aside,
  context,
  action,
  footer,
  unlisted,
  avatarSize = 40,
  size = "md",
  linkRow,
  truncate = true,
  className,
}: PersonRowProps) {
  const linked = !!href && !unlisted;
  const nameCls = cn("font-semibold text-fg-1 underline-offset-2", size === "md" ? "text-body" : "text-small");
  const nameNode =
    linked && !linkRow ? (
      <Link href={href!} className={cn(nameCls, "target-24 hover:underline")}>
        {name}
      </Link>
    ) : (
      <span className={cn(nameCls, linkRow && linked && "group-hover/row:underline")}>{name}</span>
    );
  const sub = [title, org].filter(Boolean);

  const content = (
    <>
      <Avatar name={name} tintKey={tintKey} size={avatarSize} unlisted={unlisted} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <div className={cn("flex min-w-0 items-center gap-x-2 gap-y-0.5", truncate ? "flex-nowrap" : "flex-wrap")}>
            {/* the extra 3px keeps the 24px link target inside the truncating box */}
            <span className={cn("min-w-0", truncate && "truncate", linked && !linkRow && "-my-[3px] py-[3px]")}>{nameNode}</span>
            {chips}
          </div>
          {aside && <span className="shrink-0">{aside}</span>}
        </div>
        {sub.length > 0 && (
          <p className={cn(size === "md" ? "text-small" : "text-caption", "text-fg-2", truncate && "truncate")}>
            {sub.map((s, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {s}
              </span>
            ))}
          </p>
        )}
        {context}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
      {action && !linkRow && <div className="shrink-0">{action}</div>}
    </>
  );

  if (linkRow && linked) {
    return (
      <Link href={href!} className={cn("group/row flex min-h-11 min-w-0 items-start gap-3", className)}>
        {content}
      </Link>
    );
  }
  return <div className={cn("flex min-w-0 items-start gap-3", className)}>{content}</div>;
}
