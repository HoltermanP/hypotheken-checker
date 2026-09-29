import { annuityPrincipal, floorEuro } from "../math"
import { NORM_KEYS, type EnergyLabel, type NormValues } from "../norms"
import type { Obligation } from "../types"
import { financieringslastPct, toetsrente, type TableKind } from "./financieringslast"
import { obligationBurdens, type ObligationBurden } from "./obligations"
import type { Tracer } from "../trace"

/**
 * Maximale hypotheek op basis van inkomen (Trhk art. 3 en 4).
 *
 *   gezamenlijk toetsinkomen = hoogste inkomen + tweede inkomen × partnerpercentage − betaalde alimentatie
 *   maximale woonlast/jaar   = toetsinkomen × financieringslastpercentage(tabel, inkomen, toetsrente)
 *   ruimte per maand         = woonlast/12 − verplichtingen/maand − erfpachtcanon/12
 *   basis leenruimte         = contante waarde van 'ruimte per maand' over 360 maanden tegen de toetsrente
 *   maximale hypotheek       = basis + energielabelbedrag + energiebesparende voorzieningen + alleenstaandenbedrag
 *
 * AOW-toets (Trhk art. 2 lid 5, NHG C.7.4.2): bereikt een aanvrager binnen 10 jaar de AOW-leeftijd,
 * dan wordt ook getoetst op het inkomen na AOW (met de AOW-tabel). De laagste uitkomst is bepalend.
 */

export interface CapacityApplicant {
  id: string
  toetsinkomen: number
  reachedAow: boolean
  monthsUntilAow: number
  retirementIncome: number
}

export interface CapacityParams {
  norms: NormValues
  applicants: CapacityApplicant[]
  obligations: Obligation[]
  alimonyPaidAnnual: number
  erfpachtAnnual: number
  ratePct: number
  fixedYears: number
  energyLabel: EnergyLabel
  /** Bedrag dat daadwerkelijk aan energiebesparende voorzieningen wordt besteed. */
  energySavingAmount: number
  /** Geen hypotheekrenteaftrek (box 3) → box 3-tabellen. */
  noInterestDeduction?: boolean
  tracer?: Tracer
}

export interface CapacityMoment {
  label: string
  combinedIncome: number
  table: TableKind
  pct: number
  maxAnnualCost: number
  maxMonthlyForMortgage: number
  baseLoan: number
  maxLoan: number
}

export interface IncomeCapacityResult {
  toetsrentePct: number
  combinedIncome: number
  table: TableKind
  financieringslastPct: number
  maxAnnualCost: number
  obligations: ObligationBurden[]
  obligationsMonthly: number
  erfpachtMonthly: number
  maxMonthlyForMortgage: number
  baseLoan: number
  energyLabelExtra: number
  energySavingExtra: number
  singleExtra: number
  /** Resultaat op basis van het huidige inkomen. */
  currentMaxLoan: number
  aowTest: CapacityMoment[]
  decisive: "current" | "aow"
  maxLoan: number
}

export function combineIncomes(norms: NormValues, incomes: number[]): number {
  const sorted = [...incomes].sort((a, b) => b - a)
  const [first = 0, ...rest] = sorted
  return first + rest.reduce((a, v) => a + (v * norms.trhk.partnerIncomePct) / 100, 0)
}

function tableFor(isAow: boolean, noDeduction: boolean | undefined): TableKind {
  if (noDeduction) return isAow ? "box3Aow" : "box3Regular"
  return isAow ? "aow" : "regular"
}

export function energyExtras(norms: NormValues, label: EnergyLabel, energySavingAmount: number) {
  const labelExtra = norms.trhk.energielabelExtra[label] ?? 0
  const savingCap = norms.trhk.energieBesparendExtra[label] ?? 0
  return { labelExtra, savingExtra: Math.max(0, Math.min(energySavingAmount, savingCap)) }
}

