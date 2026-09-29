import "server-only"
import { and, desc, eq, lt } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"
import { extractDocument } from "@/lib/ai/extract"
import { applyToIntake } from "@/lib/documents/apply"
import { runConsistencyChecks, type ConfirmedDoc, type IntakeFacts } from "@/lib/documents/consistency"
import type { ExtractedField, FieldValue, NormalizedExtraction } from "@/lib/documents/extraction"
import { ALLOWED_CONTENT_TYPES, checklist, docType, MAX_UPLOAD_BYTES, type ChecklistItem } from "@/lib/documents/types"
import type { IntakeData, StepKey } from "@/lib/intake/schema"
import { aiRateLimit, enforceRateLimit } from "@/lib/rate-limit"
import { signDownload } from "@/lib/signed-url"
import { deleteObject, readObject } from "@/lib/storage"
import { getOwnedDossier, loadIntake, NotFoundError, saveStep } from "./dossiers"

/**
 * Documentenservice. Alle queries gefilterd op userId (en dossier-eigendom).
 */

export interface DossierDocumentChecks {
  checks: { label: string; status: "green" | "orange" | "red"; detail: string }[]
  confirmedTypes: string[]
}

export function retentionDays(): number {
  return Number(process.env.DOCUMENT_RETENTION_DAYS ?? 90) || 90
}

export function documentPathPrefix(dossierId: string) {
  return `dossiers/${dossierId}/`
}

export async function listDocuments(userId: string, dossierId: string) {
  await getOwnedDossier(userId, dossierId)
  return getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId)))
    .orderBy(desc(schema.documents.createdAt))
}

export async function getOwnedDocument(userId: string, documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new NotFoundError("Document")
  const [d] = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.userId, userId)))
  if (!d) throw new NotFoundError("Document")
  return d
}

export class DocumentValidationError extends Error {}

export async function registerDocument(
  userId: string,
  input: {
    dossierId: string
    type: string
    applicantPosition: number | null
    pathname: string
    url: string
    contentType: string
    size: number
    fileName: string
  }
) {
  await getOwnedDossier(userId, input.dossierId)
  if (!docType(input.type)) throw new DocumentValidationError("Onbekend documenttype.")
  if (!input.pathname.startsWith(documentPathPrefix(input.dossierId))) throw new DocumentValidationError("Ongeldig pad.")
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(input.contentType)) throw new DocumentValidationError("Alleen PDF, JPG, PNG of WebP.")
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) throw new DocumentValidationError("Bestand is te groot (max. 20 MB).")
  const db = getDb()
  const [existing] = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(and(eq(schema.documents.blobPathname, input.pathname), eq(schema.documents.userId, userId)))
  if (existing) return existing.id
  const expiresAt = new Date(Date.now() + retentionDays() * 86_400_000)
  const [row] = await db
    .insert(schema.documents)
    .values({
      dossierId: input.dossierId,
      userId,
      applicantPosition: input.applicantPosition,
      type: input.type,
      blobPathname: input.pathname,
      blobUrl: input.url,
      fileName: input.fileName.slice(0, 200),
      contentType: input.contentType,
      sizeBytes: input.size,
      status: "uploaded",
      expiresAt,
    })
    .returning({ id: schema.documents.id })
  return row!.id
}

export async function runExtraction(userId: string, documentId: string): Promise<NormalizedExtraction> {
  const doc = await getOwnedDocument(userId, documentId)
  const def = docType(doc.type)
  if (!def) throw new DocumentValidationError("Onbekend documenttype.")
  await enforceRateLimit("ai-extract", userId, aiRateLimit())
  const db = getDb()
  await db.update(schema.documents).set({ status: "extracting", errorMessage: null }).where(eq(schema.documents.id, doc.id))
  try {
    const data = await readObject(doc.blobUrl)
    const extraction = await extractDocument({ def, data, contentType: doc.contentType, now: new Date().toISOString() })
    await db
      .update(schema.documents)
      .set({ status: "extracted", extraction: extraction as unknown as Record<string, unknown> })
      .where(and(eq(schema.documents.id, doc.id), eq(schema.documents.userId, userId)))
    return extraction
  } catch (err) {
    const message = err instanceof Error && err.name === "ExtractionUnavailableError" ? err.message : "Uitlezen is mislukt. Vul de waarden zelf in."
    console.error("Extractie mislukt:", (err as Error).name)
    await db.update(schema.documents).set({ status: "failed", errorMessage: message }).where(eq(schema.documents.id, doc.id))
    throw new DocumentValidationError(message)
  }
}

