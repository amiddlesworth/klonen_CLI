import { cn } from "@/lib/cn";

/** 14px loading ring (1.5px, 700ms linear spin; a static ring under reduced motion). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3.5 shrink-0 rounded-full border-[1.5px] border-current border-r-transparent animate-spin-700", className)}
    />
  );
}
