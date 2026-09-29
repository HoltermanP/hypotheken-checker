import { annuityPayment } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import { deductionRate } from "../tax/income-tax"
import { box3Tax } from "../tax/wealth-tax"
import { refinanceAnalysis, type RefinanceResult } from "../mover/penalty"
import type { ExistingLoanPart } from "../types"

/**
 * Overwaarde benutten zonder aankoop (§6.8). Per optie: netto-effect over 10 en 30 jaar,
 * fiscale gevolgen en risico's. Negatief netto-effect = kosten, positief = opbrengst/besparing.
 *
 * Modelparameters (zie ENGINE.md, status needs_verification via norm senioren.*):
 * - Verkoop met terughuur: koopprijs 80% van de marktwaarde, aanvangshuur 5% van de koopprijs.
 * - Verzilverhypotheek: maximaal 50% van de marktwaarde, rente wordt bijgeschreven.
 */

export const SALE_LEASEBACK_PRICE_PCT = 80
export const SALE_LEASEBACK_RENT_PCT = 5
export const REVERSE_MORTGAGE_MAX_PCT = 50

export interface EquityOption {
  key: string
  title: string
  description: string
  amount: number
  monthlyEffect: number
  netEffect10: number
  netEffect30: number
  taxConsequences: string[]
  risks: string[]
  lenders?: string[]
  normKeys: string[]
  available: boolean
  unavailableReason?: string
}

export interface EquityReleaseContext {
  norms: NormValues
  marketValue: number
  woz: number
  currentDebt: number
  loanParts: ExistingLoanPart[]
  /** Extra leenruimte op basis van inkomen (max hypotheek − huidige schuld). */
  incomeRoom: number
  /** Extra leenruimte op basis van onderpand. */
  collateralRoom: number
  ratePct: number
  taxableIncome: number
  savingsAboveBuffer: number
  persons: number
  children: number
  oldestAge: number
  calculationDate: string
  fixedYears: number
  requestedAmount: number
  lendersAllowingConsumptive: string[]
  lendersAllowingBusiness: string[]
  isEntrepreneur: boolean
}

function annuityNet(norms: NormValues, amount: number, ratePct: number, taxable: number, deductible: boolean) {
  const gross = annuityPayment(amount, ratePct, 360)
  const interestYear1 = (amount * ratePct) / 100
  const benefit = deductible ? (interestYear1 * deductionRate(norms, taxable)) / 100 / 12 : 0
  return { gross, net: gross - benefit }
}

