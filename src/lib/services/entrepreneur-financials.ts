import "server-only"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb, schema } from "@/lib/db/client"
import { applyFinancialsToBusiness } from "@/lib/documents/apply-financials"
import { FIN_FIELDS, mergeFinancials, type FinancialsExtraction, type MergedFinancials } from "@/lib/documents/financials"
import { docType } from "@/lib/documents/types"
import { defaultBusiness } from "@/lib/intake/defaults"
import type { BusinessForm, EntrepreneurStep } from "@/lib/intake/schema"
import { DocumentValidationError } from "./documents"
import { loadIntake, saveStep } from "./dossiers"

/**
 * Jaarcijfers (jaarrekening, Excel, jaaroverzicht) per aanvrager samenvoegen en overnemen in de
 * ondernemer-stap van de intake. Alle queries gefilterd op userId.
 */

export interface FinancialsDocView {
  id: string
  fileName: string
  applicantPosition: number
  status: string
  source: FinancialsExtraction["source"] | null
  documentKind: string | null
  entities: string[]
  years: number[]
  warnings: string[]
  error: string | null
}

function isFinancialsType(type: string) {
  return docType(type)?.extraction === "financials"
}

async function financialsRows(userId: string, dossierId: string) {
  const rows = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId)))
  return rows.filter((r) => isFinancialsType(r.type)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function loadFinancials(userId: string, dossierId: string) {
  const [rows, { intake }] = await Promise.all([financialsRows(userId, dossierId), loadIntake(userId, dossierId)])
  const docs: FinancialsDocView[] = rows.map((r) => {
    const ext = (r.extraction ?? null) as FinancialsExtraction | null
    return {
      id: r.id,
      fileName: r.fileName,
      applicantPosition: r.applicantPosition ?? 1,
      status: r.status,
      source: ext?.source ?? null,
      documentKind: ext?.documentKind ?? null,
      entities: ext?.entities.map((e) => e.name) ?? [],
      years: [...new Set(ext?.entities.flatMap((e) => e.years.map((y) => y.year)) ?? [])].sort(),
      warnings: ext?.warnings ?? [],
      error: r.errorMessage,
    }
  })
  const persons = intake.persoonlijk?.applicants ?? [{ firstName: "" }]
  const applicants = persons.map((p, i) => {
    const position = i + 1
    const items = rows
      .filter((r) => (r.applicantPosition ?? 1) === position && r.extraction)
      .map((r) => ({ id: r.id, extraction: r.extraction as unknown as FinancialsExtraction }))
    return {
      position,
      name: p.firstName || (position === 1 ? "Aanvrager 1" : "Partner"),
      businesses: intake.ondernemer?.applicants[i]?.businesses ?? [],
      merged: mergeFinancials(items),
    }
  })
  return { docs, applicants, intake }
}

// ----------------------------------------------------------------------------- overnemen

const mergedValue = z.object({ value: z.number().finite().min(-1e10).max(1e10), confidence: z.number().min(0).max(1), sourceIds: z.array(z.string().max(64)).max(50) })
const fieldKeys = FIN_FIELDS.map((f) => f.key) as [string, ...string[]]
export const mergedFinancialsSchema = z.object({
  entities: z
    .array(
      z.object({
        key: z.string().max(120),
        name: z.string().trim().min(1).max(80),
        role: z.enum(["holding", "werkmaatschappij", "geconsolideerd", "eenmanszaak", "onbekend"]),
        ownershipPct: z.number().min(0).max(100).nullable(),
        parentName: z.string().max(80).nullable(),
        years: z
          .array(z.object({ year: z.number().int().min(1990).max(2100), isForecast: z.boolean(), values: z.partialRecord(z.enum(fieldKeys), mergedValue) }))
          .max(10),
      })
    )
    .max(8),
  salaries: z.array(z.object({ year: z.number().int().min(1990).max(2100), amount: z.number().min(0).max(1e8), sourceIds: z.array(z.string().max(64)).max(50) })).max(10),
  shareholdingPct: z.number().min(0).max(100).nullable(),
  conflicts: z.array(z.string().max(500)).max(100),
})

export async function applyFinancials(
  userId: string,
  dossierId: string,
  input: { applicantPosition: number; businessId: string | null; merged: unknown }
): Promise<{ summary: string[]; errors: string[] }> {
  const parsed = mergedFinancialsSchema.safeParse(input.merged)
  if (!parsed.success) throw new DocumentValidationError("De cijfers zijn ongeldig. Controleer de invoer.")
  const merged = parsed.data as MergedFinancials
  const { intake } = await loadIntake(userId, dossierId)
  const count = intake.persoonlijk?.applicants.length ?? 1
  if (input.applicantPosition < 1 || input.applicantPosition > count) throw new DocumentValidationError("Onbekende aanvrager.")
  const step: EntrepreneurStep = structuredClone(intake.ondernemer ?? { applicants: [] })
  while (step.applicants.length < count) step.applicants.push({ businesses: [] })
  const list = step.applicants[input.applicantPosition - 1]!.businesses
  let index = input.businessId ? list.findIndex((b) => b.id === input.businessId) : -1
  const summary: string[] = []
  if (index < 0) {
    if (list.length >= 5) throw new DocumentValidationError("Kies een bestaande onderneming.")
    const b: BusinessForm = defaultBusiness(new Date().getFullYear())
    const sole = merged.entities.length > 0 && merged.entities.every((e) => e.role === "eenmanszaak")
    if (!sole) b.legalForm = merged.entities.some((e) => e.role === "holding") ? "bv_holding" : "bv"
    b.name = merged.entities.find((e) => e.role !== "geconsolideerd")?.name ?? ""
    list.push(b)
    index = list.length - 1
    summary.push("Nieuwe onderneming aangemaakt in de intake.")
  }
  const result = applyFinancialsToBusiness(list[index]!, merged)
  list[index] = result.business
  summary.push(...result.summary)
  const saved = await saveStep(userId, dossierId, "ondernemer", step)
  if (!saved.ok) return { summary: [], errors: saved.errors }
  const ids = new Set(merged.entities.flatMap((e) => e.years.flatMap((y) => Object.values(y.values).flatMap((v) => v?.sourceIds ?? []))))
  merged.salaries.forEach((s) => s.sourceIds.forEach((id) => ids.add(id)))
  const rows = await financialsRows(userId, dossierId)
  const db = getDb()
  for (const r of rows) {
    if (!ids.has(r.id) || (r.applicantPosition ?? 1) !== input.applicantPosition) continue
    await db
      .update(schema.documents)
      .set({ status: "confirmed", confirmedData: { fields: [], financialsAppliedTo: list[index]!.id }, confirmedAt: new Date() })
      .where(and(eq(schema.documents.id, r.id), eq(schema.documents.userId, userId)))
  }
  return { summary, errors: [] }
}
