"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { getDb, schema } from "@/lib/db/client"
import { buildNormSet } from "@/lib/norms"
import { audit } from "@/lib/services/audit"
import { invalidateReferenceCache, loadNormSetEntries } from "@/lib/services/reference-data"

export interface ActionResult {
  ok: boolean
  message: string
}

const status = z.enum(["verified", "needs_verification", "unknown"])
const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().url("Ongeldige URL").nullable())
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

async function guard(): Promise<string | ActionResult> {
  try {
    return await requireAdmin()
  } catch {
    return { ok: false, message: "Geen toegang." }
  }
}

// ---------------------------------------------------------------------------- normen

const normValueSchema = z.object({
  id: z.string().uuid(),
  value: z.string(),
  status: z.enum(["verified", "needs_verification"]),
  sourceUrl: optionalUrl,
  sourceName: optionalText,
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-DD"),
  note: optionalText,
})

export async function updateNormValue(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const parsed = normValueSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") }
  const json = parseJson(parsed.data.value)
  if (!json.ok) return { ok: false, message: "De waarde is geen geldige JSON." }
  if (parsed.data.status === "verified" && !parsed.data.sourceUrl) {
    return { ok: false, message: "Een geverifieerde norm heeft een bron-URL nodig." }
  }
  const db = getDb()
  const [row] = await db.select().from(schema.normValues).where(eq(schema.normValues.id, parsed.data.id))
  if (!row) return { ok: false, message: "Norm niet gevonden." }
  // Controleer dat de set nog bruikbaar is voor de rekenkern met de nieuwe waarde.
  const [set] = await db.select().from(schema.normSets).where(eq(schema.normSets.id, row.normSetId))
  const entries = (await loadNormSetEntries(row.normSetId)).map((e) => (e.key === row.key ? { ...e, value: json.value } : e))
  try {
    buildNormSet(entries, { year: set!.year, version: "check" })
  } catch (err) {
    return { ok: false, message: `De rekenkern kan deze waarde niet gebruiken: ${(err as Error).message}` }
  }
  await db
    .update(schema.normValues)
    .set({
      value: json.value,
      status: parsed.data.status,
      sourceUrl: parsed.data.sourceUrl,
      sourceName: parsed.data.sourceName,
      checkedAt: parsed.data.checkedAt,
      note: parsed.data.note,
    })
    .where(eq(schema.normValues.id, parsed.data.id))
  await audit({ userId, action: "update", entityType: "norm_value", entityId: row.id, meta: { key: row.key, status: parsed.data.status } })
  invalidateReferenceCache()
  revalidatePath(`/admin/normen/${row.normSetId}`)
  return { ok: true, message: "Norm opgeslagen." }
}

export async function cloneNormSet(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const parsed = z.object({ setId: z.string().uuid(), year: z.coerce.number().int().min(2020).max(2100) }).safeParse(Object.fromEntries(form))
  if (!parsed.success) return { ok: false, message: "Ongeldig jaar." }
  const db = getDb()
  const values = await db.select().from(schema.normValues).where(eq(schema.normValues.normSetId, parsed.data.setId))
  const existing = await db.select().from(schema.normSets).where(eq(schema.normSets.year, parsed.data.year))
  const version = existing.reduce((m, s) => Math.max(m, s.version), 0) + 1
  const [created] = await db
    .insert(schema.normSets)
    .values({ year: parsed.data.year, version, name: `Normen ${parsed.data.year}`, status: "draft", clonedFromId: parsed.data.setId })
    .returning()
  for (let i = 0; i < values.length; i += 100) {
    await db.insert(schema.normValues).values(
      values.slice(i, i + 100).map((v) => ({
        normSetId: created!.id,
        key: v.key,
        value: v.value,
        unit: v.unit,
        label: v.label,
        sourceName: v.sourceName,
        sourceUrl: v.sourceUrl,
        checkedAt: v.checkedAt,
        status: "needs_verification",
        note: `Gekloond; controleer de waarde voor ${parsed.data.year}. ${v.note ?? ""}`.trim(),
      }))
    )
  }
  await audit({ userId, action: "clone", entityType: "norm_set", entityId: created!.id, meta: { year: parsed.data.year } })
  revalidatePath("/admin/normen")
  return { ok: true, message: `Normen ${parsed.data.year} (versie ${version}) aangemaakt als concept. Alle waarden staan op 'te verifiëren'.` }
}

