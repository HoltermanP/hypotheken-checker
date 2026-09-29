import type { AdviceOutput } from "@/lib/engine"

/**
 * Compacte, afgeronde feiten uit de engine-uitvoer. Dit is de ENIGE invoer voor het LLM en ook de
 * referentie voor de anti-hallucinatiecheck. Bedragen op hele euro's, percentages op 2 decimalen.
 */

const eur = (n: number) => Math.round(n)
const pct = (n: number) => Math.round(n * 100) / 100

export type AdviceFacts = ReturnType<typeof buildFacts>

export function buildFacts(out: AdviceOutput) {
  const goalLabel: Record<string, string> = {
    starter: "eerste woning kopen",
    doorstromer: "verhuizen (kopen en verkopen)",
    oversluiten: "hypotheek oversluiten",
    verhogen: "hypotheek verhogen",
    verkopen: "woning verkopen",
    orientatie: "oriënteren op de maximale hypotheek",
  }
  const lenderIncomes = out.entrepreneur?.businesses.map((b) => {
    const incomes = b.perLender.filter((p) => p.accepted !== false).map((p) => p.income)
    return {
      rechtsvorm: b.legalForm,
      toetsinkomenLaagste: incomes.length ? eur(Math.min(...incomes)) : 0,
      toetsinkomenHoogste: incomes.length ? eur(Math.max(...incomes)) : 0,
      risicoscore: b.risk.score,
      risiconiveau: b.risk.level,
      uitkeerbareWinst: b.analysis ? eur(b.analysis.distributable) : null,
      bepalendeToets: b.analysis?.limitingTest ?? null,
      ontbrekendeDocumenten: b.missingDocuments.length,
    }
  })
  return {
    doel: goalLabel[out.goal] ?? out.goal,
    aantalAanvragers: out.applicants.length,
    leeftijden: out.applicants.map((a) => a.age),
    toetsinkomen: eur(out.capacity.income.combinedIncome),
    toetsrentePct: pct(out.capacity.income.toetsrentePct),
    financieringslastPct: pct(out.capacity.income.financieringslastPct),
    maximaleHypotheek: eur(out.summary.maxMortgage),
    maximaleHypotheekInkomen: eur(out.capacity.income.maxLoan),
    maximaleHypotheekOnderpand: out.capacity.collateral ? eur(out.capacity.collateral.maxLoan) : null,
    beperkendeFactor: out.capacity.limiting,
    aowToetsBepalend: out.capacity.income.decisive === "aow",
    knoppen: out.capacity.levers.filter((l) => l.extraLoan > 0).map((l) => ({ knop: l.label, extraLeenruimte: eur(l.extraLoan) })),
    verstandigLenen: eur(out.prudent.loan),
    hypotheekbedrag: eur(out.loan.amount),
    tekortEigenGeld: eur(out.summary.shortfall),
    rentePct: pct(out.loan.ratePct),
    rentevastJaren: out.loan.fixedYears,
    nhg: out.loan.nhgApplied,
    brutoMaandlast: eur(out.summary.grossMonthly),
    nettoMaandlast: eur(out.summary.netMonthly),
    gemiddeldeNettoMaandlastRentevast: eur(out.loan.avgNetMonthlyFixed),
    kostenKoper: out.purchase ? eur(out.purchase.costs.total) : null,
    overdrachtsbelasting: out.purchase ? eur(out.purchase.costs.transferTax.amount) : null,
    startersvrijstelling: out.purchase ? out.purchase.costs.transferTax.starterExemptShare > 0 : null,
    eigenGeld: out.purchase ? eur(out.purchase.ownFundsAvailable) : null,
    overwaarde: out.mover ? eur(out.mover.netProceeds) : null,
    eigenwoningreserve: out.mover ? eur(out.mover.eigenwoningreserve) : null,
    restschuldVorigeWoning: out.mover ? eur(out.mover.restschuld) : null,
    vrijBesteedbaarPerMaand: out.budget ? eur(out.budget.remaining) : null,
    nettoInkomenPerMaand: out.budget ? eur(out.budget.netIncomeMonthly) : null,
    top3: out.lenders.top3.map((r) => ({
      bank: r.name,
      rentePct: pct(r.ratePct ?? 0),
      nettoMaandlast: eur(r.netMonthlyYear1 ?? 0),
      totaleKostenRentevast: eur(r.totalCostsFixedPeriod ?? 0),
      maximaleLeenruimte: eur(r.maxLoan),
    })),
    aantalBankenMogelijk: out.lenders.rows.filter((r) => r.accepted !== false && r.fits).length,
    stresstests: out.stress.map((s) => ({ test: s.label, stoplicht: s.light })),
    rodeControles: out.checks.filter((c) => c.status === "red").map((c) => c.label),
    oranjeControles: out.checks.filter((c) => c.status === "orange").map((c) => c.label),
    ondernemers: lenderIncomes ?? null,
    overwaardeOpties: out.equityRelease?.options.filter((o) => o.available).map((o) => ({ optie: o.title, nettoEffect10Jaar: eur(o.netEffect10) })) ?? null,
  }
}
