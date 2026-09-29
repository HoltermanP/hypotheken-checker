import { annuityPayment } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import type { Obligation } from "../types"

/**
 * Maandlast van financiële verplichtingen die de toegestane financieringslast verlagen.
 *
 * - Doorlopend krediet en persoonlijke lening: 2% van de kredietlimiet / oorspronkelijke hoofdsom
 *   per maand (NHG V&N; norm trhk.bkr_limit_pct_per_month).
 * - Private lease: werkelijke maandtermijn × factor (norm trhk.private_lease_rule).
 * - Studieschuld (Trhk art. 3a): werkelijke DUO-maandtermijn × bruteringsfactor bij de toetsrente.
 *   In de aanloopfase, aflosvrije periode of bij draagkracht: termijn berekend op basis van
 *   actuele restschuld, rente en resterende looptijd.
 * - Overige verplichtingen: werkelijke maandtermijn.
 * - Partneralimentatie verlaagt het toetsinkomen en zit dus NIET in deze maandlast.
 */

export interface ObligationBurden {
  id: string
  type: Obligation["type"]
  monthly: number
  formula: string
  normKey?: string
}

export function studentLoanFactor(norms: NormValues, toetsrentePct: number): number {
  const rate = Math.round(toetsrentePct * 1000) / 1000
  for (const [from, to, factor] of norms.trhk.studieschuldFactors) {
    if (rate >= from && (to === null || rate <= to)) return factor
  }
  return norms.trhk.studieschuldFactors[norms.trhk.studieschuldFactors.length - 1]![2]
}

export function studentLoanMonthly(ob: Obligation): number {
  if (ob.studentLoanReducedPhase && ob.outstanding > 0) {
    return annuityPayment(
      ob.outstanding,
      ob.studentLoanRatePct ?? 0,
      Math.max(1, ob.studentLoanRemainingMonths ?? 420)
    )
  }
  return ob.monthlyPayment
}

export function obligationBurdens(
  obligations: Obligation[],
  norms: NormValues,
  toetsrentePct: number
): ObligationBurden[] {
  const out: ObligationBurden[] = []
  for (const ob of obligations) {
    if (ob.willBeRepaid || ob.type === "alimony_partner") continue
    switch (ob.type) {
      case "revolving_credit":
      case "personal_loan": {
        const monthly = (ob.limitOrPrincipal * norms.trhk.bkrPctPerMonth) / 100
        out.push({
          id: ob.id,
          type: ob.type,
          monthly,
          formula: `${norms.trhk.bkrPctPerMonth}% × ${ob.limitOrPrincipal}`,
          normKey: NORM_KEYS.bkr,
        })
        break
      }
      case "private_lease": {
        const monthly = ob.monthlyPayment * norms.trhk.privateLeaseFactor
        out.push({
          id: ob.id,
          type: ob.type,
          monthly,
          formula: `${ob.monthlyPayment} × ${norms.trhk.privateLeaseFactor}`,
          normKey: NORM_KEYS.privateLease,
        })
        break
      }
      case "student_loan": {
        const base = studentLoanMonthly(ob)
        const factor = studentLoanFactor(norms, toetsrentePct)
        out.push({
          id: ob.id,
          type: ob.type,
          monthly: base * factor,
          formula: `${base.toFixed(2)} × bruteringsfactor ${factor}`,
          normKey: NORM_KEYS.studieschuld,
        })
        break
      }
      default:
        out.push({ id: ob.id, type: ob.type, monthly: ob.monthlyPayment, formula: "werkelijke maandtermijn" })
    }
  }
  return out
}

export function totalAlimonyPaidAnnual(obligations: Obligation[]): number {
  return obligations
    .filter((o) => o.type === "alimony_partner" && !o.willBeRepaid)
    .reduce((a, o) => a + o.monthlyPayment * 12, 0)
}