export async function activateNormSet(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const setId = z.string().uuid().safeParse(form.get("setId"))
  if (!setId.success) return { ok: false, message: "Ongeldige normenset." }
  const db = getDb()
  const [set] = await db.select().from(schema.normSets).where(eq(schema.normSets.id, setId.data))
  if (!set) return { ok: false, message: "Normenset niet gevonden." }
  try {
    buildNormSet(await loadNormSetEntries(set.id), { year: set.year, version: "check" })
  } catch (err) {
    return { ok: false, message: `Kan niet activeren: ${(err as Error).message}` }
  }
  await db.update(schema.normSets).set({ status: "archived" }).where(and(eq(schema.normSets.status, "active"), ne(schema.normSets.id, set.id)))
  await db.update(schema.normSets).set({ status: "active" }).where(eq(schema.normSets.id, set.id))
  await audit({ userId, action: "activate", entityType: "norm_set", entityId: set.id, meta: { year: set.year } })
  invalidateReferenceCache()
  revalidatePath("/admin/normen")
  return { ok: true, message: `Normen ${set.year} v${set.version} zijn nu actief.` }
}

// ---------------------------------------------------------------------------- geldverstrekkers

const criterionSchema = z.object({
  id: z.string().uuid(),
  table: z.enum(["criteria", "entrepreneur"]),
  value: z.string(),
  status,
  sourceUrl: optionalUrl,
  note: optionalText,
})

export async function updateLenderCriterion(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const parsed = criterionSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") }
  const json = parseJson(parsed.data.value)
  if (!json.ok) return { ok: false, message: "De waarde is geen geldige JSON (gebruik bijv. true, 100, \"tekst\" of null)." }
  const table = parsed.data.table === "criteria" ? schema.lenderCriteria : schema.lenderEntrepreneurPolicies
  const [row] = await getDb()
    .update(table)
    .set({
      value: json.value,
      status: json.value === null ? "unknown" : parsed.data.status,
      sourceUrl: parsed.data.sourceUrl,
      note: parsed.data.note,
      checkedAt: new Date().toISOString().slice(0, 10),
    })
    .where(eq(table.id, parsed.data.id))
    .returning()
  if (!row) return { ok: false, message: "Criterium niet gevonden." }
  await audit({ userId, action: "update", entityType: "lender_criterion", entityId: row.id, meta: { lender: row.lenderSlug, key: row.key } })
  invalidateReferenceCache()
  revalidatePath(`/admin/geldverstrekkers/${row.lenderSlug}`)
  return { ok: true, message: "Criterium opgeslagen." }
}

export async function toggleLenderActive(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const slug = String(form.get("slug") ?? "")
  const active = form.get("active") === "true"
  await getDb().update(schema.lenders).set({ active }).where(eq(schema.lenders.slug, slug))
  await audit({ userId, action: active ? "activate" : "deactivate", entityType: "lender", entityId: slug })
  invalidateReferenceCache()
  revalidatePath(`/admin/geldverstrekkers/${slug}`)
  return { ok: true, message: active ? "Geldverstrekker geactiveerd." : "Geldverstrekker gedeactiveerd." }
}

const rateSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  lenderSlug: z.string().min(1),
  fixedYears: z.coerce.number().int().min(1).max(30),
  ltvClass: z.enum(["nhg", "ltv60", "ltv70", "ltv80", "ltv90", "ltv100"]),
  repaymentType: z.enum(["annuity", "linear", "interest_only"]),
  ratePct: z.coerce.number().min(0).max(15),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: optionalUrl,
  status: z.enum(["verified", "needs_verification"]),
})

export async function upsertRate(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const userId = await guard()
  if (typeof userId !== "string") return userId
  const parsed = rateSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") }
  const { id, ...data } = parsed.data
  const values = { ...data, nhg: data.ltvClass === "nhg", origin: "admin", energyLabelDiscount: 0 }
  const db = getDb()
  if (id) await db.update(schema.rateSheets).set(values).where(eq(schema.rateSheets.id, id))
  else await db.insert(schema.rateSheets).values(values)
  await audit({ userId, action: id ? "update" : "create", entityType: "rate", entityId: id ?? null, meta: { lender: data.lenderSlug, fixedYears: data.fixedYears } })
  invalidateReferenceCache()
  revalidatePath(`/admin/geldverstrekkers/${data.lenderSlug}`)
  return { ok: true, message: "Rente opgeslagen." }
}
