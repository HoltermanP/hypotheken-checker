import { NORM_KEYS, type NormValues } from "../norms"
import type { CapacityApplicant } from "../capacity/income-capacity"
import { partSchedule, type LoanPart, type Projection } from "../loan/schedule"
import type { PersonIncome } from "../budget/budget"
import { householdNetMonthly } from "../budget/budget"

/**
 * Stresstests met stoplichtscore.
 *
 * Maatstaven:
 * - Leenruimte-ratio = maximale hypotheek in het scenario / werkelijke hypotheek.
 *   groen ≥ 1,00; oranje ≥ 0,85; rood < 0,85.
 * - Budget: netto-inkomen − netto woonlasten − overige vaste lasten.
 *   groen ≥ 0 met ruimte; oranje als het tekort binnen de buffer valt; rood anders.
 * - Waardedaling: LTV ≤ 100% groen, ≤ 110% oranje, > 110% rood.
 */

export type Light = "green" | "orange" | "red"

export interface StressApplicant {
  id: string
  label: string
  toetsinkomen: number
  /** Werkelijk bruto belastbaar inkomen (voor netto). */
  taxable: number
  labour: number
  reachedAow: boolean
  monthsUntilAow: number
  retirementIncome: number
  isEntrepreneur: boolean
  /** Bruto loon (voor WW/WIA). */
  wage: number
  aovMonthly: number
  survivorPensionAnnual: number
  orvCoverage: number
  yearsWorked: number
}

export interface StressResult {
  key: string
  label: string
  light: Light
  metrics: { label: string; value: number; unit: "EUR" | "EUR/maand" | "%" | "maanden" | "factor" }[]
  explanation: string
  tips: string[]
}

export interface StressContext {
  norms: NormValues
  applicants: StressApplicant[]
  loanAmount: number
  parts: LoanPart[]
  projection: Projection
  propertyValue: number
  /** Overige vaste lasten per maand (uit de begroting, zonder wonen). */
  otherCostsMonthly: number
  bufferSavings: number
  childrenUnder18: number
  /** Maximale hypotheek bij een andere set aanvragers/inkomens. */
  capacity: (applicants: CapacityApplicant[]) => number
  saleCostsPct: number
}

function ratioLight(ratio: number): Light {
  return ratio >= 1 ? "green" : ratio >= 0.85 ? "orange" : "red"
}

function budgetLight(remaining: number, buffer: number, months: number): Light {
  if (remaining >= 0) return "green"
  return -remaining * months <= buffer ? "orange" : "red"
}

const toCapacity = (a: StressApplicant, income = a.toetsinkomen, reachedAow = a.reachedAow): CapacityApplicant => ({
  id: a.id,
  toetsinkomen: income,
  reachedAow,
  monthsUntilAow: a.monthsUntilAow,
  retirementIncome: a.retirementIncome,
})

export function wwMonths(norms: NormValues, yearsWorked: number): number {
  const s = norms.social
  const first = Math.min(10, yearsWorked) * s.wwMaandenPerJaarEerste10
  const after = Math.max(0, yearsWorked - 10) * s.wwMaandenPerJaarDaarna
  return Math.max(s.wwMinMaanden, Math.min(s.wwMaxMaanden, Math.floor(first + after)))
}

export function cappedWage(norms: NormValues, wage: number): number {
  return Math.min(wage, norms.social.maxDagloon * 261)
}

