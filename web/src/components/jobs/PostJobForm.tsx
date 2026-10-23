"use client";
import { useActionState, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, CircleAlert, CreditCard, Eye, Lock } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Radio } from "@/components/ui/Checkbox";
import { SampleChip } from "@/components/ui/Chip";
import { Disclosure } from "@/components/ui/Disclosure";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { OrgMark } from "@/components/ui/OrgMark";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createJob } from "@/lib/actions/jobs";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { ROLE_GROUP_LABEL, salaryRange, type RoleGroup } from "@/lib/format";
import type { JobOrg } from "@/lib/queries/jobsx";
import { JobCard } from "./JobCard";
import { JobHeader } from "./JobHeader";
import { EMPLOYMENT_TYPES, UNIT_LABEL } from "./labels";
import {
  DESCRIPTION_MAX,
  POST_ROLE_GROUPS,
  POST_UNITS,
  fieldErrors,
  parseMoney,
  postJobSchema,
  type PostJobErrors,
  type PostJobField,
  type PostJobState,
} from "./post-job-schema";

type Values = Record<PostJobField, string>;

const EMPTY: Values = { title: "", roleGroup: "", unit: "", employmentType: "Full-time", salaryMin: "", salaryMax: "", description: "" };
const ORDER: PostJobField[] = ["title", "roleGroup", "unit", "employmentType", "salaryMin", "salaryMax", "description"];