export async function confirmDocument(
  userId: string,
  documentId: string,
  values: Record<string, FieldValue>,
  apply: boolean
): Promise<{ summary: string[]; errors: string[] }> {
  const doc = await getOwnedDocument(userId, documentId)
  const def = docType(doc.type)!
  const allowed = new Set(def.fields.map((f) => f.key))
  const clean: Record<string, FieldValue> = {}
  for (const [k, v] of Object.entries(values)) {
    if (!allowed.has(k)) continue
    if (v === null || typeof v === "number" || typeof v === "boolean") clean[k] = v
    else clean[k] = String(v).slice(0, 500)
  }
  const extraction = (doc.extraction ?? null) as NormalizedExtraction | null
  const fields: ExtractedField[] = def.fields.map((f) => {
    const prev = extraction?.fields.find((x) => x.key === f.key)
    const value = clean[f.key] ?? null
    return { key: f.key, label: f.label, kind: f.kind, value, confidence: prev && prev.value === value ? prev.confidence : 1, note: prev?.note ?? null }
  })
  await getDb()
    .update(schema.documents)
    .set({ status: "confirmed", confirmedData: { fields } as unknown as Record<string, unknown>, confirmedAt: new Date() })
    .where(and(eq(schema.documents.id, doc.id), eq(schema.documents.userId, userId)))
  if (!apply) return { summary: ["Bevestigd; gebruikt voor de controles."], errors: [] }
  const { intake } = await loadIntake(userId, doc.dossierId)
  const result = applyToIntake(intake, { type: doc.type, applicantPosition: doc.applicantPosition, values: clean })
  const errors: string[] = []
  for (const [step, data] of Object.entries(result.changed)) {
    const r = await saveStep(userId, doc.dossierId, step as Exclude<StepKey, "overzicht">, data)
    if (!r.ok) errors.push(...r.errors)
  }
  return { summary: result.summary, errors }
}

export async function deleteDocument(userId: string, documentId: string) {
  const doc = await getOwnedDocument(userId, documentId)
  try {
    await deleteObject(doc.blobUrl)
  } catch (err) {
    console.error("Blob verwijderen mislukt:", (err as Error).message)
  }
  await getDb().delete(schema.documents).where(and(eq(schema.documents.id, doc.id), eq(schema.documents.userId, userId)))
}

export async function signedDownloadUrl(userId: string, documentId: string): Promise<string> {
  const doc = await getOwnedDocument(userId, documentId)
  return `/api/documents/${doc.id}/download?token=${encodeURIComponent(signDownload(doc.id, userId))}`
}

// ----------------------------------------------------------------------------- checklist & checks

export function intakeFacts(intake: IntakeData, calculationDate: string): IntakeFacts {
  return {
    calculationDate,
    applicants: (intake.persoonlijk?.applicants ?? []).map((p, i) => {
      const inc = intake.inkomen?.applicants[i]
      const emp = inc?.incomes.filter((x) => x.kind === "employment") ?? []
      const gross = emp.reduce(
        (s, e) =>
          s +
          (e.kind === "employment"
            ? e.grossAnnualSalary + e.holidayPay + e.thirteenthMonth + e.fixedYearEndBonus + e.irregularityAllowance + e.commission
            : 0),
        0
      )
      const ibl = emp.find((e) => e.kind === "employment" && e.iblToetsinkomen)
      const studie = intake.verplichtingen?.obligations.find((o) => o.type === "student_loan" && (o.applicantPosition ?? 1) === i + 1)
      return {
        position: i + 1,
        firstName: p.firstName,
        dateOfBirth: p.dateOfBirth,
        grossAnnualEmployment: gross > 0 ? gross : null,
        iblToetsinkomen: ibl && ibl.kind === "employment" ? (ibl.iblToetsinkomen ?? null) : null,
        studentLoanMonthly: studie ? studie.monthlyPayment : null,
        businesses: (intake.ondernemer?.applicants[i]?.businesses ?? []).map((b) => ({
          legalForm: b.legalForm,
          shareholdingPct: b.bv?.shareholdingPct ?? null,
          currentAccountDga: b.bv?.currentAccountDga ?? null,
          profits:
            b.legalForm === "bv" || b.legalForm === "bv_holding"
              ? (b.bv?.entities.find((e) => e.role === "werkmaatschappij") ?? b.bv?.entities[0])?.financials.map((f) => ({ year: f.year, value: f.resultAfterTax })) ?? []
              : (b.soleProp?.years ?? []).map((y) => ({ year: y.year, value: y.profit })),
          dgaSalaries: (b.bv?.salaries ?? []).map((s) => ({ year: s.year, value: s.amount })),
          fluctuationExplained: !!b.fluctuationExplanation,
        })),
      }
    }),
    savings: intake.vermogen?.savings ?? null,
    purchasePrice: intake["nieuwe-woning"]?.purchasePrice ?? null,
    targetWoz: intake["nieuwe-woning"]?.wozValue ?? null,
    currentWoz: intake["huidige-woning"]?.wozValue ?? null,
    currentDebt: intake["huidige-woning"] ? intake["huidige-woning"].loanParts.reduce((s, p) => s + p.balance, 0) : null,
  }
}

