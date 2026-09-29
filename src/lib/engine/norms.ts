/**
 * Getypeerde normenset zoals de rekenkern die gebruikt.
 *
 * De waarden komen uit `norm_values` (database) of uit de seed (`src/lib/norms/seed`). Elke waarde
 * heeft een normsleutel (bijv. "nhg.kostengrens"); de engine verwijst in zijn trace naar die
 * sleutels, zodat elk getal herleidbaar is naar een bron.
 */

export type NormStatus = "verified" | "needs_verification"

export interface NormMeta {
  key: string
  label: string
  year: number
  unit?: string | null
  sourceName?: string | null
  sourceUrl?: string | null
  checkedAt?: string | null
  status: NormStatus
  note?: string | null
}

/** [vanaf, tot (exclusief) of null, tarief in %] */
export type Bracket = [number, number | null, number]

export interface FinancieringslastTable {
  /** [vanaf, tot en met | null] per inkomensrij (euro). */
  incomeBrackets: [number, number | null][]
  /** [vanaf %, tot en met % | null] per toetsrentekolom. */
  rateBrackets: [number, number | null][]
  /** values[rij][kolom] in procenten. */
  values: number[][]
}

/** Energielabelklassen zoals de Trhk ze groepeert. */
export type EnergyLabel =
  | "A++++EPG"
  | "A++++"
  | "A+++"
  | "A++"
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "geen"

export interface HeffingskortingParams {
  /** Algemene heffingskorting */
  ahk: { max: number; afbouwVanaf: number; afbouwPct: number; aowMax: number; aowAfbouwPct: number }
  /** Arbeidskorting: [vanaf, tot, basisbedrag, pct boven 'vanaf'] (pct mag negatief zijn) */
  ak: [number, number | null, number, number][]
  akAow: [number, number | null, number, number][]
}

export interface NormValues {
  trhk: {
    toetsrenteAfmPct: number
    toetsrenteMinFixedYears: number
    annuityYears: number
    partnerIncomePct: number
    bkrPctPerMonth: number
    privateLeaseFactor: number
    /** [vanaf %, tot % | null, factor] */
    studieschuldFactors: [number, number | null, number][]
    energielabelExtra: Record<EnergyLabel, number>
    energieBesparendExtra: Record<EnergyLabel, number>
    maxLtvPct: number
    maxLtvEnergyPct: number
    alleenstaandeExtra: number
    alleenstaandeMinIncomeRegular: number
    alleenstaandeMinIncomeAow: number
    /** AOW-leeftijd in maanden per kalenderjaar waarin die bereikt wordt (bijv. {"2026": 804}). */
    aowAgeMonthsByYear: Record<string, number>
    tables: {
      regular: FinancieringslastTable
      aow: FinancieringslastTable
      box3Regular: FinancieringslastTable
      box3Aow: FinancieringslastTable
    }
  }
  nhg: {
    kostengrens: number
    kostengrensEnergie: number
    provisiePct: number
    rentekortingIndicatiePct: number
  }
  tax: {
    box1: Bracket[]
    box1Aow: Bracket[]
    maxAftrekPct: number
    /** [vanaf WOZ, tot WOZ | null, percentage] — laatste schijf: villataks */
    ewf: Bracket[]
    villataksGrens: number
    villataksPct: number
    hillenAftrekPct: number
    /** Jaarlijkse afbouw Wet Hillen in procentpunt (afgeleid uit twee opeenvolgende jaren). */
    hillenStepPct: number
    heffingskortingen: HeffingskortingParams
  }
  ovb: {
    eigenWoningPct: number
    overigPct: number
    startersMaxLeeftijd: number
    startersWoningwaardegrens: number
  }
  box3: {
    heffingvrijVermogen: number
    forfaitBankPct: number
    forfaitOverigPct: number
    forfaitSchuldenPct: number
    drempelSchulden: number
    tariefPct: number
  }
  schenk: {
    vrijstellingKindJaarlijks: number
    eenmaligVerhoogdKind: number
    jubeltonEigenWoning: number
  }
  ondernemer: {
    zelfstandigenaftrek: number
    startersaftrek: number
    mkbWinstvrijstellingPct: number
    urencriterium: number
    box2: Bracket[]
    vpb: Bracket[]
    gebruikelijkLoon: number
    excessiefLenenDrempel: number
    lijfrenteJaarruimte: {
      pctPremiegrondslag: number
      franchise: number
      maxPremiegrondslag: number
      maxJaarruimte: number
    }
  }
  social: {
    aowJaarAlleenstaand: number
    aowJaarGehuwdPerPersoon: number
    anwMaand: number
    wmlMaand: number
    maxDagloon: number
    wwEersteMaandenPct: number
    wwDaarnaPct: number
    wwMaxMaanden: number
    wiaIvaPct: number
    wiaLoongerelateerdPct: number
    /** WGA-vervolguitkering als % van het minimumloon (middelste klasse 45-55%). */
    wiaVervolgPctWml: number
    wwMinMaanden: number
    wwMaandenPerJaarEerste10: number
    wwMaandenPerJaarDaarna: number
    ziekteLoondoorbetalingPct: number
  }
  costs: {
    notarisLevering: number
    notarisHypotheekakte: number
    taxatie: number
    adviesBemiddeling: number
    bankgarantiePctOfGuarantee: number
    bankgarantieGuaranteePctOfPrice: number
    bouwkundigeKeuring: number
    kadaster: number
    aankoopmakelaar: number
    makelaarCourtagePct: number
    royementKosten: number
    overigeVerkoopkosten: number
  }
  budget: {
    /** Nibud minimale voedingskosten per maand. */
    foodSingle: number
    foodCouple: number
    foodPerChild: number
    gasMonthly: number
    electricityBySize: Record<string, number>
    waterBySize: Record<string, number>
    healthPremiumPerAdultMonthly: number
    healthDeductiblePerAdultYear: number
    maintenancePctPerYear: number
    municipalMonthly: number
    bufferSingle: number
    bufferCouple: number
  }
  market: {
    spaarrentePct: number
    verwachtRendementBeleggenPct: number
    inflatiePct: number
    woningwaardestijgingPct: number
  }
}

