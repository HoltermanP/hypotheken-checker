"use server"

import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import type { StepKey } from "@/lib/intake/schema"
import { nextStep } from "@/lib/intake/steps"
import { audit } from "@/lib/services/audit"
import { loadIntake, NotFoundError, saveDraft, saveStep, skipStep } from "@/lib/services/dossiers"

export type StepActionResult = { ok: true; next: StepKey | null } | { ok: false; errors: string[] }

function fail(err: unknown): { ok: false; errors: string[] } {
  if (err instanceof AuthError) return { ok: false, errors: ["Je sessie is verlopen. Log opnieuw in."] }
  if (err instanceof NotFoundError) return { ok: false, errors: ["Dossier niet gevonden."] }
  console.error("Intake opslaan mislukt:", (err as Error).message)
  return { ok: false, errors: ["Opslaan is niet gelukt. Probeer het opnieuw."] }
}

export async function saveStepAction(dossierId: string, step: Exclude<StepKey, "overzicht">, data: unknown): Promise<StepActionResult> {
  try {
    const userId = await requireUserId()
    const r = await saveStep(userId, dossierId, step, data)
    if (!r.ok) return r
    await audit({ userId, action: "save_step", entityType: "dossier", entityId: dossierId, dossierId, meta: { step } })
    const { intake } = await loadIntake(userId, dossierId)
    revalidatePath(`/app/dossiers/${dossierId}`)
    return { ok: true, next: nextStep(intake, step) }
  } catch (err) {
    return fail(err)
  }
}

export async function saveDraftAction(dossierId: string, step: StepKey, data: unknown): Promise<{ ok: boolean }> {
  try {
    const userId = await requireUserId()
    await saveDraft(userId, dossierId, step, data)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function skipStepAction(dossierId: string, step: StepKey): Promise<StepActionResult> {
  try {
    const userId = await requireUserId()
    await skipStep(userId, dossierId, step)
    const { intake } = await loadIntake(userId, dossierId)
    return { ok: true, next: nextStep(intake, step) }
  } catch (err) {
    return fail(err)
  }
}

export async function calculateAction(dossierId: string): Promise<{ ok: false; errors: string[] } | never> {
  const { calculateAdvice } = await import("@/lib/services/advice")
  const { IntakeIncompleteError } = await import("@/lib/intake/to-engine")
  const { redirect } = await import("next/navigation")
  let ok = false
  try {
    const userId = await requireUserId()
    await calculateAdvice(userId, dossierId)
    await audit({ userId, action: "calculate", entityType: "dossier", entityId: dossierId, dossierId })
    ok = true
  } catch (err) {
    if (err instanceof IntakeIncompleteError) return { ok: false, errors: [`Vul eerst deze stappen in: ${err.missing.join(", ")}`] }
    return fail(err)
  }
  if (ok) redirect(`/app/dossiers/${dossierId}/advies`)
  return { ok: false, errors: ["Onbekende fout"] }
}
