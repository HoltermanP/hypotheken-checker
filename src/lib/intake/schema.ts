import { z } from "zod"

/**
 * Zod-schema's voor de intake-wizard. Eén schema per stap; samen vormen ze `IntakeData`.
 * Bedragen zijn getallen in euro's (jaarbedragen tenzij het veld anders zegt).
 */

const eur = z.number({ error: "Vul een bedrag in" }).min(0, "Bedrag kan niet negatief zijn")
const pct = z.number({ error: "Vul een percentage in" }).min(0).max(100)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vul een datum in")
const optionalDate = z.union([isoDate, z.literal(""), z.null()]).optional()
const id = z.string().min(1)

export const GOALS = ["starter", "doorstromer", "oversluiten", "verhogen", "verkopen", "orientatie"] as const
export const ENERGY_LABELS = ["A++++EPG", "A++++", "A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G", "geen"] as const
export const LEGAL_FORMS = ["eenmanszaak", "vof", "maatschap", "cv", "bv", "bv_holding"] as const
export const SECTORS = [
  "zakelijke_dienstverlening",
  "ict",
  "zorg",
  "bouw",
  "horeca",
  "detailhandel",
  "groothandel",
  "transport",
  "industrie",
  "agrarisch",
  "creatief",
  "overig",
] as const

// ----------------------------------------------------------------------------- stap: doel
export const goalStep = z.object({
  goal: z.enum(GOALS),
  title: z.string().trim().max(80).optional(),
})

// ----------------------------------------------------------------------------- stap: persoonlijk
export const applicantPersonal = z.object({
  firstName: z.string().trim().max(60).optional(),
  dateOfBirth: isoDate,
  previousHomeOwner: z.boolean(),
  usedStartersExemption: z.boolean(),
  yearsWorked: z.number().int().min(0).max(60).nullable().optional(),
})

export const personalStep = z.object({
  hasPartner: z.boolean(),
  applicants: z.array(applicantPersonal).min(1).max(2),
  maritalStatus: z.enum(["single", "married", "registered_partnership", "cohabiting"]),
  prenup: z.enum(["none", "prenuptial", "limited_community"]),
  children: z.number().int().min(0).max(15),
  childrenUnder18: z.number().int().min(0).max(15),
})

// ----------------------------------------------------------------------------- stap: inkomen
export const incomeItem = z.discriminatedUnion("kind", [
  z.object({
    id,
    kind: z.literal("employment"),
    employer: z.string().trim().max(80).optional(),
    contract: z.enum(["permanent", "temporary_with_intent", "temporary", "flex", "perspectiefverklaring"]),
    grossAnnualSalary: eur,
    holidayPay: eur,
    thirteenthMonth: eur,
    fixedYearEndBonus: eur,
    irregularityAllowance: eur,
    commission: eur,
    iblToetsinkomen: eur.nullable().optional(),
  }),
  z.object({
    id,
    kind: z.literal("benefit"),
    benefitType: z.enum(["ww", "wia_iva", "wia_wga", "wajong", "other"]),
    grossAnnual: eur,
    permanent: z.boolean(),
  }),
  z.object({ id, kind: z.literal("pension"), pensionType: z.enum(["aow", "pension", "lijfrente"]), grossAnnual: eur }),
  z.object({ id, kind: z.literal("rental"), grossAnnual: eur }),
  z.object({ id, kind: z.literal("alimony_received"), grossAnnual: eur }),
])

export const applicantIncome = z.object({
  incomes: z.array(incomeItem).max(10),
  isEntrepreneur: z.boolean(),
  expectedRetirementIncome: eur.nullable().optional(),
  alimonyPaidAnnual: eur,
})

export const incomeStep = z.object({ applicants: z.array(applicantIncome).min(1).max(2) })

// ----------------------------------------------------------------------------- stap: ondernemer
export const solePropYear = z.object({
  year: z.number().int().min(2000).max(2100),
  revenue: eur,
  profit: z.number(),
  depreciation: eur,
  investments: eur,
  privateWithdrawals: eur,
  incidentalGains: eur,
  incidentalLosses: eur,
  forDecrease: eur,
  hoursCriterionMet: z.boolean(),
})

export const bvYear = z.object({
  year: z.number().int().min(2000).max(2100),
  revenue: eur,
  resultBeforeTax: z.number(),
  corporateTax: eur,
  resultAfterTax: z.number(),
  dividendPaid: eur,
  retainedEarnings: z.number(),
  equity: z.number(),
  balanceTotal: eur,
  liquidAssets: eur,
  currentAssets: eur,
  currentLiabilities: eur,
  longTermLiabilities: eur,
  managementFeeReceived: eur,
  managementFeePaid: eur,
  dgaSalaryPaid: eur,
  intercompanyReceivables: eur,
  intercompanyPayables: eur,
  resultFromParticipations: z.number(),
  participationsValue: eur,
  incidentalItems: z.number().optional(),
})

