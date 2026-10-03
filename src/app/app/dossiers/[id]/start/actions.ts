"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import type { SalarySuggestion } from "@/lib/quick/quick"
import { RateLimitError } from "@/lib/rate-limit"
import { calculateAdvice } from "@/lib/services/advice"
import { audit } from "@/lib/services/audit"
import { DocumentValidationError } from "@/lib/services/documents"
import { NotFoundError } from "@/lib/services/dossiers"
import { applyQuick, extractForQuick, saveQuick } from "@/lib/services/quick"

function message(err: unknown): string {
  if (err instanceof AuthError) return "Je sessie is verlopen. Log opnieuw in."
  if (err instanceof NotFoundError) return "Niet gevonden."
  if (err instanceof RateLimitError) return `Te veel verzoeken. Probeer het over ${Math.ceil(err.retryAfterSeconds / 60)} minuten opnieuw.`
  if (err instanceof DocumentValidationError) return err.message
  console.error("Snelle invoer mislukt:", (err as Error).name)
  return "Er ging iets mis. Probeer het opnieuw."
}

export async function quickExtractAction(
  documentId: string,
  dossierId: string
): Promise<{ ok: true; data: { applicantPosition: number; salary: SalarySuggestion | null; legalForm: string | null } } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId()
    const data = await extractForQuick(userId, documentId)
    await audit({ userId, action: "extract", entityType: "document", entityId: documentId, dossierId })
    revalidatePath(`/app/dossiers/${dossierId}/start`)
    return { ok: true, data }
  } catch (err) {
    revalidatePath(`/app/dossiers/${dossierId}/start`)
    return { ok: false, error: message(err) }
  }
}

export async function saveQuickDraftAction(dossierId: string, data: unknown): Promise<{ ok: boolean }> {
  try {
    const userId = await requireUserId()
    await saveQuick(userId, dossierId, data)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function quickCalculateAction(dossierId: string, data: unknown): Promise<{ ok: false; errors: string[] }> {
  try {
    const userId = await requireUserId()
    const r = await applyQuick(userId, dossierId, data)
    if (!r.ok) return r
    await audit({ userId, action: "save_step", entityType: "dossier", entityId: dossierId, dossierId, meta: { step: "start" } })
    await calculateAdvice(userId, dossierId)
    await audit({ userId, action: "calculate", entityType: "dossier", entityId: dossierId, dossierId })
  } catch (err) {
    return { ok: false, errors: [message(err)] }
  }
  revalidatePath(`/app/dossiers/${dossierId}`, "layout")
  redirect(`/app/dossiers/${dossierId}/advies`)
}
