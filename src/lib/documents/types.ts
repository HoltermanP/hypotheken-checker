/**
 * Documenttypes, de velden die we eruit halen, en de checklist per profiel.
 * Isomorf (client + server).
 */

export type FieldKind = "money" | "number" | "percent" | "date" | "text" | "boolean"

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  hint?: string
}

export interface DocTypeDef {
  type: string
  /** "financials": meerjarige jaarcijfers per entiteit (eigen extractie en review). */
  extraction?: "fields" | "financials"
  label: string
  description: string
  /** Hoe oud het document maximaal mag zijn (maanden), indien van toepassing. */
  maxAgeMonths?: number
  perApplicant: boolean
  fields: FieldDef[]
}

const money = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "money", hint })
const date = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "date", hint })
const text = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "text", hint })
const num = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "number", hint })
const pct = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "percent", hint })
const bool = (key: string, label: string, hint?: string): FieldDef => ({ key, label, kind: "boolean", hint })

const person = [text("naam", "Naam"), date("geboortedatum", "Geboortedatum")]

export const DOC_TYPES: DocTypeDef[] = [
  {
    type: "jaarcijfers_onderneming",
    label: "Jaarcijfers onderneming (jaarrekening, Excel, jaaroverzicht)",
    description: "Jaarrekeningen (pdf), een Excel-overzicht of het sjabloon, jaaroverzicht DGA of aangiften. Meerdere jaren en entiteiten tegelijk.",
    perApplicant: true,
    extraction: "financials",
    fields: [],
  },
  {
    type: "werkgeversverklaring",
    label: "Werkgeversverklaring",
    description: "Verklaring van je werkgever over je dienstverband en salaris.",
    maxAgeMonths: 3,
    perApplicant: true,
    fields: [
      ...person,
      text("werkgever", "Werkgever"),
      date("datum_document", "Datum verklaring"),
      text("dienstverband", "Soort dienstverband", "vast, tijdelijk, oproep"),
      bool("intentieverklaring", "Intentieverklaring (tijdelijk → vast)"),
      money("bruto_jaarsalaris", "Bruto jaarsalaris (excl. vakantiegeld)"),
      money("vakantiegeld", "Vakantiegeld per jaar"),
      money("dertiende_maand", "Vaste 13e maand"),
      money("eindejaarsuitkering", "Vaste eindejaarsuitkering"),
      money("onregelmatigheidstoeslag", "Onregelmatigheidstoeslag per jaar"),
      money("provisie", "Provisie per jaar"),
      date("in_dienst_sinds", "In dienst sinds"),
    ],
  },
  {
    type: "salarisstrook",
    label: "Salarisstrook",
    description: "Recente loonstrook (niet ouder dan 3 maanden).",
    maxAgeMonths: 3,
    perApplicant: true,
    fields: [...person, text("werkgever", "Werkgever"), date("datum_document", "Periode/datum"), money("bruto_maandsalaris", "Bruto maandsalaris"), money("netto_uitbetaald", "Netto uitbetaald"), pct("vakantiegeld_pct", "Vakantiegeld reservering (%)")],
  },
  {
    type: "jaaropgave",
    label: "Jaaropgave",
    description: "Jaaropgave van je werkgever (fiscaal loon).",
    perApplicant: true,
    fields: [...person, text("werkgever", "Werkgever"), num("jaar", "Jaar"), money("fiscaal_loon", "Fiscaal loon (loon voor de loonheffing)")],
  },
  {
    type: "ibl_rapport",
    label: "UWV-verzekeringsbericht / IBL-rapport",
    description: "Inkomensbepaling Loondienst op basis van UWV-gegevens.",
    maxAgeMonths: 1,
    perApplicant: true,
    fields: [...person, date("datum_document", "Datum rapport"), money("ibl_toetsinkomen", "IBL-toetsinkomen"), num("pensioenfactor", "Pensioengevend factor")],
  },
  {
    type: "pensioenoverzicht",
    label: "Pensioenoverzicht (mijnpensioenoverzicht.nl)",
    description: "Verwacht pensioen en AOW.",
    perApplicant: true,
    fields: [...person, date("datum_document", "Datum overzicht"), money("aow_per_jaar", "AOW per jaar"), money("pensioen_per_jaar", "Ouderdomspensioen per jaar"), money("nabestaandenpensioen_per_jaar", "Partnerpensioen per jaar"), date("aow_datum", "AOW-datum")],
  },
  {
    type: "hypotheekoverzicht",
    label: "Jaaroverzicht huidige hypotheek",
    description: "Overzicht van je huidige leningdelen.",
    perApplicant: false,
    fields: [text("geldverstrekker", "Geldverstrekker"), date("datum_document", "Datum"), money("totale_restschuld", "Totale restschuld"), text("leningdelen", "Leningdelen (soort, restschuld, rente, einde rentevast)")],
  },
  {
    type: "woz_beschikking",
    label: "WOZ-beschikking",
    description: "WOZ-waarde van je (huidige of nieuwe) woning.",
    maxAgeMonths: 15,
    perApplicant: false,
    fields: [text("adres", "Adres"), num("peiljaar", "Waardepeiljaar"), money("woz_waarde", "WOZ-waarde"), date("datum_document", "Datum beschikking")],
  },
  {
    type: "koopovereenkomst",
    label: "(Voorlopige) koopovereenkomst",
    description: "Koopsom, ontbindende voorwaarden en leveringsdatum.",
    perApplicant: false,
    fields: [text("adres", "Adres"), money("koopsom", "Koopsom"), money("roerende_zaken", "Roerende zaken"), date("leveringsdatum", "Leveringsdatum"), date("datum_financieringsvoorbehoud", "Datum financieringsvoorbehoud"), money("waarborgsom", "Waarborgsom of bankgarantie"), text("kopers", "Koper(s)")],
  },
  {
    type: "taxatierapport",
    label: "Taxatierapport",
    description: "Marktwaarde volgens een gevalideerd taxatierapport.",
    maxAgeMonths: 6,
    perApplicant: false,
    fields: [text("adres", "Adres"), money("marktwaarde", "Marktwaarde"), money("marktwaarde_na_verbouwing", "Marktwaarde na verbouwing"), date("datum_document", "Waardepeildatum"), text("energielabel", "Energielabel")],
  },
  {
    type: "energielabel",
    label: "Energielabel",
    description: "Geregistreerd energielabel van de woning.",
    perApplicant: false,
    fields: [text("adres", "Adres"), text("energielabel", "Label"), date("geldig_tot", "Geldig tot")],
  },
  {
    type: "verkoopovereenkomst",
    label: "Verkoopovereenkomst huidige woning",
    description: "Verkoopprijs en leveringsdatum van je huidige woning.",
    perApplicant: false,
    fields: [text("adres", "Adres"), money("verkoopprijs", "Verkoopprijs"), date("leveringsdatum", "Leveringsdatum"), bool("ontbindende_voorwaarden_verlopen", "Ontbindende voorwaarden verlopen")],
  },
  {
    type: "bankafschrift",
    label: "Bankafschrift (spaargeld)",
    description: "Recent afschrift als bewijs van eigen middelen.",
    maxAgeMonths: 3,
    perApplicant: true,
    fields: [text("rekeninghouder", "Rekeninghouder"), date("datum_document", "Datum"), money("saldo", "Saldo")],
  },
  {
    type: "duo_overzicht",
    label: "Studieschuldoverzicht (DUO)",
    description: "Actuele studieschuld en maandtermijn.",
    maxAgeMonths: 3,
    perApplicant: true,
    fields: [...person, date("datum_document", "Datum"), money("restschuld", "Restschuld"), money("maandtermijn", "Maandtermijn"), pct("rente", "Rente"), text("stelsel", "Stelsel / fase")],
  },
  {
    type: "bouwkundig_rapport",
    label: "Bouwkundig rapport",
    description: "Uitkomst van de bouwkundige keuring.",
    perApplicant: false,
    fields: [text("adres", "Adres"), money("herstelkosten_direct", "Direct noodzakelijk herstel"), money("herstelkosten_5jaar", "Herstel binnen 5 jaar"), date("datum_document", "Datum")],
  },
  {
    type: "offerte_verbouwing",
    label: "Offerte verbouwing of verduurzaming",
    description: "Kosten van geplande werkzaamheden.",
    perApplicant: false,
    fields: [text("omschrijving", "Omschrijving"), money("bedrag", "Bedrag incl. btw"), money("energiebesparend_deel", "Waarvan energiebesparend"), date("datum_document", "Datum")],
  },
  {
    type: "ib_aangifte",
    label: "IB-aangifte / definitieve aanslag",
    description: "Aangifte inkomstenbelasting (per jaar).",
    perApplicant: true,
    fields: [...person, num("jaar", "Jaar"), money("winst_uit_onderneming", "Winst uit onderneming (vóór ondernemersaftrek)"), money("loon", "Loon uit dienstbetrekking"), money("inkomen_box1", "Belastbaar inkomen box 1"), money("inkomen_box2", "Inkomen box 2"), bool("urencriterium", "Urencriterium gehaald")],
  },
  {
    type: "jaarrekening",
    label: "Jaarrekening / jaarcijfers",
    description: "Balans en winst-en-verliesrekening (per entiteit en geconsolideerd).",
    perApplicant: true,
    fields: [text("entiteit", "Onderneming/entiteit"), num("jaar", "Jaar"), bool("geconsolideerd", "Geconsolideerd"), money("omzet", "Omzet"), money("resultaat_voor_belasting", "Resultaat vóór belasting"), money("resultaat_na_belasting", "Resultaat na belasting"), money("winst_ib", "Winst (IB-ondernemer)"), money("eigen_vermogen", "Eigen vermogen"), money("balanstotaal", "Balanstotaal"), money("liquide_middelen", "Liquide middelen"), money("kortlopende_schulden", "Kortlopende schulden"), money("salaris_dga", "Salaris DGA"), money("rekening_courant_dga", "Rekening-courant DGA (vordering op DGA)")],
  },
  {
    type: "vpb_aangifte",
    label: "Vpb-aangifte",
    description: "Aangifte vennootschapsbelasting.",
    perApplicant: true,
    fields: [text("entiteit", "Entiteit"), num("jaar", "Jaar"), money("belastbaar_bedrag", "Belastbaar bedrag"), money("vpb", "Verschuldigde Vpb")],
  },
  {
    type: "ivo",
    label: "Inkomensverklaring Ondernemer (IVO)",
    description: "Toetsinkomen volgens een erkend rekenexpert.",
    maxAgeMonths: 6,
    perApplicant: true,
    fields: [...person, date("datum_document", "Datum"), money("toetsinkomen", "Toetsinkomen"), text("rekenexpert", "Rekenexpert")],
  },
  {
    type: "kvk_uittreksel",
    label: "KvK-uittreksel",
    description: "Inschrijving, rechtsvorm en bestuurders.",
    maxAgeMonths: 3,
    perApplicant: true,
    fields: [text("naam_onderneming", "Naam"), text("kvk_nummer", "KvK-nummer"), text("rechtsvorm", "Rechtsvorm"), date("datum_oprichting", "Datum oprichting"), text("bestuurders", "Bestuurders")],
  },
  {
    type: "tussentijdse_cijfers",
    label: "Tussentijdse cijfers en prognose",
    description: "Cijfers van het lopende jaar.",
    perApplicant: true,
    fields: [num("jaar", "Jaar"), date("datum_document", "Tot en met"), money("omzet", "Omzet"), money("resultaat", "Resultaat"), money("prognose_resultaat", "Prognose resultaat heel jaar")],
  },
  {
    type: "aandeelhoudersregister",
    label: "Aandeelhoudersregister / oprichtingsakte",
    description: "Wie houdt welke aandelen.",
    perApplicant: true,
    fields: [text("entiteit", "Entiteit"), text("aandeelhouder", "Aandeelhouder"), pct("aandelenpercentage", "Aandelenpercentage")],
  },
  { type: "organogram", label: "Organogram holdingstructuur", description: "Structuur holding en werkmaatschappijen.", perApplicant: true, fields: [text("structuur", "Structuur")] },
  {
    type: "jaaropgave_dga",
    label: "Loonstroken of jaaropgave DGA",
    description: "Salaris dat je van je BV ontvangt.",
    perApplicant: true,
    fields: [...person, text("werkgever", "BV"), num("jaar", "Jaar"), money("fiscaal_loon", "Fiscaal loon")],
  },
  { type: "dividendbesluit", label: "Dividendbesluit", description: "Besluit tot dividenduitkering.", perApplicant: true, fields: [text("entiteit", "Entiteit"), date("datum_document", "Datum"), money("dividend", "Bedrag")] },
  {
    type: "managementovereenkomst",
    label: "Managementovereenkomst",
    description: "Afspraken over de management fee.",
    perApplicant: true,
    fields: [text("partijen", "Partijen"), money("fee_per_jaar", "Fee per jaar"), date("ingangsdatum", "Ingangsdatum"), bool("schriftelijk", "Schriftelijk vastgelegd")],
  },
  { type: "rekening_courant", label: "Rekening-courantoverzicht DGA ↔ BV", description: "Stand rekening-courant.", perApplicant: true, fields: [text("entiteit", "BV"), date("datum_document", "Datum"), money("saldo", "Saldo (positief = DGA is schuldig)")] },
  { type: "kredietovereenkomst", label: "Zakelijke kredietovereenkomst / borgstelling", description: "Zakelijke kredieten en privé-borgstellingen.", perApplicant: true, fields: [text("kredietgever", "Kredietgever"), money("bedrag", "Kredietbedrag"), money("borgstelling", "Borgstelling privé")] },
  { type: "aov_polis", label: "Overzicht lijfrentes of AOV-polis", description: "Arbeidsongeschiktheids- en lijfrenteverzekeringen.", perApplicant: true, fields: [text("verzekeraar", "Verzekeraar"), money("verzekerd_per_maand", "Verzekerd bedrag per maand"), money("premie_per_jaar", "Premie per jaar")] },
]