export function incomeCapacity(p: CapacityParams): IncomeCapacityResult {
  const { norms } = p
  const t = p.tracer
  const rate = toetsrente(norms, p.ratePct, p.fixedYears)
  const months = norms.trhk.annuityYears * 12
  const burdens = obligationBurdens(p.obligations, norms, rate)
  const obligationsMonthly = burdens.reduce((a, b) => a + b.monthly, 0)
  const erfpachtMonthly = p.erfpachtAnnual / 12
  const single = p.applicants.length === 1

  const { labelExtra, savingExtra } = energyExtras(norms, p.energyLabel, p.energySavingAmount)

  const compute = (label: string, incomes: { income: number; isAow: boolean }[]): CapacityMoment => {
    const combinedIncome = Math.max(
      0,
      combineIncomes(
        norms,
        incomes.map((i) => i.income)
      ) - p.alimonyPaidAnnual
    )
    const highest = [...incomes].sort((a, b) => b.income - a.income)[0]
    const table = tableFor(highest?.isAow ?? false, p.noInterestDeduction)
    const pct = financieringslastPct(norms, table, combinedIncome, rate)
    const maxAnnualCost = (combinedIncome * pct) / 100
    const maxMonthlyForMortgage = Math.max(0, maxAnnualCost / 12 - obligationsMonthly - erfpachtMonthly)
    const baseLoan = annuityPrincipal(maxMonthlyForMortgage, rate, months)
    const isAowTable = table === "aow" || table === "box3Aow"
    const singleThreshold = isAowTable
      ? norms.trhk.alleenstaandeMinIncomeAow
      : norms.trhk.alleenstaandeMinIncomeRegular
    const singleExtra = single && combinedIncome > singleThreshold ? norms.trhk.alleenstaandeExtra : 0
    const maxLoan = baseLoan > 0 ? floorEuro(baseLoan + labelExtra + savingExtra + singleExtra) : 0
    return { label, combinedIncome, table, pct, maxAnnualCost, maxMonthlyForMortgage, baseLoan, maxLoan }
  }

  const current = compute(
    "Huidig inkomen",
    p.applicants.map((a) => ({ income: a.toetsinkomen, isAow: a.reachedAow }))
  )

  // AOW-toets: momenten binnen 10 jaar waarop een aanvrager AOW-gerechtigd wordt.
  const aowMoments = p.applicants
    .filter((a) => !a.reachedAow && a.monthsUntilAow > 0 && a.monthsUntilAow <= 120)
    .map((a) => a.monthsUntilAow)
    .sort((a, b) => a - b)
  const aowTest: CapacityMoment[] = aowMoments.map((m) =>
    compute(
      `Na AOW-leeftijd (over ${Math.round(m / 12)} jaar)`,
      p.applicants.map((a) => {
        const retired = a.reachedAow || a.monthsUntilAow <= m
        return { income: retired ? a.retirementIncome : a.toetsinkomen, isAow: retired }
      })
    )
  )
  const lowestAow = aowTest.reduce<CapacityMoment | null>(
    (min, m) => (min === null || m.maxLoan < min.maxLoan ? m : min),
    null
  )
  const decisive = lowestAow && lowestAow.maxLoan < current.maxLoan ? "aow" : "current"
  const maxLoan = decisive === "aow" ? lowestAow!.maxLoan : current.maxLoan

  const singleThreshold =
    current.table === "aow" || current.table === "box3Aow"
      ? norms.trhk.alleenstaandeMinIncomeAow
      : norms.trhk.alleenstaandeMinIncomeRegular
  const singleExtra = single && current.combinedIncome > singleThreshold ? norms.trhk.alleenstaandeExtra : 0

  if (t) {
    t.add({
      id: "toetsinkomen",
      label: "Gezamenlijk toetsinkomen",
      value: current.combinedIncome,
      unit: "EUR/jaar",
      formula: "hoogste inkomen + tweede inkomen × partnerpercentage − betaalde partneralimentatie",
      inputs: { partnerPct: norms.trhk.partnerIncomePct, alimentatie: p.alimonyPaidAnnual },
      normKeys: [NORM_KEYS.partnerIncome, NORM_KEYS.alimentatie],
    })
    t.add({
      id: "toetsrente",
      label: "Toetsrente",
      value: rate,
      unit: "%",
      formula:
        p.fixedYears < norms.trhk.toetsrenteMinFixedYears
          ? "max(AFM-toetsrente, werkelijke rente) bij rentevast < 10 jaar"
          : "werkelijke rente bij rentevast ≥ 10 jaar",
      inputs: { werkelijkeRente: p.ratePct, rentevastJaren: p.fixedYears },
      normKeys: [NORM_KEYS.toetsrenteAfm, NORM_KEYS.toetsrenteMinFixedYears],
    })
    t.add({
      id: "financieringslastPct",
      label: "Financieringslastpercentage",
      value: current.pct,
      unit: "%",
      formula: `tabel ${current.table} bij toetsinkomen en toetsrente`,
      normKeys: [tableNormKey(current.table)],
    })
    t.add({
      id: "maxWoonlastMaand",
      label: "Maximale bruto woonlast per maand",
      value: current.maxAnnualCost / 12,
      unit: "EUR/maand",
      formula: "toetsinkomen × financieringslastpercentage / 12",
    })
    t.add({
      id: "verplichtingenMaand",
      label: "Maandlast verplichtingen (gewogen)",
      value: obligationsMonthly,
      unit: "EUR/maand",
      formula: "som van 2% kredietlimiet, lease × factor, studieschuld × bruteringsfactor, overige",
      normKeys: [NORM_KEYS.bkr, NORM_KEYS.studieschuld, NORM_KEYS.privateLease],
    })
    t.add({
      id: "basisLeenruimte",
      label: "Leenruimte uit inkomen (annuïtair 30 jaar)",
      value: floorEuro(current.baseLoan),
      unit: "EUR",
      formula: "contante waarde van (woonlast − verplichtingen − erfpacht) over 360 maanden tegen toetsrente",
      normKeys: [NORM_KEYS.annuityYears],
    })
    t.add({
      id: "energielabelExtra",
      label: "Extra leenruimte energielabel",
      value: labelExtra,
      unit: "EUR",
      formula: `bedrag bij label ${p.energyLabel}`,
      normKeys: [NORM_KEYS.energielabelExtra],
    })
    t.add({
      id: "energieBesparendExtra",
      label: "Extra leenruimte energiebesparende voorzieningen",
      value: savingExtra,
      unit: "EUR",
      formula: "min(geplande investering, maximum bij label)",
      normKeys: [NORM_KEYS.energieBesparendExtra],
    })
    t.add({
      id: "alleenstaandeExtra",
      label: "Extra leenruimte alleenstaande",
      value: singleExtra,
      unit: "EUR",
      formula: "vast bedrag bij één aanvrager boven de inkomensdrempel",
      normKeys: [NORM_KEYS.alleenstaande],
    })
    t.add({
      id: "maxHypotheekInkomen",
      label: "Maximale hypotheek op basis van inkomen",
      value: maxLoan,
      unit: "EUR",
      formula:
        decisive === "aow"
          ? "laagste van toets op huidig inkomen en toets na AOW-leeftijd"
          : "basis leenruimte + energielabel + energiebesparend + alleenstaandenbedrag",
      normKeys: [NORM_KEYS.aowRule],
    })
  }

  return {
    toetsrentePct: rate,
    combinedIncome: current.combinedIncome,
    table: current.table,
    financieringslastPct: current.pct,
    maxAnnualCost: current.maxAnnualCost,
    obligations: burdens,
    obligationsMonthly,
    erfpachtMonthly,
    maxMonthlyForMortgage: current.maxMonthlyForMortgage,
    baseLoan: floorEuro(current.baseLoan),
    energyLabelExtra: labelExtra,
    energySavingExtra: savingExtra,
    singleExtra,
    currentMaxLoan: current.maxLoan,
    aowTest,
    decisive,
    maxLoan,
  }
}

export function tableNormKey(table: TableKind): string {
  switch (table) {
    case "regular":
      return NORM_KEYS.tableRegular
    case "aow":
      return NORM_KEYS.tableAow
    case "box3Regular":
      return NORM_KEYS.tableBox3Regular
    case "box3Aow":
      return NORM_KEYS.tableBox3Aow
  }
}
