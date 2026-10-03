import Link from "next/link"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Disclaimer } from "@/components/disclaimer"
import { QuickStart } from "@/components/quick/quick-start"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { NotFoundError } from "@/lib/services/dossiers"
import { retentionDays } from "@/lib/services/documents"
import { loadQuick } from "@/lib/services/quick"
import { getActiveNormSet, getLenders } from "@/lib/services/reference-data"
import { isLocalStorage } from "@/lib/storage"

export const metadata = { title: "Start" }

export default async function QuickStartPage({ params }: PageProps<"/app/dossiers/[id]/start">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const [lenders, norms] = await Promise.all([getLenders(), getActiveNormSet()])
  let data
  try {
    data = await loadQuick(userId, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload je loonstroken en (als je ondernemer bent) je jaarcijfers, vul aan wat we niet uit je documenten halen en klik op Bereken. De rest vullen we in met gangbare
        standaardwaarden; die zie je terug in het advies.
      </p>
      <QuickStart
        dossierId={id}
        defaults={data.defaults}
        docs={data.docs}
        financials={data.financials}
        calcYear={data.calcYear}
        local={isLocalStorage()}
        lenders={lenders.filter((l) => l.active).map((l) => ({ slug: l.slug, name: l.name, policy: l.entrepreneur }))}
        gebruikelijkLoon={norms.values.ondernemer.gebruikelijkLoon}
      />
      <div className="flex gap-3 rounded-xl border p-4 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-primary" />
        <p>
          Documenten worden versleuteld bewaard en na {retentionDays()} dagen automatisch verwijderd. Een BSN slaan we nooit op. Meer details invullen, zoals kinderen,
          verzekeringen of een tweede baan? Gebruik de{" "}
          <Link href={`/app/dossiers/${id}/intake`} className="underline">
            uitgebreide intake
          </Link>{" "}
          of bekijk{" "}
          <Link href={`/app/dossiers/${id}/documenten`} className="underline">
            alle documenten
          </Link>
          .
        </p>
      </div>
      <Disclaimer />
    </div>
  )
}
