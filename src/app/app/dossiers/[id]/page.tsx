import { redirect } from "next/navigation"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { getOwnedDossier } from "@/lib/services/dossiers"

export default async function DossierIndex({ params }: PageProps<"/app/dossiers/[id]">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const d = await getOwnedDossier(userId, id)
  redirect(d.status === "advice" ? `/app/dossiers/${id}/advies` : `/app/dossiers/${id}/intake/${d.currentStep}`)
}
