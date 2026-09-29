import "server-only"
import { getDb, schema } from "@/lib/db/client"

/**
 * Audit-log: wie heeft wat bekeken of gewijzigd. Nooit persoonsgegevens in `meta` — alleen id's,
 * aantallen en statussen.
 */
export async function audit(entry: {
  userId: string | null
  action: string
  entityType: string
  entityId?: string | null
  dossierId?: string | null
  meta?: Record<string, string | number | boolean | null>
}): Promise<void> {
  try {
    await getDb()
      .insert(schema.auditLog)
      .values({
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        dossierId: entry.dossierId ?? null,
        meta: entry.meta ?? null,
      })
  } catch (err) {
    // Audit mag de gebruikersactie niet blokkeren; wel loggen (zonder PII).
    console.error("Audit-log schrijven mislukt:", (err as Error).message)
  }
}
