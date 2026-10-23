import { clsx, type ClassValue } from "clsx";

/** Joins class names. Later classes do not override earlier ones by magic: pass only what you mean. */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
