import { NORM_KEYS } from "../norms"

/**
 * Controle-overzicht ("gecheckt op"): elke toets met status (groen/oranje/rood), de norm en de
 * bron. De engine levert de uitkomsten; dit module zet ze om naar een uniforme lijst.
 */

export type CheckStatus = "green" | "orange" | "red"
export type CheckCategory =
  | "Trhk"
  | "NHG"
  | "Fiscaal"
  | "Onderpand"
  | "Acceptatie"
  | "Documenten"
  | "Betaalbaarheid"
  | "Risico"
  | "Normen"
  | "Ondernemer"

export interface Check {
  id: string
  category: CheckCategory
  label: string
  status: CheckStatus
  detail: string
  normKeys: string[]
}

export interface DocumentCheckInput {
  label: string
  status: CheckStatus
  detail: string
}

export interface CheckInputs {
  loanAmount: number
  maxIncome: number
  maxCollateral: number | null
  shortfall: number
  costsFromOwnFunds: { ok: boolean; message: string } | null
  nhg: { wanted: boolean; eligible: boolean; reason: string } | null
  newInterestOnly: number
  box3Part: number
  aowDecisive: boolean
  starterExempt: boolean | null
  budgetLight: CheckStatus | null
  stressReds: number
  stressOranges: number
  lendersFitting: number
  documentChecks: DocumentCheckInput[]
  unverifiedNorms: number
  staleRates: number
  entrepreneurWarnings: string[]
  excessiveBorrowingExcess: number
}

