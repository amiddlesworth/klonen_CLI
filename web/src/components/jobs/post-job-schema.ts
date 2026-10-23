import { z } from "zod";
import { EMPLOYMENT_TYPES } from "./labels";

/*
 * Validation for "Post a job" (§8.13), shared by the client form (inline errors as you go) and
 * the server action (the authority). Plain module: safe to import on both sides.
 */

export const POST_ROLE_GROUPS = ["head_coach", "coordinator", "position_coach", "ga_analyst", "support"] as const;
export const POST_UNITS = ["offense", "defense", "special_teams", "staff"] as const;

export const SALARY_MAX = 500_000;
export const DESCRIPTION_MIN = 40;
export const DESCRIPTION_MAX = 5000;

/** "45,000", "$45000", "45000.00" -> 45000; empty -> undefined. */
const money = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t) return undefined;
    const cleaned = t.replace(/[$,\s]/g, "").replace(/\.\d{0,2}$/, "");
    return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
  },
  z
    .number({ invalid_type_error: "Enter a whole dollar amount, like 45,000." })
    .int("Enter a whole dollar amount, like 45,000.")
    .min(1000, "Enter the yearly amount in dollars, like 45,000.")
    .max(SALARY_MAX, "That is above the $500,000 limit for a listing.")
    .optional(),
);

export const postJobSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Add a job title, like Defensive Backs Coach.")
      .max(80, "Keep the title under 80 characters."),
    roleGroup: z.enum(POST_ROLE_GROUPS, { errorMap: () => ({ message: "Choose a role group." }) }),
    unit: z.enum(POST_UNITS, { errorMap: () => ({ message: "Choose a unit." }) }),
    employmentType: z.enum(EMPLOYMENT_TYPES, { errorMap: () => ({ message: "Choose an employment type." }) }),
    salaryMin: money,
    salaryMax: money,
    description: z
      .string()
      .trim()
      .min(DESCRIPTION_MIN, `Describe the role in at least ${DESCRIPTION_MIN} characters.`)
      .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX.toLocaleString("en-US")} characters.`),
  })
  .superRefine((v, ctx) => {
    if (v.salaryMin && v.salaryMax && v.salaryMin > v.salaryMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["salaryMax"], message: "The maximum can't be lower than the minimum." });
    }
  });

export type PostJobInput = z.input<typeof postJobSchema>;
export type PostJobValues = z.output<typeof postJobSchema>;
export type PostJobField = "title" | "roleGroup" | "unit" | "employmentType" | "salaryMin" | "salaryMax" | "description";
export type PostJobErrors = Partial<Record<PostJobField, string>>;

/** The first message per field, in form order. */
export function fieldErrors(error: z.ZodError): PostJobErrors {
  const out: PostJobErrors = {};
  for (const issue of error.issues) {
    const f = issue.path[0] as PostJobField | undefined;
    if (f && !out[f]) out[f] = issue.message;
  }
  return out;
}

/** Parsed salary for the live preview (undefined when empty or invalid). */
export function parseMoney(v: string): number | undefined {
  const r = money.safeParse(v);
  return r.success ? r.data : undefined;
}

export type PostJobState = { errors: PostJobErrors; formError?: string } | null;
