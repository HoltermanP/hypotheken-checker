"use server"

import { clerkClient } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isE2ETestMode } from "@/env"
import { requireUserId } from "@/lib/auth"
import { deleteAllUserData, deleteDossierCompletely } from "@/lib/services/account"
import { audit } from "@/lib/services/audit"
import { getOwnedDossier } from "@/lib/services/dossiers"

export async function deleteDossierAction(form: FormData) {
  const userId = await requireUserId()
  const dossierId = String(form.get("dossierId") ?? "")
  await getOwnedDossier(userId, dossierId)
  if (form.get("confirm") !== "on") redirect(`/app/dossiers/${dossierId}/intake/overzicht?verwijderen=bevestigen`)
  await deleteDossierCompletely(userId, dossierId)
  await audit({ userId, action: "delete", entityType: "dossier", entityId: dossierId })
  redirect("/app?verwijderd=1")
}

export async function deleteAccountAction(form: FormData) {
  const userId = await requireUserId()
  if (String(form.get("confirmText") ?? "").trim().toUpperCase() !== "VERWIJDEREN") {
    redirect("/app/account?fout=bevestiging")
  }
  await audit({ userId, action: "delete", entityType: "account" })
  await deleteAllUserData(userId)
  if (isE2ETestMode()) {
    const jar = await cookies()
    jar.delete("e2e_user")
    jar.delete("e2e_role")
  } else {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  }
  redirect("/?account=verwijderd")
}
