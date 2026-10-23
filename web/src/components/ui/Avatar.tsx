import { cn } from "@/lib/cn";
import { initials, tintFor, type Tint } from "@/lib/format";

export type AvatarSize = 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 80;

// Font size ≈ 0.34 × size. Initials in avatars under 32px are exempt from the 12px floor (aria-hidden).
const SIZE: Record<AvatarSize, string> = {
  24: "size-6 text-[10px]",
  28: "size-7 text-[11px]",
  32: "size-8 text-[12px]",
  36: "size-9 text-[13px]",
  40: "size-10 text-[14px]",
  48: "size-12 text-[17px]",
  56: "size-14 text-[20px]",
  64: "size-16 text-[22px]",
  80: "size-20 text-[27px] tracking-normal",
};

const TINT: Record<Tint, string> = {
  1: "bg-av1-bg text-av1-fg",
  2: "bg-av2-bg text-av2-fg",
  3: "bg-av3-bg text-av3-fg",
  4: "bg-av4-bg text-av4-fg",
  5: "bg-av5-bg text-av5-fg",
  6: "bg-av6-bg text-av6-fg",
};

export type AvatarProps = {
  name: string;
  /** Stable key for the tint: the person's slug (or a user id for accounts without a profile). */
  tintKey?: string;
  size?: AvatarSize;
  /** A claimed photo. */
  src?: string | null;
  /** Named in a source but without a profile: no tint, --fg-3 initials, dashed --control ring. */
  unlisted?: boolean;
  /** Hidden from assistive tech when the name is adjacent (default). Set false to expose it as an image. */
  decorative?: boolean;
  className?: string;
};

/** People are circles: two initials on one of six soft tints, picked by tintFor(slug). */
export function Avatar({ name, tintKey, size = 40, src, unlisted, decorative = true, className }: AvatarProps) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": name };
  return (
    <span
      {...a11y}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold leading-none tracking-[.01em]",
        SIZE[size],
        unlisted ? "bg-surface text-fg-3 outline-1 outline-control outline-dashed -outline-offset-1" : TINT[tintFor(tintKey ?? name)],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- claimed photos are user uploads of unknown size
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
