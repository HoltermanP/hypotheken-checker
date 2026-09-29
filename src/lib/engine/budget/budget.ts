import { NORM_KEYS, type NormValues } from "../norms"
import { netIncome } from "../tax/income-tax"

/**
 * Betaalbaarheidstoets naast de wettelijke norm: een Nibud-achtige begroting met vaste lasten.
 *
 * We gebruiken alleen onderbouwde componenten (energie, water, gemeentelijke lasten,
 * zorgverzekering, onderhoud, minimale voeding) en tonen de rest als "vrij besteedbaar" voor
 * kleding, vervoer, vrije tijd en sparen. Nibud adviseert maandelijks ca. 10% van het netto-inkomen
 * te sparen; dat is de drempel voor 'groen'.
 */

export interface PersonIncome {
  taxable: number
  labour: number
  aow: boolean
}

export interface BudgetLine {
  key: string
  label: string
  monthly: number
  normKey?: string
}

export interface BudgetResult {
  netIncomeMonthly: number
  lines: BudgetLine[]
  totalCosts: number
  remaining: number
  savingsAdvice: number
  light: "green" | "orange" | "red"
  explanation: string
}

export const SAVINGS_ADVICE_PCT = 10

export function householdNetMonthly(norms: NormValues, persons: PersonIncome[]): number {
  return persons.reduce((a, p) => a + netIncome(norms, p.taxable, p.labour, p.aow).net, 0) / 12
}

export function budget(
  norms: NormValues,
  params: {
    persons: PersonIncome[]
    adults: number
    children: number
    housingNetMonthly: number
    hoaMonthly: number
    erfpachtAnnual: number
    propertyValue: number
    obligationsMonthly: number
    otherFixedCostsMonthly: number
  }
): BudgetResult {
  const b = norms.budget
  const size = Math.max(1, params.adults + params.children)
  const sizeKey = size >= 5 ? "5plus" : String(size)
  const electricity = b.electricityBySize[sizeKey] ?? b.electricityBySize["5plus"] ?? 0
  const water = b.waterBySize[String(Math.min(size, 5))] ?? b.waterBySize["5"] ?? 0
  const netIncomeMonthly = householdNetMonthly(norms, params.persons)
  const lines: BudgetLine[] = [
    { key: "wonen", label: "Netto hypotheeklasten", monthly: params.housingNetMonthly },
    ...(params.hoaMonthly > 0 ? [{ key: "vve", label: "VvE-bijdrage", monthly: params.hoaMonthly }] : []),
    ...(params.erfpachtAnnual > 0 ? [{ key: "erfpacht", label: "Erfpachtcanon", monthly: params.erfpachtAnnual / 12 }] : []),
    {
      key: "onderhoud",
      label: "Reservering onderhoud woning",
      monthly: (params.propertyValue * b.maintenancePctPerYear) / 100 / 12,
      normKey: NORM_KEYS.budgetOnderhoud,
    },
    { key: "energie", label: "Energie en water", monthly: b.gasMonthly + electricity + water, normKey: NORM_KEYS.budgetEnergie },
    { key: "gemeente", label: "Gemeentelijke lasten en waterschap", monthly: b.municipalMonthly, normKey: NORM_KEYS.budgetGemeente },
    {
      key: "zorg",
      label: "Zorgverzekering (incl. eigen risico)",
      monthly: params.adults * (b.healthPremiumPerAdultMonthly + b.healthDeductiblePerAdultYear / 12),
      normKey: NORM_KEYS.budgetVerzekeringen,
    },
    {
      key: "voeding",
      label: "Voeding (Nibud-minimum)",
      monthly: (params.adults >= 2 ? b.foodCouple : b.foodSingle) + params.children * b.foodPerChild,
      normKey: NORM_KEYS.budgetLevensonderhoud,
    },
    ...(params.obligationsMonthly > 0
      ? [{ key: "verplichtingen", label: "Leningen, lease en studieschuld", monthly: params.obligationsMonthly }]
      : []),
    ...(params.otherFixedCostsMonthly > 0
      ? [{ key: "overig", label: "Overige vaste lasten (zelf opgegeven)", monthly: params.otherFixedCostsMonthly }]
      : []),
  ]
  const totalCosts = lines.reduce((a, l) => a + l.monthly, 0)
  const remaining = netIncomeMonthly - totalCosts
  const savingsAdvice = (netIncomeMonthly * SAVINGS_ADVICE_PCT) / 100
  const light = remaining < 0 ? "red" : remaining < savingsAdvice ? "orange" : "green"
  return {
    netIncomeMonthly,
    lines,
    totalCosts,
    remaining,
    savingsAdvice,
    light,
    explanation:
      light === "green"
        ? "Na de vaste lasten blijft genoeg over voor dagelijkse uitgaven en om te sparen."
        : light === "orange"
          ? "Er blijft weinig ruimte over om te sparen; houd een ruime buffer aan."
          : "De vaste lasten zijn hoger dan het netto-inkomen. Dit is niet verantwoord.",
  }
}
