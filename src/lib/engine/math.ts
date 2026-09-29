/**
 * Financiële basisfuncties. Rentes worden als jaarpercentage (5 = 5%) doorgegeven en omgerekend
 * naar een maandrente via r/12 (nominale maandrente), zoals Nederlandse geldverstrekkers doen.
 */

export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12
}

/** Maandtermijn (rente + aflossing) van een annuïteit. */
export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = monthlyRate(annualRatePct)
  if (r === 0) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

/** Contante waarde (hoofdsom) die hoort bij een maandtermijn: inverse van annuityPayment. */
export function annuityPrincipal(payment: number, annualRatePct: number, months: number): number {
  if (payment <= 0 || months <= 0) return 0
  const r = monthlyRate(annualRatePct)
  if (r === 0) return payment * months
  return (payment * (1 - Math.pow(1 + r, -months))) / r
}

/** Restschuld van een annuïteit na `elapsed` maanden. */
export function annuityBalance(
  principal: number,
  annualRatePct: number,
  months: number,
  elapsed: number
): number {
  if (elapsed <= 0) return principal
  if (elapsed >= months) return 0
  const r = monthlyRate(annualRatePct)
  if (r === 0) return principal * (1 - elapsed / months)
  const f = Math.pow(1 + r, months)
  return (principal * (f - Math.pow(1 + r, elapsed))) / (f - 1)
}

/** Aandeel van de hoofdsom dat na `elapsed` maanden nog openstaat (0..1). */
export function annuityBalanceRatio(annualRatePct: number, months: number, elapsed: number): number {
  return annuityBalance(1, annualRatePct, months, elapsed)
}

/** Contante waarde van een reeks gelijke maandbedragen tegen een disconteringsvoet. */
export function presentValueOfMonthly(amount: number, annualRatePct: number, months: number) {
  return annuityPrincipal(amount, annualRatePct, months)
}

/** Eindwaarde van periodieke inleg + beginkapitaal bij een jaarrendement (maandelijks samengesteld). */
export function futureValue(
  start: number,
  monthlyDeposit: number,
  annualReturnPct: number,
  months: number
): number {
  const r = annualReturnPct / 100 / 12
  if (r === 0) return start + monthlyDeposit * months
  const g = Math.pow(1 + r, months)
  return start * g + (monthlyDeposit * (g - 1)) / r
}

export function round(value: number, decimals = 2): number {
  const f = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Afronden naar beneden op hele euro's (maximale hypotheek wordt nooit naar boven afgerond). */
export function floorEuro(value: number): number {
  return Math.floor(value + 1e-9)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

/** Belasting over een bedrag volgens schijven [vanaf, tot|null, pct]. */
export function bracketTax(amount: number, brackets: [number, number | null, number][]): number {
  if (amount <= 0) return 0
  let tax = 0
  for (const [from, to, pct] of brackets) {
    if (amount <= from) break
    const upper = to === null ? amount : Math.min(amount, to)
    tax += ((upper - from) * pct) / 100
  }
  return tax
}

/** Marginaal tarief (%) bij een bedrag. */
export function marginalRate(amount: number, brackets: [number, number | null, number][]): number {
  let rate = brackets[0]?.[2] ?? 0
  for (const [from, , pct] of brackets) {
    if (amount > from) rate = pct
  }
  return rate
}

/** Standaarddeviatie gedeeld door gemiddelde (variatiecoëfficiënt). */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = average(values)
  if (mean === 0) return 0
  const variance = average(values.map((v) => (v - mean) ** 2))
  return Math.sqrt(variance) / Math.abs(mean)
}

/** Lineaire trend (helling per periode) via kleinste kwadraten. */
export function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const xs = values.map((_, i) => i)
  const mx = average(xs)
  const my = average(values)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (values[i]! - my)
    den += (xs[i]! - mx) ** 2
  }
  return den === 0 ? 0 : num / den
}