export function equityReleaseOptions(ctx: EquityReleaseContext): {
  room: number
  options: EquityOption[]
  refinance: RefinanceResult | null
} {
  const { norms } = ctx
  const room = Math.max(0, Math.min(ctx.incomeRoom, ctx.collateralRoom))
  const amount = Math.min(ctx.requestedAmount > 0 ? ctx.requestedAmount : room, room)
  const options: EquityOption[] = []

  // 1. Verhogen voor verbouwing
  {
    const { net } = annuityNet(norms, amount, ctx.ratePct, ctx.taxableIncome, true)
    options.push({
      key: "verbouwing",
      title: "Hypotheek verhogen voor verbouwing",
      description: "Extra annuïtaire lening voor een verbouwing van je eigen woning, uitbetaald via een bouwdepot.",
      amount,
      monthlyEffect: -net,
      netEffect10: -net * 120,
      netEffect30: -net * 360,
      taxConsequences: [
        "Rente is aftrekbaar in box 1 als het geld aantoonbaar aan verbetering/onderhoud van de eigen woning wordt besteed en de lening annuïtair of lineair in 30 jaar wordt afgelost.",
      ],
      risks: ["Hogere maandlasten en schuld.", "Kosten van de verbouwing kunnen hoger uitvallen dan begroot."],
      normKeys: [NORM_KEYS.aflossingseis, NORM_KEYS.maxAftrek, NORM_KEYS.nhgVoorwaarden],
      available: amount > 0,
      unavailableReason: amount > 0 ? undefined : "Er is geen extra leenruimte.",
    })
  }

  // 2. Verduurzamen (extra leenruimte energiebesparende voorzieningen, tot 106%)
  {
    const energyRoom = Math.max(0, (ctx.marketValue * norms.trhk.maxLtvEnergyPct) / 100 - ctx.currentDebt)
    const a = Math.min(energyRoom, Math.max(amount, 0) + (ctx.marketValue * (norms.trhk.maxLtvEnergyPct - norms.trhk.maxLtvPct)) / 100)
    const { net } = annuityNet(norms, a, ctx.ratePct, ctx.taxableIncome, true)
    options.push({
      key: "verduurzamen",
      title: "Verhogen voor verduurzaming",
      description: "Lenen voor energiebesparende voorzieningen: extra leenruimte buiten de inkomensnorm en tot 106% van de woningwaarde.",
      amount: a,
      monthlyEffect: -net,
      netEffect10: -net * 120,
      netEffect30: -net * 360,
      taxConsequences: ["Rente is aftrekbaar (verbetering eigen woning) bij annuïtaire of lineaire aflossing."],
      risks: ["De energiebesparing hangt af van verbruik en energieprijzen en is niet meegerekend."],
      normKeys: [NORM_KEYS.energieBesparendExtra, NORM_KEYS.maxLtvEnergy],
      available: a > 0,
    })
  }

  // 3. Aflossen vs. sparen vs. beleggen
  {
    const A = ctx.savingsAboveBuffer
    const deductiblePart = ctx.loanParts.some((p) => p.type === "annuity" || p.type === "linear" || p.startedBefore2013)
    const d = deductiblePart ? deductionRate(norms, ctx.taxableIncome) / 100 : 0
    const avgRate =
      ctx.currentDebt > 0 ? ctx.loanParts.reduce((a, p) => a + p.balance * p.ratePct, 0) / ctx.currentDebt : ctx.ratePct
    const box3Base = box3Tax(norms, { bankBalances: A, otherAssets: 0, debts: 0, persons: ctx.persons }).tax
    const box3Other = box3Tax(norms, { bankBalances: 0, otherAssets: A, debts: 0, persons: ctx.persons }).tax
    const grow = (rateNetPct: number, years: number) => A * (Math.pow(1 + rateNetPct / 100, years) - 1)
    const aflosNet = avgRate * (1 - d) + (A > 0 ? (box3Base / A) * 100 : 0)
    const spaarNet = norms.market.spaarrentePct - (A > 0 ? (box3Base / A) * 100 : 0)
    const beleggenNet = norms.market.verwachtRendementBeleggenPct - (A > 0 ? (box3Other / A) * 100 : 0)
    for (const [key, title, rate, desc, risks] of [
      ["aflossen", "Extra aflossen", aflosNet, "Spaargeld boven je buffer gebruiken om de hypotheek af te lossen (binnen de boetevrije ruimte).", ["Geld zit vast in de woning; je kunt het niet zomaar terugkrijgen."]],
      ["sparen", "Sparen", spaarNet, "Het geld op een spaarrekening laten staan.", ["Rendement ligt vaak onder de hypotheekrente en inflatie."]],
      ["beleggen", "Beleggen", beleggenNet, "Het geld beleggen (verwacht rendement volgens de Commissie Parameters).", ["Rendement is niet gegarandeerd; je kunt verlies lijden."]],
    ] as const) {
      options.push({
        key,
        title,
        description: desc,
        amount: A,
        monthlyEffect: (A * rate) / 100 / 12,
        netEffect10: grow(rate, 10),
        netEffect30: grow(rate, 30),
        taxConsequences:
          key === "aflossen"
            ? ["Lagere hypotheekrenteaftrek, lagere box 3-heffing (spaargeld neemt af)."]
            : ["Het vermogen valt in box 3 (forfaitair rendement boven het heffingvrij vermogen)."],
        risks: [...risks],
        normKeys: [NORM_KEYS.spaarrente, NORM_KEYS.rendement, NORM_KEYS.box3Bank, NORM_KEYS.box3Overig, NORM_KEYS.box3Tarief, NORM_KEYS.maxAftrek],
        available: A > 0,
        unavailableReason: A > 0 ? undefined : "Je hebt geen spaargeld boven je buffer.",
      })
    }
  }

  // 4. Oversluiten
  let refinance: RefinanceResult | null = null
  if (ctx.loanParts.length > 0) {
    refinance = refinanceAnalysis(ctx.loanParts, ctx.calculationDate, ctx.ratePct, ctx.fixedYears)
    options.push({
      key: "oversluiten",
      title: "Oversluiten naar een lagere rente",
      description: "De huidige leningdelen oversluiten tegen de actuele rente, of rentemiddeling bij de huidige bank.",
      amount: ctx.currentDebt,
      monthlyEffect: refinance.monthlySaving,
      netEffect10: refinance.monthlySaving * 120 - refinance.totalPenalty,
      netEffect30: refinance.monthlySaving * Math.min(360, ctx.fixedYears * 12) - refinance.totalPenalty,
      taxConsequences: ["Boeterente bij oversluiten is als financieringskosten aftrekbaar in box 1."],
      risks: ["Afsluitkosten (advies, notaris, taxatie) komen bovenop de boeterente."],
      normKeys: [NORM_KEYS.boeterente],
      available: refinance.monthlySaving > 0,
      unavailableReason: refinance.monthlySaving > 0 ? undefined : "De actuele rente is niet lager dan je huidige rente.",
    })
  }

  // 5. Overwaarde vrij opnemen (consumptief)
  {
    const box3Room = Math.max(0, Math.min(ctx.collateralRoom, amount))
    const { gross } = annuityNet(norms, box3Room, ctx.ratePct, ctx.taxableIncome, false)
    options.push({
      key: "consumptief",
      title: "Overwaarde vrij opnemen",
      description: "Extra lening voor consumptieve doelen (bijvoorbeeld een auto of reis).",
      amount: box3Room,
      monthlyEffect: -gross,
      netEffect10: -gross * 120,
      netEffect30: -gross * 360,
      taxConsequences: [
        "Rente is niet aftrekbaar (box 3-schuld).",
        "De schuld verlaagt je box 3-grondslag boven de schuldendrempel.",
        "De Trhk-toets gebruikt voor dit deel de box 3-tabel (lagere leenruimte).",
      ],
      risks: ["Je woning dient als onderpand voor consumptie; bij waardedaling groeit het restschuldrisico."],
      lenders: ctx.lendersAllowingConsumptive,
      normKeys: [NORM_KEYS.tableBox3Regular, NORM_KEYS.box3Schulden, NORM_KEYS.box3Drempel],
      available: box3Room > 0 && ctx.lendersAllowingConsumptive.length > 0,
      unavailableReason:
        ctx.lendersAllowingConsumptive.length === 0 ? "Geen van de banken in onze database staat dit (bevestigd) toe." : undefined,
    })
  }

  // 6. Schenken aan kinderen
  if (ctx.children > 0) {
    const perYear = norms.schenk.vrijstellingKindJaarlijks * ctx.children
    options.push({
      key: "schenken",
      title: "Schenken aan kinderen",
      description:
        "Jaarlijks belastingvrij schenken aan je kinderen, eventueel gefinancierd uit overwaarde. De eenmalig verhoogde vrijstelling voor de eigen woning (jubelton) bestaat sinds 2024 niet meer.",
      amount: perYear,
      monthlyEffect: -perYear / 12,
      netEffect10: -perYear * 10,
      netEffect30: -perYear * 30,
      taxConsequences: [
        "Jaarlijkse vrijstelling per kind; daarboven schenkbelasting.",
        "Familiebank: een lening aan je kind met zakelijke rente kan voor het kind een eigenwoningschuld zijn (aftrekbaar); voor jou valt de vordering in box 3.",
      ],
      risks: ["Geschonken geld ben je kwijt; houd rekening met je eigen pensioen."],
      normKeys: [NORM_KEYS.schenkKind, NORM_KEYS.jubelton, NORM_KEYS.schenkEenmalig],
      available: true,
    })
  }

  // 7. Aanvulling pensioen: verzilverhypotheek, verkoop met terughuur, kleiner wonen
  {
    const senior = ctx.oldestAge >= 60
    const reverse = Math.max(0, (ctx.marketValue * REVERSE_MORTGAGE_MAX_PCT) / 100 - ctx.currentDebt)
    const debt10 = reverse * Math.pow(1 + ctx.ratePct / 100, 10)
    const debt30 = reverse * Math.pow(1 + ctx.ratePct / 100, 30)
    options.push({
      key: "verzilveren",
      title: "Verzilverhypotheek (opeethypotheek)",
      description: "Voor senioren: een lening zonder maandlasten; de rente wordt bij de schuld opgeteld en afgelost bij verkoop of overlijden.",
      amount: reverse,
      monthlyEffect: 0,
      netEffect10: -(debt10 - reverse),
      netEffect30: -(debt30 - reverse),
      taxConsequences: ["Bijgeschreven rente is doorgaans niet aftrekbaar als het geld niet aan de woning wordt besteed (box 3)."],
      risks: ["De schuld groeit snel door rente-op-rente en vermindert de erfenis.", "Aanbod is beperkt en wisselt (controleer actuele aanbieders)."],
      normKeys: [NORM_KEYS.verzilver],
      available: senior && reverse > 0,
      unavailableReason: senior ? undefined : "Alleen beschikbaar voor senioren (doorgaans vanaf ca. 60 jaar).",
    })
    const price = (ctx.marketValue * SALE_LEASEBACK_PRICE_PCT) / 100
    const rentYear = (price * SALE_LEASEBACK_RENT_PCT) / 100
    const cash = price - ctx.currentDebt
    options.push({
      key: "sale_leaseback",
      title: "Verkoop met terughuur",
      description: "Je verkoopt de woning aan een belegger en huurt hem terug.",
      amount: cash,
      monthlyEffect: -rentYear / 12,
      netEffect10: cash - rentYear * 10,
      netEffect30: cash - rentYear * 30,
      taxConsequences: ["Opbrengst valt in box 3; geen hypotheekrenteaftrek en geen eigenwoningforfait meer."],
      risks: ["Koopprijs ligt ruim onder de marktwaarde.", "Huur stijgt jaarlijks; je profiteert niet meer van waardestijging."],
      normKeys: [NORM_KEYS.saleLeaseback],
      available: senior && cash > 0,
      unavailableReason: senior ? undefined : "Vooral bedoeld voor senioren.",
    })
  }
  return { room, options, refinance }
}
