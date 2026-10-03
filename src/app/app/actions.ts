"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { requireUserId } from "@/lib/auth"
import { GOAL_TITLES } from "@/lib/intake/goals"
import { GOALS } from "@/lib/intake/schema"
import { audit } from "@/lib/services/audit"
import { createDossier } from "@/lib/services/dossiers"

export async function createDossierAction(form: FormData) {
  const userId = await requireUserId()
  const goal = z.enum(GOALS).catch("orientatie").parse(form.get("goal"))
  const d = await createDossier(userId, goal, GOAL_TITLES[goal])
  await audit({ userId, action: "create", entityType: "dossier", entityId: d.id, dossierId: d.id, meta: { goal } })
  redirect(`/app/dossiers/${d.id}/start`)
}
