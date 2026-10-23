import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,

  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const orgKind = pgEnum("org_kind", ["college", "high_school", "pro", "other"]);
export const roleGroup = pgEnum("role_group", [
  "head_coach",
  "coordinator",
  "position_coach",
  "ga_analyst",
  "support",
  "player",
  "other",
]);
export const unit = pgEnum("unit", ["offense", "defense", "special_teams", "staff"]);
export const bioQuality = pgEnum("bio_quality", ["none", "thin", "full"]);
export const edgeKind = pgEnum("edge_kind", ["worked_under", "worked_alongside"]);
export const userKind = pgEnum("user_kind", ["coach", "employer", "admin"]);
export const jobSource = pgEnum("job_source", ["sample", "native", "aggregated"]);
export const pipelineStage = pgEnum("pipeline_stage", ["sourced", "contacted", "interview", "offer"]);
export const audience = pgEnum("audience", ["search_firms", "selected_programs", "all_except_current"]);

/** A program (college team) or any other employer that appears in a career. */
export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(), // "ncaa-<orgId>" for registry programs, "org-<slug>" otherwise
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    nickname: text("nickname"),
    kind: orgKind("kind").notNull().default("other"),
    level: text("level"), // "NCAA D-III", "NCAA D-I FBS", "high school", "pro/semi-pro" ...
    conference: text("conference"),
    conferenceAbbr: text("conference_abbr"),
    city: text("city"),
    state: text("state"),
    athleticsUrl: text("athletics_url"),
    ncaaOrgId: integer("ncaa_org_id"),
    inRegistry: boolean("in_registry").notNull().default(false), // has a full program page
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_idx").on(t.slug), index("organizations_registry_idx").on(t.inRegistry)],
);

export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    fullName: text("full_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    currentOrgId: text("current_org_id").references(() => organizations.id),
    currentTitle: text("current_title"),
    roleGroup: roleGroup("role_group"),
    unit: unit("unit"),
    almaMater: text("alma_mater"),
    hometown: text("hometown"),
    about: text("about"), // written by the coach after claiming; never generated
    bioExcerpt: text("bio_excerpt"), // short verbatim quote from the source bio, shown with attribution
    bioQuality: bioQuality("bio_quality"),
    sourceUrl: text("source_url"),
    claimed: boolean("claimed").notNull().default(false),
    claimedAt: timestamp("claimed_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("people_slug_idx").on(t.slug),
    index("people_current_org_idx").on(t.currentOrgId),
    index("people_name_search_idx").using("gin", sql`to_tsvector('simple', ${t.fullName})`),
  ],
);

/** One stint: a person in one role at one organization over a span of seasons. */
export const tenures = pgTable(
  "tenures",
  {
    id: serial("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull().references(() => organizations.id),
    role: text("role").notNull(),
    roleGroup: roleGroup("role_group").notNull().default("other"),
    unit: unit("unit"),
    sport: text("sport").notNull().default("football"), // non-football stints are kept but never form tree edges
    startYear: integer("start_year"), // fall season year
    endYear: integer("end_year"), // null = current or unknown
    isCurrent: boolean("is_current").notNull().default(false),
    asPlayer: boolean("as_player").notNull().default(false),
    yearsExplicit: boolean("years_explicit").notNull().default(false),
    evidence: text("evidence"),
    sourceUrl: text("source_url"),
    verified: boolean("verified").notNull().default(false), // corroborated by a second source
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("tenures_person_idx").on(t.personId), index("tenures_org_idx").on(t.orgId)],
);

/** Derived coaching-tree relationships, computed by the pipeline from overlapping tenures. */
export const treeEdges = pgTable(
  "tree_edges",
  {
    id: serial("id").primaryKey(),
    kind: edgeKind("kind").notNull(),
    mentorId: text("mentor_id").notNull().references(() => people.id, { onDelete: "cascade" }), // for worked_alongside: the lexicographically smaller id
    menteeId: text("mentee_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull().references(() => organizations.id),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
  },
  (t) => [index("tree_mentor_idx").on(t.mentorId), index("tree_mentee_idx").on(t.menteeId)],
);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  kind: userKind("kind").notNull(),
  personId: text("person_id").references(() => people.id),
  orgId: text("org_id").references(() => organizations.id), // employer's program
  isDemo: boolean("is_demo").notNull().default(true),
});

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organizations.id),
    title: text("title").notNull(),
    roleGroup: roleGroup("role_group").notNull(),
    unit: unit("unit"),
    description: text("description").notNull(),
    location: text("location"),
    employmentType: text("employment_type").notNull().default("Full-time"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    postedAt: timestamp("posted_at").notNull().defaultNow(),
    closesAt: timestamp("closes_at"),
    status: text("status").notNull().default("open"),
    source: jobSource("source").notNull().default("native"),
    sourceUrl: text("source_url"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    isDemo: boolean("is_demo").notNull().default(false),
    /**
     * Listings posted from a shared demo account belong to the browser that posted them (the random
     * id in its httpOnly demo scope cookie, lib/demo-scope.ts) and are shown only there, labeled
     * "Demo listing". Null = a seeded or real listing everyone sees.
     */
    demoScope: text("demo_scope"),
  },
  (t) => [index("jobs_org_idx").on(t.orgId), index("jobs_posted_idx").on(t.postedAt), index("jobs_demo_scope_idx").on(t.demoScope)],
);

