"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { hasTabBar } from "./types";

/**
 * The shell's outer column. Adds `has-tabbar` when the phone tab bar is on the page (signed in, or
 * a signed-out page other than the landing page), so the page leaves room for the fixed bar and
 * sticky footers (`.has-tabbar &`, `--tabbar-offset`) sit on top of it instead of under it.
 */
export function ShellFrame({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  return <div className={cn("flex min-h-dvh flex-col", hasTabBar(pathname, signedIn) && "has-tabbar")}>{children}</div>;
}
