import type { EnergyLabel } from "./norms"
import type { BusinessInput } from "./entrepreneur/types"

/**
 * Invoertypen van de rekenkern. Alle bedragen in euro's, alle percentages in procenten (5 = 5%),
 * alle datums als ISO-string (YYYY-MM-DD). De engine leest nooit de systeemklok: de
 * berekeningsdatum zit in de invoer, zodat de uitkomst deterministisch is.
 */

export type Goal = "starter" | "doorstromer" | "oversluiten" | "verhogen" | "verkopen" | "orientatie"

export type ContractType =
  | "permanent"
  | "temporary_with_intent"
  | "temporary"
  | "flex"
  | "perspectiefverklaring"

export interface EmploymentIncome {
  kind: "employment"
  contract: ContractType
  /** Bruto jaarsalaris exclusief vakantiegeld en 13e maand. */
  grossAnnualSalary: number
  holidayPay: number
  thirteenthMonth: number
  fixedYearEndBonus: number
  /** Structurele onregelmatigheidstoeslag (ORT). */
  irregularityAllowance: number
  /** Structurele provisie (gemiddelde). */
  commission: number
  /** IBL-toetsinkomen (Inkomensbepaling Loondienst) indien beschikbaar. */
  iblToetsinkomen?: number | null
}

export interface BenefitIncome {
  kind: "benefit"
  benefitType: "ww" | "wia_iva" | "wia_wga" | "wajong" | "other"
  grossAnnual: number
  /** Duurzaam (bijv. IVA, Wajong) of tijdelijk (bijv. WW). */
  permanent: boolean
}

export interface PensionIncome {
  kind: "pension"
  pensionType: "aow" | "pension" | "lijfrente"
  grossAnnual: number
}

export interface OtherIncome {
  kind: "rental" | "alimony_received"
  grossAnnual: number
}

export type Income = EmploymentIncome | BenefitIncome | PensionIncome | OtherIncome

export interface Applicant {
  id: "a1" | "a2"
  dateOfBirth: string
  incomes: Income[]
  businesses: BusinessInput[]
  /** Verwacht bruto pensioeninkomen per jaar vanaf AOW-leeftijd (AOW + pensioen), indien bekend. */
  expectedRetirementIncome?: number | null
  /** Heeft eerder een eigen woning gehad (startersvrijstelling al gebruikt / EWR). */
  previousHomeOwner: boolean
  /** Startersvrijstelling overdrachtsbelasting al eerder gebruikt. */
  usedStartersExemption: boolean
  /** Betaalde partneralimentatie per jaar (verlaagt het toetsinkomen). */
  alimonyPaidAnnual: number
  /** Arbeidsongeschiktheids- en overlijdensrisicodekking. */
  aovMonthlyBenefit?: number | null
  orvCoverage?: number | null
  /** Nabestaandenpensioen per jaar voor de partner bij overlijden. */
  survivorPensionAnnual?: number | null
  /** Aantal gewerkte jaren (voor WW-duur). */
  yearsWorked?: number | null
}

export type ObligationType =
  | "revolving_credit"
  | "personal_loan"
  | "private_lease"
  | "student_loan"
  | "alimony_partner"
  | "other"

export interface Obligation {
  id: string
  type: ObligationType
  /** Kredietlimiet (doorlopend krediet) of oorspronkelijke hoofdsom. */
  limitOrPrincipal: number
  /** Actuele maandtermijn (lease, persoonlijke lening, studieschuld). */
  monthlyPayment: number
  /** Resterende schuld. */
  outstanding: number
  /** Studieschuld: nog in aanloopfase / aflosvrije periode / draagkracht. */
  studentLoanReducedPhase?: boolean
  studentLoanRatePct?: number
  studentLoanRemainingMonths?: number
  /** Wordt vóór het passeren afgelost (telt dan niet mee). */
  willBeRepaid?: boolean
}

export interface Assets {
  savings: number
  investments: number
  /** Schenking van ouders (bruto). */
  giftAmount: number
  /** Lening van ouders (familiebank). */
  familyLoanAmount: number
  familyLoanRatePct: number
  /** Eigenwoningreserve uit eerdere verkoop (fiscaal). */
  eigenwoningreserve: number
  /** Buffer die de klant wil aanhouden. */
  desiredBuffer: number
  /** Deel van het spaargeld dat de klant wil inbrengen (null = alles boven de buffer). */
  ownFundsToContribute?: number | null
}

export type LoanPartType = "annuity" | "linear" | "interest_only" | "savings" | "investment"

