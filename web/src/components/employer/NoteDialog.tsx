"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import type { Candidate } from "@/lib/queries/employer";
import { NOTE_MAX } from "./stages";

type NoteDialogProps = {
  /** The candidate whose note is being edited; null when closed. */
  candidate: Candidate | null;
  onClose: () => void;
  onSave: (candidate: Candidate, note: string) => void;
};

/**
 * Add or edit a candidate's note (§8.14 Notes; the pipeline keeps one note per candidate).
 * Dialog on desktop, bottom sheet on phone. Saving an empty note removes it.
 */
export function NoteDialog({ candidate, onClose, onSave }: NoteDialogProps) {
  const formId = useId();
  return (
    <Dialog
      open={!!candidate}
      onOpenChange={(open) => !open && onClose()}
      title={candidate ? `Note on ${candidate.person.fullName}` : "Note"}
      description="One note per candidate: saving replaces the last one. Only your account sees notes."
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId}>
            Save note
          </Button>
        </>
      )}
    >
      {candidate && <NoteForm key={candidate.entryId} formId={formId} candidate={candidate} onSave={onSave} />}
    </Dialog>
  );
}

/** Mounted each time the dialog opens, so it always starts from the saved note. */
function NoteForm({ formId, candidate, onSave }: { formId: string; candidate: Candidate; onSave: NoteDialogProps["onSave"] }) {
  const [value, setValue] = useState(candidate.note ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = `note-${candidate.entryId}`;

  // Focus the textarea once the dialog has opened (its showModal runs after this effect).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(candidate, value);
      }}
    >
      <Textarea
        ref={ref}
        id={fieldId}
        label="Note"
        rows={5}
        maxLength={NOTE_MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="References, availability, next step…"
        help={`${value.length.toLocaleString("en-US")} of ${NOTE_MAX.toLocaleString("en-US")} characters. Leave it empty to remove the note.`}
      />
    </form>
  );
}
