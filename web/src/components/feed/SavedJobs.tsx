"use client";
import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { MenuGroup, MenuLink } from "@/components/ui/MenuItems";
import { useSavedJob } from "@/components/jobs/SaveJobButton";
import { ShortcutDisclosure, ShortcutItem, ShortcutLink } from "./ShortcutRows";

/** An open job the viewer may have saved (the feed passes the open jobs; saved ids live in this browser). */
export type SavedJobRef = { id: number; title: string; orgShortName: string };

/** Reports one job's saved state from the jobs feature's store (shared with every Save button). */
function Probe({ id, onChange }: { id: number; onChange: (id: number, saved: boolean) => void }) {
  const [saved] = useSavedJob(id);
  useEffect(() => onChange(id, saved), [id, saved, onChange]);
  return null;
}

/** The open jobs saved in this browser, live as Save buttons on the page change; `ready` once read. */
function useSavedAmong(jobs: SavedJobRef[]) {
  const [ids, setIds] = useState<ReadonlySet<number>>(() => new Set());
  const [ready, setReady] = useState(false);
  const onChange = useCallback((id: number, saved: boolean) => {
    setIds((prev) => {
      if (prev.has(id) === saved) return prev;
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  // Runs after the probes' effects in the same commit, so the first count shown is already right.
  useEffect(() => setReady(true), []);
  const probes = jobs.map((j) => <Probe key={j.id} id={j.id} onChange={onChange} />);
  return { saved: jobs.filter((j) => ids.has(j.id)), ready, probes };
}

const LABEL = "Saved jobs";
const EMPTY_HREF = "/feed?filter=jobs";

/**
 * "Saved jobs" in the Shortcuts card (§8.5) with its count. Saved jobs open in place (each links to
 * its job page); with none saved, the row links to the feed's Jobs filter, where Save lives.
 */
export function SavedJobsShortcut({ jobs }: { jobs: SavedJobRef[] }) {
  const { saved, ready, probes } = useSavedAmong(jobs);
  return (
    <>
      {probes}
      {ready && saved.length > 0 ? (
        <ShortcutDisclosure icon={Bookmark} label={LABEL} count={saved.length}>
          {saved.map((j) => (
            <ShortcutItem key={j.id} href={`/jobs/${j.id}`} meta={j.orgShortName}>
              {j.title}
            </ShortcutItem>
          ))}
        </ShortcutDisclosure>
      ) : (
        <ShortcutLink href={EMPTY_HREF} icon={Bookmark} label={LABEL} count={ready ? 0 : undefined} />
      )}
    </>
  );
}

/** The same list in the Me menu at 721–1080px, where the left rail is hidden. */
export function SavedJobsMenu({ jobs }: { jobs: SavedJobRef[] }) {
  const { saved, ready, probes } = useSavedAmong(jobs);
  const count = <span className="num text-caption text-fg-3">{saved.length}</span>;
  return (
    <>
      {probes}
      {ready && saved.length > 0 ? (
        <MenuGroup label={`${LABEL} · ${saved.length}`}>
          {saved.map((j) => (
            <MenuLink key={j.id} href={`/jobs/${j.id}`} description={j.orgShortName}>
              {j.title}
            </MenuLink>
          ))}
        </MenuGroup>
      ) : (
        <MenuLink href={EMPTY_HREF} icon={Bookmark} trailing={ready ? count : undefined}>
          {LABEL}
        </MenuLink>
      )}
    </>
  );
}
