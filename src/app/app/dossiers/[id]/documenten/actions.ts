"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import type { FieldValue } from "@/lib/documents/extraction"
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/documents/types"
import { RateLimitError } from "@/lib/rate-limit"
import { audit } from "@/lib/services/audit"
import {
  confirmDocument,
  deleteDocument,
  DocumentValidationError,
  documentPathPrefix,
  registerDocument,
  runExtraction,
  signedDownloadUrl,
} from "@/lib/services/documents"
import { getOwnedDossier, NotFoundError } from "@/lib/services/dossiers"
import { putLocal, isLocalStorage } from "@/lib/storage"

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: "Je sessie is verlopen. Log opnieuw in." }
  if (err instanceof NotFoundError) return { ok: false, error: "Niet gevonden." }
  if (err instanceof RateLimitError) return { ok: false, error: `Te veel verzoeken. Probeer het over ${Math.ceil(err.retryAfterSeconds / 60)} minuten opnieuw.` }
  if (err instanceof DocumentValidationError) return { ok: false, error: err.message }
  console.error("Documentactie mislukt:", (err as Error).name)
  return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." }
}

export async function registerUploadAction(input: {
  dossierId: string
  type: string
  applicantPosition: number | null
  pathname: string
  url: string
  contentType: string
  size: number
  fileName: string
}): Promise<Result<{ id: string }>> {
  try {
    const userId = await requireUserId()
    const id = await registerDocument(userId, input)
    await audit({ userId, action: "upload", entityType: "document", entityId: id, dossierId: input.dossierId, meta: { type: input.type } })
    revalidatePath(`/app/dossiers/${input.dossierId}/documenten`)
    return { ok: true, data: { id } }
  } catch (err) {
    return fail(err)
  }
}

/** Alleen lokaal (zonder Blob-token): upload via de server naar .uploads/. */
export async function localUploadAction(form: FormData): Promise<Result<{ id: string }>> {
  try {
    if (!isLocalStorage()) return { ok: false, error: "Niet beschikbaar." }
    const userId = await requireUserId()
    const dossierId = String(form.get("dossierId"))
    await getOwnedDossier(userId, dossierId)
    const file = form.get("file")
    if (!(file instanceof File)) return { ok: false, error: "Geen bestand." }
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: "Alleen PDF, JPG, PNG of WebP." }
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Bestand is te groot (max. 20 MB)." }
    const pathname = `${documentPathPrefix(dossierId)}${randomUUID()}`
    const stored = await putLocal(pathname, Buffer.from(await file.arrayBuffer()))
    const pos = form.get("applicantPosition")
    const id = await registerDocument(userId, {
      dossierId,
      type: String(form.get("type")),
      applicantPosition: pos ? Number(pos) : null,
      pathname: stored.pathname,
      url: stored.url,
      contentType: file.type,
      size: file.size,
      fileName: file.name,
    })
    revalidatePath(`/app/dossiers/${dossierId}/documenten`)
    return { ok: true, data: { id } }
  } catch (err) {
    return fail(err)
  }
}

export async function extractAction(documentId: string, dossierId: string): Promise<Result> {
  try {
    const userId = await requireUserId()
    await runExtraction(userId, documentId)
    await audit({ userId, action: "extract", entityType: "document", entityId: documentId, dossierId })
    revalidatePath(`/app/dossiers/${dossierId}/documenten`)
    return { ok: true, data: null }
  } catch (err) {
    revalidatePath(`/app/dossiers/${dossierId}/documenten`)
    return fail(err)
  }
}

export async function confirmAction(
  documentId: string,
  dossierId: string,
  values: Record<string, FieldValue>,
  apply: boolean
): Promise<Result<{ summary: string[]; errors: string[] }>> {
  try {
    const userId = await requireUserId()
    const r = await confirmDocument(userId, documentId, values, apply)
    await audit({ userId, action: "confirm", entityType: "document", entityId: documentId, dossierId, meta: { apply } })
    revalidatePath(`/app/dossiers/${dossierId}`, "layout")
    return { ok: true, data: r }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteDocumentAction(documentId: string, dossierId: string): Promise<Result> {
  try {
    const userId = await requireUserId()
    await deleteDocument(userId, documentId)
    await audit({ userId, action: "delete", entityType: "document", entityId: documentId, dossierId })
    revalidatePath(`/app/dossiers/${dossierId}/documenten`)
    return { ok: true, data: null }
  } catch (err) {
    return fail(err)
  }
}

export async function downloadUrlAction(documentId: string): Promise<Result<{ url: string }>> {
  try {
    const userId = await requireUserId()
    return { ok: true, data: { url: await signedDownloadUrl(userId, documentId) } }
  } catch (err) {
    return fail(err)
  }
}