export const bvEntity = z.object({
  key: id,
  name: z.string().trim().min(1, "Vul een naam in").max(80),
  role: z.enum(["holding", "werkmaatschappij"]),
  parentKey: z.string().nullable(),
  ownershipPct: pct,
  financials: z.array(bvYear).max(4),
})

export const business = z.object({
  id,
  name: z.string().trim().max(80).optional(),
  kvkNumber: z.string().trim().regex(/^(\d{8})?$/, "Een KvK-nummer heeft 8 cijfers").optional(),
  legalForm: z.enum(LEGAL_FORMS),
  startDate: isoDate,
  sector: z.enum(SECTORS),
  profitSharePct: pct,
  largestClientPct: pct,
  orderBookMonths: z.number().min(0).max(120).nullable().optional(),
  aovHas: z.boolean(),
  aovMonthlyBenefit: eur,
  broodfonds: z.boolean(),
  annuityPremiumAnnual: eur,
  businessDebts: eur,
  guarantees: z.array(z.object({ amount: eur, description: z.string().trim().max(120), jointAndSeveral: z.boolean() })).max(10),
  ivoIncome: eur.nullable().optional(),
  nextFiguresDate: optionalDate,
  expectedCurrentYearProfit: z.number().nullable().optional(),
  fluctuationExplanation: z.string().trim().max(1000).optional(),
  soleProp: z
    .object({
      years: z.array(solePropYear).max(4),
      forBalance: eur,
      forecastProfit: z.number().nullable().optional(),
    })
    .optional(),
  bv: z
    .object({
      shareholdingPct: pct,
      statutoryDirector: z.boolean(),
      salaries: z.array(z.object({ year: z.number().int(), amount: eur })).max(4),
      carBenefit: eur,
      pensionAccrual: eur,
      fiscalUnity: z.boolean(),
      currentAccountDga: z.number(),
      issuedCapital: eur,
      managementFee: z.object({
        annual: eur,
        contractual: z.boolean(),
        structural: z.boolean(),
        armsLength: z.boolean(),
      }),
      entities: z.array(bvEntity).min(1).max(5),
      /** Geconsolideerde cijfers (optioneel; anders berekent de engine de consolidatie). */
      consolidated: z.array(bvYear).max(5).optional(),
      loansToDga: z
        .array(
          z.object({
            id,
            amount: eur,
            purpose: z.enum(["eigen_woning", "consumptief", "overig"]),
            mortgageRight: z.boolean(),
            existedBefore2023: z.boolean(),
            ratePct: z.number().min(0).max(20),
          })
        )
        .max(10),
    })
    .optional(),
})

export const entrepreneurStep = z.object({
  applicants: z.array(z.object({ businesses: z.array(business).max(4) })).min(1).max(2),
})

// ----------------------------------------------------------------------------- stap: verplichtingen
export const obligationItem = z.object({
  id,
  applicantPosition: z.number().int().min(1).max(2).nullable(),
  type: z.enum(["revolving_credit", "personal_loan", "private_lease", "student_loan", "alimony_partner", "other"]),
  description: z.string().trim().max(80).optional(),
  limitOrPrincipal: eur,
  monthlyPayment: eur,
  outstanding: eur,
  studentLoanReducedPhase: z.boolean().optional(),
  studentLoanRatePct: z.number().min(0).max(10).optional(),
  studentLoanRemainingMonths: z.number().int().min(0).max(600).optional(),
  willBeRepaid: z.boolean().optional(),
})

export const obligationsStep = z.object({
  obligations: z.array(obligationItem).max(20),
  bkrRegistrations: z.string().trim().max(1000).optional(),
})

// ----------------------------------------------------------------------------- stap: vermogen
export const assetsStep = z.object({
  savings: eur,
  investments: eur,
  giftAmount: eur,
  familyLoanAmount: eur,
  familyLoanRatePct: z.number().min(0).max(15),
  eigenwoningreserve: eur,
  desiredBuffer: eur,
  ownFundsToContribute: eur.nullable().optional(),
})

// ----------------------------------------------------------------------------- stap: huidige woning
export const loanPartItem = z.object({
  id,
  type: z.enum(["annuity", "linear", "interest_only", "savings", "investment"]),
  balance: eur,
  ratePct: z.number().min(0).max(15),
  fixedRateEndDate: isoDate,
  endDate: isoDate,
  startedBefore2013: z.boolean(),
  nhg: z.boolean(),
  lender: z.string().trim().max(60).optional(),
  originalPrincipal: eur.nullable().optional(),
  penaltyFreePct: z.number().min(0).max(100).nullable().optional(),
  portOnMove: z.boolean().optional(),
  accruedValue: eur.nullable().optional(),
})

