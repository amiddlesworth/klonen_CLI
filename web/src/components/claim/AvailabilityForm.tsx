"use client";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Building2, Check, CircleAlert, EyeOff, Lock, ToggleLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup, Radio, Switch } from "@/components/ui/Checkbox";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/ui/Icon";
import { PAGE_TITLE } from "@/components/ui/PageHeader";
import { saveAvailability } from "@/lib/actions/availability";
import { BRAND } from "@/lib/brand";
import { availabilityStatus, type AvailabilityAudience } from "@/lib/format";
import type { AvailabilitySettings, PickerProgram } from "@/lib/queries/claim";
import { REGIONS, ROLE_CHOICES } from "./options";
import { ProgramPicker } from "./ProgramPicker";

type Draft = Pick<AvailabilitySettings, "open" | "audience" | "selectedOrgIds" | "roles" | "regions">;

type AvailabilityFormProps = {
  initial: AvailabilitySettings;
  /** Registry programs the coach may choose (the current program is left out). */
  programs: PickerProgram[];
  /** The coach's current program, always left out of the audience. */
  currentProgram: PickerProgram | null;
  /** Division III programs per region value. */
  regionCounts: Record<string, number>;
};

function snapshot(d: Draft) {
  return JSON.stringify([d.open, d.audience, [...d.selectedOrgIds].sort(), [...d.roles].sort(), [...d.regions].sort()]);
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** A program's short name in running text: never broken across lines ("Pacific / (OR)"). */
function Program({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/** availabilityStatus() text with the program's short name kept on one line. */
function withProgram(text: string, name: string | null): ReactNode {
  if (!name || !text.includes(name)) return text;
  const [before, ...rest] = text.split(name);
  return (
    <>
      {before}
      <Program>{name}</Program>
      {rest.join(name)}
    </>
  );
}

const SECTION = "py-4 md:py-5";
const GROUP_HELP = "mb-2.5 text-caption text-fg-3";

/**
 * Open to opportunities (§8.12): Switch with "Never shown on your public profile", the privacy
 * explanation, who can see it (with the program picker), roles and regions, then Save (primary) and
 * Cancel, both disabled until something changes. Saves through saveAvailability.
 */
export function AvailabilityForm({ initial, programs, currentProgram, regionCounts }: AvailabilityFormProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const dirty = useMemo(() => snapshot(draft) !== snapshot(saved), [draft, saved]);
  const current = currentProgram?.shortName ?? null;
  const status = withProgram(availabilityStatus(draft.open, draft.audience, current), current);

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
    setError(null);
    if (patch.selectedOrgIds || patch.audience || patch.open !== undefined) setProgramsError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    if (draft.open && draft.audience === "selected_programs" && draft.selectedOrgIds.length === 0) {
      setProgramsError("Choose at least one program, or pick another audience.");
      document.getElementById("availability-programs")?.focus();
      return;
    }
    startSaving(async () => {
      const res = await saveAvailability(draft).catch(() => null);
      if (!res) return setError("We couldn't reach the server. Try again.");
      if (!res.ok) {
        if (res.field === "programs") setProgramsError(res.error);
        else setError(res.error);
        return;
      }
      setSaved(draft);
      setJustSaved(true);
    });
  }

  function cancel() {
    setDraft(saved);
    setError(null);
    setProgramsError(null);
  }

  const audiences: { value: AvailabilityAudience; label: string; description: ReactNode }[] = [
    { value: "search_firms", label: "Search firms", description: "Recruiters running coaching searches for schools" },
    { value: "selected_programs", label: "Specific programs", description: "Only the programs you choose" },
    {
      value: "all_except_current",
      label: "All employers except my current program",
      description: current ? (
        <>
          Every program hiring on {BRAND.name}, except <Program>{current}</Program>
        </>
      ) : (
        `Every program hiring on ${BRAND.name}`
      ),
    },
  ];

  return (
    <form onSubmit={submit} noValidate>
      <Card padding="none" aria-labelledby="availability-title">
        <div className="px-4 pb-4 pt-4 md:px-6 md:pt-5">
          <h1 id="availability-title" className={PAGE_TITLE}>
            Open to opportunities
          </h1>
          <p className="mt-1 max-w-prose text-small text-fg-2">
            Let the people hiring know you&apos;d consider a new role
            {current ? (
              <>
                , without anyone at <Program>{current}</Program> finding out
              </>
            ) : null}
            .
          </p>
          <Switch
            className="mt-3 min-h-11"
            label={<span className="text-body font-medium">Open to new coaching roles</span>}
            description={status}
            checked={draft.open}
            onChange={(e) => update({ open: e.target.checked })}
          />
          <p className="mt-1 flex items-center gap-1 text-caption text-fg-3">
            <Icon icon={Lock} size={12} className="text-fg-2" />
            Never shown on your public profile
          </p>
        </div>

        <section aria-labelledby="availability-privacy" className="border-t border-divider bg-surface-2 px-4 py-3.5 md:px-6">
          <h2 id="availability-privacy" className="text-small font-semibold">
            How this stays private
          </h2>
          <ul className="mt-2 space-y-2 text-small text-fg-2">
            <li className="flex items-start gap-2">
              <Icon icon={EyeOff} size={16} className="mt-0.5" />
              <span>
                <span className="font-medium text-fg-1">Never on your public profile.</span> Visitors, other coaches and your own staff see your profile exactly
                as before.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon icon={Building2} size={16} className="mt-0.5" />
              <span>
                <span className="font-medium text-fg-1">{current ? <Program>{current}</Program> : "Your current program"} is always left out.</span> Nobody hiring there sees it, whichever
                audience you choose.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon icon={Users} size={16} className="mt-0.5" />
              <span>
                <span className="font-medium text-fg-1">Only the audience you choose.</span> They see it only while searching for candidates.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon icon={ToggleLeft} size={16} className="mt-0.5" />
              <span>
                <span className="font-medium text-fg-1">Off works right away.</span> Turn it off and it disappears from every search.
              </span>
            </li>
          </ul>
        </section>

        <div className="divide-y divide-divider px-4 md:px-6">
          <div className={SECTION}>
            <ChoiceGroup label="Who can see it">
              <div className="mt-1 flex flex-col gap-1">
                {audiences.map((a) => (
                  <Radio
                    key={a.value}
                    name="audience"
                    value={a.value}
                    label={a.label}
                    description={a.description}
                    checked={draft.audience === a.value}
                    onChange={() => update({ audience: a.value })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            {draft.audience === "selected_programs" && (
              <div className="mt-3 md:pl-6">
                <ProgramPicker
                  id="availability-programs"
                  programs={programs}
                  selected={draft.selectedOrgIds}
                  onChange={(ids) => update({ selectedOrgIds: ids })}
                  excluded={currentProgram}
                  error={programsError}
                />
              </div>
            )}
          </div>

          <fieldset className={SECTION}>
            <legend className="float-left mb-0.5 w-full text-small font-semibold">Roles you&apos;d consider</legend>
            <p className={GROUP_HELP}>Leave them all off to be open to any role.</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_CHOICES.map((r) => (
                <FilterChip key={r.value} selected={draft.roles.includes(r.value)} onClick={() => update({ roles: toggle(draft.roles, r.value) })}>
                  {r.label}
                </FilterChip>
              ))}
            </div>
          </fieldset>

          <fieldset className={SECTION}>
            <legend className="float-left mb-0.5 w-full text-small font-semibold">Regions</legend>
            <p className={GROUP_HELP}>Leave them all off for anywhere. Numbers are Division III programs in each region.</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <FilterChip
                  key={r.value}
                  selected={draft.regions.includes(r.value)}
                  title={r.states.join(", ")}
                  onClick={() => update({ regions: toggle(draft.regions, r.value) })}
                >
                  {r.label}
                  <span className="num font-normal">{regionCounts[r.value] ?? 0}</span>
                </FilterChip>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-3 border-t border-divider px-4 py-3 md:flex-row md:items-center md:px-6">
          <div className="min-w-0 flex-1 text-small">
            <div role="status">
              {!error && justSaved && !dirty && !saving ? (
                <p className="flex items-start gap-1.5 text-fg-1">
                  <Icon icon={Check} size={16} className="mt-0.5" />
                  <span>
                    <span className="font-medium">Saved.</span> <span className="text-fg-2">{withProgram(availabilityStatus(saved.open, saved.audience, current), current)}</span>
                  </span>
                </p>
              ) : !error && dirty && !saving ? (
                <p className="text-fg-3">You have unsaved changes.</p>
              ) : null}
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-danger">
                <Icon icon={CircleAlert} size={16} className="mt-0.5" />
                {error}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Button onClick={cancel} disabled={!dirty || saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!dirty} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