export function buildChecks(i: CheckInputs): Check[] {
  const checks: Check[] = []
  const add = (c: Check) => checks.push(c)
  add({
    id: "trhk_inkomen",
    category: "Trhk",
    label: "Leenbedrag binnen de inkomensnorm (Trhk/Nibud)",
    status: i.loanAmount <= i.maxIncome + 1 ? "green" : "red",
    detail:
      i.loanAmount <= i.maxIncome + 1
        ? "De hypotheek past binnen de maximale financieringslast."
        : "De hypotheek is hoger dan de inkomensnorm toestaat.",
    normKeys: [NORM_KEYS.tableRegular, NORM_KEYS.toetsrenteAfm, NORM_KEYS.annuityYears],
  })
  if (i.maxCollateral !== null) {
    add({
      id: "ltv",
      category: "Onderpand",
      label: "Leenbedrag binnen de maximale LTV",
      status: i.loanAmount <= i.maxCollateral + 1 ? "green" : "red",
      detail:
        i.loanAmount <= i.maxCollateral + 1
          ? "De hypotheek blijft binnen 100% van de marktwaarde (plus energiebesparende voorzieningen tot 106%)."
          : "De hypotheek is hoger dan de maximale LTV.",
      normKeys: [NORM_KEYS.maxLtv, NORM_KEYS.maxLtvEnergy],
    })
  }
  if (i.costsFromOwnFunds) {
    add({
      id: "kosten_koper",
      category: "Onderpand",
      label: "Kosten koper uit eigen middelen",
      status: i.costsFromOwnFunds.ok ? "green" : "red",
      detail: i.costsFromOwnFunds.message,
      normKeys: [NORM_KEYS.maxLtv],
    })
    add({
      id: "tekort",
      category: "Betaalbaarheid",
      label: "Voldoende eigen middelen",
      status: i.shortfall <= 0 ? "green" : "red",
      detail: i.shortfall <= 0 ? "De financiering is rond." : "Je komt eigen geld tekort om de aankoop te financieren.",
      normKeys: [],
    })
  }
  if (i.nhg) {
    add({
      id: "nhg",
      category: "NHG",
      label: "Nationale Hypotheek Garantie",
      status: i.nhg.eligible ? "green" : i.nhg.wanted ? "orange" : "green",
      detail: i.nhg.reason,
      normKeys: [NORM_KEYS.nhgKostengrens, NORM_KEYS.nhgKostengrensEnergie, NORM_KEYS.nhgVoorwaarden],
    })
  }
  add({
    id: "aflossingseis",
    category: "Fiscaal",
    label: "Aflossingseis voor hypotheekrenteaftrek",
    status: i.newInterestOnly > 0 ? "orange" : "green",
    detail:
      i.newInterestOnly > 0
        ? "Het nieuwe aflossingsvrije deel is niet aftrekbaar (box 3)."
        : "Nieuwe leningdelen worden annuïtair of lineair in 30 jaar afgelost; de rente is aftrekbaar.",
    normKeys: [NORM_KEYS.aflossingseis],
  })
  if (i.box3Part > 0) {
    add({
      id: "bijleenregeling",
      category: "Fiscaal",
      label: "Bijleenregeling",
      status: "orange",
      detail: "Een deel van de lening valt door de bijleenregeling in box 3 (geen renteaftrek).",
      normKeys: [NORM_KEYS.bijleenregeling, NORM_KEYS.eigenwoningreserve],
    })
  }
  if (i.starterExempt !== null) {
    add({
      id: "startersvrijstelling",
      category: "Fiscaal",
      label: "Startersvrijstelling overdrachtsbelasting",
      status: "green",
      detail: i.starterExempt ? "Je komt (deels) in aanmerking voor de startersvrijstelling." : "De startersvrijstelling is niet van toepassing.",
      normKeys: [NORM_KEYS.ovbStartersLeeftijd, NORM_KEYS.ovbStartersGrens],
    })
  }
  add({
    id: "aow_toets",
    category: "Trhk",
    label: "Pensioen- en AOW-toets",
    status: i.aowDecisive ? "orange" : "green",
    detail: i.aowDecisive
      ? "Het inkomen na AOW-leeftijd is bepalend voor de maximale hypotheek."
      : "Het inkomen na AOW-leeftijd beperkt de leenruimte niet (of de AOW-leeftijd valt na 10 jaar).",
    normKeys: [NORM_KEYS.aowRule, NORM_KEYS.aowAge, NORM_KEYS.tableAow],
  })
  if (i.budgetLight) {
    add({
      id: "budget",
      category: "Betaalbaarheid",
      label: "Begroting na vaste lasten",
      status: i.budgetLight,
      detail:
        i.budgetLight === "green"
          ? "Er blijft voldoende over om te leven en te sparen."
          : i.budgetLight === "orange"
            ? "Er blijft weinig ruimte om te sparen."
            : "De vaste lasten zijn hoger dan het netto-inkomen.",
      normKeys: [NORM_KEYS.budgetLevensonderhoud, NORM_KEYS.budgetEnergie, NORM_KEYS.budgetGemeente],
    })
  }
  add({
    id: "stress",
    category: "Risico",
    label: "Stresstests",
    status: i.stressReds > 0 ? "red" : i.stressOranges > 0 ? "orange" : "green",
    detail: `${i.stressReds} rood, ${i.stressOranges} oranje. Zie de risicoanalyse voor tips.`,
    normKeys: [NORM_KEYS.wia, NORM_KEYS.ww, NORM_KEYS.anw],
  })
  add({
    id: "acceptatie",
    category: "Acceptatie",
    label: "Acceptatie door geldverstrekkers",
    status: i.lendersFitting >= 3 ? "green" : i.lendersFitting >= 1 ? "orange" : "red",
    detail: `${i.lendersFitting} geldverstrekker(s) accepteren je profiel en het leenbedrag past.`,
    normKeys: [],
  })
  for (const [idx, d] of i.documentChecks.entries()) {
    add({ id: `document_${idx}`, category: "Documenten", label: d.label, status: d.status, detail: d.detail, normKeys: [] })
  }
  if (i.documentChecks.length === 0) {
    add({
      id: "documenten",
      category: "Documenten",
      label: "Documentconsistentie",
      status: "orange",
      detail: "Nog geen bevestigde documenten; de uitkomst is gebaseerd op je eigen opgave.",
      normKeys: [],
    })
  }
  add({
    id: "normen",
    category: "Normen",
    label: "Verificatie van gebruikte normen",
    status: i.unverifiedNorms > 0 ? "orange" : "green",
    detail:
      i.unverifiedNorms > 0
        ? `${i.unverifiedNorms} gebruikte parameter(s) zijn nog niet geverifieerd bij de primaire bron (zie Aannames en bronnen).`
        : "Alle gebruikte normen zijn geverifieerd bij de primaire bron.",
    normKeys: [],
  })
  add({
    id: "rentes",
    category: "Normen",
    label: "Actualiteit van de rentes",
    status: i.staleRates > 0 ? "orange" : "green",
    detail: i.staleRates > 0 ? `${i.staleRates} rente(s) in de top 3 zijn ouder dan 14 dagen.` : "De rentes in de top 3 zijn recent.",
    normKeys: [],
  })
  for (const [idx, w] of i.entrepreneurWarnings.entries()) {
    add({ id: `ondernemer_${idx}`, category: "Ondernemer", label: "Aandachtspunt ondernemer", status: "orange", detail: w, normKeys: [] })
  }
  if (i.excessiveBorrowingExcess > 0) {
    add({
      id: "excessief_lenen",
      category: "Ondernemer",
      label: "Wet excessief lenen",
      status: "red",
      detail: "Je schulden aan je eigen BV liggen boven de drempel; het meerdere wordt belast in box 2.",
      normKeys: [NORM_KEYS.excessiefLenen, NORM_KEYS.excessiefLenenUitzondering],
    })
  }
  return checks
}