export const currentHomeStep = z.object({
  wozValue: eur,
  marketValue: eur,
  expectedSalePrice: eur,
  energyLabel: z.enum(ENERGY_LABELS),
  erfpachtCanonAnnual: eur,
  loanParts: z.array(loanPartItem).max(10),
  expectedSaleDate: optionalDate,
  brokerFeePct: z.number().min(0).max(5).nullable().optional(),
  moveOrder: z.enum(["buy_first", "sell_first"]).optional(),
  bridgeMonths: z.number().int().min(0).max(36).optional(),
  temporaryHousingMonthly: eur.optional(),
  temporaryHousingMonths: z.number().int().min(0).max(36).optional(),
})

// ----------------------------------------------------------------------------- stap: nieuwe woning
export const targetHomeStep = z.object({
  purchasePrice: eur.min(1, "Vul de koopsom in"),
  marketValue: eur.nullable().optional(),
  wozValue: eur.nullable().optional(),
  kind: z.enum(["existing", "new_build"]),
  propertyType: z.enum(["appartement", "tussenwoning", "hoekwoning", "twee_onder_een_kap", "vrijstaand", "overig"]),
  extraWork: eur,
  constructionMonths: z.number().int().min(0).max(48).nullable().optional(),
  energyLabel: z.enum(ENERGY_LABELS),
  erfpachtCanonAnnual: eur,
  renovationAmount: eur,
  energySavingAmount: eur,
  hoaMonthly: eur,
  deliveryDate: optionalDate,
  ownOccupation: z.boolean(),
  useBuyersAgent: z.boolean(),
  useBuildingInspection: z.boolean(),
})

// ----------------------------------------------------------------------------- stap: voorkeuren
export const preferencesStep = z.object({
  fixedRateYears: z.number().int().refine((v) => [1, 2, 3, 5, 6, 7, 10, 12, 15, 20, 25, 30].includes(v), "Kies een rentevaste periode"),
  repaymentType: z.enum(["annuity", "linear", "mixed"]),
  interestOnlyPct: z.number().min(0).max(50),
  nhg: z.enum(["yes", "no", "unknown"]),
  riskAppetite: z.enum(["low", "medium", "high"]),
  maxNetMonthly: eur.nullable().optional(),
  goals: z.array(z.enum(["pensioen", "kinderen", "minder_werken", "eerder_stoppen", "verduurzamen", "vermogen_opbouwen"])),
  equityReleaseAmount: eur.optional(),
  equityReleasePurpose: z.enum(["renovation", "energy", "consumption", "business", "gift_children", "pension"]).optional(),
  showHomeInBv: z.boolean().optional(),
})

// ----------------------------------------------------------------------------- stap: risico's
export const risksStep = z.object({
  applicants: z
    .array(
      z.object({
        aovMonthlyBenefit: eur.nullable().optional(),
        orvCoverage: eur.nullable().optional(),
        survivorPensionAnnual: eur.nullable().optional(),
        unemploymentRisk: z.enum(["low", "medium", "high"]),
        incomeOutlook: z.enum(["rising", "stable", "falling"]),
      })
    )
    .min(1)
    .max(2),
  otherFixedCostsMonthly: eur.nullable().optional(),
})

export const STEP_SCHEMAS = {
  doel: goalStep,
  persoonlijk: personalStep,
  inkomen: incomeStep,
  ondernemer: entrepreneurStep,
  verplichtingen: obligationsStep,
  vermogen: assetsStep,
  "huidige-woning": currentHomeStep,
  "nieuwe-woning": targetHomeStep,
  voorkeuren: preferencesStep,
  risicos: risksStep,
} as const

export type StepKey = keyof typeof STEP_SCHEMAS | "overzicht"
export type GoalStep = z.infer<typeof goalStep>
export type PersonalStep = z.infer<typeof personalStep>
export type IncomeStep = z.infer<typeof incomeStep>
export type EntrepreneurStep = z.infer<typeof entrepreneurStep>
export type ObligationsStep = z.infer<typeof obligationsStep>
export type AssetsStep = z.infer<typeof assetsStep>
export type CurrentHomeStep = z.infer<typeof currentHomeStep>
export type TargetHomeStep = z.infer<typeof targetHomeStep>
export type PreferencesStep = z.infer<typeof preferencesStep>
export type RisksStep = z.infer<typeof risksStep>
export type BusinessForm = z.infer<typeof business>
export type IncomeItem = z.infer<typeof incomeItem>

export interface IntakeData {
  doel?: GoalStep
  persoonlijk?: PersonalStep
  inkomen?: IncomeStep
  ondernemer?: EntrepreneurStep
  verplichtingen?: ObligationsStep
  vermogen?: AssetsStep
  "huidige-woning"?: CurrentHomeStep
  "nieuwe-woning"?: TargetHomeStep
  voorkeuren?: PreferencesStep
  risicos?: RisksStep
}
