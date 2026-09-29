import type { LenderEntrepreneurPolicy } from "../lenders/types"
import { applyMethod, methodExplanation } from "./sole-prop"
import type { BusinessInput, BvEntity, BvYear } from "./types"

/**
 * Toetsinkomen DGA (BV en BV met holding).
 *
 * Toetsinkomen = DGA-salaris + (als de bank dat toestaat) het duurzaam uitkeerbare deel van de
 * winst × aandelenbelang. Het uitkeerbare deel is het minimum van vier toetsen:
 *  1. Winstcapaciteit: resultaat na belasting volgens de rekenmethode van de bank (standaard
 *     gemiddelde 3 jaar, laatste jaar als plafond indien lager).
 *  2. Solvabiliteit: na uitkering p moet (EV − p) / (BT − p) ≥ s  ⇒  p ≤ (EV − s·BT) / (1 − s).
 *  3. Liquiditeit: na uitkering moet de current ratio ≥ c blijven  ⇒  p ≤ VA − c·KVV, en p ≤ liquide middelen.
 *  4. Uitkeringstoets: p ≤ vrij uitkeerbare reserves (EV − geplaatst kapitaal).
 *
 * Holding: rekenen met geconsolideerde cijfers. Eliminaties: management fee (ontvangen door de
 * holding = betaald door de werkmaatschappij), resultaat en boekwaarde van deelnemingen, en
 * onderlinge vorderingen/schulden. De management fee telt alleen mee voor het salaris uit de
 * holding als die zakelijk, structureel en contractueel is vastgelegd (of de bank dat expliciet
 * accepteert).
 *
 * Standaarddrempels als de bank geen drempel publiceert (modelaanname, zie ENTREPRENEURS.md):
 * solvabiliteit 20%, current ratio 1,0.
 */

export const DEFAULT_MIN_SOLVENCY_PCT = 20
export const DEFAULT_MIN_CURRENT_RATIO = 1

const ZERO_YEAR = (year: number): BvYear => ({
  year,
  revenue: 0,
  resultBeforeTax: 0,
  corporateTax: 0,
  resultAfterTax: 0,
  dividendPaid: 0,
  retainedEarnings: 0,
  equity: 0,
  balanceTotal: 0,
  liquidAssets: 0,
  currentAssets: 0,
  currentLiabilities: 0,
  longTermLiabilities: 0,
  managementFeeReceived: 0,
  managementFeePaid: 0,
  dgaSalaryPaid: 0,
  intercompanyReceivables: 0,
  intercompanyPayables: 0,
  resultFromParticipations: 0,
  participationsValue: 0,
})

/** Effectief belang van de top-aandeelhouder in een entiteit (product van de keten). */
export function effectiveOwnership(entities: BvEntity[], key: string): number {
  const entity = entities.find((e) => e.key === key)
  if (!entity) return 0
  const own = entity.ownershipPct / 100
  if (!entity.parentKey) return own
  return own * effectiveOwnership(entities, entity.parentKey)
}

/**
 * Consolideer de groep per jaar. De cijfers van dochters worden volledig meegenomen (integrale
 * consolidatie) zodra de holding een meerderheidsbelang heeft, anders naar rato van het belang.
 */
export function consolidate(entities: BvEntity[]): BvYear[] {
  const years = [...new Set(entities.flatMap((e) => e.financials.filter((f) => !f.isForecast).map((f) => f.year)))].sort(
    (a, b) => a - b
  )
  return years.map((year) => {
    const c = ZERO_YEAR(year)
    let feeReceived = 0
    let feePaid = 0
    let icReceivable = 0
    let icPayable = 0
    for (const e of entities) {
      const f = e.financials.find((x) => x.year === year && !x.isForecast)
      if (!f) continue
      const weight = e.parentKey === null ? 1 : e.ownershipPct >= 50 ? 1 : e.ownershipPct / 100
      c.revenue += f.revenue * weight
      c.resultBeforeTax += (f.resultBeforeTax - f.resultFromParticipations) * weight
      c.corporateTax += f.corporateTax * weight
      c.resultAfterTax += (f.resultAfterTax - f.resultFromParticipations) * weight
      c.dividendPaid += e.parentKey === null ? f.dividendPaid : 0
      c.retainedEarnings += f.retainedEarnings * weight
      c.equity += (f.equity - f.participationsValue) * weight
      c.balanceTotal += (f.balanceTotal - f.participationsValue) * weight
      c.liquidAssets += f.liquidAssets * weight
      c.currentAssets += f.currentAssets * weight
      c.currentLiabilities += f.currentLiabilities * weight
      c.longTermLiabilities += f.longTermLiabilities * weight
      c.dgaSalaryPaid += f.dgaSalaryPaid * weight
      feeReceived += f.managementFeeReceived * weight
      feePaid += f.managementFeePaid * weight
      icReceivable += f.intercompanyReceivables * weight
      icPayable += f.intercompanyPayables * weight
    }
    // Eliminatie: onderlinge management fee is omzet voor de holding en kosten voor de werkmij.
    const feeElim = Math.min(feeReceived, feePaid)
    c.revenue -= feeElim
    c.managementFeeReceived = feeReceived - feeElim
    c.managementFeePaid = feePaid - feeElim
    // Eliminatie van onderlinge vorderingen en schulden (balans).
    const icElim = Math.min(icReceivable, icPayable)
    c.currentAssets -= icElim
    c.currentLiabilities -= icElim
    c.balanceTotal -= icElim
    return c
  })
}

