/**
 * Class names shared by the messaging frame, its skeletons and the thread header (kept apart from the
 * components so client and server modules can share them without importing each other).
 */

/**
 * The page wrapper for the messaging card. On md and up the page itself never scrolls: no legal
 * footer, 20px above and below the card, and the card fills the rest of the viewport (each pane
 * scrolls on its own). On phone the inbox page keeps the legal footer under the card, except while a
 * tapped conversation loads (the card then shows the thread skeleton, data-pending); the thread page
 * has none, and no bottom padding, so its composer sits directly on the tab bar.
 */
export const FRAME_PAGE_CLASS = "md:pb-5 md:[&>footer]:hidden max-md:[&:has([data-pending])>footer]:hidden";
export const FRAME_PAGE_THREAD_CLASS = "max-md:pb-0";

/**
 * Both pane headers are 64px tall on md and up, border included, so their bottom rules form one
 * line across the card (56px on phone, where only one pane shows).
 */
export const PANE_HEADER_CLASS = "flex h-14 shrink-0 items-center border-b border-divider md:h-16";

/** On the phone thread page, the thread column fills the screen so the composer sits on the tab bar. */
export const PHONE_FILL_CLASS = "max-md:min-h-[calc(100dvh-var(--mtop-h)-var(--tabbar-h)-env(safe-area-inset-bottom)-10px)]";
