"use client";
import { useActionState, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, CreditCard, Eye, Lock } from "lucide-react";
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
import { STEPPER_BAND, Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { createJob } from "@/lib/actions/jobs";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { ROLE_GROUP_LABEL, placeLong, salaryRange, type RoleGroup } from "@/lib/format";
import type { JobOrg } from "@/lib/queries/jobsx";
import { JobCard } from "./JobCard";
import { JobHeader } from "./JobHeader";
import { EMPLOYMENT_TYPES, UNIT_LABEL, withArticle } from "./labels";
import {
  CITY_MAX,
  DESCRIPTION_MAX,
  HOW_TO_APPLY_MAX,
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

const EMPTY: Values = { title: "", roleGroup: "", unit: "", city: "", employmentType: "Full-time", salaryMin: "", salaryMax: "", description: "", howToApply: "" };
const ORDER: PostJobField[] = ["title", "roleGroup", "unit", "city", "employmentType", "salaryMin", "salaryMax", "description", "howToApply"];

/** "Start from an outline": plain heading lines and dash bullets, the format the job page reads. */
function outline(program: string, title: string): string {
  return `${program} is hiring ${withArticle(title || "coach")} for its football program.

Responsibilities
-
-

Qualifications
- Bachelor's degree required
- `;
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0 border-t border-divider py-5 first:border-t-0 first:pt-0", className)}>
      <legend className="float-left mb-3 w-full text-small font-semibold text-fg-1">{title}</legend>
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

const POST_STEPS = ["Listing details", "Checkout"] as const;

type PostJobFormProps = { org: JobOrg; posterName: string };

/**
 * Post a job (§8.13): the form (Role, Program, Location and type, Pay, Description, Application)
 * with a live preview of the JobCard and the detail header, validated with the shared zod schema
 * as you go; then a checkout stub that says payments are disabled in the demo, and Publish listing
 * (server action). On success: a toast ("View listing" opens it) and the listing's own search in
 * the hiring pipeline (§8.13).
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
  const router = useRouter();
  const toast = useToast();
  const published = state?.published ?? null;

  // Published: continue to this listing's own search in the hiring pipeline (§8.13), once per listing.
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (!published || announced.current === published.id) return;
    announced.current = published.id;
    router.push(`/employers/pipeline?list=${published.pipelineId}`);
  }, [published, router]);

  // The success toast shows when the form unmounts, i.e. when the pipeline replaces it, so its five
  // seconds aren't spent while the next page loads. The provider lives in the root layout and stays.
  const showToast = toast.show;
  const latest = useRef(published);
  useEffect(() => {
    latest.current = published;
  }, [published]);
  useEffect(
    () => () => {
      const p = latest.current;
      if (!p) return;
      showToast(`Published “${p.title}”`, {
        actionLabel: "View listing",
        onAction: () => router.push(`/jobs/${p.id}`),
      });
    },
    [router, showToast],
  );

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

  const city = values.city.trim();
  const place = placeLong(city || org.city, org.state);
  const previewJob = {
    id: 0,
    title: values.title.trim() || "Job title",
    // No role group chip until one is chosen: the preview never shows a value the employer didn't pick.
    roleGroup: values.roleGroup,
    unit: values.unit || null,
    location: place,
    employmentType: values.employmentType || "Full-time",
    salaryMin: salaryMin ?? null,
    salaryMax: salaryMax ?? null,
    postedAt: null,
    source: "native",
    isDemo: true,
    org,
  };

  // Framed (cards) beside the form at lg; unframed inside the phone disclosure card, so no
  // bordered box sits inside another (§5.3). The card is the feed's own JobCard (feed layout): beside
  // the form it gets the feed column's width, so it shows exactly as the feed will (audit X03).
  const preview = (framed: boolean) => (
    <div className={cn("flex flex-col", framed ? "gap-3" : "divide-y divide-divider")} inert>
      <div className={framed ? undefined : "pb-3"}>
        <p className="mb-1.5 text-caption font-medium text-fg-3">In the feed and on Jobs</p>
        {framed ? (
          <Card className="overflow-hidden">
            <JobCard job={previewJob} layout="feed" href="#" meta={`${org.shortName} · new listing`} preview headingLevel="h3" />
          </Card>
        ) : (
          <JobCard job={previewJob} layout="feed" href="#" meta={`${org.shortName} · new listing`} preview headingLevel="h3" className="-mx-4 px-4" />
        )}
      </div>
      <div className={framed ? undefined : "pt-3"}>
        <p className="mb-1.5 text-caption font-medium text-fg-3">Top of the job page</p>
        {framed ? (
          <Card className="px-6 pt-6">
            <JobHeader job={previewJob} headingLevel="h2" preview />
          </Card>
        ) : (
          <JobHeader job={previewJob} headingLevel="h2" preview />
        )}
      </div>
    </div>
  );

  // Below lg the preview is a disclosure inside the form, just before the step's primary action, so
  // it is checked before continuing (the side preview covers lg and up).
  const phonePreview = (divider: boolean) => (
    <div className={cn("py-4 lg:hidden", divider && "border-t border-divider")}>
      <Disclosure summary={<span className="text-small font-medium text-fg-1">Preview the listing</span>} contentClassName="pt-3">
        {preview(false)}
      </Disclosure>
    </div>
  );

  const roleOptions = POST_ROLE_GROUPS.map((v) => ({ value: v, label: ROLE_GROUP_LABEL[v as RoleGroup] }));
  const unitOptions = POST_UNITS.map((v) => ({ value: v, label: UNIT_LABEL[v] }));

  return (
    // lg: the preview column takes the feed column's width (568px) when there is room, never under 360px.
    <div className="flex flex-col gap-2 md:gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,568px)] lg:items-start lg:gap-6">
      <form ref={formRef} action={formAction} noValidate className="min-w-0" aria-labelledby={`${uid}-heading`}>
        <Card padding="main">
          {/* The page header, then the shared Stepper in a band under it, as in the claim flow (audit X15). */}
          <div>
            <h1 id={`${uid}-heading`} className="text-display-sm">
              Post a job
            </h1>
            <p className="mt-0.5 text-small text-fg-2">
              Listings appear on Jobs and in the {BRAND.name} feed. This is the demo: nothing is charged and nothing leaves the demo.
            </p>
          </div>
          <div className={cn(STEPPER_BAND, "-mx-4 mb-5 mt-4 border-b md:-mx-6")}>
            <Stepper steps={POST_STEPS} current={step === "edit" ? 0 : 1} label="Post a job progress" />
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
            <Section title="Role" className="border-t-0 pt-0">
              <Input
                id={id("title")}
                name="title"
                label="Job title"
                required
                maxLength={80}
                autoComplete="off"
                value={values.title}
                onChange={set("title")}
                onBlur={blur("title")}
                error={shown("title")}
                help="As it appears on your staff page, for example Defensive Backs Coach."
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
                  <p className="text-small text-fg-2">{[org.nickname, placeLong(org.city, org.state)].filter(Boolean).join(" · ")}</p>
                  <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} className="mt-1.5" />
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-caption text-fg-3">
                <Icon icon={Lock} size={12} className="mt-0.5" />
                <span>
                  Posting as {posterName}, athletic director. The program and its state come from your account.
                </span>
              </p>
            </Section>

            <Section title="Location and type">
              <Input
                id={id("city")}
                name="city"
                label="City"
                maxLength={CITY_MAX}
                autoComplete="address-level2"
                value={values.city}
                onChange={set("city")}
                onBlur={blur("city")}
                error={shown("city")}
                help={org.state ? `Optional. The state comes from your program: ${org.state}.` : "Optional."}
                fieldClassName="md:max-w-80"
              />
              <fieldset className="min-w-0">
                <legend className="mb-1 text-small font-medium text-fg-1">Employment type</legend>
                <div className="flex flex-col gap-0.5 md:flex-row md:gap-6">
                  {EMPLOYMENT_TYPES.map((t) => (
                    <Radio key={t} name="employmentType" value={t} label={t} checked={values.employmentType === t} onChange={set("employmentType")} />
                  ))}
                </div>
                {shown("employmentType") && <p className="text-caption text-danger">{shown("employmentType")}</p>}
              </fieldset>
            </Section>

            <Section title="Pay">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id={id("salaryMin")}
                  name="salaryMin"
                  label="Minimum salary (USD a year)"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.salaryMin}
                  onChange={set("salaryMin")}
                  onBlur={blur("salaryMin")}
                  error={shown("salaryMin")}
                  help="Optional. For example, 45,000."
                />
                <Input
                  id={id("salaryMax")}
                  name="salaryMax"
                  label="Maximum salary (USD a year)"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.salaryMax}
                  onChange={set("salaryMax")}
                  onBlur={blur("salaryMax")}
                  error={shown("salaryMax")}
                  help="Optional. For example, 55,000."
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
                    Start a section with a line like Responsibilities, and start each bullet with a dash.{" "}
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
                        description: outline(org.name, cur.title.trim()),
                      }))
                    }
                  >
                    Start from an outline
                  </Button>
                </div>
              )}
            </Section>

            <Section title="Application">
              <Input
                id={id("howToApply")}
                name="howToApply"
                label="How to apply"
                maxLength={HOW_TO_APPLY_MAX}
                inputMode="url"
                autoComplete="off"
                value={values.howToApply}
                onChange={set("howToApply")}
                onBlur={blur("howToApply")}
                error={shown("howToApply")}
                help="Optional. A web address or an email, shown at the end of the listing under How to apply. In the demo, nothing is sent to it."
              />
            </Section>

            {phonePreview(true)}

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
                <Row label="Location">{place || "Not listed"}</Row>
                <Row label="Type and pay">
                  {values.employmentType}
                  {salaryText ? <span className="num"> · {salaryText}</span> : " · Salary not listed"}
                </Row>
                <Row label="How to apply">{values.howToApply.trim() ? <span className="break-words">{values.howToApply.trim()}</span> : <span className="text-fg-3">Not given</span>}</Row>
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
                  demo only, labeled as a demo listing, and opens a hiring pipeline for it.
                </p>
              </div>
              {phonePreview(false)}
              <div className="mt-4 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                <Button variant="secondary" icon={ArrowLeft} phone="large" onClick={() => setStep("edit")} disabled={pending || !!published} className="max-md:w-full">
                  Back to details
                </Button>
                <Button type="submit" variant="primary" phone="large" loading={pending || !!published} className="max-md:w-full">
                  Publish listing
                </Button>
              </div>
            </section>
          )}
        </Card>
      </form>

      {/* Preview: sticky beside the form at lg; below lg it is a disclosure inside the form (phonePreview). */}
      <aside aria-label="Listing preview" className="hidden lg:sticky lg:top-[calc(var(--nav-h)+20px)] lg:block">
        <h2 className="mb-2 flex items-center gap-1.5 text-body font-semibold">
          <Icon icon={Eye} size={16} className="text-fg-2" />
          Preview
        </h2>
        {preview(true)}
      </aside>
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
