import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { decryptJson, encryptJson } from "@/lib/crypto"

/**
 * Versleutelde JSON-kolom: wordt als tekst (AES-256-GCM) opgeslagen en transparant
 * ontsleuteld bij het lezen. Gebruik voor alle persoons- en financiële gegevens.
 */
export const encryptedJson = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType() {
      return "text"
    },
    toDriver(value: T): string {
      return encryptJson(value)
    },
    fromDriver(value: string): T {
      return decryptJson<T>(value)
    },
  })(name)

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// ---------------------------------------------------------------------------
// Gebruikers en dossiers
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  /** Clerk userId */
  id: text("id").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
})

export const dossiers = pgTable(
  "dossiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    status: text("status").notNull().default("intake"),
    currentStep: text("current_step").notNull().default("doel"),
    completedSteps: jsonb("completed_steps").$type<string[]>().notNull().default([]),
    /** Algemene intake-antwoorden die niet in een specifieke tabel horen (huishouden, voorkeuren, risico's). */
    general: encryptedJson<Record<string, unknown>>("general"),
    ...timestamps,
  },
  (t) => [index("dossiers_user_idx").on(t.userId)]
)

const dossierRef = () =>
  uuid("dossier_id")
    .notNull()
    .references(() => dossiers.id, { onDelete: "cascade" })
const userRef = () => text("user_id").notNull()

export const applicants = pgTable(
  "applicants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    position: integer("position").notNull(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("applicants_dossier_pos_idx").on(t.dossierId, t.position)]
)

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    applicantPosition: integer("applicant_position").notNull(),
    type: text("type").notNull(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("incomes_dossier_idx").on(t.dossierId)]
)

export const obligations = pgTable(
  "obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    applicantPosition: integer("applicant_position"),
    type: text("type").notNull(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("obligations_dossier_idx").on(t.dossierId)]
)

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    type: text("type").notNull(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("assets_dossier_idx").on(t.dossierId)]
)

export const currentProperties = pgTable(
  "current_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("current_properties_dossier_idx").on(t.dossierId)]
)

export const currentLoanParts = pgTable(
  "current_loan_parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    currentPropertyId: uuid("current_property_id")
      .notNull()
      .references(() => currentProperties.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("current_loan_parts_dossier_idx").on(t.dossierId)]
)

export const targetProperties = pgTable(
  "target_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("target_properties_dossier_idx").on(t.dossierId)]
)

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    overrides: jsonb("overrides").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("scenarios_dossier_idx").on(t.dossierId)]
)

// ---------------------------------------------------------------------------
// Ondernemers
// ---------------------------------------------------------------------------

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    applicantPosition: integer("applicant_position").notNull(),
    legalForm: text("legal_form").notNull(),
    /** KvK-nummer, startdatum, branche, vooruitzichten e.d. (versleuteld). */
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("businesses_dossier_idx").on(t.dossierId)]
)

export const businessEntities = pgTable(
  "business_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    dossierId: dossierRef(),
    userId: userRef(),
    /** holding | werkmaatschappij | onderneming */
    role: text("role").notNull(),
    key: text("key").notNull(),
    parentKey: text("parent_key"),
    ownershipPct: numeric("ownership_pct", { mode: "number" }),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("business_entities_business_idx").on(t.businessId)]
)

export const businessFinancials = pgTable(
  "business_financials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    dossierId: dossierRef(),
    userId: userRef(),
    /** null = geconsolideerde cijfers */
    entityKey: text("entity_key"),
    year: integer("year").notNull(),
    isConsolidated: boolean("is_consolidated").notNull().default(false),
    isForecast: boolean("is_forecast").notNull().default(false),
    data: encryptedJson<Record<string, unknown>>("data").notNull(),
    ...timestamps,
  },
  (t) => [index("business_financials_business_idx").on(t.businessId)]
)

export const shareholdings = pgTable("shareholdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dossierId: dossierRef(),
  userId: userRef(),
  applicantPosition: integer("applicant_position").notNull(),
  entityKey: text("entity_key").notNull(),
  pct: numeric("pct", { mode: "number" }).notNull(),
  direct: boolean("direct").notNull().default(true),
  ...timestamps,
})

export const businessGuarantees = pgTable("business_guarantees", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dossierId: dossierRef(),
  userId: userRef(),
  data: encryptedJson<Record<string, unknown>>("data").notNull(),
  ...timestamps,
})

export const dgaLoans = pgTable("dga_loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dossierId: dossierRef(),
  userId: userRef(),
  data: encryptedJson<Record<string, unknown>>("data").notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Documenten, berekeningen, rapporten
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    applicantPosition: integer("applicant_position"),
    type: text("type").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    blobUrl: text("blob_url").notNull(),
    fileName: encryptedJson<string>("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** uploaded | extracting | extracted | confirmed | failed */
    status: text("status").notNull().default("uploaded"),
    extraction: encryptedJson<Record<string, unknown>>("extraction"),
    confirmedData: encryptedJson<Record<string, unknown>>("confirmed_data"),
    errorMessage: text("error_message"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("documents_dossier_idx").on(t.dossierId),
    index("documents_expires_idx").on(t.expiresAt),
  ]
)

export const calculations = pgTable(
  "calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    inputHash: text("input_hash").notNull(),
    engineVersion: text("engine_version").notNull(),
    normSetVersion: text("norm_set_version").notNull(),
    output: encryptedJson<Record<string, unknown>>("output").notNull(),
    ...timestamps,
  },
  (t) => [index("calculations_dossier_idx").on(t.dossierId, t.inputHash)]
)

