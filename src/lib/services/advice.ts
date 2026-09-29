import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { sha256 } from "@/lib/crypto"
import { getDb, schema } from "@/lib/db/client"
import { ENGINE_VERSION, estimateReferenceRate, runAdvice, type AdviceOutput } from "@/lib/engine"
import type { EngineInput } from "@/lib/engine/types"
import { intakeToEngineInput } from "@/lib/intake/to-engine"
import { documentChecksForDossier } from "./documents"
import { loadIntake, setDossierStatus } from "./dossiers"
import { getEngineContext } from "./reference-data"

/**
 * Berekeningsservice: bouwt de engine-invoer uit de intake (+ bevestigde documenten), rekent
 * deterministisch en slaat de uitkomst op met input-hash, engineversie en normversie. Een
 * ongewijzigde invoer hergebruikt de vorige berekening.
 */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Stabiele JSON (gesorteerde sleutels) voor de input-hash. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export async function buildEngineInput(userId: string, dossierId: string): Promise<{ input: EngineInput; ctx: Awaited<ReturnType<typeof getEngineContext>> }> {
  const [{ intake, skipped }, ctx, docs] = await Promise.all([
    loadIntake(userId, dossierId),
    getEngineContext(),
    documentChecksForDossier(userId, dossierId),
  ])
  const draft = intakeToEngineInput(intake, {
    calculationDate: todayIso(),
    referenceRatePct: 4.5,
    skipped,
    documentChecks: docs.checks,
    confirmedDocTypes: docs.confirmedTypes,
  })
  const input = { ...draft, referenceRatePct: estimateReferenceRate(draft, ctx) }
  return { input, ctx }
}

export async function calculateAdvice(userId: string, dossierId: string): Promise<{ calculationId: string; output: AdviceOutput }> {
  const { input, ctx } = await buildEngineInput(userId, dossierId)
  const inputHash = sha256(stableStringify(input))
  const db = getDb()
  const [existing] = await db
    .select()
    .from(schema.calculations)
    .where(
      and(
        eq(schema.calculations.dossierId, dossierId),
        eq(schema.calculations.userId, userId),
        eq(schema.calculations.inputHash, inputHash),
        eq(schema.calculations.engineVersion, ENGINE_VERSION),
        eq(schema.calculations.normSetVersion, ctx.norms.version)
      )
    )
    .orderBy(desc(schema.calculations.createdAt))
    .limit(1)
  if (existing) return { calculationId: existing.id, output: existing.output as unknown as AdviceOutput }
  const output = runAdvice(input, ctx)
  const [row] = await db
    .insert(schema.calculations)
    .values({
      dossierId,
      userId,
      inputHash,
      engineVersion: ENGINE_VERSION,
      normSetVersion: ctx.norms.version,
      output: { ...output, input } as unknown as Record<string, unknown>,
    })
    .returning({ id: schema.calculations.id })
  await setDossierStatus(userId, dossierId, "advice")
  return { calculationId: row!.id, output }
}

export async function latestCalculation(userId: string, dossierId: string) {
  const [row] = await getDb()
    .select()
    .from(schema.calculations)
    .where(and(eq(schema.calculations.dossierId, dossierId), eq(schema.calculations.userId, userId)))
    .orderBy(desc(schema.calculations.createdAt))
    .limit(1)
  if (!row) return null
  const stored = row.output as unknown as AdviceOutput & { input: EngineInput }
  return { id: row.id, createdAt: row.createdAt, output: stored, input: stored.input }
}
