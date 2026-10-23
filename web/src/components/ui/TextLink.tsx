import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type TextLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  /**
   * "default": --link 500, underline on hover.
   * "inline": inside prose, always underlined (1px, offset 2).
   * "plain": inherits color (names and titles in rows); underline on hover.
   */
  variant?: "default" | "inline" | "plain";
  /** Leaves the site: new tab, 12px external-link icon. Detected from http(s) hrefs when omitted. */
  external?: boolean;
  /** Ends with a 14px arrow ("Explore tree →", "All moves →"). */
  arrow?: boolean;
  /** 24px tall target for links outside sentences (padding-block 3px, margin-block -3px). */
  target24?: boolean;
  children: ReactNode;
};

const VARIANT = {
  default: "font-medium text-link hover:underline",
  inline: "font-medium text-link underline decoration-1 hover:decoration-2",
  plain: "hover:underline",
};

/** Link (§8.1). Visited links keep the same color. */
export function TextLink({ variant = "default", external, arrow, target24, className, children, href, ...rest }: TextLinkProps) {
  const isExternal = external ?? (typeof href === "string" && /^https?:\/\//.test(href));
  return (
    <Link
      href={href}
      className={cn(
        "underline-offset-2",
        VARIANT[variant],
        (isExternal || arrow) && "inline-flex items-center gap-1",
        isExternal && "gap-[3px]",
        target24 && "target-24",
        className,
      )}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {children}
      {isExternal && <Icon icon={ExternalLink} size={12} />}
      {arrow && !isExternal && <Icon icon={ArrowRight} size={14} />}
      {isExternal && <span className="sr-only"> (opens in a new tab)</span>}
    </Link>
  );
}
