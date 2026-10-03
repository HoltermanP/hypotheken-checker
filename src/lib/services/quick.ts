import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"
import { confirmedValues, type ExtractedField, type NormalizedExtraction } from "@/lib/documents/extraction"
import { mergeFinancials, type FinancialsExtraction, type MergedFinancials } from "@/lib/documents/financials"
import { docType } from "@/lib/documents/types"
import {
  fillFromSuggestions,
  legalFormFromFinancials,
  quickForm,
  quickFromIntake,
  quickToIntake,
  salaryFromDoc,
  salarySuggestion,
  type QuickForm,
  type SalaryDoc,
  type SalarySuggestion,
} from "@/lib/quick/quick"
import { confirmDocument, listDocuments, runExtraction } from "./documents"
import { loadIntake, quickDraftOf, saveQuickDraft, saveStep } from "./dossiers"

/**
 * Snelle invoer (pagina Start): documenten uitlezen, het formulier voorvullen en in één keer
 * omzetten naar de volledige intake. Alle queries gefilterd op userId.
 */

export const SALARY_TYPES = new Set(["salarisstrook", "werkgeversverklaring"])
export const FINANCIALS_TYPE = "jaarcijfers_onderneming"

type DocRow = Awaited<ReturnType<typeof listDocuments>>[number]

export interface QuickDocView {
  id: string
  fileName: string
  kind: "salary" | "financials"
  applicantPosition: number
  status: string
  error: string | null
}

export interface QuickFinancialsView {
  position: number
  legalForm: string | null
  entities: { name: string; role: string; years: { year: number; result: number | null; forecast: boolean }[] }[]
  conflicts: string[]
  warnings: string[]
}

function fieldsOf(r: DocRow): ExtractedField[] {
  const confirmed = (r.confirmedData ?? null) as { fields?: ExtractedField[] } | null
  if (confirmed?.fields?.length) return confirmed.fields
  return ((r.extraction ?? null) as NormalizedExtraction | null)?.fields ?? []
}

function salaryDocs(rows: DocRow[], position: number): SalaryDoc[] {
  return rows
    .filter((r) => SALARY_TYPES.has(r.type) && (r.applicantPosition ?? 1) === position && r.extraction)
    .map((r) => ({ type: r.type, values: confirmedValues(fieldsOf(r)), createdAt: r.createdAt.toISOString() }))
}

function mergedFor(rows: DocRow[], position: number): MergedFinancials | null {
  const items = rows
    .filter((r) => r.type === FINANCIALS_TYPE && (r.applicantPosition ?? 1) === position && r.extraction)
    .map((r) => ({ id: r.id, extraction: r.extraction as unknown as FinancialsExtraction }))
  return items.length ? mergeFinancials(items) : null
}

function financialsView(position: number, m: MergedFinancials, rows: DocRow[]): QuickFinancialsView {
  return {
    position,
    legalForm: legalFormFromFinancials(m),
    entities: m.entities.map((e) => ({
      name: e.name,
      role: e.role,
      years: e.years.map((y) => ({ year: y.year, result: y.values.resultBeforeTax?.value ?? y.values.resultAfterTax?.value ?? null, forecast: y.isForecast })),
    })),
    conflicts: m.conflicts,
    warnings: rows
      .filter((r) => r.type === FINANCIALS_TYPE && (r.applicantPosition ?? 1) === position && r.extraction)
      .flatMap((r) => (r.extraction as unknown as FinancialsExtraction).warnings),
  }
}

/** Een eerder opgeslagen concept over de startwaarden leggen (velden die ontbreken blijven standaard). */
function withDraft(base: QuickForm, draft: unknown): QuickForm {
  if (!draft || typeof draft !== "object") return base
  const d = draft as Partial<QuickForm>
  return {
    ...base,
    ...d,
    applicants: Array.isArray(d.applicants) && d.applicants.length ? d.applicants.map((a, i) => ({ ...(base.applicants[i] ?? base.applicants[0]!), ...a })) : base.applicants,
    currentHome: { ...base.currentHome, ...(d.currentHome ?? {}) },
    targetHome: { ...base.targetHome, ...(d.targetHome ?? {}) },
  }
}

