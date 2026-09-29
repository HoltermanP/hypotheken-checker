import type {
  Bracket,
  EnergyLabel,
  FinancieringslastTable,
  HeffingskortingParams,
  NormMeta,
  NormSet,
  NormStatus,
  NormValues,
} from "@/lib/engine/norms"

/**
 * Zet een lijst ruwe normwaarden (zoals opgeslagen in `norm_values` en in de seed) om naar de
 * getypeerde NormSet die de rekenkern gebruikt. Isomorf: draait in de browser (wat-als-modus) en
 * op de server. Ontbrekende of onleesbare waarden geven een duidelijke fout.
 */

export interface NormEntry {
  key: string
  year: number
  value: unknown
  unit?: string | null
  label: string
  sourceName?: string | null
  sourceUrl?: string | null
  checkedAt?: string | null
  status: NormStatus
  note?: string | null
}

export class NormBuildError extends Error {}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function num(v: unknown, key: string, path = ""): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  throw new NormBuildError(`Norm ${key}${path ? `.${path}` : ""}: verwacht een getal, kreeg ${JSON.stringify(v)}`)
}

function field(v: unknown, key: string, path: string): unknown {
  let cur: unknown = v
  for (const part of path.split(".")) {
    if (!isObj(cur)) throw new NormBuildError(`Norm ${key}: veld ${path} ontbreekt`)
    cur = cur[part]
  }
  return cur
}

/** Parse "1.234,56" of "8,324" naar een getal. */
export function dutchNumber(s: string): number {
  return Number(s.trim().replace(/\./g, "").replace(",", "."))
}

function brackets(v: unknown, key: string): Bracket[] {
  const list = isObj(v) ? v.brackets : v
  if (!Array.isArray(list)) throw new NormBuildError(`Norm ${key}: verwacht schijven`)
  return list
    .filter((b): b is unknown[] => Array.isArray(b) && typeof b[2] === "number")
    .map((b) => [num(b[0], key), b[1] === null ? null : num(b[1], key), num(b[2], key)])
}

/**
 * Parse een arbeidskortingsformule zoals "996 + 31,009% x (ai - 11.965)", "8,324% x
 * arbeidsinkomen", "5.685 - 6,510% x (ai - 45.592)" of "0" naar [basis, pct].
 */
export function parseAkFormula(formula: string): [number, number] {
  const s = formula.trim()
  if (/^0$/.test(s)) return [0, 0]
  const withBase = /^([\d.,]+)\s*([+-])\s*([\d.,]+)\s*%/.exec(s)
  if (withBase) {
    const sign = withBase[2] === "-" ? -1 : 1
    return [dutchNumber(withBase[1]!), sign * dutchNumber(withBase[3]!)]
  }
  const pctOnly = /^([\d.,]+)\s*%/.exec(s)
  if (pctOnly) return [0, dutchNumber(pctOnly[1]!)]
  throw new NormBuildError(`Onleesbare arbeidskortingsformule: ${formula}`)
}

function akBrackets(v: unknown, key: string): [number, number | null, number, number][] {
  if (!Array.isArray(v)) throw new NormBuildError(`Norm ${key}: verwacht arbeidskortingsschijven`)
  return v.map((b) => {
    if (!Array.isArray(b)) throw new NormBuildError(`Norm ${key}: ongeldige schijf`)
    const [base, pct] = typeof b[2] === "number" ? [b[2], 0] : parseAkFormula(String(b[2]))
    return [num(b[0], key), b[1] === null ? null : num(b[1], key), base, pct]
  })
}

const LABEL_GROUPS: Record<string, EnergyLabel[]> = {
  "E,F,G": ["E", "F", "G"],
  "C,D": ["C", "D"],
  "A,B": ["A", "B"],
  "A+,A++": ["A+", "A++"],
  "A+++": ["A+++"],
  "A++++": ["A++++"],
}

