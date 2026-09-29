import { Suspense } from "react"
import { Calculator, FileDown } from "lucide-react"
import { Disclaimer } from "@/components/disclaimer"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { CalculateButton } from "@/components/intake/calculate-button"
import { AdviceCharts } from "@/components/advice/charts"
import { AdviceText } from "@/components/advice/advice-text"
import { LendersView } from "@/components/advice/lenders-view"
import { ScenariosView } from "@/components/advice/scenarios-view"
import { StressView } from "@/components/advice/stress-view"
import {
  AssumptionsSection,
  BudgetSection,
  ChecksSection,
  EntrepreneurSection,
  EquityReleaseSection,
  FinancingSection,
  MaxMortgageSection,
  NextStepsSection,
  Section,
} from "@/components/advice/sections"
import { chartRows } from "@/lib/advice/chart-rows"
import { nextSteps } from "@/lib/advice/next-steps"
import type { AdviceTexts } from "@/lib/advice/template"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { formatDate, formatEuro } from "@/lib/format"
import { latestCalculation } from "@/lib/services/advice"
import { confirmedDocumentValue } from "@/lib/services/documents"
import { getOrCreateReport, type StoredReport } from "@/lib/services/report"
import { computeScenarios, getScenarioDefinitions } from "@/lib/services/scenarios"
import { getActiveNormSet } from "@/lib/services/reference-data"

export const metadata = { title: "Advies" }

async function AiText({ report, section }: { report: Promise<StoredReport>; section: keyof AdviceTexts }) {
  return <AdviceText report={await report} section={section} />
}

function Lazy({ report, section }: { report: Promise<StoredReport>; section: keyof AdviceTexts }) {
  return (
    <Suspense fallback={<Skeleton className="h-20 w-full" aria-label="Toelichting wordt geschreven" />}>
      <AiText report={report} section={section} />
    </Suspense>
  )
}

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
  const report = getOrCreateReport(userId, id, calc.id, out)
  const [scenarioResults, { defs }, deadline, norms] = await Promise.all([
    computeScenarios(userId, id).catch(() => []),
    getScenarioDefinitions(userId, id).catch(() => ({ defs: [] })),
    confirmedDocumentValue(userId, id, "koopovereenkomst", "datum_financieringsvoorbehoud").catch(() => null),
    getActiveNormSet(),
  ])
  const steps = nextSteps(calc.input, {
    financingDeadline: typeof deadline === "string" ? deadline : null,
    guaranteePct: norms.values.costs.bankgarantieGuaranteePctOfPrice,
  })
  const isDga = calc.input.applicants.some((a) => a.businesses.some((b) => b.bv))
  const unverified = out.assumptions.filter((a) => a.status !== "verified").length
  const nav = [
    ["samenvatting", "Samenvatting"],
    ["maximaal", "Maximale hypotheek"],
    ["financiering", "Financiering"],
    ["scenarios", "Scenario's"],
    ["grafieken", "Grafieken"],
    ["banken", "Bankadvies"],
    ["risico", "Risico's"],
    ...(out.equityRelease ? [["overwaarde", "Overwaarde"]] : []),
    ...(out.entrepreneur ? [["ondernemer", "Ondernemer"]] : []),
    ["stappen", "Vervolgstappen"],
    ["controles", "Gecheckt op"],
    ["bronnen", "Aannames en bronnen"],
  ]
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Berekend op {formatDate(calc.createdAt)} · rekenkern {out.engineVersion} · normen {out.normSetVersion}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/dossiers/${id}/pdf`} className={buttonVariants({ variant: "outline" })} data-testid="pdf-link">
            <FileDown aria-hidden /> Download PDF
          </a>
          <CalculateButton dossierId={id} />
        </div>
      </div>
      <Disclaimer />
      <nav aria-label="Onderdelen van het rapport" className="flex flex-wrap gap-2 text-sm">
        {nav.map(([k, label]) => (
          <a key={k} href={`#sectie-${k}`} className="rounded-full border px-3 py-1 hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>
      <Section id="samenvatting" title="Samenvatting">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Maximale hypotheek", formatEuro(out.summary.maxMortgage)],
            ["Verstandig om te lenen", formatEuro(out.summary.prudentLoan)],
            ["Bruto maandlast", formatEuro(out.summary.grossMonthly)],
            ["Netto maandlast", formatEuro(out.summary.netMonthly)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-4">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="text-2xl font-semibold tabular-nums" data-testid={`kpi-${k}`}>{v}</dd>
            </div>
          ))}
        </dl>
        {out.warnings.map((w) => (
          <p key={w} className="text-sm text-amber-800 dark:text-amber-300">{w}</p>
        ))}
        <Lazy report={report} section="samenvatting" />
      </Section>
      <Section id="maximaal" title="Maximale hypotheek">
        <Lazy report={report} section="maximaleHypotheek" />
        <MaxMortgageSection out={out} />
      </Section>
      <Section id="financiering" title="Financieringsopzet en betaalbaarheid">
        <Lazy report={report} section="financiering" />
        <FinancingSection out={out} />
        <BudgetSection out={out} />
      </Section>
      <Section id="scenarios" title="Scenariovergelijking">
        <ScenariosView dossierId={id} results={scenarioResults} defs={defs} isDga={isDga} isMover={calc.input.goal === "doorstromer"} />
      </Section>
      <Section id="grafieken" title="Grafieken">
        <AdviceCharts rows={chartRows(out)} />
      </Section>
      <Section id="banken" title="Bankadvies">
        <Lazy report={report} section="bankadvies" />
        <LendersView comparison={out.lenders} loanAmount={out.loan.amount} />
      </Section>
      <Section id="risico" title="Risicoanalyse">
        <Lazy report={report} section="risico" />
        <StressView results={out.stress} />
      </Section>
      {out.equityRelease ? (
        <Section id="overwaarde" title="Overwaarde benutten">
          <Lazy report={report} section="overwaarde" />
          <EquityReleaseSection out={out} />
        </Section>
      ) : null}
      {out.entrepreneur ? (
        <Section id="ondernemer" title="Ondernemers">
          <Lazy report={report} section="ondernemer" />
          <EntrepreneurSection out={out} />
        </Section>
      ) : null}
      <Section id="stappen" title="Checklist en tijdlijn">
        <NextStepsSection steps={steps} />
      </Section>
      <Section id="controles" title="Gecheckt op">
        <ChecksSection out={out} />
      </Section>
      <Section
        id="bronnen"
        title="Aannames en bronnen"
        intro={
          unverified > 0 ? (
            <p>
              {unverified} gebruikte parameter(s) zijn nog niet geverifieerd bij de primaire bron. Ze zijn hieronder gemarkeerd als &quot;te verifiëren&quot;.
            </p>
          ) : (
            <p>Alle gebruikte parameters zijn geverifieerd bij de primaire bron.</p>
          )
        }
      >
        <AssumptionsSection assumptions={out.assumptions} />
      </Section>
      <Disclaimer />
    </div>
  )
}
