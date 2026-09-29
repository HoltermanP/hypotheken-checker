"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { requireUserId } from "@/lib/auth"
import { GOALS } from "@/lib/intake/schema"
import { audit } from "@/lib/services/audit"
import { createDossier } from "@/lib/services/dossiers"

const TITLES: Record<(typeof GOALS)[number], string> = {
  starter: "Eerste woning",
  doorstromer: "Verhuizen",
  oversluiten: "Oversluiten",
  verhogen: "Hypotheek verhogen",
  verkopen: "Woning verkopen",
  orientatie: "Oriëntatie",
}

export async function createDossierAction(form: FormData) {
  const userId = await requireUserId()
  const goal = z.enum(GOALS).catch("orientatie").parse(form.get("goal"))
  const d = await createDossier(userId, goal, TITLES[goal])
  await audit({ userId, action: "create", entityType: "dossier", entityId: d.id, dossierId: d.id, meta: { goal } })
  redirect(`/app/dossiers/${d.id}/intake/persoonlijk`)
}
