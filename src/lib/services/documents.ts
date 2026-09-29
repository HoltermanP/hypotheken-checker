import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"

/**
 * Documentenservice (uitgebreid in fase 5). Alle queries gefilterd op userId.
 */

export interface DossierDocumentChecks {
  checks: { label: string; status: "green" | "orange" | "red"; detail: string }[]
  confirmedTypes: string[]
}

export async function documentChecksForDossier(userId: string, dossierId: string): Promise<DossierDocumentChecks> {
  const docs = await getDb()
    .select({ type: schema.documents.type, status: schema.documents.status })
    .from(schema.documents)
    .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId)))
  const confirmedTypes = [...new Set(docs.filter((d) => d.status === "confirmed").map((d) => d.type))]
  return { checks: [], confirmedTypes }
}