export function runStressTests(ctx: StressContext): StressResult[] {
  const { norms, applicants } = ctx
  const results: StressResult[] = []
  const baseNetMonthly = ctx.projection.years[0]?.netMonthly ?? 0
  const persons = (overrides: Record<string, Partial<PersonIncome>> = {}): PersonIncome[] =>
    applicants.map((a) => ({ taxable: a.taxable, labour: a.labour, aow: a.reachedAow, ...overrides[a.id] }))
  const remainingWith = (ps: PersonIncome[], housing: number) =>
    householdNetMonthly(norms, ps) - housing - ctx.otherCostsMonthly
  const baseRemaining = remainingWith(persons(), baseNetMonthly)

  // 1. Rentestijging bij renteherziening
  for (const pp of [1, 2]) {
    const shocked = ctx.parts.reduce((a, part) => a + partSchedule(part, { rateShockPp: pp }).paymentAfterReset, 0)
    const normal = ctx.parts.reduce((a, part) => a + partSchedule(part).paymentAfterReset, 0)
    const extra = shocked - normal
    // Netto effect: extra rente is (grotendeels) aftrekbaar; conservatief rekenen we bruto.
    const remaining = baseRemaining - extra
    const light: Light = remaining >= 0 ? (extra <= baseRemaining * 0.5 ? "green" : "orange") : "red"
    results.push({
      key: `rente_plus_${pp}`,
      label: `Rente +${pp}% bij renteherziening`,
      light,
      metrics: [
        { label: "Extra bruto maandlast na renteherziening", value: extra, unit: "EUR/maand" },
        { label: "Bruto maandlast na renteherziening", value: shocked, unit: "EUR/maand" },
        { label: "Vrij besteedbaar na stijging", value: remaining, unit: "EUR/maand" },
      ],
      explanation:
        light === "red"
          ? "Bij deze rentestijging komt je begroting na de rentevaste periode tekort."
          : "Je kunt deze rentestijging opvangen binnen je begroting.",
      tips: light === "green" ? [] : ["Kies een langere rentevaste periode of los extra af vóór de renteherziening."],
    })
  }

  // 2. Uitval van het inkomen van één aanvrager (bij twee aanvragers)
  if (applicants.length === 2) {
    for (const a of applicants) {
      const other = applicants.find((x) => x.id !== a.id)!
      const max = ctx.capacity([toCapacity(other)])
      const ratio = ctx.loanAmount > 0 ? max / ctx.loanAmount : 1
      const remaining = remainingWith(persons({ [a.id]: { taxable: 0, labour: 0 } }), baseNetMonthly)
      const light = ratio >= 1 ? "green" : remaining >= 0 ? "orange" : "red"
      results.push({
        key: `uitval_${a.id}`,
        label: `Uitval inkomen ${a.label}`,
        light,
        metrics: [
          { label: "Maximale hypotheek op één inkomen", value: max, unit: "EUR" },
          { label: "Leenruimte-ratio", value: ratio, unit: "factor" },
          { label: "Vrij besteedbaar per maand", value: remaining, unit: "EUR/maand" },
        ],
        explanation:
          ratio >= 1
            ? `Ook met alleen het inkomen van ${other.label} past de hypotheek binnen de norm.`
            : `Met alleen het inkomen van ${other.label} is de hypotheek hoger dan de norm toestaat.`,
        tips: ratio >= 1 ? [] : ["Overweeg een woonlastenverzekering of houd een grotere buffer aan."],
      })
    }
  }

  // 3. Arbeidsongeschiktheid en 4. werkloosheid (per aanvrager)
  for (const a of applicants) {
    if (a.reachedAow) continue
    let aoIncome: number
    let aoExplain: string
    if (a.isEntrepreneur) {
      aoIncome = a.aovMonthly * 12
      aoExplain =
        a.aovMonthly > 0
          ? "Als ondernemer val je terug op je arbeidsongeschiktheidsverzekering (AOV)."
          : "Als ondernemer heb je geen WIA; zonder AOV valt je inkomen volledig weg."
    } else {
      aoIncome = (cappedWage(norms, a.wage) * norms.social.wiaIvaPct) / 100 + (a.taxable - a.wage)
      aoExplain = `Na 2 jaar loondoorbetaling (minimaal ${norms.social.ziekteLoondoorbetalingPct}%) ontvang je bij volledige en duurzame arbeidsongeschiktheid een IVA-uitkering van ${norms.social.wiaIvaPct}% van het (gemaximeerde) loon.`
    }
    const aoRemaining = remainingWith(persons({ [a.id]: { taxable: aoIncome, labour: 0 } }), baseNetMonthly)
    const aoLight = aoRemaining >= 0 ? "green" : budgetLight(aoRemaining, ctx.bufferSavings, 24)
    results.push({
      key: `ao_${a.id}`,
      label: `Arbeidsongeschiktheid ${a.label}`,
      light: aoLight,
      metrics: [
        { label: "Bruto jaarinkomen bij arbeidsongeschiktheid", value: aoIncome, unit: "EUR" },
        { label: "Vrij besteedbaar per maand", value: aoRemaining, unit: "EUR/maand" },
      ],
      explanation: aoExplain,
      tips:
        aoLight === "green"
          ? []
          : a.isEntrepreneur
            ? ["Sluit een AOV af of word lid van een broodfonds.", "Houd een buffer aan van minimaal 6 maanden vaste lasten."]
            : ["Overweeg een WIA-hiaat- of woonlastenverzekering."],
    })

    if (a.isEntrepreneur) {
      const remaining = remainingWith(persons({ [a.id]: { taxable: 0, labour: 0 } }), baseNetMonthly)
      const monthsCovered = remaining < 0 ? ctx.bufferSavings / -remaining : Infinity
      results.push({
        key: `ww_${a.id}`,
        label: `Wegvallen opdrachten ${a.label}`,
        light: remaining >= 0 ? "green" : monthsCovered >= 12 ? "orange" : "red",
        metrics: [
          { label: "Tekort per maand zonder inkomen", value: Math.min(0, remaining), unit: "EUR/maand" },
          { label: "Maanden te overbruggen met buffer", value: Number.isFinite(monthsCovered) ? monthsCovered : 999, unit: "maanden" },
        ],
        explanation: "Ondernemers hebben geen recht op WW. Je buffer moet een periode zonder opdrachten opvangen.",
        tips: remaining >= 0 ? [] : ["Bouw een buffer op van minimaal 12 maanden vaste lasten."],
      })
    } else {
      const months = wwMonths(norms, a.yearsWorked)
      const wwIncome = (cappedWage(norms, a.wage) * norms.social.wwDaarnaPct) / 100 + (a.taxable - a.wage)
      const remaining = remainingWith(persons({ [a.id]: { taxable: wwIncome, labour: 0 } }), baseNetMonthly)
      const afterRemaining = remainingWith(persons({ [a.id]: { taxable: a.taxable - a.wage, labour: 0 } }), baseNetMonthly)
      const light: Light = remaining >= 0 ? (afterRemaining >= 0 ? "green" : "orange") : budgetLight(remaining, ctx.bufferSavings, months)
      results.push({
        key: `ww_${a.id}`,
        label: `Werkloosheid ${a.label}`,
        light,
        metrics: [
          { label: "WW-duur", value: months, unit: "maanden" },
          { label: "Vrij besteedbaar tijdens WW", value: remaining, unit: "EUR/maand" },
          { label: "Vrij besteedbaar na afloop WW", value: afterRemaining, unit: "EUR/maand" },
        ],
        explanation: `WW: eerste 2 maanden ${norms.social.wwEersteMaandenPct}%, daarna ${norms.social.wwDaarnaPct}% van het (gemaximeerde) dagloon, gedurende ${months} maanden op basis van je arbeidsverleden.`,
        tips: light === "green" ? [] : ["Houd een buffer aan voor de periode na afloop van de WW."],
      })
    }
  }

  // 5. Overlijden (bij twee aanvragers)
  if (applicants.length === 2) {
    for (const a of applicants) {
      const survivor = applicants.find((x) => x.id !== a.id)!
      const anw = ctx.childrenUnder18 > 0 ? norms.social.anwMaand * 12 : 0
      const survivorTaxable = survivor.taxable + a.survivorPensionAnnual + anw
      const remainingLoan = Math.max(0, ctx.loanAmount - a.orvCoverage)
      const max = ctx.capacity([toCapacity(survivor, survivor.toetsinkomen + a.survivorPensionAnnual + anw)])
      const ratio = remainingLoan > 0 ? max / remainingLoan : 10
      const scale = ctx.loanAmount > 0 ? remainingLoan / ctx.loanAmount : 0
      const remaining = remainingWith(
        [{ taxable: survivorTaxable, labour: survivor.labour, aow: survivor.reachedAow }],
        baseNetMonthly * scale
      )
      const light = ratioLight(ratio) === "green" || remaining >= 0 ? (ratio >= 1 ? "green" : "orange") : "red"
      results.push({
        key: `overlijden_${a.id}`,
        label: `Overlijden ${a.label}`,
        light,
        metrics: [
          { label: "Uitkering overlijdensrisicoverzekering", value: a.orvCoverage, unit: "EUR" },
          { label: "Resterende hypotheek", value: remainingLoan, unit: "EUR" },
          { label: "Maximale hypotheek nabestaande", value: max, unit: "EUR" },
          { label: "Vrij besteedbaar nabestaande", value: remaining, unit: "EUR/maand" },
        ],
        explanation: `De nabestaande houdt het eigen inkomen, eventueel nabestaandenpensioen${ctx.childrenUnder18 > 0 ? " en een ANW-uitkering (kinderen onder 18)" : ""}.`,
        tips: light === "green" ? [] : ["Sluit een overlijdensrisicoverzekering af die de hypotheek (deels) aflost."],
      })
    }
  }

  // 6. Pensionering
  const retirementMonths = applicants.filter((a) => !a.reachedAow).map((a) => a.monthsUntilAow)
  if (retirementMonths.length > 0) {
    const at = Math.max(...retirementMonths)
    const afterTerm = at >= ctx.projection.years.length * 12
    const yearIdx = Math.max(0, Math.floor(at / 12) - 1)
    const row = afterTerm ? null : ctx.projection.years[yearIdx]
    const balance = row?.balanceEnd ?? 0
    const max = ctx.capacity(applicants.map((a) => toCapacity(a, a.retirementIncome, true)))
    const ratio = balance > 0 ? max / balance : 10
    // Valt de pensionering na de looptijd, dan zijn er geen hypotheeklasten meer.
    const netAtRetirement = row?.netMonthly ?? 0
    const remaining = remainingWith(
      applicants.map((a) => ({ taxable: a.retirementIncome, labour: 0, aow: true })),
      netAtRetirement
    )
    results.push({
      key: "pensioen",
      label: "Pensionering",
      light: ratio >= 1 && remaining >= 0 ? "green" : remaining >= 0 ? "orange" : "red",
      metrics: [
        { label: "Restschuld bij pensionering", value: balance, unit: "EUR" },
        { label: "Maximale hypotheek op pensioeninkomen", value: max, unit: "EUR" },
        { label: "Vrij besteedbaar na pensionering", value: remaining, unit: "EUR/maand" },
      ],
      explanation: "Na pensionering daalt het inkomen naar AOW en pensioen. De restschuld moet dan passen bij dat inkomen.",
      tips: ratio >= 1 ? [] : ["Los vóór je pensioen extra af of bouw aanvullend pensioen op (lijfrente/jaarruimte)."],
    })
  }

  // 7. Echtscheiding
  if (applicants.length === 2) {
    const equity = Math.max(0, ctx.propertyValue - ctx.loanAmount)
    for (const a of applicants) {
      const needed = ctx.loanAmount + equity / 2
      const max = ctx.capacity([toCapacity(a)])
      const ratio = needed > 0 ? max / needed : 10
      results.push({
        key: `scheiding_${a.id}`,
        label: `Scheiding: ${a.label} houdt de woning`,
        light: ratioLight(ratio),
        metrics: [
          { label: "Benodigd (hypotheek + uitkoop helft overwaarde)", value: needed, unit: "EUR" },
          { label: "Maximale hypotheek alleen", value: max, unit: "EUR" },
          { label: "Leenruimte-ratio", value: ratio, unit: "factor" },
        ],
        explanation: `Om de woning alleen te houden, moet ${a.label} de hele hypotheek overnemen en de partner uitkopen.`,
        tips: ratio >= 1 ? [] : ["Leg afspraken over de woning vast in samenlevingscontract of huwelijkse voorwaarden."],
      })
    }
  }

  // 8. Waardedaling
  for (const drop of [10, 20]) {
    const value = ctx.propertyValue * (1 - drop / 100)
    const ltv = value > 0 ? (ctx.loanAmount / value) * 100 : 0
    const restschuld = Math.max(0, ctx.loanAmount - value * (1 - ctx.saleCostsPct / 100))
    results.push({
      key: `waardedaling_${drop}`,
      label: `Waardedaling woning −${drop}%`,
      light: ltv <= 100 ? "green" : ltv <= 110 ? "orange" : "red",
      metrics: [
        { label: "Woningwaarde", value, unit: "EUR" },
        { label: "Loan-to-value", value: ltv, unit: "%" },
        { label: "Restschuld bij verkoop", value: restschuld, unit: "EUR" },
      ],
      explanation:
        restschuld > 0
          ? "Bij verkoop in deze situatie houd je een restschuld over."
          : "Ook na deze waardedaling is verkoop zonder restschuld mogelijk.",
      tips: restschuld > 0 ? ["Los in de eerste jaren extra af om het restschuldrisico te beperken; NHG kan een restschuld kwijtschelden bij gedwongen verkoop."] : [],
    })
  }
  return results
}

export const STRESS_NORM_KEYS = [NORM_KEYS.wia, NORM_KEYS.ww, NORM_KEYS.wwDuur, NORM_KEYS.anw, NORM_KEYS.maxDagloon]
