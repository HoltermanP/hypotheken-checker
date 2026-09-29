import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"
import { deleteObject } from "@/lib/storage"
import { loadIntake } from "./dossiers"

/**
 * AVG-functies: inzage/export (art. 15/20) en verwijdering (art. 17). Alles gefilterd op userId.
 */

export async function exportUserData(userId: string) {
  const db = getDb()
  const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.userId, userId))
  const out = []
  for (const d of dossiers) {
    const [{ intake }, docs, calcs, reports, chat, scenarios] = await Promise.all([
      loadIntake(userId, d.id),
      db.select().from(schema.documents).where(and(eq(schema.documents.dossierId, d.id), eq(schema.documents.userId, userId))),
      db.select().from(schema.calculations).where(and(eq(schema.calculations.dossierId, d.id), eq(schema.calculations.userId, userId))),
      db.select().from(schema.adviceReports).where(and(eq(schema.adviceReports.dossierId, d.id), eq(schema.adviceReports.userId, userId))),
      db.select().from(schema.chatMessages).where(and(eq(schema.chatMessages.dossierId, d.id), eq(schema.chatMessages.userId, userId))),
      db.select().from(schema.scenarios).where(and(eq(schema.scenarios.dossierId, d.id), eq(schema.scenarios.userId, userId))),
    ])
    out.push({
      dossier: { id: d.id, titel: d.title, doel: d.goal, status: d.status, aangemaakt: d.createdAt, bijgewerkt: d.updatedAt },
      intake,
      documenten: docs.map((x) => ({
        id: x.id,
        type: x.type,
        bestandsnaam: x.fileName,
        status: x.status,
        uitgelezen: x.extraction,
        bevestigd: x.confirmedData,
        geupload: x.createdAt,
        wordtVerwijderdOp: x.expiresAt,
      })),
      berekeningen: calcs.map((c) => ({ id: c.id, datum: c.createdAt, engineVersie: c.engineVersion, normVersie: c.normSetVersion, uitkomst: c.output })),
      rapportteksten: reports.map((r) => ({ datum: r.createdAt, bron: r.textSource, teksten: r.texts })),
      scenarios: scenarios.map((s) => ({ naam: s.name, instellingen: s.overrides })),
      chat: chat.map((m) => ({ rol: m.role, tekst: m.content, datum: m.createdAt })),
    })
  }
  const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.userId, userId))
  return {
    toelichting:
      "Export van al je gegevens bij HypotheekCheck NL (AVG art. 15 en 20). De originele documentbestanden kun je zelf downloaden in het dossier zolang ze bewaard worden.",
    geexporteerdOp: new Date().toISOString(),
    gebruiker: { id: userId },
    dossiers: out,
    auditLog: audit.map((a) => ({ actie: a.action, object: a.entityType, datum: a.at })),
  }
}

async function deleteBlobs(rows: { blobUrl: string }[]) {
  for (const r of rows) {
    try {
      await deleteObject(r.blobUrl)
    } catch (err) {
      console.error("Blob verwijderen mislukt:", (err as Error).message)
    }
  }
}

/** Verwijder één dossier inclusief documenten (bestanden) en alle afgeleide gegevens. */
export async function deleteDossierCompletely(userId: string, dossierId: string) {
  const db = getDb()
  const docs = await db
    .select({ blobUrl: schema.documents.blobUrl })
    .from(schema.documents)
    .where(and(eq(schema.documents.dossierId, dossierId), eq(schema.documents.userId, userId)))
  await deleteBlobs(docs)
  // Alle gekoppelde tabellen hebben ON DELETE CASCADE op dossier_id.
  await db.delete(schema.dossiers).where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
}

/** Verwijder alle gegevens van de gebruiker. De audit-log wordt geanonimiseerd. */
export async function deleteAllUserData(userId: string) {
  const db = getDb()
  const docs = await db.select({ blobUrl: schema.documents.blobUrl }).from(schema.documents).where(eq(schema.documents.userId, userId))
  await deleteBlobs(docs)
  await db.delete(schema.dossiers).where(eq(schema.dossiers.userId, userId))
  await db.delete(schema.users).where(eq(schema.users.id, userId))
  await db.update(schema.auditLog).set({ userId: null }).where(eq(schema.auditLog.userId, userId))
}
