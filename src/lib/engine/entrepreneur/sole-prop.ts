import { average } from "../math"
import type { EntCalcMethod, LenderEntrepreneurPolicy } from "../lenders/types"
import type { BusinessInput, SolePropYear } from "./types"

/**
 * Toetsinkomen IB-ondernemer (eenmanszaak, vof, maatschap, cv).
 *
 * Gecorrigeerde winst per jaar = winst vóór ondernemersaftrek − incidentele baten
 *                                + incidentele lasten + afname FOR
 * (bij vof/maatschap/cv is `profit` al het eigen winstaandeel).
 *
 * Rekenmethoden (per bank configureerbaar):
 * - avg3_capped_by_last (standaard): gemiddelde van de laatste 3 jaar; is het laatste jaar lager,
 *   dan telt het laatste jaar; is het laatste jaar hoger, dan maximaal het gemiddelde.
 * - avg3: gemiddelde van de laatste 3 jaar.
 * - last_year: alleen het laatste jaar.
 * - weighted: gewogen gemiddelde (1 × oudste, 2 × middelste, 3 × laatste) / 6.
 * - ivo: toetsinkomen uit de Inkomensverklaring Ondernemer (indien aanwezig).
 *
 * Starters (minder jaren dan de bank vereist): alleen als de bank een prognose accepteert; dan
 * min(gemiddelde van de beschikbare jaren, prognose).
 */

export function correctedProfit(y: SolePropYear): number {
  return y.profit - y.incidentalGains + y.incidentalLosses + y.forDecrease
}

export function applyMethod(values: number[], method: EntCalcMethod): number {
  const last3 = values.slice(-3)
  if (last3.length === 0) return 0
  const last = last3[last3.length - 1]!
  switch (method) {
    case "avg3":
      return average(last3)
    case "last_year":
      return last
    case "weighted": {
      const weights = last3.map((_, i) => i + 1 + (3 - last3.length))
      const total = weights.reduce((a, b) => a + b, 0)
      return last3.reduce((a, v, i) => a + v * weights[i]!, 0) / total
    }
    case "ivo":
    case "avg3_capped_by_last":
    default: {
      const avg = average(last3)
      return last < avg ? last : avg
    }
  }
}

export interface EntrepreneurIncomeResult {
  accepted: boolean | null
  income: number
  method: EntCalcMethod
  yearsOfFigures: number
  explanation: string[]
  /** Gebruikte waarden per jaar (na correctie). */
  basis: { year: number; value: number }[]
}

export const DEFAULT_POLICY: LenderEntrepreneurPolicy = {
  minYearsFigures: 3,
  acceptsForecastForStarters: false,
  ivoPolicy: "accepted",
  calcMethod: "avg3_capped_by_last",
  acceptedLegalForms: null,
  dgaTreatment: "salary_plus_distributable_profit",
  minSolvencyPct: null,
  minCurrentRatio: null,
  countsManagementFee: null,
  dgaThresholdPct: 5,
  allowsLoanNextToOwnBv: null,
  guaranteesTreatment: null,
  maxLtvPct: null,
  maxInterestOnlyPct: null,
}

export function solePropIncome(
  business: BusinessInput,
  policy: LenderEntrepreneurPolicy
): EntrepreneurIncomeResult {
  const explanation: string[] = []
  const years = [...(business.soleProp?.years ?? [])]
    .filter((y) => !y.isForecast)
    .sort((a, b) => a.year - b.year)
  const basis = years.map((y) => ({ year: y.year, value: correctedProfit(y) }))
  const method: EntCalcMethod = policy.calcMethod ?? "avg3_capped_by_last"
  const minYears = policy.minYearsFigures ?? 3
  const forecast = business.soleProp?.forecastProfit ?? null

  if (policy.acceptedLegalForms && !policy.acceptedLegalForms.includes(business.legalForm)) {
    return {
      accepted: false,
      income: 0,
      method,
      yearsOfFigures: years.length,
      explanation: [`De rechtsvorm ${business.legalForm} wordt door deze bank niet geaccepteerd.`],
      basis,
    }
  }

  if (policy.ivoPolicy === "required" && !business.ivoIncome) {
    explanation.push("Deze bank vereist een Inkomensverklaring Ondernemer (IVO); die ontbreekt nog.")
  }
  if (business.ivoIncome && (method === "ivo" || policy.ivoPolicy === "required" || policy.ivoPolicy === "accepted")) {
    explanation.push("Toetsinkomen volgens de Inkomensverklaring Ondernemer (IVO).")
    return { accepted: true, income: business.ivoIncome, method: "ivo", yearsOfFigures: years.length, explanation, basis }
  }

  if (years.length < minYears) {
    if (years.length >= 1 && policy.acceptsForecastForStarters && forecast !== null) {
      const avgAvailable = average(basis.map((b) => b.value))
      const income = Math.max(0, Math.min(avgAvailable, forecast))
      explanation.push(
        `Startende ondernemer met ${years.length} jaar cijfers: laagste van het gemiddelde (${Math.round(avgAvailable)}) en de prognose (${Math.round(forecast)}).`
      )
      return { accepted: true, income, method, yearsOfFigures: years.length, explanation, basis }
    }
    explanation.push(
      `De bank vraagt minimaal ${minYears} jaar cijfers; er ${years.length === 1 ? "is" : "zijn"} ${years.length}${policy.acceptsForecastForStarters ? " en geen prognose" : " en een prognose wordt niet geaccepteerd"}.`
    )
    return {
      accepted: policy.acceptsForecastForStarters === null && years.length > 0 ? null : false,
      income: years.length > 0 && policy.acceptsForecastForStarters === null ? Math.max(0, applyMethod(basis.map((b) => b.value), method)) : 0,
      method,
      yearsOfFigures: years.length,
      explanation,
      basis,
    }
  }

  const income = Math.max(0, applyMethod(basis.map((b) => b.value), method))
  explanation.push(methodExplanation(method, basis.map((b) => b.value)))
  if (basis.some((b, i) => i > 0 && b.value < basis[i - 1]!.value * 0.7)) {
    explanation.push("Let op: een van de jaren laat een daling van meer dan 30% zien; licht dit toe (incidentele posten?).")
  }
  return {
    accepted: policy.ivoPolicy === "required" && !business.ivoIncome ? null : true,
    income,
    method,
    yearsOfFigures: years.length,
    explanation,
    basis,
  }
}

export function methodExplanation(method: EntCalcMethod, values: number[]): string {
  const last3 = values.slice(-3)
  const avg = average(last3)
  const last = last3[last3.length - 1] ?? 0
  switch (method) {
    case "avg3":
      return "Gemiddelde van de laatste drie jaar."
    case "last_year":
      return "Alleen het laatste jaar telt."
    case "weighted":
      return "Gewogen gemiddelde: het laatste jaar weegt het zwaarst (1-2-3)."
    default:
      return last < avg
        ? "Gemiddelde van drie jaar, maar het laatste jaar is lager en daarom bepalend."
        : "Gemiddelde van drie jaar; het hogere laatste jaar telt maximaal tot het gemiddelde."
  }
}