function labelTable(v: unknown, key: string): Record<EnergyLabel, number> {
  const src = isObj(v) && isObj(v.amountsPerLabel) ? v.amountsPerLabel : v
  if (!isObj(src)) throw new NormBuildError(`Norm ${key}: verwacht bedragen per energielabel`)
  const out = {} as Record<EnergyLabel, number>
  for (const [group, amount] of Object.entries(src)) {
    const n = num(amount, key, group)
    if (group.startsWith("A++++ met")) out["A++++EPG"] = n
    else if (group.startsWith("geen")) out.geen = n
    else for (const label of LABEL_GROUPS[group] ?? []) out[label] = n
  }
  const all: EnergyLabel[] = ["A++++EPG", "A++++", "A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G", "geen"]
  for (const l of all) {
    if (out[l] === undefined) {
      if (l === "A++++EPG" && out["A++++"] !== undefined) out[l] = out["A++++"]
      else if (l === "geen") out[l] = 0
      else throw new NormBuildError(`Norm ${key}: geen bedrag voor label ${l}`)
    }
  }
  return out
}

function table(v: unknown, key: string): FinancieringslastTable {
  if (!isObj(v) || !Array.isArray(v.incomeBrackets) || !Array.isArray(v.rateBrackets) || !Array.isArray(v.values)) {
    throw new NormBuildError(`Norm ${key}: ongeldige financieringslasttabel`)
  }
  const t = v as unknown as FinancieringslastTable
  if (t.values.length !== t.incomeBrackets.length) {
    throw new NormBuildError(`Norm ${key}: aantal rijen klopt niet`)
  }
  for (const row of t.values) {
    if (!Array.isArray(row) || row.length !== t.rateBrackets.length) {
      throw new NormBuildError(`Norm ${key}: aantal kolommen klopt niet`)
    }
  }
  return t
}

function typical(v: unknown, key: string): number {
  if (typeof v === "number") return v
  if (isObj(v)) {
    if (typeof v.typical === "number") return v.typical
    if (typeof v.typicalFixedMin === "number" && typeof v.typicalFixedMax === "number") {
      return (v.typicalFixedMin + v.typicalFixedMax) / 2
    }
    if (typeof v.typicalMin === "number" && typeof v.typicalMax === "number") {
      return (v.typicalMin + v.typicalMax) / 2
    }
    if (typeof v.min === "number" && typeof v.max === "number") {
      return (v.min + v.max) / 2
    }
  }
  throw new NormBuildError(`Norm ${key}: geen typische waarde`)
}

export interface BuildOptions {
  year: number
  version: string
  /** Hillen-percentage van het voorgaande jaar (voor de afbouwstap). */
  previousHillenPct?: number | null
}