export async function loadQuick(userId: string, dossierId: string) {
  const [{ dossier, intake }, rows] = await Promise.all([loadIntake(userId, dossierId), listDocuments(userId, dossierId)])
  const calcYear = new Date().getFullYear()
  const base = withDraft(quickFromIntake(intake, calcYear), quickDraftOf(dossier))
  const suggestions = [1, 2].map((p) => salarySuggestion(salaryDocs(rows, p)))
  const defaults = fillFromSuggestions(base, suggestions)
  const docs: QuickDocView[] = rows
    .filter((r) => SALARY_TYPES.has(r.type) || r.type === FINANCIALS_TYPE)
    .map((r) => ({
      id: r.id,
      fileName: r.fileName,
      kind: r.type === FINANCIALS_TYPE ? "financials" : "salary",
      applicantPosition: r.applicantPosition ?? 1,
      status: r.status,
      error: r.errorMessage,
    }))
  const financials = [1, 2].map((p) => {
    const m = mergedFor(rows, p)
    return m && m.entities.length ? financialsView(p, m, rows) : null
  })
  return { defaults, docs, financials, calcYear, hasAdvice: dossier.status === "advice" }
}

/** Een net geüpload document uitlezen en teruggeven wat het formulier kan overnemen. */
export async function extractForQuick(
  userId: string,
  documentId: string
): Promise<{ applicantPosition: number; salary: SalarySuggestion | null; legalForm: string | null }> {
  await runExtraction(userId, documentId)
  const [row] = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.userId, userId)))
  const position = row?.applicantPosition ?? 1
  if (!row) return { applicantPosition: position, salary: null, legalForm: null }
  if (row.type === FINANCIALS_TYPE) {
    const m = mergeFinancials([{ id: row.id, extraction: row.extraction as unknown as FinancialsExtraction }])
    return { applicantPosition: position, salary: null, legalForm: legalFormFromFinancials(m) }
  }
  const salary = salaryFromDoc({ type: row.type, values: confirmedValues(fieldsOf(row)), createdAt: row.createdAt.toISOString() })
  return { applicantPosition: position, salary, legalForm: null }
}

export async function saveQuick(userId: string, dossierId: string, data: unknown) {
  await saveQuickDraft(userId, dossierId, data)
}

/** Formulier valideren, omzetten naar de intake en alles opslaan. */
export async function applyQuick(userId: string, dossierId: string, raw: unknown): Promise<{ ok: true; notes: string[] } | { ok: false; errors: string[] }> {
  const parsed = quickForm.safeParse(raw)
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) }
  const q = parsed.data
  await saveQuickDraft(userId, dossierId, q)
  const [{ intake }, rows] = await Promise.all([loadIntake(userId, dossierId), listDocuments(userId, dossierId)])
  const calcYear = new Date().getFullYear()
  const { steps, notes } = quickToIntake(q, intake, [mergedFor(rows, 1), mergedFor(rows, 2)], calcYear)
  for (const [step, data] of steps) {
    const r = await saveStep(userId, dossierId, step, data)
    if (!r.ok) return { ok: false, errors: r.errors }
  }
  // Uitgelezen documenten tellen als bevestigd: de gebruiker heeft de waarden in het formulier gezien.
  const db = getDb()
  for (const r of rows) {
    if (r.status !== "extracted") continue
    if (SALARY_TYPES.has(r.type)) await confirmDocument(userId, r.id, confirmedValues(fieldsOf(r)), false)
    else if (docType(r.type)?.extraction === "financials")
      await db
        .update(schema.documents)
        .set({ status: "confirmed", confirmedData: { fields: [] }, confirmedAt: new Date() })
        .where(and(eq(schema.documents.id, r.id), eq(schema.documents.userId, userId)))
  }
  return { ok: true, notes }
}