export function checklistFor(intake: IntakeData, calculationDate: string): ChecklistItem[] {
  const year = Number(calculationDate.slice(0, 4))
  return checklist({
    goal: intake.doel?.goal ?? "orientatie",
    applicants: (intake.persoonlijk?.applicants ?? []).map((p, i) => {
      const inc = intake.inkomen?.applicants[i]
      return {
        position: i + 1,
        employment: (inc?.incomes ?? []).filter((x) => x.kind === "employment").map((e) => ({ contract: e.kind === "employment" ? e.contract : "permanent" })),
        pension: (inc?.incomes ?? []).some((x) => x.kind === "pension"),
        businesses: inc?.isEntrepreneur ? (intake.ondernemer?.applicants[i]?.businesses ?? [{ legalForm: "eenmanszaak" }]).map((b) => ({ legalForm: b.legalForm, holding: b.legalForm === "bv_holding" })) : [],
        studentLoan: (intake.verplichtingen?.obligations ?? []).some((o) => o.type === "student_loan" && (o.applicantPosition ?? 1) === i + 1),
      }
    }),
    hasCurrentHome: !!intake["huidige-woning"],
    hasTargetHome: !!intake["nieuwe-woning"],
    newBuild: intake["nieuwe-woning"]?.kind === "new_build",
    renovation: (intake["nieuwe-woning"]?.renovationAmount ?? 0) + (intake["nieuwe-woning"]?.energySavingAmount ?? 0) > 0,
    savings: (intake.vermogen?.savings ?? 0) > 0,
    nearAow: (intake.persoonlijk?.applicants ?? []).map((p) => (p.dateOfBirth ? year - Number(p.dateOfBirth.slice(0, 4)) >= 57 : false)),
  })
}

function toConfirmed(rows: (typeof schema.documents.$inferSelect)[]): ConfirmedDoc[] {
  return rows
    .filter((d) => d.status === "confirmed" && d.confirmedData)
    .map((d) => {
      const fields = ((d.confirmedData as { fields?: ExtractedField[] }).fields ?? []) as ExtractedField[]
      return {
        id: d.id,
        type: d.type,
        applicantPosition: d.applicantPosition,
        values: Object.fromEntries(fields.map((f) => [f.key, f.value])),
        uploadedAt: d.createdAt.toISOString().slice(0, 10),
      }
    })
}

export async function documentChecksForDossier(userId: string, dossierId: string): Promise<DossierDocumentChecks & { raw: ReturnType<typeof runConsistencyChecks> }> {
  const [rows, { intake }] = await Promise.all([
    getDb()
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId))),
    loadIntake(userId, dossierId),
  ])
  const confirmed = toConfirmed(rows)
  const raw = runConsistencyChecks(confirmed, intakeFacts(intake, new Date().toISOString().slice(0, 10)))
  return {
    checks: raw.map((c) => ({ label: c.label, status: c.status, detail: c.detail })),
    confirmedTypes: [...new Set(confirmed.map((c) => c.type))],
    raw,
  }
}

/** Verlopen documenten (bewaartermijn) verwijderen: blob + rij. Voor de cron-job. */
export async function purgeExpiredDocuments(now = new Date()): Promise<number> {
  const db = getDb()
  const expired = await db.select().from(schema.documents).where(lt(schema.documents.expiresAt, now))
  for (const d of expired) {
    try {
      await deleteObject(d.blobUrl)
    } catch (err) {
      console.error("Blob verwijderen mislukt:", (err as Error).message)
    }
    await db.delete(schema.documents).where(eq(schema.documents.id, d.id))
  }
  return expired.length
}

/** Eén bevestigde waarde uit een document van een type (of null). */
export async function confirmedDocumentValue(userId: string, dossierId: string, type: string, key: string): Promise<FieldValue | null> {
  const rows = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId), eq(schema.documents.type, type)))
  for (const d of toConfirmed(rows)) if (d.values[key] !== undefined && d.values[key] !== null) return d.values[key]!
  return null
}