export function buildNormSet(entries: NormEntry[], opts: BuildOptions): NormSet {
  const byKey = new Map(entries.filter((e) => e.year === opts.year).map((e) => [e.key, e]))
  const meta: Record<string, NormMeta> = {}
  const get = (key: string): unknown => {
    const e = byKey.get(key)
    if (!e) throw new NormBuildError(`Norm ${key} ontbreekt voor ${opts.year}`)
    meta[key] = {
      key,
      label: e.label,
      year: e.year,
      unit: e.unit ?? null,
      sourceName: e.sourceName ?? null,
      sourceUrl: e.sourceUrl ?? null,
      checkedAt: e.checkedAt ?? null,
      status: e.status,
      note: e.note ?? null,
    }
    return e.value
  }

  // Neem ook de tekstnormen op in de metadata (bronnenlijst), ook al rekent de engine er niet mee.
  for (const key of byKey.keys()) {
    const e = byKey.get(key)!
    meta[key] = {
      key,
      label: e.label,
      year: e.year,
      unit: e.unit ?? null,
      sourceName: e.sourceName ?? null,
      sourceUrl: e.sourceUrl ?? null,
      checkedAt: e.checkedAt ?? null,
      status: e.status,
      note: e.note ?? null,
    }
  }

  const aowAge = get("trhk.aow_leeftijd")
  const aowMonths = field(aowAge, "trhk.aow_leeftijd", "months")
  const aowAgeMonthsByYear: Record<string, number> = {}
  if (isObj(aowMonths)) {
    for (const [y, m] of Object.entries(aowMonths)) if (typeof m === "number") aowAgeMonthsByYear[y] = m
  }
  const minRow = get("trhk.min_toetsinkomen_row")
  const studie = get("trhk.studieschuld_factors")
  const studieBrackets = (isObj(studie) ? studie.brackets : studie) as unknown[]
  const lease = get("trhk.private_lease_rule")
  const ahk = get("ahk.max")
  const ak = get("ak.max")
  const hillen = num(get("hillen.aftrek_pct"), "hillen.aftrek_pct")
  const ww = get("ww.uitkering_pct")
  const wwDuur = get("ww.duur_regels")
  const wia = get("wia.regels")
  const aow = get("aow.bedrag_indicatief")
  const anw = get("anw.bedrag_indicatief")
  const lijfrente = get("lijfrente.jaarruimte")
  const bankgarantie = get("kk.bankgarantie_pct")
  const kadaster = get("kk.kadaster")
  const courtage = get("vk.makelaar_courtage_pct")
  const overigVerkoop = get("vk.overige_verkoopkosten")
  const food = field(get("nibud.basis_levensonderhoud"), "nibud.basis_levensonderhoud", "voedingMinimum")
  const energie = get("nibud.energie_gemiddeld")
  const verzekeringen = get("nibud.verzekeringen")
  const onderhoud = get("nibud.onderhoud_woning_pct")
  const gemeente = get("nibud.gemeentelijke_lasten")
  const buffer = get("nibud.buffer_eigenaar")
  const spaar = get("markt.spaarrente_gemiddeld")
  const rendement = get("markt.verwacht_rendement_beleggen")
  const inflatie = get("markt.inflatie_verwachting")
  const woningwaarde = get("markt.woningwaardestijging_verwachting")
  const rentekorting = get("nhg.rentekorting_indicatie_pct")
  const nextYear = String(opts.year + 1)

  const foodCouple = num(field(food, "nibud", "paar"), "nibud.basis_levensonderhoud")
  const foodFamily = num(field(food, "nibud", "paarMet2Kinderen_8en13jr"), "nibud.basis_levensonderhoud")

  const values: NormValues = {
    trhk: {
      toetsrenteAfmPct: num(get("trhk.toetsrente_afm"), "trhk.toetsrente_afm"),
      toetsrenteMinFixedYears: num(get("trhk.toetsrente_min_fixed_years"), "trhk.toetsrente_min_fixed_years"),
      annuityYears: num(get("trhk.toetsing_annuitair_jaren"), "trhk.toetsing_annuitair_jaren"),
      partnerIncomePct: num(get("trhk.partner_income_pct"), "trhk.partner_income_pct"),
      bkrPctPerMonth: num(get("trhk.bkr_limit_pct_per_month"), "trhk.bkr_limit_pct_per_month"),
      privateLeaseFactor: isObj(lease) ? num(lease.factor, "trhk.private_lease_rule", "factor") : 1,
      studieschuldFactors: studieBrackets.map((b) => {
        const arr = b as unknown[]
        return [num(arr[0], "studieschuld"), arr[1] === null ? null : num(arr[1], "studieschuld"), num(arr[2], "studieschuld")]
      }),
      energielabelExtra: labelTable(get("trhk.energielabel_extra"), "trhk.energielabel_extra"),
      energieBesparendExtra: labelTable(
        get("trhk.energiebesparende_voorzieningen_extra"),
        "trhk.energiebesparende_voorzieningen_extra"
      ),
      maxLtvPct: num(get("trhk.max_ltv_pct"), "trhk.max_ltv_pct"),
      maxLtvEnergyPct: num(get("trhk.max_ltv_energy_pct"), "trhk.max_ltv_energy_pct"),
      alleenstaandeExtra: num(get("trhk.alleenstaande_extra"), "trhk.alleenstaande_extra"),
      alleenstaandeMinIncomeRegular: num(field(minRow, "trhk.min_toetsinkomen_row", "regular"), "min_row"),
      alleenstaandeMinIncomeAow: num(field(minRow, "trhk.min_toetsinkomen_row", "aow"), "min_row"),
      aowAgeMonthsByYear,
      tables: {
        regular: table(get("trhk.financieringslast.regular"), "trhk.financieringslast.regular"),
        aow: table(get("trhk.financieringslast.aow"), "trhk.financieringslast.aow"),
        box3Regular: table(get("trhk.financieringslast.box3_regular"), "trhk.financieringslast.box3_regular"),
        box3Aow: table(get("trhk.financieringslast.box3_aow"), "trhk.financieringslast.box3_aow"),
      },
    },
    nhg: {
      kostengrens: num(get("nhg.kostengrens"), "nhg.kostengrens"),
      kostengrensEnergie: num(get("nhg.kostengrens_energie"), "nhg.kostengrens_energie"),
      provisiePct: num(get("nhg.borgtochtprovisie_pct"), "nhg.borgtochtprovisie_pct"),
      rentekortingIndicatiePct: isObj(rentekorting)
        ? num(rentekorting.min, "nhg.rentekorting_indicatie_pct")
        : num(rentekorting, "nhg.rentekorting_indicatie_pct"),
    },
    tax: {
      box1: brackets(get("box1.schijven"), "box1.schijven"),
      box1Aow: brackets(get("box1.schijven_aow"), "box1.schijven_aow"),
      maxAftrekPct: num(get("box1.max_aftrektarief_pct"), "box1.max_aftrektarief_pct"),
      ewf: brackets(get("ewf.percentages"), "ewf.percentages"),
      villataksGrens: num(get("ewf.villataks_grens"), "ewf.villataks_grens"),
      villataksPct: num(get("ewf.villataks_pct"), "ewf.villataks_pct"),
      hillenAftrekPct: hillen,
      hillenStepPct:
        opts.previousHillenPct !== undefined && opts.previousHillenPct !== null
          ? Math.max(0, opts.previousHillenPct - hillen)
          : 100 / 30,
      heffingskortingen: heffingskortingen(ahk, ak),
    },
    ovb: {
      eigenWoningPct: num(get("ovb.eigen_woning_pct"), "ovb.eigen_woning_pct"),
      overigPct: num(get("ovb.overig_pct"), "ovb.overig_pct"),
      startersMaxLeeftijd: num(get("ovb.starters_max_leeftijd"), "ovb.starters_max_leeftijd"),
      startersWoningwaardegrens: num(get("ovb.starters_woningwaardegrens"), "ovb.starters_woningwaardegrens"),
    },
    box3: {
      heffingvrijVermogen: num(get("box3.heffingvrij_vermogen"), "box3.heffingvrij_vermogen"),
      forfaitBankPct: num(get("box3.forfait_banktegoeden_pct"), "box3.forfait_banktegoeden_pct"),
      forfaitOverigPct: num(get("box3.forfait_overige_bezittingen_pct"), "box3.forfait_overige_bezittingen_pct"),
      forfaitSchuldenPct: num(get("box3.forfait_schulden_pct"), "box3.forfait_schulden_pct"),
      drempelSchulden: num(get("box3.drempel_schulden"), "box3.drempel_schulden"),
      tariefPct: num(get("box3.tarief_pct"), "box3.tarief_pct"),
    },
    schenk: {
      vrijstellingKindJaarlijks: num(get("schenk.vrijstelling_kind_jaarlijks"), "schenk.vrijstelling_kind_jaarlijks"),
      eenmaligVerhoogdKind: num(get("schenk.eenmalig_verhoogd_kind"), "schenk.eenmalig_verhoogd_kind"),
      jubeltonEigenWoning: num(get("schenk.jubelton_eigen_woning"), "schenk.jubelton_eigen_woning"),
    },
    ondernemer: {
      zelfstandigenaftrek: num(get("ib.zelfstandigenaftrek"), "ib.zelfstandigenaftrek"),
      startersaftrek: num(get("ib.startersaftrek"), "ib.startersaftrek"),
      mkbWinstvrijstellingPct: num(get("ib.mkb_winstvrijstelling_pct"), "ib.mkb_winstvrijstelling_pct"),
      urencriterium: num(get("ib.urencriterium_uren"), "ib.urencriterium_uren"),
      box2: brackets(get("box2.schijven"), "box2.schijven"),
      vpb: brackets(get("vpb.schijven"), "vpb.schijven"),
      gebruikelijkLoon: num(get("dga.gebruikelijk_loon_norm"), "dga.gebruikelijk_loon_norm"),
      excessiefLenenDrempel: num(get("dga.excessief_lenen_drempel"), "dga.excessief_lenen_drempel"),
      lijfrenteJaarruimte: {
        pctPremiegrondslag: num(field(lijfrente, "lijfrente", "pctPremiegrondslag"), "lijfrente"),
        franchise: num(field(lijfrente, "lijfrente", "franchise"), "lijfrente"),
        maxPremiegrondslag: num(field(lijfrente, "lijfrente", "maxPremiegrondslag"), "lijfrente"),
        maxJaarruimte: num(field(lijfrente, "lijfrente", "maxJaarruimte"), "lijfrente"),
      },
    },
    social: {
      aowJaarAlleenstaand: num(field(aow, "aow", "alleenstaand.brutoPerJaarInclVakantie"), "aow"),
      aowJaarGehuwdPerPersoon: num(field(aow, "aow", "gehuwdPerPersoon.brutoPerJaarInclVakantie"), "aow"),
      anwMaand: num(field(anw, "anw", "totaalPerMaand"), "anw"),
      wmlMaand: num(get("wml.bruto_maand"), "wml.bruto_maand"),
      maxDagloon: isObj(ww) && typeof ww.maxDagloon === "number" ? ww.maxDagloon : num(get("ww.max_dagloon"), "ww.max_dagloon"),
      wwEersteMaandenPct: num(field(ww, "ww", "pctEersteMaanden"), "ww.uitkering_pct"),
      wwDaarnaPct: num(field(ww, "ww", "pctDaarna"), "ww.uitkering_pct"),
      wwMaxMaanden: num(field(wwDuur, "ww.duur_regels", "maxMaanden"), "ww.duur_regels"),
      wwMinMaanden: num(field(wwDuur, "ww.duur_regels", "minMaanden"), "ww.duur_regels"),
      wwMaandenPerJaarEerste10: num(field(wwDuur, "ww.duur_regels", "maandenPerJaarEerste10"), "ww.duur_regels"),
      wwMaandenPerJaarDaarna: num(field(wwDuur, "ww.duur_regels", "maandenPerJaarVanaf11"), "ww.duur_regels"),
      wiaIvaPct: num(field(wia, "wia.regels", "IVA_pctWiaMaandloon"), "wia.regels"),
      wiaLoongerelateerdPct: num(field(wia, "wia.regels", "WGA_loongerelateerd.daarna"), "wia.regels"),
      wiaVervolgPctWml: num(field(wia, "wia.regels", "WGA_vervolguitkering_pctMinimumloon.45-55"), "wia.regels"),
      ziekteLoondoorbetalingPct: num(field(wia, "wia.regels", "loondoorbetalingZiekte.minPct"), "wia.regels"),
    },
    costs: {
      notarisLevering: typical(get("kk.notaris_levering"), "kk.notaris_levering"),
      notarisHypotheekakte: typical(get("kk.notaris_hypotheekakte"), "kk.notaris_hypotheekakte"),
      taxatie: typical(get("kk.taxatie"), "kk.taxatie"),
      adviesBemiddeling: typical(get("kk.advies_bemiddeling"), "kk.advies_bemiddeling"),
      bankgarantiePctOfGuarantee: num(field(bankgarantie, "kk.bankgarantie_pct", "pctOfGuarantee"), "kk.bankgarantie_pct"),
      bankgarantieGuaranteePctOfPrice: num(field(bankgarantie, "kk.bankgarantie_pct", "guaranteePctOfPrice"), "kk.bankgarantie_pct"),
      bouwkundigeKeuring: typical(get("kk.bouwkundige_keuring"), "kk.bouwkundige_keuring"),
      kadaster: isObj(kadaster) && typeof kadaster.totaalIndicatief_levering_plus_hypotheek_KIK === "number"
        ? kadaster.totaalIndicatief_levering_plus_hypotheek_KIK
        : num(kadaster, "kk.kadaster"),
      aankoopmakelaar: typical(get("kk.aankoopmakelaar"), "kk.aankoopmakelaar"),
      makelaarCourtagePct: isObj(courtage) ? num(courtage.typicalInclBtw, "vk.makelaar_courtage_pct") : num(courtage, "vk.makelaar_courtage_pct"),
      royementKosten: typical(get("vk.royement_kosten"), "vk.royement_kosten"),
      overigeVerkoopkosten: isObj(overigVerkoop)
        ? typical(overigVerkoop.energielabel, "vk.overige_verkoopkosten") +
          typical(overigVerkoop.marketingFotosPlattegrondFunda, "vk.overige_verkoopkosten")
        : num(overigVerkoop, "vk.overige_verkoopkosten"),
    },
    budget: {
      foodSingle: num(field(food, "nibud", "alleenstaande"), "nibud.basis_levensonderhoud"),
      foodCouple,
      foodPerChild: (foodFamily - foodCouple) / 2,
      gasMonthly: num(field(energie, "nibud.energie_gemiddeld", "gas"), "nibud.energie_gemiddeld"),
      electricityBySize: field(energie, "nibud.energie_gemiddeld", "stroomPerHuishoudgrootte") as Record<string, number>,
      waterBySize: field(energie, "nibud.energie_gemiddeld", "waterPerHuishoudgrootte") as Record<string, number>,
      healthPremiumPerAdultMonthly: num(field(verzekeringen, "nibud.verzekeringen", "zorgverzekeringGemiddeldePremiePerVolwassene"), "nibud.verzekeringen"),
      healthDeductiblePerAdultYear: num(field(verzekeringen, "nibud.verzekeringen", "verplichtEigenRisico"), "nibud.verzekeringen"),
      maintenancePctPerYear: num(field(onderhoud, "nibud.onderhoud_woning_pct", "pctWoningwaardePerJaar"), "nibud.onderhoud_woning_pct"),
      municipalMonthly: num(field(gemeente, "nibud.gemeentelijke_lasten", "eigenaarTotaalPerMaand"), "nibud.gemeentelijke_lasten"),
      bufferSingle: num(field(buffer, "nibud.buffer_eigenaar", "voorbeeldModaalInkomenZonderPartner"), "nibud.buffer_eigenaar"),
      bufferCouple: num(field(buffer, "nibud.buffer_eigenaar", "voorbeeldModaalInkomenMetPartner"), "nibud.buffer_eigenaar"),
    },
    market: {
      spaarrentePct: num(field(spaar, "markt.spaarrente_gemiddeld", "vrijOpneembaar"), "markt.spaarrente_gemiddeld"),
      verwachtRendementBeleggenPct: num(field(rendement, "markt.verwacht_rendement_beleggen", "aandelenMaxBrutoMeetkundig"), "markt.verwacht_rendement_beleggen"),
      inflatiePct: pickForecast(inflatie, ["CPB_CPI_" + nextYear, "CPB_CPI_" + opts.year], "markt.inflatie_verwachting"),
      woningwaardestijgingPct: pickForecast(woningwaarde, ["DNB_" + nextYear, "DNB_" + opts.year], "markt.woningwaardestijging_verwachting"),
    },
  }
  return { year: opts.year, version: opts.version, values, meta }
}

