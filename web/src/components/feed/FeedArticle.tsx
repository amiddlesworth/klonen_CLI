"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type FeedItemApi = { hide: () => void };
const FeedItemContext = createContext<FeedItemApi | null>(null);

/** The surrounding feed item's controls (the More menu uses it to hide the item). */
export function useFeedItem(): FeedItemApi | null {
  return useContext(FeedItemContext);
}

type FeedArticleProps = {
  /** id of the item's h2. */
  labelledBy: string;
  /** "move", "job", "update": used in the hidden placeholder. */
  noun: string;
  className?: string;
  children: ReactNode;
};

/**
 * A feed item card (§8.5 FeedItem): an <article> labelled by its headline, overflow hidden so the
 * context strip and action bar run to the edges. "Hide this move" in the More menu collapses it to a
 * one-line placeholder with Undo (focus moves there, then back to the card on Undo).
 */
export function FeedArticle({ labelledBy, noun, className, children }: FeedArticleProps) {
  const [hidden, setHidden] = useState(false);
  const undoRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const changed = useRef(false);

  useEffect(() => {
    if (!changed.current) return;
    if (hidden) undoRef.current?.focus();
    else cardRef.current?.focus();
  }, [hidden]);

  if (hidden) {
    return (
      <Card as="article" aria-label={`Hidden ${noun}`} className="flex items-center gap-3 px-4 py-3">
        <Icon icon={EyeOff} size={16} className="text-fg-3" />
        <p className="min-w-0 flex-1 text-small text-fg-2">This {noun} is hidden until you reload the page.</p>
        <Button
          ref={undoRef}
          variant="ghost"
          size="sm"
          onClick={() => {
            changed.current = true;
            setHidden(false);
          }}
        >
          Undo
        </Button>
      </Card>
    );
  }

  return (
    <FeedItemContext.Provider
      value={{
        hide: () => {
          changed.current = true;
          setHidden(true);
        },
      }}
    >
      <Card as="article" ref={cardRef} tabIndex={-1} aria-labelledby={labelledBy} className={cn("overflow-hidden", className)}>
        {children}
      </Card>
    </FeedItemContext.Provider>
  );
}
