import { Calculator } from "lucide-react"
import { Disclaimer } from "@/components/disclaimer"
import { CalculateButton } from "@/components/intake/calculate-button"
import { WhatIf } from "@/components/what-if/what-if"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { latestCalculation } from "@/lib/services/advice"
import { getEngineContext } from "@/lib/services/reference-data"

export const metadata = { title: "Wat als" }

export default async function WhatIfPage({ params }: PageProps<"/app/dossiers/[id]/wat-als">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const calc = await latestCalculation(userId, id)
  if (!calc) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <Calculator aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Bereken eerst je advies</p>
        <CalculateButton dossierId={id} />
      </div>
    )
  }
  const ctx = await getEngineContext()
  // Alleen de rentes die de wat-als-modus nodig heeft (kleinere pagina).
  const rates = ctx.rates.filter((r) => r.fixedYears === calc.input.preferences.fixedRateYears)
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Schuif met de knoppen en zie direct wat er verandert. De berekening gebeurt in je browser met dezelfde rekenkern en normen als je rapport.
      </p>
      <WhatIf input={calc.input} ctx={{ ...ctx, rates }} />
      <Disclaimer />
    </div>
  )
}
