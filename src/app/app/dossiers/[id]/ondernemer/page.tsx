import { Briefcase } from "lucide-react"
import { Disclaimer } from "@/components/disclaimer"
import { FinancialsWorkbench } from "@/components/entrepreneur/financials-workbench"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { loadFinancials } from "@/lib/services/entrepreneur-financials"
import { getActiveNormSet, getLenders } from "@/lib/services/reference-data"
import { isLocalStorage } from "@/lib/storage"

export const metadata = { title: "Inkomenstoets ondernemer" }

export default async function EntrepreneurIncomePage({ params }: PageProps<"/app/dossiers/[id]/ondernemer">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const [{ docs, applicants }, lenders, norms] = await Promise.all([loadFinancials(userId, id), getLenders(), getActiveNormSet()])
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-xl border p-4 text-sm">
        <Briefcase aria-hidden className="size-5 shrink-0 text-primary" />
        <p>
          Bepaal je toetsinkomen als ondernemer vanuit je jaarcijfers. Voor een BV (met holding) kijken we naar je salaris plus je deel van de winst die de BV verantwoord kan uitkeren: gemiddelde winst zonder incidentele posten, begrensd door solvabiliteit, liquiditeit en vrije reserves. Bestanden worden privé bewaard en automatisch verwijderd; we nemen niets over zonder jouw bevestiging.
        </p>
      </div>
      <FinancialsWorkbench
        dossierId={id}
        applicants={applicants.map((a) => ({ position: a.position, name: a.name, businesses: a.businesses, merged: a.merged }))}
        docs={docs}
        lenders={lenders.filter((l) => l.active).map((l) => ({ slug: l.slug, name: l.name, policy: l.entrepreneur }))}
        gebruikelijkLoon={norms.values.ondernemer.gebruikelijkLoon}
        local={isLocalStorage()}
      />
      <Disclaimer />
    </div>
  )
}