/** Cijfers waarmee gerekend wordt: aangeleverde consolidatie, berekende consolidatie of de enkele BV. */
export function groupFigures(business: BusinessInput): { figures: BvYear[]; consolidated: boolean } {
  const bv = business.bv
  if (!bv) return { figures: [], consolidated: false }
  const provided = (bv.consolidated ?? []).filter((y) => !y.isForecast)
  if (provided.length > 0) return { figures: [...provided].sort((a, b) => a.year - b.year), consolidated: true }
  if (bv.entities.length > 1) return { figures: consolidate(bv.entities), consolidated: true }
  const single = bv.entities[0]
  return {
    figures: single ? single.financials.filter((f) => !f.isForecast).sort((a, b) => a.year - b.year) : [],
    consolidated: false,
  }
}

export interface DistributableTests {
  profitCapacity: number
  maxBySolvency: number
  maxByLiquidity: number
  maxByReserves: number
  solvencyPct: number
  currentRatio: number
  minSolvencyPct: number
  minCurrentRatio: number
  distributable: number
  limitingTest: "winstcapaciteit" | "solvabiliteit" | "liquiditeit" | "uitkeringstoets"
}

export function distributableProfit(
  figures: BvYear[],
  issuedCapital: number,
  policy: LenderEntrepreneurPolicy
): DistributableTests {
  const method = policy.calcMethod === "ivo" || !policy.calcMethod ? "avg3_capped_by_last" : policy.calcMethod
  const profitCapacity = Math.max(0, applyMethod(figures.map((f) => f.resultAfterTax), method))
  const latest = figures[figures.length - 1] ?? ZERO_YEAR(0)
  const s = (policy.minSolvencyPct ?? DEFAULT_MIN_SOLVENCY_PCT) / 100
  const cr = policy.minCurrentRatio ?? DEFAULT_MIN_CURRENT_RATIO
  const maxBySolvency = Math.max(0, (latest.equity - s * latest.balanceTotal) / (1 - s))
  const maxByLiquidity = Math.max(
    0,
    Math.min(latest.liquidAssets, latest.currentAssets - cr * latest.currentLiabilities)
  )
  const maxByReserves = Math.max(0, latest.equity - issuedCapital)
  const candidates: [DistributableTests["limitingTest"], number][] = [
    ["winstcapaciteit", profitCapacity],
    ["solvabiliteit", maxBySolvency],
    ["liquiditeit", maxByLiquidity],
    ["uitkeringstoets", maxByReserves],
  ]
  const [limitingTest, distributable] = candidates.reduce((min, c) => (c[1] < min[1] ? c : min))
  return {
    profitCapacity,
    maxBySolvency,
    maxByLiquidity,
    maxByReserves,
    solvencyPct: latest.balanceTotal > 0 ? (latest.equity / latest.balanceTotal) * 100 : 0,
    currentRatio: latest.currentLiabilities > 0 ? latest.currentAssets / latest.currentLiabilities : Infinity,
    minSolvencyPct: s * 100,
    minCurrentRatio: cr,
    distributable,
    limitingTest,
  }
}

export interface DgaIncomeResult {
  accepted: boolean | null
  income: number
  salary: number
  salaryCounted: number
  distributableShare: number
  tests: DistributableTests | null
  consolidated: boolean
  treatedAsEmployee: boolean
  explanation: string[]
  warnings: string[]
}

