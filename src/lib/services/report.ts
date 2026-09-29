import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { buildFacts } from "@/lib/advice/facts"
import type { AdviceTexts } from "@/lib/advice/template"
import { generateAdviceTexts } from "@/lib/ai/advice-text"
import { getDb, schema } from "@/lib/db/client"
import type { AdviceOutput } from "@/lib/engine"
import { aiRateLimit, enforceRateLimit, RateLimitError } from "@/lib/rate-limit"
import { templateTexts } from "@/lib/advice/template"

export interface StoredReport {
  texts: AdviceTexts
  source: "llm" | "template"
  model: string | null
  numberCheckPassed: boolean
}

/** Adviesteksten voor een berekening: bestaand rapport of nieuw genereren (en opslaan). */
export async function getOrCreateReport(userId: string, dossierId: string, calculationId: string, output: AdviceOutput): Promise<StoredReport> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(schema.adviceReports)
    .where(and(eq(schema.adviceReports.calculationId, calculationId), eq(schema.adviceReports.userId, userId)))
    .orderBy(desc(schema.adviceReports.createdAt))
    .limit(1)
  if (existing) {
    return {
      texts: existing.texts as unknown as AdviceTexts,
      source: existing.textSource as "llm" | "template",
      model: existing.model,
      numberCheckPassed: existing.numberCheckPassed,
    }
  }
  const facts = buildFacts(output)
  let generated: StoredReport
  try {
    await enforceRateLimit("ai-report", userId, aiRateLimit())
    generated = await generateAdviceTexts(facts)
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err
    generated = { texts: templateTexts(facts), source: "template", model: null, numberCheckPassed: true }
  }
  await db.insert(schema.adviceReports).values({
    dossierId,
    userId,
    calculationId,
    texts: generated.texts as unknown as Record<string, string>,
    textSource: generated.source,
    model: generated.model,
    numberCheckPassed: generated.numberCheckPassed,
  })
  return generated
}