export interface NormSet {
  year: number
  /** Versie-ID van de normset (bijv. "2026.1"), opgeslagen bij elke berekening. */
  version: string
  values: NormValues
  meta: Record<string, NormMeta>
}

/**
 * Koppeling van elk veld in NormValues aan de normsleutel (bron). Wordt gebruikt voor de trace en
 * de lijst "Aannames en bronnen".
 */
export const NORM_KEYS = {
  toetsrenteAfm: "trhk.toetsrente_afm",
  toetsrenteMinFixedYears: "trhk.toetsrente_min_fixed_years",
  annuityYears: "trhk.toetsing_annuitair_jaren",
  partnerIncome: "trhk.partner_income_pct",
  bkr: "trhk.bkr_limit_pct_per_month",
  privateLease: "trhk.private_lease_rule",
  studieschuld: "trhk.studieschuld_factors",
  energielabelExtra: "trhk.energielabel_extra",
  energieBesparendExtra: "trhk.energiebesparende_voorzieningen_extra",
  maxLtv: "trhk.max_ltv_pct",
  maxLtvEnergy: "trhk.max_ltv_energy_pct",
  alleenstaande: "trhk.alleenstaande_extra",
  alleenstaandeMin: "trhk.min_toetsinkomen_row",
  aowAge: "trhk.aow_leeftijd",
  aowRule: "trhk.aow_toets_rule",
  alimentatie: "trhk.alimentatie_rule",
  erfpacht: "trhk.erfpacht_rule",
  tableRegular: "trhk.financieringslast.regular",
  tableAow: "trhk.financieringslast.aow",
  tableBox3Regular: "trhk.financieringslast.box3_regular",
  tableBox3Aow: "trhk.financieringslast.box3_aow",
  nhgKostengrens: "nhg.kostengrens",
  nhgKostengrensEnergie: "nhg.kostengrens_energie",
  nhgProvisie: "nhg.borgtochtprovisie_pct",
  nhgRentekorting: "nhg.rentekorting_indicatie_pct",
  nhgVoorwaarden: "nhg.voorwaarden",
  box1: "box1.schijven",
  box1Aow: "box1.schijven_aow",
  maxAftrek: "box1.max_aftrektarief_pct",
  ewf: "ewf.percentages",
  villataksGrens: "ewf.villataks_grens",
  villataksPct: "ewf.villataks_pct",
  hillen: "hillen.aftrek_pct",
  aflossingseis: "ew.aflossingseis",
  bijleenregeling: "ew.bijleenregeling",
  eigenwoningreserve: "ew.eigenwoningreserve",
  ahk: "ahk.max",
  ak: "ak.max",
  ovbEigen: "ovb.eigen_woning_pct",
  ovbOverig: "ovb.overig_pct",
  ovbStartersLeeftijd: "ovb.starters_max_leeftijd",
  ovbStartersGrens: "ovb.starters_woningwaardegrens",
  box3Vrij: "box3.heffingvrij_vermogen",
  box3Bank: "box3.forfait_banktegoeden_pct",
  box3Overig: "box3.forfait_overige_bezittingen_pct",
  box3Schulden: "box3.forfait_schulden_pct",
  box3Drempel: "box3.drempel_schulden",
  box3Tarief: "box3.tarief_pct",
  schenkKind: "schenk.vrijstelling_kind_jaarlijks",
  schenkEenmalig: "schenk.eenmalig_verhoogd_kind",
  jubelton: "schenk.jubelton_eigen_woning",
  zelfstandigenaftrek: "ib.zelfstandigenaftrek",
  startersaftrek: "ib.startersaftrek",
  mkb: "ib.mkb_winstvrijstelling_pct",
  urencriterium: "ib.urencriterium_uren",
  forAfgeschaft: "ib.for_afgeschaft",
  box2: "box2.schijven",
  ab: "box2.aanmerkelijk_belang_pct",
  vpb: "vpb.schijven",
  gebruikelijkLoon: "dga.gebruikelijk_loon_norm",
  gebruikelijkLoonRegels: "dga.gebruikelijk_loon_regels",
  excessiefLenen: "dga.excessief_lenen_drempel",
  excessiefLenenUitzondering: "dga.excessief_lenen_uitzondering_ew",
  lijfrente: "lijfrente.jaarruimte",
  aow: "aow.bedrag_indicatief",
  anw: "anw.bedrag_indicatief",
  wml: "wml.bruto_maand",
  maxDagloon: "ww.max_dagloon",
  ww: "ww.uitkering_pct",
  wwDuur: "ww.duur_regels",
  wia: "wia.regels",
  kkNotarisLevering: "kk.notaris_levering",
  kkNotarisHypotheek: "kk.notaris_hypotheekakte",
  kkTaxatie: "kk.taxatie",
  kkAdvies: "kk.advies_bemiddeling",
  kkBankgarantie: "kk.bankgarantie_pct",
  kkKeuring: "kk.bouwkundige_keuring",
  kkKadaster: "kk.kadaster",
  kkMakelaar: "kk.aankoopmakelaar",
  vkCourtage: "vk.makelaar_courtage_pct",
  vkRoyement: "vk.royement_kosten",
  vkOverig: "vk.overige_verkoopkosten",
  budgetLevensonderhoud: "nibud.basis_levensonderhoud",
  budgetEnergie: "nibud.energie_gemiddeld",
  budgetVerzekeringen: "nibud.verzekeringen",
  budgetOnderhoud: "nibud.onderhoud_woning_pct",
  budgetGemeente: "nibud.gemeentelijke_lasten",
  budgetBuffer: "nibud.buffer_eigenaar",
  spaarrente: "markt.spaarrente_gemiddeld",
  rendement: "markt.verwacht_rendement_beleggen",
  inflatie: "markt.inflatie_verwachting",
  woningwaarde: "markt.woningwaardestijging_verwachting",
  boeterente: "boeterente.berekeningswijze",
  verzilver: "senioren.verzilverhypotheek",
  saleLeaseback: "senioren.sale_and_leaseback",
  anwVoorwaarden: "anw.voorwaarden",
  aov: "aov.typisch",
  schenkOverig: "schenk.vrijstelling_overig",
  nibudBuffer: "nibud.buffer_rule",
} as const

export type NormKey = (typeof NORM_KEYS)[keyof typeof NORM_KEYS]
