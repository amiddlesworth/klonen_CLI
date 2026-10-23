import type { ReactNode } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { QuoteBlock } from "./QuoteBlock";
import { SourceLink } from "./SourceLink";

type SourceDisclosureProps = {
  /** Verbatim evidence sentence for the stint. */
  evidence: string | null | undefined;
  sourceUrl: string | null | undefined;
  /** Appended to the domain in the link: "goboxers.com · Ian Falconer bio". */
  sourceDetail?: string;
  /** A 12px line above the quote ("Title in the bio: Special Teams Coordinator / Safeties Coach"). */
  note?: ReactNode;
  className?: string;
};

/** "Source" disclosure on every stint (§8.3): closed by default; opens to the verbatim quote and its link. */
export function SourceDisclosure({ evidence, sourceUrl, sourceDetail, note, className }: SourceDisclosureProps) {
  if (!evidence && !sourceUrl && !note) return null;
  const link = sourceUrl ? <SourceLink href={sourceUrl} detail={sourceDetail} /> : null;
  return (
    <Disclosure summary="Source" className={className} contentClassName="pb-1">
      {note && <p className="mb-1.5 text-caption text-fg-3">{note}</p>}
      {evidence ? <QuoteBlock quote={evidence} tone="muted" attribution={link} /> : link && <p className="text-caption text-fg-3">{link}</p>}
    </Disclosure>
  );
}
