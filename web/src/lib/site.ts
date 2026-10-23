/**
 * The site's own origin, from configuration only. Absolute URLs (canonical links, og:url, JSON-LD,
 * share and invite links) are built from SITE_URL and never from request headers: Host and
 * X-Forwarded-Host are client-controlled, so echoing them lets a shared cache be poisoned with links
 * to another host.
 *
 * Set SITE_URL (e.g. "https://coaches.example") in production. It defaults to the local dev server.
 */
const DEFAULT_SITE_URL = "http://localhost:3000";

/** Parses a configured origin; anything that isn't an absolute http(s) URL falls back to the default. */
export function parseSiteUrl(value: string | undefined | null): string {
  if (!value) return DEFAULT_SITE_URL;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_SITE_URL;
    return u.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** "https://coaches.example" (no trailing slash). */
export const SITE_URL: string = parseSiteUrl(process.env.SITE_URL);

/** An absolute URL on this site for a path ("/in/ian-falconer" → "http://localhost:3000/in/ian-falconer"). */
export function absoluteUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

/**
 * A redirect target that stays on this site: a relative path starting with exactly one "/" ("/feed",
 * "/jobs?role=head_coach"). Absolute URLs ("https://evil.example"), protocol-relative ones
 * ("//evil.example", "/\evil.example"), control characters and anything that resolves to another
 * origin return `fallback`.
 */
export function safeRedirectPath(value: unknown, fallback = "/feed"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Browsers strip tabs and newlines inside URLs and treat "\" like "/", so "/\t/evil.example" is
  // protocol-relative too. Refuse every control character and backslash outright.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const base = new URL(SITE_URL);
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
