import { ExternalLink } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { sourceDomain } from "@/lib/format";

type SourceLinkProps = {
  href: string;
  /** Visible text; defaults to the domain ("goboxers.com"). */
  label?: string;
  /** Appended after the domain: "goboxers.com · Ian Falconer bio". */
  detail?: string;
  className?: string;
};

/**
 * Source link (§8.1): --link 500, always underlined (1px, offset 2; 2px on hover), 12px
 * external-link icon, opens in a new tab, padded to a 24px target.
 */
export function SourceLink({ href, label, detail, className }: SourceLinkProps) {
  const text = label ?? (detail ? `${sourceDomain(href)} · ${detail}` : sourceDomain(href));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "target-24 inline-flex items-center gap-[3px] font-medium text-link underline decoration-1 underline-offset-2 hover:decoration-2",
        className,
      )}
    >
      {text}
      <Icon icon={ExternalLink} size={12} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