function pickForecast(v: unknown, keys: string[], key: string): number {
  if (typeof v === "number") return v
  if (isObj(v)) {
    for (const k of keys) if (typeof v[k] === "number") return v[k] as number
    const first = Object.values(v).find((x) => typeof x === "number")
    if (typeof first === "number") return first
  }
  throw new NormBuildError(`Norm ${key}: geen prognose gevonden`)
}

function heffingskortingen(ahk: unknown, ak: unknown): HeffingskortingParams {
  if (!isObj(ahk) || !isObj(ak)) throw new NormBuildError("Heffingskortingen ontbreken")
  const aowAhk = isObj(ahk.aow) ? ahk.aow : ahk
  return {
    ahk: {
      max: num(ahk.max, "ahk.max"),
      afbouwVanaf: num(ahk.afbouwVanaf, "ahk.max", "afbouwVanaf"),
      afbouwPct: num(ahk.afbouwPct, "ahk.max", "afbouwPct"),
      aowMax: num(aowAhk.max, "ahk.max", "aow.max"),
      aowAfbouwPct: num(aowAhk.afbouwPct, "ahk.max", "aow.afbouwPct"),
    },
    ak: akBrackets(ak.brackets, "ak.max"),
    akAow: akBrackets(ak.aowBrackets ?? ak.brackets, "ak.max"),
  }
}