export const DOC_TYPE_MAP = new Map(DOC_TYPES.map((d) => [d.type, d]))

export function docType(type: string): DocTypeDef | undefined {
  return DOC_TYPE_MAP.get(type)
}

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
] as const

/** Extensies voor de bestandskiezer (sommige browsers geven geen MIME-type voor .csv/.xls). */
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"

/** Bepaal het MIME-type, ook als de browser het leeg laat. */
export function resolveContentType(fileName: string, type: string): string {
  if (type && type !== "application/octet-stream") return type
  const ext = fileName.toLowerCase().split(".").pop()
  return (
    { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv" }[ext ?? ""] ?? type
  )
}
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export interface ChecklistItem {
  type: string
  label: string
  description: string
  required: boolean
  applicantPosition: number | null
  reason: string
}

interface ChecklistProfile {
  goal: string
  applicants: {
    position: number
    employment: { contract: string }[]
    pension: boolean
    businesses: { legalForm: string; holding: boolean }[]
    studentLoan: boolean
  }[]
  hasCurrentHome: boolean
  hasTargetHome: boolean
  newBuild: boolean
  renovation: boolean
  savings: boolean
  nearAow: boolean[]
}

/** Checklist: welke documenten verplicht of optioneel zijn voor dit profiel. */
export function checklist(p: ChecklistProfile): ChecklistItem[] {
  const out: ChecklistItem[] = []
  const add = (type: string, required: boolean, pos: number | null, reason: string) => {
    const d = docType(type)!
    out.push({ type, label: d.label, description: d.description, required, applicantPosition: pos, reason })
  }
  for (const a of p.applicants) {
    for (const e of a.employment) {
      add("werkgeversverklaring", true, a.position, "Onderbouwt je salaris en dienstverband.")
      add("salarisstrook", true, a.position, "Controle van je actuele salaris.")
      if (e.contract === "flex" || e.contract === "temporary") add("ibl_rapport", true, a.position, "Zonder vast contract telt je inkomen via de IBL-berekening.")
      else add("ibl_rapport", false, a.position, "Kan een hoger toetsinkomen opleveren bij wisselend inkomen.")
      add("jaaropgave", false, a.position, "Controle van het fiscale loon.")
      break
    }
    if (a.pension || p.nearAow[a.position - 1]) add("pensioenoverzicht", true, a.position, "Nodig voor de pensioen-/AOW-toets.")
    else add("pensioenoverzicht", false, a.position, "Voor een nauwkeurige pensioentoets en stresstest.")
    if (a.studentLoan) add("duo_overzicht", true, a.position, "Actuele DUO-termijn bepaalt de weging van je studieschuld.")
    for (const b of a.businesses) {
      const bv = b.legalForm === "bv" || b.legalForm === "bv_holding"
      add("kvk_uittreksel", true, a.position, "Rechtsvorm, startdatum en bestuurders.")
      add("jaarcijfers_onderneming", true, a.position, "Jaarrekeningen of een Excel-overzicht van de laatste 3 jaar; we vullen de cijfers automatisch in.")
      add("jaarrekening", false, a.position, "Losse jaarrekening per jaar (als alternatief voor het overzicht hierboven).")
      add("ib_aangifte", true, a.position, "IB-aangiften en definitieve aanslagen van 3 jaar.")
      add("ivo", false, a.position, "Veel banken vragen een Inkomensverklaring Ondernemer.")
      add("tussentijdse_cijfers", false, a.position, "Actuele ontwikkeling van het lopende jaar.")
      if (bv) {
        add("vpb_aangifte", true, a.position, "Onderbouwing van de BV-cijfers.")
        add("aandeelhoudersregister", true, a.position, "Aandelenbelang (DGA-status).")
        add("jaaropgave_dga", true, a.position, "Salaris DGA.")
        add("rekening_courant", false, a.position, "Voor de Wet excessief lenen.")
        add("dividendbesluit", false, a.position, "Uitgekeerde dividenden.")
      }
      if (b.holding) {
        add("organogram", true, a.position, "Structuur van holding en werkmaatschappijen.")
        add("managementovereenkomst", true, a.position, "Management fee telt alleen mee als die is vastgelegd.")
      }
      add("kredietovereenkomst", false, a.position, "Zakelijke kredieten en borgstellingen.")
      add("aov_polis", false, a.position, "AOV en lijfrentes voor de stresstests.")
      break
    }
  }
  if (p.hasCurrentHome) {
    add("hypotheekoverzicht", true, null, "Restschuld, rente en rentevaste periode van je huidige leningdelen.")
    add("woz_beschikking", true, null, "WOZ-waarde voor het eigenwoningforfait.")
    if (p.goal === "doorstromer" || p.goal === "verkopen") add("verkoopovereenkomst", false, null, "Verkoopprijs en leveringsdatum.")
    if (p.goal === "verhogen" || p.goal === "oversluiten") add("taxatierapport", false, null, "Actuele marktwaarde voor de LTV.")
  }
  if (p.hasTargetHome) {
    add("koopovereenkomst", true, null, "Koopsom en datum financieringsvoorbehoud.")
    if (!p.newBuild) add("taxatierapport", false, null, "De bank baseert de LTV op de marktwaarde.")
    add("energielabel", false, null, "Extra leenruimte en rentekorting.")
    if (!p.newBuild) add("bouwkundig_rapport", false, null, "Inzicht in onderhoudskosten.")
  }
  if (p.renovation) add("offerte_verbouwing", true, null, "Onderbouwing van de verbouwingskosten.")
  if (p.savings) add("bankafschrift", false, null, "Bewijs van eigen middelen.")
  // Unieke combinaties
  const seen = new Set<string>()
  return out.filter((i) => {
    const k = `${i.type}|${i.applicantPosition}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