export const adviceReports = pgTable(
  "advice_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    calculationId: uuid("calculation_id")
      .notNull()
      .references(() => calculations.id, { onDelete: "cascade" }),
    texts: encryptedJson<Record<string, string>>("texts").notNull(),
    /** llm | template */
    textSource: text("text_source").notNull(),
    model: text("model"),
    numberCheckPassed: boolean("number_check_passed").notNull(),
    ...timestamps,
  },
  (t) => [index("advice_reports_dossier_idx").on(t.dossierId)]
)

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: dossierRef(),
    userId: userRef(),
    role: text("role").notNull(),
    content: encryptedJson<string>("content").notNull(),
    ...timestamps,
  },
  (t) => [index("chat_messages_dossier_idx").on(t.dossierId)]
)

// ---------------------------------------------------------------------------
// Referentiedata: geldverstrekkers, rentes, normen
// ---------------------------------------------------------------------------

export const lenders = pgTable("lenders", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  brands: jsonb("brands").$type<string[]>().notNull().default([]),
  website: text("website"),
  active: boolean("active").notNull().default(true),
  activeNote: text("active_note"),
  ...timestamps,
})

const referenceValueColumns = {
  key: text("key").notNull(),
  value: jsonb("value").$type<unknown>(),
  sourceUrl: text("source_url"),
  note: text("note"),
  /** verified | needs_verification | unknown */
  status: text("status").notNull().default("needs_verification"),
  checkedAt: date("checked_at"),
}

export const lenderCriteria = pgTable(
  "lender_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lenderSlug: text("lender_slug")
      .notNull()
      .references(() => lenders.slug, { onDelete: "cascade" }),
    ...referenceValueColumns,
    ...timestamps,
  },
  (t) => [uniqueIndex("lender_criteria_key_idx").on(t.lenderSlug, t.key)]
)

export const lenderEntrepreneurPolicies = pgTable(
  "lender_entrepreneur_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lenderSlug: text("lender_slug")
      .notNull()
      .references(() => lenders.slug, { onDelete: "cascade" }),
    ...referenceValueColumns,
    ...timestamps,
  },
  (t) => [uniqueIndex("lender_ent_policies_key_idx").on(t.lenderSlug, t.key)]
)

export const rateSheets = pgTable(
  "rate_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lenderSlug: text("lender_slug")
      .notNull()
      .references(() => lenders.slug, { onDelete: "cascade" }),
    fixedYears: integer("fixed_years").notNull(),
    /** nhg | ltv60 | ltv70 | ltv80 | ltv90 | ltv100 */
    ltvClass: text("ltv_class").notNull(),
    nhg: boolean("nhg").notNull(),
    /** annuity | linear | interest_only */
    repaymentType: text("repayment_type").notNull(),
    /** Rentekorting voor energielabel (procentpunt), 0 = geen korting verwerkt. */
    energyLabelDiscount: numeric("energy_label_discount", { mode: "number" }).notNull().default(0),
    ratePct: numeric("rate_pct", { mode: "number" }).notNull(),
    rateDate: date("rate_date").notNull(),
    sourceUrl: text("source_url"),
    /** verified | needs_verification | derived */
    status: text("status").notNull().default("needs_verification"),
    /** seed | cron | admin */
    origin: text("origin").notNull().default("seed"),
    ...timestamps,
  },
  (t) => [
    index("rate_sheets_lookup_idx").on(t.lenderSlug, t.fixedYears, t.ltvClass, t.repaymentType),
  ]
)

export const normSets = pgTable(
  "norm_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    /** active | draft | archived */
    status: text("status").notNull().default("draft"),
    clonedFromId: uuid("cloned_from_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("norm_sets_year_version_idx").on(t.year, t.version)]
)

export const normValues = pgTable(
  "norm_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    normSetId: uuid("norm_set_id")
      .notNull()
      .references(() => normSets.id, { onDelete: "cascade" }),
    ...referenceValueColumns,
    unit: text("unit"),
    label: text("label").notNull(),
    sourceName: text("source_name"),
    ...timestamps,
  },
  (t) => [uniqueIndex("norm_values_set_key_idx").on(t.normSetId, t.key)]
)

// ---------------------------------------------------------------------------
// Operationeel
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    dossierId: uuid("dossier_id"),
    /** Nooit persoonsgegevens in meta. */
    meta: jsonb("meta").$type<Record<string, string | number | boolean | null>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_user_idx").on(t.userId, t.at)]
)

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })]
)

export const cronRuns = pgTable("cron_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  job: text("job").notNull(),
  status: text("status").notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
})
