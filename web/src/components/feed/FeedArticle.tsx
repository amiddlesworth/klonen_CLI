"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HIDE_KIND_NOUN, hideKind, showKind, useHiddenKinds, type HideKind } from "./feedPrefs";

type FeedItemApi = { hide: () => void };
const FeedItemContext = createContext<FeedItemApi | null>(null);

/** The surrounding feed item's controls (the More menu uses it for "Hide moves like this"). */
export function useFeedItem(): FeedItemApi | null {
  return useContext(FeedItemContext);
}

type FeedArticleProps = {
  /** id of the item's h2. */
  labelledBy: string;
  /** The kind "Hide moves like this" hides (every item of it, remembered in this browser). */
  hideKind?: HideKind;
  /** The first item of its kind on the page: when the kind is hidden it holds the one-line placeholder with Show again. */
  firstOfKind?: boolean;
  /**
   * The page's one "Dotted years are inferred…" footnote when this card holds it (§6.2). Hiding the
   * card keeps it visible in the placeholder, so the remaining dotted years stay explained.
   */
  note?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * A feed item card (§8.5 FeedItem): an <article> labelled by its headline, overflow hidden so the
 * context strip and action bar run to the edges. "Hide moves like this" in the More menu hides every
 * item of the same kind (new hires, promotions, role changes, milestones) and remembers it in this
 * browser: the first such item on the page becomes a one-line placeholder with "Show again" (focus
 * moves there, then back to the card), the others leave the page.
 */
export function FeedArticle({ labelledBy, hideKind: kind, firstOfKind, note, className, children }: FeedArticleProps) {
  const hiddenKinds = useHiddenKinds();
  const hidden = !!kind && hiddenKinds.includes(kind);
  const showRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  /** Set when this card's own menu or button changed the state, so focus follows only then. */
  const changed = useRef(false);
  /** This card is where the viewer chose to hide the kind: it keeps a placeholder, so focus has a place to go. */
  const [origin, setOrigin] = useState(false);

  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    if (hidden) showRef.current?.focus();
    else cardRef.current?.focus();
  }, [hidden]);

  if (hidden && kind) {
    // One placeholder per hidden kind (on its first item, or wherever the dotted-year note sits).
    if (!firstOfKind && !note && !origin) return null;
    return (
      <Card as="article" aria-label={`${HIDE_KIND_NOUN[kind]} hidden`} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon icon={EyeOff} size={16} className="text-fg-3" />
          <p className="min-w-0 flex-1 text-small text-fg-2">{HIDE_KIND_NOUN[kind]} are hidden from your feed in this browser.</p>
          <Button
            ref={showRef}
            variant="ghost"
            size="sm"
            phone="large"
            onClick={() => {
              changed.current = true;
              setOrigin(false);
              showKind(kind);
            }}
          >
            Show again
          </Button>
        </div>
        {note && <div className="mt-1 pl-7">{note}</div>}
      </Card>
    );
  }

  return (
    <FeedItemContext.Provider
      value={
        kind
          ? {
              hide: () => {
                changed.current = true;
                setOrigin(true);
                hideKind(kind);
              },
            }
          : null
      }
    >
      <Card as="article" ref={cardRef} tabIndex={-1} aria-labelledby={labelledBy} className={cn("overflow-hidden", className)}>
        {children}
      </Card>
    </FeedItemContext.Provider>
  );
}
