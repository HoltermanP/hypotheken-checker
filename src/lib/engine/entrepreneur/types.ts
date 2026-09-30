/**
 * Invoertypen voor ondernemers (eenmanszaak, vof, maatschap, cv, BV en BV met holding).
 */

export type LegalForm = "eenmanszaak" | "vof" | "maatschap" | "cv" | "bv" | "bv_holding"

export type Sector =
  | "zakelijke_dienstverlening"
  | "ict"
  | "zorg"
  | "bouw"
  | "horeca"
  | "detailhandel"
  | "groothandel"
  | "transport"
  | "industrie"
  | "agrarisch"
  | "creatief"
  | "overig"

/** Cijfers per jaar voor eenmanszaak/vof/maatschap/cv (IB-ondernemer). */
export interface SolePropYear {
  year: number
  revenue: number
  /** Winst uit onderneming vóór ondernemersaftrek (bij vof: het eigen winstaandeel). */
  profit: number
  depreciation: number
  investments: number
  privateWithdrawals: number
  /** Incidentele baten (worden eruit gehaald). */
  incidentalGains: number
  /** Incidentele lasten (worden teruggeteld). */
  incidentalLosses: number
  /** Afname van de FOR in dit jaar (telt mee als inkomen). */
  forDecrease: number
  hoursCriterionMet: boolean
  isForecast?: boolean
}

/** Jaarcijfers van een BV (per entiteit of geconsolideerd). */
export interface BvYear {
  year: number
  revenue: number
  resultBeforeTax: number
  corporateTax: number
  resultAfterTax: number
  dividendPaid: number
  /** Winstreserves / overige reserves (vrij uitkeerbaar). */
  retainedEarnings: number
  equity: number
  balanceTotal: number
  liquidAssets: number
  currentAssets: number
  currentLiabilities: number
  longTermLiabilities: number
  /** Ontvangen management fee (holding) of betaalde fee (werkmaatschappij). */
  managementFeeReceived: number
  managementFeePaid: number
  /** Salaris DGA dat door deze entiteit wordt betaald. */
  dgaSalaryPaid: number
  /** Onderlinge vorderingen op/van groepsmaatschappijen (voor eliminatie). */
  intercompanyReceivables: number
  intercompanyPayables: number
  /** Resultaat uit deelnemingen (holding; wordt bij consolidatie geëlimineerd). */
  resultFromParticipations: number
  /** Boekwaarde van deelnemingen (holding; wordt bij consolidatie geëlimineerd). */
  participationsValue: number
  /** Incidentele posten vóór belasting (+ = bate, − = last); worden uit de winstcapaciteit gehaald. */
  incidentalItems?: number
  isForecast?: boolean
}

export interface BvEntity {
  key: string
  name: string
  role: "holding" | "werkmaatschappij"
  /** Parent-entiteit (null = direct gehouden door de aanvrager). */
  parentKey: string | null
  /** Belang van de parent (of de aanvrager) in deze entiteit. */
  ownershipPct: number
  financials: BvYear[]
}

export interface DgaLoan {
  id: string
  amount: number
  purpose: "eigen_woning" | "consumptief" | "overig"
  /** Hypotheekrecht gevestigd ten behoeve van de BV. */
  mortgageRight: boolean
  /** Eigenwoningschuld die al bestond op 31-12-2022 (overgangsrecht). */
  existedBefore2023: boolean
  ratePct: number
}

export interface BusinessGuarantee {
  amount: number
  description: string
  jointAndSeveral: boolean
}

export interface ManagementFee {
  annual: number
  contractual: boolean
  structural: boolean
  armsLength: boolean
}

export interface BusinessInput {
  id: string
  legalForm: LegalForm
  startDate: string
  sector: Sector
  /** Winstaandeel bij vof/maatschap/cv (%). */
  profitSharePct: number
  soleProp?: {
    years: SolePropYear[]
    forBalance: number
    /** Prognose voor het lopende jaar (starters). */
    forecastProfit?: number | null
  }
  bv?: {
    /** Effectief belang van de aanvrager in de (top)entiteit (%). */
    shareholdingPct: number
    statutoryDirector: boolean
    /** Salaris DGA per jaar. */
    salaries: { year: number; amount: number }[]
    carBenefit: number
    pensionAccrual: number
    entities: BvEntity[]
    fiscalUnity: boolean
    /** Geconsolideerde cijfers indien aangeleverd (anders berekent de engine ze). */
    consolidated?: BvYear[] | null
    managementFee?: ManagementFee | null
    /** Rekening-courant DGA ↔ BV: positief = DGA is schuldig aan de BV. */
    currentAccountDga: number
    loansToDga: DgaLoan[]
    /** Geplaatst kapitaal (niet uitkeerbaar). */
    issuedCapital: number
  }
  /** Inkomensverklaring Ondernemer (IVO) toetsinkomen, indien beschikbaar. */
  ivoIncome?: number | null
  /** Omzetaandeel van de grootste opdrachtgever (%). */
  largestClientPct: number
  orderBookMonths?: number | null
  aov: { has: boolean; monthlyBenefit: number }
  broodfonds?: boolean
  annuityPremiumAnnual: number
  businessDebts: number
  guarantees: BusinessGuarantee[]
  /** Datum waarop de volgende jaarrekening beschikbaar is (ISO). */
  nextFiguresDate?: string | null
  /** Verwachte winst (of resultaat na belasting) van het lopende jaar. */
  expectedCurrentYearProfit?: number | null
  /** Toelichting bij grote schommelingen (incidentele posten). */
  fluctuationExplanation?: string | null
}
