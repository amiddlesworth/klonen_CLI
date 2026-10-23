import { Disclosure } from "@/components/ui/Disclosure";
import { QuoteBlock } from "./QuoteBlock";
import { SourceLink } from "./SourceLink";

type SourceDisclosureProps = {
  /** Verbatim evidence sentence for the stint. */
  evidence: string | null | undefined;
  sourceUrl: string | null | undefined;
  /** Appended to the domain in the link: "goboxers.com · Ian Falconer bio". */
  sourceDetail?: string;
  className?: string;
};

/** "Source" disclosure on every stint (§8.3): closed by default; opens to the verbatim quote and its link. */
export function SourceDisclosure({ evidence, sourceUrl, sourceDetail, className }: SourceDisclosureProps) {
  if (!evidence && !sourceUrl) return null;
  const link = sourceUrl ? <SourceLink href={sourceUrl} detail={sourceDetail} /> : null;
  return (
    <Disclosure summary="Source" className={className} contentClassName="pb-1">
      {evidence ? <QuoteBlock quote={evidence} tone="muted" attribution={link} /> : <p className="text-caption text-fg-3">{link}</p>}
    </Disclosure>
  );
}