const OUTLINE = `{program} is hiring a {title} for its football program.

**Responsibilities**
-
-

**Qualifications**
- Bachelor's degree required
- `;

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0 border-t border-divider py-5 first:border-t-0 first:pt-0", className)}>
      <legend className="float-left mb-3 w-full text-body font-semibold text-fg-1">{title}</legend>
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function Stepper({ step }: { step: "edit" | "checkout" }) {
  const steps = [
    { key: "edit", label: "Listing details" },
    { key: "checkout", label: "Checkout" },
  ] as const;
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small font-medium">
      {steps.map((s, i) => {
        const current = s.key === step;
        const done = step === "checkout" && s.key === "edit";
        return (
          <li key={s.key} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-2", current || done ? "text-fg-1" : "text-fg-3")}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 place-items-center rounded-full text-caption font-semibold",
                current ? "bg-badge-bg text-badge-fg" : done ? "bg-hover text-fg-1" : "shadow-[inset_0_0_0_1px_var(--control)]",
              )}
            >
              {done ? <Icon icon={Check} size={12} /> : i + 1}
            </span>
            {s.label}
            {done && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

type PostJobFormProps = { org: JobOrg; posterName: string };

/**
 * Post a job (§8.13): the form (Role, Program, Type, Pay, Description) with a live preview of the
 * JobCard and the detail header, validated with the shared zod schema as you go; then a checkout
 * stub that says payments are disabled in the demo, and Publish listing (server action).
 */
export function PostJobForm({ org, posterName }: PostJobFormProps) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<PostJobField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<"edit" | "checkout">("edit");
  const [state, formAction, pending] = useActionState<PostJobState, FormData>(createJob, null);
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutHeading = useRef<HTMLHeadingElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;

  const clientErrors = useMemo<PostJobErrors>(() => {
    const r = postJobSchema.safeParse(values);
    return r.success ? {} : fieldErrors(r.error);
  }, [values]);
  const serverErrors = state?.errors ?? {};
  const shown = (f: PostJobField) => ((submitted || touched[f]) && clientErrors[f]) || serverErrors[f] || undefined;

  // A server-side rejection sends the person back to the fields.
  useEffect(() => {
    if (state && Object.keys(state.errors).length) {
      setStep("edit");
      setSubmitted(true);
    }
  }, [state]);

  useEffect(() => {
    if (step === "checkout") checkoutHeading.current?.focus();
  }, [step]);

  const set = (f: PostJobField) => (e: { currentTarget: { value: string } }) => {
    const v = e.currentTarget.value;
    setValues((cur) => ({ ...cur, [f]: v }));
  };
  const blur = (f: PostJobField) => () => setTouched((t) => ({ ...t, [f]: true }));

  function toCheckout() {
    setSubmitted(true);
    const first = ORDER.find((f) => clientErrors[f]);
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }
    setStep("checkout");
  }

  const salaryMin = parseMoney(values.salaryMin);
  const salaryMax = parseMoney(values.salaryMax);
  const salaryText = salaryRange(salaryMin ?? null, salaryMax ?? null);
  const errorCount = submitted ? ORDER.filter((f) => clientErrors[f]).length : 0;

  const previewJob = {
    id: 0,
    title: values.title.trim() || "Job title",
    roleGroup: values.roleGroup || "position_coach",
    unit: values.unit || null,
    employmentType: values.employmentType || "Full-time",
    salaryMin: salaryMin ?? null,
    salaryMax: salaryMax ?? null,
    postedAt: null,
    source: "native",
    isDemo: true,
    org,
  };

  // Framed (cards) beside the form at lg; unframed inside the phone disclosure card, so no
  // bordered box sits inside another (§5.3).
  const preview = (framed: boolean) => (
    <div className={cn("flex flex-col", framed ? "gap-3" : "divide-y divide-divider")} inert>
      <div className={framed ? undefined : "pb-3"}>
        <p className="mb-1.5 text-caption font-medium text-fg-3">In the feed and on Jobs</p>
        {framed ? (
          <Card className="overflow-hidden">
            <JobCard job={previewJob} variant="card" href="#" meta={`${org.shortName} · new listing`} preview headingLevel="h3" />
          </Card>
        ) : (
          <JobCard job={previewJob} variant="card" href="#" meta={`${org.shortName} · new listing`} preview headingLevel="h3" className="-mx-4 px-4" />
        )}
      </div>
      <div className={framed ? undefined : "pt-3"}>
        <p className="mb-1.5 text-caption font-medium text-fg-3">Top of the job page</p>
        {framed ? (
          <Card className="px-4 pt-4">
            <JobHeader job={previewJob} headingLevel="h2" preview titleClassName="md:text-display-sm" />
          </Card>
        ) : (
          <JobHeader job={previewJob} headingLevel="h2" preview />
        )}
      </div>
    </div>
  );

  const roleOptions = POST_ROLE_GROUPS.map((v) => ({ value: v, label: ROLE_GROUP_LABEL[v as RoleGroup] }));
  const unitOptions = POST_UNITS.map((v) => ({ value: v, label: UNIT_LABEL[v] }));

  return (
    <div className="flex flex-col gap-2 md:gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
      <form ref={formRef} action={formAction} noValidate className="min-w-0" aria-labelledby={`${uid}-heading`}>
        <Card padding="main">
          <div className="mb-5 flex flex-col gap-3">
            <div>
              <h1 id={`${uid}-heading`} className="text-display-sm md:text-display">
                Post a job
              </h1>
              <p className="mt-0.5 text-small text-fg-2">
                Listings appear on Jobs and in the {BRAND.name} feed. This is the demo: nothing is charged and nothing leaves the demo.
              </p>
            </div>
            <Stepper step={step} />
          </div>

          {state?.formError && (
            <div role="alert" className="mb-5 flex items-start gap-2 text-small text-fg-1">
              <Icon icon={CircleAlert} size={16} className="mt-0.5 text-danger" />
              <span>{state.formError}</span>
            </div>
          )}
          {errorCount > 0 && step === "edit" && !state?.formError && (
            <p role="alert" className="mb-5 flex items-start gap-2 text-small text-fg-1">
              <Icon icon={CircleAlert} size={16} className="mt-0.5 text-danger" />
              <span>
                {errorCount === 1 ? "One field needs" : `${errorCount} fields need`} a fix before checkout.
              </span>
            </p>
          )}

          {/* Step 1: the fields stay mounted on checkout (hidden), so Publish submits them. */}
          <div hidden={step !== "edit"}>
            <h2 ref={editHeading} className="sr-only">
              Listing details
            </h2>
            <Section title="Role">
              <Input
                id={id("title")}
                name="title"
                label="Job title"
                required
                maxLength={80}
                autoComplete="off"
                placeholder="Defensive Backs Coach"
                value={values.title}
                onChange={set("title")}
                onBlur={blur("title")}
                error={shown("title")}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  id={id("roleGroup")}
                  name="roleGroup"
                  label="Role group"
                  required
                  placeholder="Choose…"
                  options={roleOptions}
                  value={values.roleGroup}
                  onChange={set("roleGroup")}
                  onBlur={blur("roleGroup")}
                  error={shown("roleGroup")}
                />
                <Select
                  id={id("unit")}
                  name="unit"
                  label="Unit"
                  required
                  placeholder="Choose…"
                  options={unitOptions}
                  value={values.unit}
                  onChange={set("unit")}
                  onBlur={blur("unit")}
                  error={shown("unit")}
                />
              </div>
            </Section>

            <Section title="Program">
              <div className="flex items-start gap-3">
                <OrgMark shortName={org.shortName} name={org.name} size={40} />
                <div className="min-w-0">
                  <p className="text-body font-semibold text-fg-1">{org.name}</p>
                  <p className="text-small text-fg-2">{[org.nickname, [org.city, org.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                  <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} className="mt-1.5" />
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-caption text-fg-3">
                <Icon icon={Lock} size={12} className="mt-0.5" />
                <span>
                  Posting as {posterName}, athletic director. The program and its location come from your account.
                </span>
              </p>
            </Section>

            <Section title="Employment type">
              <div className="-mt-2 flex flex-col gap-0.5 md:flex-row md:gap-6">
                {EMPLOYMENT_TYPES.map((t) => (
                  <Radio key={t} name="employmentType" value={t} label={t} checked={values.employmentType === t} onChange={set("employmentType")} />
                ))}
              </div>
              {shown("employmentType") && <p className="text-caption text-danger">{shown("employmentType")}</p>}
            </Section>

            <Section title="Pay">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id={id("salaryMin")}
                  name="salaryMin"
                  label="Minimum salary (USD a year)"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="45,000"
                  value={values.salaryMin}
                  onChange={set("salaryMin")}
                  onBlur={blur("salaryMin")}
                  error={shown("salaryMin")}
                  help="Optional"
                />
                <Input
                  id={id("salaryMax")}
                  name="salaryMax"
                  label="Maximum salary (USD a year)"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="55,000"
                  value={values.salaryMax}
                  onChange={set("salaryMax")}
                  onBlur={blur("salaryMax")}
                  error={shown("salaryMax")}
                  help="Optional"
                />
              </div>
              <p className="text-small text-fg-2" aria-live="polite">
                {salaryText ? (
                  <>
                    Shown on the listing as <span className="num font-semibold text-fg-1">{salaryText}</span>
                  </>
                ) : (
                  "No salary range: the listing shows “Not listed”."
                )}
              </p>
            </Section>

            <Section title="Description">
              <Textarea
                id={id("description")}
                name="description"
                label="About the role"
                required
                rows={8}
                maxLength={DESCRIPTION_MAX}
                value={values.description}
                onChange={set("description")}
                onBlur={blur("description")}
                error={shown("description")}
                help={
                  <>
                    Put **Responsibilities** on its own line to start a section, and start lines with “- ” for bullets.{" "}
                    <span className="num">
                      {values.description.length.toLocaleString("en-US")} / {DESCRIPTION_MAX.toLocaleString("en-US")}
                    </span>
                  </>
                }
              />
              {!values.description.trim() && (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setValues((cur) => ({
                        ...cur,
                        description: OUTLINE.replace("{program}", org.name).replace("{title}", cur.title.trim() || "coach"),
                      }))
                    }
                  >
                    Start from an outline
                  </Button>
                </div>
              )}
            </Section>

            <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-caption text-fg-3">Next: review the listing. Payments are disabled in the demo.</p>
              <Button variant="primary" phone="large" onClick={toCheckout} className="max-md:w-full">
                Continue to checkout
              </Button>
            </div>
          </div>

          {/* Step 2: checkout stub. */}
          {step === "checkout" && (
            <section aria-labelledby={`${uid}-checkout`}>
              <h2 id={`${uid}-checkout`} ref={checkoutHeading} tabIndex={-1} className="mb-3 text-title outline-none">
                Review and publish
              </h2>
              <dl className="text-small">
                <Row label="Listing">
                  <span className="font-semibold text-fg-1">{values.title.trim()}</span>
                  <span className="text-fg-2"> · {org.shortName}</span>
                </Row>
                <Row label="Role group">{ROLE_GROUP_LABEL[values.roleGroup as RoleGroup]}</Row>
                <Row label="Type and pay">
                  {values.employmentType}
                  {salaryText ? <span className="num"> · {salaryText}</span> : " · Salary not listed"}
                </Row>
                <Row label="Duration">30 days on Jobs and in the feed</Row>
                <Row label="Price">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="num font-semibold text-fg-1">$0</span>
                    <SampleChip label="Demo" />
                  </span>
                </Row>
              </dl>
              <div role="note" className="-mx-4 mt-4 flex items-start gap-2 border-y border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:-mx-6 md:px-6">
                <Icon icon={CreditCard} size={16} className="mt-0.5 text-fg-2" />
                <p>
                  <span className="font-medium text-fg-1">Payments are disabled in the demo.</span> Nothing is charged and no card is asked for. Publishing adds this listing to the
                  demo only, labeled as a sample listing.
                </p>
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                <Button variant="secondary" icon={ArrowLeft} phone="large" onClick={() => setStep("edit")} disabled={pending} className="max-md:w-full">
                  Back to details
                </Button>
                <Button type="submit" variant="primary" phone="large" loading={pending} className="max-md:w-full">
                  Publish listing
                </Button>
              </div>
            </section>
          )}
        </Card>
      </form>

      {/* Preview: sticky beside the form at lg, a disclosure under it below lg. */}
      <aside aria-label="Listing preview" className="hidden lg:sticky lg:top-[calc(var(--nav-h)+20px)] lg:block">
        <h2 className="mb-2 flex items-center gap-1.5 text-body font-semibold">
          <Icon icon={Eye} size={16} className="text-fg-2" />
          Preview
        </h2>
        {preview(true)}
      </aside>
      <Card padding="rail" className="lg:hidden">
        <Disclosure summary={<span className="text-small font-medium text-fg-1">Preview the listing</span>} contentClassName="pt-3">
          {preview(false)}
        </Disclosure>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-t border-divider py-2.5 first:border-t-0 md:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-fg-2">{label}</dt>
      <dd className="min-w-0 text-fg-1">{children}</dd>
    </div>
  );
}
