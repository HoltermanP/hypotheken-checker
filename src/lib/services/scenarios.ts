import "server-only"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb, schema } from "@/lib/db/client"
import { runScenarios, suggestScenarios, type ScenarioDefinition, type ScenarioSummary } from "@/lib/engine"
import { buildEngineInput } from "./advice"
import { getOwnedDossier } from "./dossiers"

/**
 * Scenario's per dossier (max. 4). Zonder opgeslagen scenario's gebruiken we voorstellen van de
 * engine op basis van het profiel.
 */

export const overridesSchema = z
  .object({
    nhg: z.enum(["yes", "no"]).optional(),
    fixedRateYears: z.number().int().min(1).max(30).optional(),
    ownFunds: z.union([z.enum(["all", "none"]), z.number().min(0)]).optional(),
    moveOrder: z.enum(["buy_first", "sell_first"]).optional(),
    ownBv: z.boolean().optional(),
    salaryIncrease: z.number().min(0).max(500000).optional(),
    purchasePrice: z.number().min(0).optional(),
    salePrice: z.number().min(0).optional(),
    ratePct: z.number().min(0).max(15).optional(),
    termMonths: z.number().int().min(60).max(360).optional(),
    repaymentType: z.enum(["annuity", "linear", "mixed"]).optional(),
  })
  .strict()

export const scenarioDefsSchema = z
  .array(z.object({ id: z.string().min(1).max(40), name: z.string().trim().min(1).max(60), overrides: overridesSchema }))
  .min(1)
  .max(4)

export async function getScenarioDefinitions(userId: string, dossierId: string): Promise<{ defs: ScenarioDefinition[]; saved: boolean }> {
  await getOwnedDossier(userId, dossierId)
  const rows = await getDb()
    .select()
    .from(schema.scenarios)
    .where(and(eq(schema.scenarios.dossierId, dossierId), eq(schema.scenarios.userId, userId)))
    .orderBy(asc(schema.scenarios.position))
  if (rows.length > 0) {
    return { defs: rows.map((r) => ({ id: r.id, name: r.name, overrides: r.overrides as ScenarioDefinition["overrides"] })), saved: true }
  }
  const { input } = await buildEngineInput(userId, dossierId)
  return { defs: suggestScenarios(input), saved: false }
}

export async function saveScenarioDefinitions(userId: string, dossierId: string, raw: unknown) {
  await getOwnedDossier(userId, dossierId)
  const defs = scenarioDefsSchema.parse(raw)
  const db = getDb()
  await db.delete(schema.scenarios).where(and(eq(schema.scenarios.dossierId, dossierId), eq(schema.scenarios.userId, userId)))
  await db.insert(schema.scenarios).values(defs.map((d, position) => ({ dossierId, userId, name: d.name, position, overrides: d.overrides })))
}

export async function computeScenarios(userId: string, dossierId: string): Promise<ScenarioSummary[]> {
  const [{ defs }, { input, ctx }] = await Promise.all([getScenarioDefinitions(userId, dossierId), buildEngineInput(userId, dossierId)])
  return runScenarios(input, defs, ctx)
}
