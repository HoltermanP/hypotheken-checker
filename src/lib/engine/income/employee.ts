import type { Income } from "../types"

/**
 * Toetsinkomen uit loondienst, uitkering, pensioen en overige bronnen (Trhk art. 2 / NHG V&N C.7).
 *
 * Regels (per inkomensbron):
 * - Vast contract, tijdelijk met intentieverklaring of perspectiefverklaring: bruto jaarsalaris +
 *   vakantiegeld + vaste 13e maand + vaste eindejaarsuitkering + structurele ORT + structurele
 *   provisie.
 * - Tijdelijk zonder intentie of flexibel: IBL-toetsinkomen (Inkomensbepaling Loondienst). Zonder
 *   IBL telt dit inkomen niet mee.
 * - Uitkering: alleen duurzame uitkeringen (IVA, Wajong, pensioen) tellen mee; WW telt niet mee.
 * - Pensioen/AOW/lijfrente: telt volledig mee.
 * - Ontvangen partneralimentatie: telt mee (NHG C.7.14) zolang er recht op is.
 * - Huurinkomsten: tellen standaard niet mee in de Trhk-toets (geen vast inkomen); zie toelichting.
 */

export type IncomeTreatment = "counted" | "ibl" | "not_counted"

export interface IncomeAssessment {
  kind: Income["kind"]
  amount: number
  treatment: IncomeTreatment
  reason: string
  /** Welke acceptatie-eigenschap de bank moet hebben om dit inkomen mee te tellen. */
  requires?: "acceptsIntentieverklaring" | "acceptsFlexIBL" | "acceptsPerspectiefverklaring" | "acceptsBenefits" | "acceptsPension"
}

export function assessIncome(income: Income): IncomeAssessment {
  switch (income.kind) {
    case "employment": {
      const full =
        income.grossAnnualSalary +
        income.holidayPay +
        income.thirteenthMonth +
        income.fixedYearEndBonus +
        income.irregularityAllowance +
        income.commission
      if (income.contract === "permanent") {
        return { kind: income.kind, amount: full, treatment: "counted", reason: "Vast contract: volledig vast inkomen telt mee." }
      }
      if (income.contract === "temporary_with_intent") {
        return {
          kind: income.kind,
          amount: full,
          treatment: "counted",
          reason: "Tijdelijk contract met intentieverklaring: telt mee als vast inkomen.",
          requires: "acceptsIntentieverklaring",
        }
      }
      if (income.contract === "perspectiefverklaring") {
        return {
          kind: income.kind,
          amount: full,
          treatment: "counted",
          reason: "Perspectiefverklaring: telt mee als vast inkomen bij banken die dit accepteren.",
          requires: "acceptsPerspectiefverklaring",
        }
      }
      if (income.iblToetsinkomen && income.iblToetsinkomen > 0) {
        return {
          kind: income.kind,
          amount: income.iblToetsinkomen,
          treatment: "ibl",
          reason: "Flexibel of tijdelijk inkomen zonder intentie: IBL-toetsinkomen (UWV-gegevens) telt mee.",
          requires: "acceptsFlexIBL",
        }
      }
      return {
        kind: income.kind,
        amount: 0,
        treatment: "not_counted",
        reason: "Tijdelijk/flexibel inkomen zonder intentieverklaring of IBL-berekening telt niet mee. Vraag een IBL-berekening aan.",
      }
    }
    case "benefit":
      if (income.permanent && income.benefitType !== "ww") {
        return {
          kind: income.kind,
          amount: income.grossAnnual,
          treatment: "counted",
          reason: "Duurzame uitkering telt mee.",
          requires: "acceptsBenefits",
        }
      }
      return {
        kind: income.kind,
        amount: 0,
        treatment: "not_counted",
        reason: "Tijdelijke uitkering (zoals WW) telt niet mee als toetsinkomen.",
      }
    case "pension":
      return {
        kind: income.kind,
        amount: income.grossAnnual,
        treatment: "counted",
        reason: "Pensioen, AOW en lijfrente-uitkeringen tellen volledig mee.",
        requires: "acceptsPension",
      }
    case "alimony_received":
      return {
        kind: income.kind,
        amount: income.grossAnnual,
        treatment: "counted",
        reason: "Ontvangen partneralimentatie telt mee zolang er recht op is (NHG V&N C.7.14).",
      }
    case "rental":
      return {
        kind: income.kind,
        amount: 0,
        treatment: "not_counted",
        reason: "Huurinkomsten tellen in de standaardtoets niet mee als vast inkomen.",
      }
  }
}

/** Som van het meegetelde inkomen (zonder ondernemersinkomen). */
export function employeeToetsinkomen(incomes: Income[]): { total: number; items: IncomeAssessment[] } {
  const items = incomes.map(assessIncome)
  return { total: items.reduce((a, i) => a + i.amount, 0), items }
}

/** Bruto 'arbeidsinkomen' voor belastingberekening (werkelijk ontvangen, niet het toetsinkomen). */
export function grossIncomeForTax(incomes: Income[]): { labour: number; other: number } {
  let labour = 0
  let other = 0
  for (const inc of incomes) {
    if (inc.kind === "employment") {
      labour +=
        inc.grossAnnualSalary +
        inc.holidayPay +
        inc.thirteenthMonth +
        inc.fixedYearEndBonus +
        inc.irregularityAllowance +
        inc.commission
    } else {
      other += inc.grossAnnual
    }
  }
  return { labour, other }
}
