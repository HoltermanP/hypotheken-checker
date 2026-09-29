import { Calculator } from "lucide-react"
import { Disclaimer } from "@/components/disclaimer"
import { CalculateButton } from "@/components/intake/calculate-button"
import { LendersView } from "@/components/advice/lenders-view"
import { ScenariosView } from "@/components/advice/scenarios-view"
import { StressView } from "@/components/advice/stress-view"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { formatDate, formatEuro } from "@/lib/format"
import { latestCalculation } from "@/lib/services/advice"
import { computeScenarios, getScenarioDefinitions } from "@/lib/services/scenarios"

export const metadata = { title: "Advies" }

export default async function AdvicePage({ params }: PageProps<"/app/dossiers/[id]/advies">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const calc = await latestCalculation(userId, id)
  if (!calc) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <Calculator aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Nog geen advies berekend</p>
        <p className="text-sm text-muted-foreground">Vul de intake in en bereken je advies.</p>
        <CalculateButton dossierId={id} />
      </div>
    )
  }
  const out = calc.output
  const [scenarioResults, { defs }] = await Promise.all([
    computeScenarios(userId, id).catch(() => []),
    getScenarioDefinitions(userId, id).catch(() => ({ defs: [] })),
  ])
  const isDga = calc.input.applicants.some((a) => a.businesses.some((b) => b.bv))
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Berekend op {formatDate(calc.createdAt)} · rekenkern {out.engineVersion} · normen {out.normSetVersion}
        </p>
        <CalculateButton dossierId={id} />
      </div>
      <Disclaimer />
      <section aria-labelledby="samenvatting" className="space-y-2">
        <h2 id="samenvatting" className="text-xl font-semibold">Samenvatting</h2>
        <dl className="grid gap-4 sm:grid-cols-4">
          {[
            ["Maximale hypotheek", formatEuro(out.summary.maxMortgage)],
            ["Verstandig om te lenen", formatEuro(out.summary.prudentLoan)],
            ["Bruto maandlast", formatEuro(out.summary.grossMonthly)],
            ["Netto maandlast", formatEuro(out.summary.netMonthly)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-4">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="scenarios" className="space-y-3">
        <h2 id="scenarios" className="text-xl font-semibold">Scenariovergelijking</h2>
        <ScenariosView dossierId={id} results={scenarioResults} defs={defs} isDga={isDga} isMover={calc.input.goal === "doorstromer"} />
      </section>
      <section aria-labelledby="banken" className="space-y-3">
        <h2 id="banken" className="text-xl font-semibold">Bankadvies</h2>
        <LendersView comparison={out.lenders} loanAmount={out.loan.amount} />
      </section>
      <section aria-labelledby="risico" className="space-y-3">
        <h2 id="risico" className="text-xl font-semibold">Risicoanalyse</h2>
        <StressView results={out.stress} />
      </section>
    </div>
  )
}