export function dgaIncome(
  business: BusinessInput,
  policy: LenderEntrepreneurPolicy,
  norms: { gebruikelijkLoon: number }
): DgaIncomeResult {
  const bv = business.bv
  const explanation: string[] = []
  const warnings: string[] = []
  if (!bv) {
    return {
      accepted: false,
      income: 0,
      salary: 0,
      salaryCounted: 0,
      distributableShare: 0,
      tests: null,
      consolidated: false,
      treatedAsEmployee: false,
      explanation: ["Geen BV-gegevens ingevuld."],
      warnings,
    }
  }
  const salaries = [...bv.salaries].sort((a, b) => a.year - b.year)
  const salary = salaries[salaries.length - 1]?.amount ?? 0
  if (salary < norms.gebruikelijkLoon) {
    warnings.push(
      "Het DGA-salaris ligt onder het normbedrag van de gebruikelijkloonregeling. Dat kan fiscaal worden gecorrigeerd, tenzij je aannemelijk maakt dat een lager loon zakelijk is."
    )
  }

  const legal = business.legalForm
  if (policy.acceptedLegalForms && !policy.acceptedLegalForms.includes(legal)) {
    return {
      accepted: false,
      income: 0,
      salary,
      salaryCounted: 0,
      distributableShare: 0,
      tests: null,
      consolidated: false,
      treatedAsEmployee: false,
      explanation: [`De rechtsvorm ${legal === "bv_holding" ? "BV met holding" : "BV"} wordt door deze bank niet geaccepteerd.`],
      warnings,
    }
  }

  const threshold = policy.dgaThresholdPct ?? 5
  if (bv.shareholdingPct < threshold) {
    explanation.push(
      `Met een belang van ${bv.shareholdingPct}% (onder de grens van ${threshold}%) behandelt de bank je als werknemer: alleen het salaris telt.`
    )
    return {
      accepted: true,
      income: salary,
      salary,
      salaryCounted: salary,
      distributableShare: 0,
      tests: null,
      consolidated: false,
      treatedAsEmployee: true,
      explanation,
      warnings,
    }
  }

  if (business.ivoIncome && (policy.ivoPolicy === "required" || policy.ivoPolicy === "accepted" || policy.dgaTreatment === "ivo")) {
    explanation.push("Toetsinkomen volgens de Inkomensverklaring Ondernemer (IVO).")
    return {
      accepted: true,
      income: business.ivoIncome,
      salary,
      salaryCounted: salary,
      distributableShare: Math.max(0, business.ivoIncome - salary),
      tests: null,
      consolidated: false,
      treatedAsEmployee: false,
      explanation,
      warnings,
    }
  }

  const { figures, consolidated } = groupFigures(business)
  const minYears = policy.minYearsFigures ?? 3
  let accepted: boolean | null = true
  if (figures.length < minYears) {
    accepted = policy.acceptsForecastForStarters ? true : figures.length === 0 ? false : null
    explanation.push(`De bank vraagt ${minYears} jaar cijfers; er ${figures.length === 1 ? "is" : "zijn"} ${figures.length} beschikbaar.`)
  }
  if (policy.ivoPolicy === "required") {
    accepted = accepted === false ? false : null
    explanation.push("Deze bank vereist een IVO; de uitkomst hieronder is een benadering van de IVO-methodiek.")
  }

  // Management fee (holding)
  let salaryCounted = salary
  const fee = bv.managementFee
  if (legal === "bv_holding" && fee && fee.annual > 0) {
    const qualifies = fee.contractual && fee.structural && fee.armsLength
    const holding = bv.entities.find((e) => e.role === "holding")
    const latestHolding = holding?.financials.filter((f) => !f.isForecast).sort((a, b) => a.year - b.year).at(-1)
    const salaryFromHolding = latestHolding?.dgaSalaryPaid ?? salary
    if (!qualifies || policy.countsManagementFee === false) {
      const holdingOtherIncome = Math.max(0, (latestHolding?.revenue ?? 0) - (latestHolding?.managementFeeReceived ?? 0))
      const fundedByFee = Math.max(0, salaryFromHolding - holdingOtherIncome)
      salaryCounted = Math.max(0, salary - fundedByFee)
      warnings.push(
        qualifies
          ? "Deze bank telt de management fee niet mee; het salaris dat uit de fee wordt betaald, telt niet mee."
          : "De management fee is niet zakelijk, structureel én contractueel vastgelegd; het salaris dat daaruit wordt betaald, telt niet mee. Leg een managementovereenkomst vast."
      )
    } else {
      explanation.push("De management fee is zakelijk, structureel en contractueel vastgelegd; het salaris uit de holding telt volledig mee.")
    }
  }

  const tests = figures.length > 0 ? distributableProfit(figures, bv.issuedCapital, policy) : null
  const treatment = policy.dgaTreatment ?? "salary_plus_distributable_profit"
  let distributableShare = 0
  if (tests && treatment !== "salary_only") {
    distributableShare = (tests.distributable * bv.shareholdingPct) / 100
    explanation.push(
      `Uitkeerbare winst: laagste van winstcapaciteit, solvabiliteit, liquiditeit en uitkeringstoets (bepalend: ${tests.limitingTest}). ${methodExplanation(policy.calcMethod ?? "avg3_capped_by_last", figures.map((f) => f.resultAfterTax))}`
    )
    if (consolidated) explanation.push("Gerekend met geconsolideerde cijfers (dubbeltellingen tussen holding en werkmaatschappij geëlimineerd).")
  } else if (treatment === "salary_only") {
    explanation.push("Deze bank telt alleen het DGA-salaris; winst in de BV telt niet mee.")
  }
  if (tests && tests.solvencyPct < tests.minSolvencyPct) {
    warnings.push(`De solvabiliteit (${tests.solvencyPct.toFixed(1)}%) ligt onder de drempel van ${tests.minSolvencyPct}%.`)
  }
  if (tests && tests.currentRatio < tests.minCurrentRatio) {
    warnings.push(`De current ratio (${tests.currentRatio.toFixed(2)}) ligt onder de drempel van ${tests.minCurrentRatio}.`)
  }
  return {
    accepted,
    income: salaryCounted + distributableShare,
    salary,
    salaryCounted,
    distributableShare,
    tests,
    consolidated,
    treatedAsEmployee: false,
    explanation,
    warnings,
  }
}
