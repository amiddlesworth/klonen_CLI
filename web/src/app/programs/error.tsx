"use client";
/**
 * Error boundary one level above /programs/[slug]: the slug lookup runs in that segment's layout,
 * which its own error.tsx cannot catch, so a failed lookup lands here with the same inline state.
 */
export { default } from "./[slug]/error";
