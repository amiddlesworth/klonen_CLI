/** First focusable element on every page: jumps to the page's <main id="main">. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[80] focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-small focus:font-medium focus:text-fg-1 focus:shadow-pop"
    >
      Skip to main content
    </a>
  );
}
