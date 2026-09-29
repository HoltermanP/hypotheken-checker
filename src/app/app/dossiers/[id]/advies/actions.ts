"use server"

import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import { audit } from "@/lib/services/audit"
import { saveScenarioDefinitions } from "@/lib/services/scenarios"

export async function saveScenariosAction(dossierId: string, defs: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireUserId()
    await saveScenarioDefinitions(userId, dossierId, defs)
    await audit({ userId, action: "save_scenarios", entityType: "dossier", entityId: dossierId, dossierId })
    revalidatePath(`/app/dossiers/${dossierId}/advies`)
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Je sessie is verlopen." }
    return { ok: false, error: "Scenario's opslaan is niet gelukt. Controleer de invoer." }
  }
}
