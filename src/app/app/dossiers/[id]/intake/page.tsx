import { redirect } from "next/navigation"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { getOwnedDossier } from "@/lib/services/dossiers"

export default async function IntakeIndex({ params }: PageProps<"/app/dossiers/[id]/intake">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const d = await getOwnedDossier(userId, id)
  redirect(`/app/dossiers/${id}/intake/${d.currentStep || "doel"}`)
}
