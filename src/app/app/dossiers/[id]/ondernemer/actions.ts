"use server"

import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import { RateLimitError } from "@/lib/rate-limit"
import { audit } from "@/lib/services/audit"
import { DocumentValidationError } from "@/lib/services/documents"
import { NotFoundError } from "@/lib/services/dossiers"
import { applyFinancials } from "@/lib/services/entrepreneur-financials"

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export async function applyFinancialsAction(input: {
  dossierId: string
  applicantPosition: number
  businessId: string | null
  merged: unknown
}): Promise<Result<{ summary: string[]; errors: string[] }>> {
  try {
    const userId = await requireUserId()
    const r = await applyFinancials(userId, input.dossierId, input)
    await audit({ userId, action: "apply_financials", entityType: "dossier", entityId: input.dossierId, dossierId: input.dossierId })
    revalidatePath(`/app/dossiers/${input.dossierId}`, "layout")
    return { ok: true, data: r }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Je sessie is verlopen. Log opnieuw in." }
    if (err instanceof NotFoundError) return { ok: false, error: "Niet gevonden." }
    if (err instanceof RateLimitError) return { ok: false, error: "Te veel verzoeken. Probeer het later opnieuw." }
    if (err instanceof DocumentValidationError) return { ok: false, error: err.message }
    console.error("Jaarcijfers overnemen mislukt:", (err as Error).name)
    return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." }
  }
}
