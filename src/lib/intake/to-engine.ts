import type { BusinessInput } from "@/lib/engine/entrepreneur/types"
import type { Applicant, EngineInput, Income, Obligation } from "@/lib/engine/types"
import type { BusinessForm, IntakeData } from "./schema"

/**
 * Zet de intake om naar de invoer van de rekenkern. Puur en isomorf (ook gebruikt in de
 * wat-als-modus in de browser).
 */

export class IntakeIncompleteError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Intake onvolledig: ${missing.join(", ")}`)
  }
}

export function businessToEngine(b: BusinessForm): BusinessInput {
  // Jaren vóór de startdatum van de onderneming tellen niet mee (de wizard vult standaard 3 jaar voor).
  const startYear = Number(b.startDate.slice(0, 4)) || 0
  const fromStart = <T extends { year: number }>(rows: T[]) => rows.filter((r) => r.year >= startYear)
  return {
    id: b.id,
    legalForm: b.legalForm,
    startDate: b.startDate,
    sector: b.sector,
    profitSharePct: b.profitSharePct,
    soleProp:
      b.legalForm === "bv" || b.legalForm === "bv_holding" || !b.soleProp
        ? undefined
        : { years: fromStart(b.soleProp.years), forBalance: b.soleProp.forBalance, forecastProfit: b.soleProp.forecastProfit ?? null },
    bv:
      (b.legalForm === "bv" || b.legalForm === "bv_holding") && b.bv
        ? {
            shareholdingPct: b.bv.shareholdingPct,
            statutoryDirector: b.bv.statutoryDirector,
            salaries: fromStart(b.bv.salaries),
            carBenefit: b.bv.carBenefit,
            pensionAccrual: b.bv.pensionAccrual,
            entities: b.bv.entities.map((e) => ({ ...e, parentKey: e.parentKey || null, financials: fromStart(e.financials) })),
            fiscalUnity: b.bv.fiscalUnity,
            consolidated: null,
            managementFee: b.bv.managementFee.annual > 0 ? b.bv.managementFee : null,
            currentAccountDga: b.bv.currentAccountDga,
            loansToDga: b.bv.loansToDga,
            issuedCapital: b.bv.issuedCapital,
          }
        : undefined,
    ivoIncome: b.ivoIncome ?? null,
    largestClientPct: b.largestClientPct,
    orderBookMonths: b.orderBookMonths ?? null,
    aov: { has: b.aovHas, monthlyBenefit: b.aovMonthlyBenefit },
    broodfonds: b.broodfonds,
    annuityPremiumAnnual: b.annuityPremiumAnnual,
    businessDebts: b.businessDebts,
    guarantees: b.guarantees,
    nextFiguresDate: b.nextFiguresDate || null,
    expectedCurrentYearProfit: b.expectedCurrentYearProfit ?? null,
    fluctuationExplanation: b.fluctuationExplanation ?? null,
  }
}

export function intakeToEngineInput(
  intake: IntakeData,
  opts: {
    calculationDate: string
    referenceRatePct: number
    skipped?: string[]
    documentChecks?: EngineInput["documentChecks"]
    confirmedDocTypes?: string[]
  }
): EngineInput {
  const missing: string[] = []
  const goal = intake.doel?.goal
  if (!goal) missing.push("doel")
  if (!intake.persoonlijk) missing.push("persoonlijk")
  if (!intake.inkomen) missing.push("inkomen")
  if (!intake.vermogen) missing.push("vermogen")
  if (!intake.voorkeuren) missing.push("voorkeuren")
  if (goal && ["doorstromer", "oversluiten", "verhogen", "verkopen"].includes(goal) && !intake["huidige-woning"]) missing.push("huidige-woning")
  if (goal && ["starter", "doorstromer"].includes(goal) && !intake["nieuwe-woning"]) missing.push("nieuwe-woning")
  if (missing.length > 0) throw new IntakeIncompleteError(missing)

  const p = intake.persoonlijk!
  const inc = intake.inkomen!
  const risks = intake.risicos?.applicants ?? []
  const count = p.hasPartner ? 2 : 1
  const applicants: Applicant[] = p.applicants.slice(0, count).map((a, i) => {
    const ai = inc.applicants[i] ?? { incomes: [], isEntrepreneur: false, alimonyPaidAnnual: 0 }
    const businesses = ai.isEntrepreneur ? (intake.ondernemer?.applicants[i]?.businesses ?? []).map(businessToEngine) : []
    const r = risks[i]
    const incomes: Income[] = ai.incomes.map((x) => {
      switch (x.kind) {
        case "employment":
          return {
            kind: "employment",
            contract: x.contract,
            grossAnnualSalary: x.grossAnnualSalary,
            holidayPay: x.holidayPay,
            thirteenthMonth: x.thirteenthMonth,
            fixedYearEndBonus: x.fixedYearEndBonus,
            irregularityAllowance: x.irregularityAllowance,
            commission: x.commission,
            iblToetsinkomen: x.iblToetsinkomen ?? null,
          }
        case "benefit":
          return { kind: "benefit", benefitType: x.benefitType, grossAnnual: x.grossAnnual, permanent: x.permanent }
        case "pension":
          return { kind: "pension", pensionType: x.pensionType, grossAnnual: x.grossAnnual }
        default:
          return { kind: x.kind, grossAnnual: x.grossAnnual }
      }
    })
    return {
      id: i === 0 ? "a1" : "a2",
      dateOfBirth: a.dateOfBirth,
      incomes,
      businesses,
      expectedRetirementIncome: ai.expectedRetirementIncome ?? null,
      previousHomeOwner: a.previousHomeOwner,
      usedStartersExemption: a.usedStartersExemption,
      alimonyPaidAnnual: ai.alimonyPaidAnnual,
      aovMonthlyBenefit: r?.aovMonthlyBenefit ?? null,
      orvCoverage: r?.orvCoverage ?? null,
      survivorPensionAnnual: r?.survivorPensionAnnual ?? null,
      yearsWorked: a.yearsWorked ?? null,
    }
  })

  const obligations: Obligation[] = (intake.verplichtingen?.obligations ?? []).map((o) => ({
    id: o.id,
    type: o.type,
    limitOrPrincipal: o.limitOrPrincipal,
    monthlyPayment: o.monthlyPayment,
    outstanding: o.outstanding,
    studentLoanReducedPhase: o.studentLoanReducedPhase,
    studentLoanRatePct: o.studentLoanRatePct,
    studentLoanRemainingMonths: o.studentLoanRemainingMonths,
    willBeRepaid: o.willBeRepaid,
  }))

  const ch = intake["huidige-woning"]
  const th = intake["nieuwe-woning"]
  const pref = intake.voorkeuren!
  const v = intake.vermogen!
  return {
    calculationDate: opts.calculationDate,
    goal: goal!,
    applicants,
    household: {
      children: p.children,
      childrenUnder18: p.childrenUnder18,
      maritalStatus: p.maritalStatus,
      prenup: p.prenup,
      otherFixedCostsMonthly: intake.risicos?.otherFixedCostsMonthly ?? null,
    },
    obligations,
    assets: {
      savings: v.savings,
      investments: v.investments,
      giftAmount: v.giftAmount,
      familyLoanAmount: v.familyLoanAmount,
      familyLoanRatePct: v.familyLoanRatePct,
      eigenwoningreserve: v.eigenwoningreserve,
      desiredBuffer: v.desiredBuffer,
      ownFundsToContribute: v.ownFundsToContribute ?? null,
    },
    currentProperty: ch
      ? {
          wozValue: ch.wozValue,
          marketValue: ch.marketValue,
          expectedSalePrice: ch.expectedSalePrice,
          energyLabel: ch.energyLabel,
          erfpachtCanonAnnual: ch.erfpachtCanonAnnual,
          expectedSaleDate: ch.expectedSaleDate || null,
          brokerFeePct: ch.brokerFeePct ?? null,
          loanParts: ch.loanParts.map((lp) => ({
            id: lp.id,
            type: lp.type,
            balance: lp.balance,
            ratePct: lp.ratePct,
            fixedRateEndDate: lp.fixedRateEndDate,
            endDate: lp.endDate,
            startedBefore2013: lp.startedBefore2013,
            nhg: lp.nhg,
            originalPrincipal: lp.originalPrincipal ?? null,
            penaltyFreePct: lp.penaltyFreePct ?? null,
            portOnMove: lp.portOnMove ?? false,
            accruedValue: lp.accruedValue ?? null,
          })),
        }
      : null,
    targetProperty:
      th && !(opts.skipped ?? []).includes("nieuwe-woning")
        ? {
            purchasePrice: th.purchasePrice,
            marketValue: th.marketValue ?? null,
            wozValue: th.wozValue ?? null,
            kind: th.kind,
            extraWork: th.extraWork,
            constructionMonths: th.constructionMonths ?? null,
            energyLabel: th.energyLabel,
            erfpachtCanonAnnual: th.erfpachtCanonAnnual,
            renovationAmount: th.renovationAmount,
            energySavingAmount: th.energySavingAmount,
            hoaMonthly: th.hoaMonthly,
            deliveryDate: th.deliveryDate || null,
            ownOccupation: th.ownOccupation,
            useBuyersAgent: th.useBuyersAgent,
            useBuildingInspection: th.useBuildingInspection,
          }
        : null,
    preferences: {
      fixedRateYears: pref.fixedRateYears,
      repaymentType: pref.repaymentType,
      interestOnlyPct: pref.interestOnlyPct,
      nhg: pref.nhg,
      riskAppetite: pref.riskAppetite,
      maxNetMonthly: pref.maxNetMonthly ?? null,
      goals: pref.goals,
    },
    move:
      goal === "doorstromer" && ch
        ? {
            order: ch.moveOrder ?? "sell_first",
            bridgeMonths: ch.bridgeMonths ?? 6,
            temporaryHousingMonthly: ch.temporaryHousingMonthly ?? 0,
            temporaryHousingMonths: ch.temporaryHousingMonths ?? 0,
          }
        : null,
    equityRelease:
      goal === "verhogen" && pref.equityReleaseAmount
        ? { amount: pref.equityReleaseAmount, purpose: pref.equityReleasePurpose ?? "renovation" }
        : null,
    referenceRatePct: opts.referenceRatePct,
    documentChecks: opts.documentChecks,
    confirmedDocTypes: opts.confirmedDocTypes,
    flags: { showHomeInBv: pref.showHomeInBv ?? false },
  }
}