export interface ExistingLoanPart {
  id: string
  type: LoanPartType
  balance: number
  ratePct: number
  /** Einde rentevaste periode (ISO-datum). */
  fixedRateEndDate: string
  /** Einddatum looptijd (ISO-datum). */
  endDate: string
  /** Ingangsdatum vóór 1-1-2013 (overgangsrecht renteaftrek). */
  startedBefore2013: boolean
  nhg: boolean
  lenderSlug?: string | null
  /** Rente die nu bij de bank geldt voor een nieuwe periode (voor boeterente). */
  currentMarketRatePct?: number | null
  /** Boetevrij aflossen per jaar in % van de hoofdsom. */
  penaltyFreePct?: number | null
  /** Oorspronkelijke hoofdsom (voor boetevrije ruimte). */
  originalPrincipal?: number | null
  /** Bij verhuizing: meenemen of aflossen. */
  portOnMove?: boolean
  /** Opgebouwde waarde (spaar/beleggingsdeel). */
  accruedValue?: number | null
}

export interface CurrentProperty {
  wozValue: number
  marketValue: number
  expectedSalePrice: number
  energyLabel: EnergyLabel
  loanParts: ExistingLoanPart[]
  /** Eigenwoningschuld (fiscaal); standaard = som van box 1-leningdelen. */
  eigenwoningschuld?: number | null
  expectedSaleDate?: string | null
  /** Makelaarscourtage in % (overschrijft de standaard). */
  brokerFeePct?: number | null
  erfpachtCanonAnnual?: number
}

export type PropertyKind = "existing" | "new_build"

export interface TargetProperty {
  purchasePrice: number
  /** Marktwaarde (taxatie); standaard = koopsom. */
  marketValue?: number | null
  /** Marktwaarde na verbouwing; standaard = marktwaarde + verbouwing. */
  marketValueAfterRenovation?: number | null
  wozValue?: number | null
  kind: PropertyKind
  /** Nieuwbouw: meerwerk en bouwrente. */
  extraWork: number
  constructionInterest?: number | null
  constructionMonths?: number | null
  energyLabel: EnergyLabel
  erfpachtCanonAnnual: number
  renovationAmount: number
  energySavingAmount: number
  hoaMonthly: number
  deliveryDate?: string | null
  ownOccupation: boolean
  useBuyersAgent: boolean
  useBuildingInspection: boolean
}

export interface Preferences {
  fixedRateYears: number
  repaymentType: "annuity" | "linear" | "mixed"
  /** Aandeel aflossingsvrij bij 'mixed' (0-50). */
  interestOnlyPct: number
  nhg: "yes" | "no" | "unknown"
  riskAppetite: "low" | "medium" | "high"
  maxNetMonthly?: number | null
  goals: string[]
  /** Gewenste looptijd (maanden), standaard 360. */
  termMonths?: number
}

export interface MoveOptions {
  /** Eerst kopen, dan verkopen (overbrugging) of eerst verkopen. */
  order: "buy_first" | "sell_first"
  bridgeMonths: number
  bridgeRatePct?: number | null
  /** Tijdelijke woonlasten per maand bij eerst verkopen. */
  temporaryHousingMonthly: number
  temporaryHousingMonths: number
}

export interface EquityReleaseRequest {
  /** Gewenst extra bedrag (verhogen / overwaarde opnemen). */
  amount: number
  purpose: "renovation" | "energy" | "consumption" | "business" | "gift_children" | "pension"
}

export interface EngineInput {
  /** Berekeningsdatum (ISO). */
  calculationDate: string
  goal: Goal
  applicants: Applicant[]
  household: {
    children: number
    childrenUnder18: number
    maritalStatus: "single" | "married" | "registered_partnership" | "cohabiting"
    prenup: "none" | "prenuptial" | "limited_community"
    /** Maandelijkse vaste lasten buiten wonen die de klant zelf opgeeft (optioneel). */
    otherFixedCostsMonthly?: number | null
  }
  obligations: Obligation[]
  assets: Assets
  currentProperty?: CurrentProperty | null
  targetProperty?: TargetProperty | null
  preferences: Preferences
  move?: MoveOptions | null
  equityRelease?: EquityReleaseRequest | null
  /** Referentierente als er (nog) geen bankkeuze is (bijv. mediaan van de rentetabel). */
  referenceRatePct: number
  /** Uitkomsten van de documentconsistentiechecks (uit de documentenservice). */
  documentChecks?: { label: string; status: "green" | "orange" | "red"; detail: string }[]
  /** Documenttypes die de gebruiker heeft geüpload en bevestigd. */
  confirmedDocTypes?: string[]
  /** Scenario-overrides die de scenario-engine zet. */
  flags?: {
    /** Rekenen met woning in de BV (alleen tonen op verzoek). */
    showHomeInBv?: boolean
  }
}