export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connections_pair_idx").on(t.requesterId, t.addresseeId)],
);

/** "Open to opportunities": private, never shown on the public profile. */
export const availability = pgTable("availability", {
  personId: text("person_id").primaryKey().references(() => people.id, { onDelete: "cascade" }),
  open: boolean("open").notNull().default(false),
  audience: audience("audience").notNull().default("all_except_current"),
  selectedOrgIds: jsonb("selected_org_ids").$type<string[]>().notNull().default([]),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  regions: jsonb("regions").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const claims = pgTable(
  "claims",
  {
    id: serial("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id),
    email: text("email").notNull(),
    status: text("status").notNull().default("started"), // started | verified | published
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // One claim per (person, user): a repeat publish updates the row (submitClaim upserts on this).
  (t) => [uniqueIndex("claims_person_user_idx").on(t.personId, t.userId)],
);

export const shortlists = pgTable(
  "shortlists",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /**
     * Searches written from a shared demo account belong to one browser (its demo scope, lib/demo-scope.ts):
     * the search opened with a demo listing (jobs.demoScope), and a browser's own copy of a seeded search.
     * Null = a seeded or real search.
     */
    demoScope: text("demo_scope"),
    /** A browser's copy of a seeded search: the seeded search it was copied from (and stands in for). */
    clonedFromId: integer("cloned_from_id").references((): AnyPgColumn => shortlists.id, { onDelete: "cascade" }),
    /** When a scoped search is deleted (demo pipeline TTL). Null on seeded and real searches. */
    demoExpiresAt: timestamp("demo_expires_at"),
  },
  // One copy of a seeded search per browser, even when its first writes race (NULLs stay distinct).
  (t) => [uniqueIndex("shortlists_clone_scope_idx").on(t.clonedFromId, t.demoScope)],
);

export const shortlistEntries = pgTable(
  "shortlist_entries",
  {
    id: serial("id").primaryKey(),
    shortlistId: integer("shortlist_id").notNull().references(() => shortlists.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    stage: pipelineStage("stage").notNull().default("sourced"),
    note: text("note"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // A coach is in a search at most once, even when two adds race (addToPipeline inserts ON CONFLICT DO NOTHING).
  (t) => [uniqueIndex("shortlist_entries_list_person_idx").on(t.shortlistId, t.personId)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    threadId: text("thread_id").notNull(), // sorted pair of user ids joined by ":"
    fromUserId: text("from_user_id").notNull().references(() => users.id),
    toUserId: text("to_user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("messages_thread_idx").on(t.threadId)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export const profileViews = pgTable("profile_views", {
  id: serial("id").primaryKey(),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  viewerUserId: text("viewer_user_id").references(() => users.id),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
});
