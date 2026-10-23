import { cn } from "@/lib/cn";
import { orgInitials } from "@/lib/format";

export type OrgMarkSize = 24 | 32 | 40 | 48 | 56;

const SIZE: Record<OrgMarkSize, string> = {
  24: "size-6 rounded-[5px] text-[9px]",
  32: "size-8 rounded-sm text-[11px]",
  40: "size-10 rounded-md text-[13px]",
  48: "size-12 rounded-[10px] text-[16px]",
  56: "size-14 rounded-lg text-[18px]",
};

export type OrgMarkProps = {
  shortName: string;
  /** Full name, used to derive initials when the short name is not an acronym. */
  name?: string | null;
  /** Override the derived initials (2–3 letters). */
  initials?: string;
  size?: OrgMarkSize;
  /** Hidden from assistive tech when the name is adjacent (default). */
  decorative?: boolean;
  className?: string;
};

/** Organizations are rounded squares: --org-bg tile, --org-fg initials, inset 1px --border. */
export function OrgMark({ shortName, name, initials, size = 40, decorative = true, className }: OrgMarkProps) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": name ?? shortName };
  return (
    <span
      {...a11y}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center bg-org-bg font-semibold leading-none tracking-[.02em] text-org-fg shadow-[inset_0_0_0_1px_var(--border)]",
        SIZE[size],
        className,
      )}
    >
      {initials ?? orgInitials(shortName, name)}
    </span>
  );
}
