import { z } from "zod"
import { applyFinancialsToBusiness } from "@/lib/documents/apply-financials"
import type { FieldValue } from "@/lib/documents/extraction"
import type { MergedFinancials } from "@/lib/documents/financials"
import { defaultAssets, defaultBusiness, defaultObligations, defaultPreferences, defaultRisks, newId } from "@/lib/intake/defaults"
import { GOAL_TITLES } from "@/lib/intake/goals"
import { ENERGY_LABELS, GOALS, type BusinessForm, type IntakeData, type IncomeItem, type StepKey } from "@/lib/intake/schema"

/**
 * Snelle invoer: één formulier (wie, inkomen uit loonstroken/jaarcijfers, vermogen, schulden en
 * woning) dat wordt omgezet naar de volledige intake. Alles wat niet gevraagd wordt krijgt een
 * standaardwaarde of blijft zoals het al in de intake stond. Puur en isomorf.
 */

const eur = z.number({ error: "Vul een bedrag in" }).min(0, "Bedrag kan niet negatief zijn")
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vul een datum in")

export const CONTRACTS = ["permanent", "temporary_with_intent", "temporary", "flex"] as const
export const LOAN_TYPES = ["annuity", "linear", "interest_only", "savings", "investment"] as const
export const CURRENT_HOME_GOALS: readonly string[] = ["doorstromer", "oversluiten", "verhogen", "verkopen"]
export const TARGET_HOME_GOALS: readonly string[] = ["starter", "doorstromer"]

/** Leningdelen die we zelf aanmaken herkennen we aan deze omschrijving (bij opnieuw opslaan vervangen). */
const QUICK_DEBT = "Overige leningen"

export const quickApplicant = z.object({
  firstName: z.string().trim().max(60).optional(),
  dateOfBirth: isoDate,
  grossMonthlySalary: eur,
  holidayPayPct: z.number().min(0).max(20),
  thirteenthMonth: z.boolean(),
  contract: z.enum(CONTRACTS),
  /** DGA: de loonstrook komt van de eigen BV; telt dan als DGA-salaris, niet als loondienst. */
  salaryFromOwnBv: z.boolean(),
})

export const quickLoanPart = z.object({
  id: z.string().min(1),
  type: z.enum(LOAN_TYPES),
  balance: eur,
  ratePct: z.number({ error: "Vul de rente in" }).min(0).max(15),
  fixedRateEndDate: isoDate,
})

export const quickForm = z
  .object({
    goal: z.enum(GOALS),
    hasPartner: z.boolean(),
    applicants: z.array(quickApplicant).min(1).max(2),
    savings: eur,
    investments: eur,
    giftAmount: eur,
    studentLoanMonthly: eur,
    studentLoanOutstanding: eur,
    otherDebtMonthly: eur,
    otherDebtOutstanding: eur,
    currentHome: z.object({
      marketValue: eur,
      wozValue: eur.nullable(),
      mortgageStartYear: z.number().int().min(1960).max(2100),
      loanParts: z.array(quickLoanPart).max(6),
      energyLabel: z.enum(ENERGY_LABELS),
    }),
    targetHome: z.object({
      purchasePrice: eur,
      newBuild: z.boolean(),
      energyLabel: z.enum(ENERGY_LABELS),
    }),
    equityReleaseAmount: eur,
    fixedRateYears: z.number().int().refine((v) => [1, 2, 3, 5, 6, 7, 10, 12, 15, 20, 25, 30].includes(v), "Kies een rentevaste periode"),
  })
  .superRefine((q, ctx) => {
    if (q.applicants.length !== (q.hasPartner ? 2 : 1)) ctx.addIssue({ code: "custom", path: ["applicants"], message: "Aantal aanvragers klopt niet" })
    if (TARGET_HOME_GOALS.includes(q.goal) && q.targetHome.purchasePrice <= 0)
      ctx.addIssue({ code: "custom", path: ["targetHome", "purchasePrice"], message: "Vul de koopsom in" })
    if (CURRENT_HOME_GOALS.includes(q.goal) && q.currentHome.marketValue <= 0)
      ctx.addIssue({ code: "custom", path: ["currentHome", "marketValue"], message: "Vul de waarde van je woning in" })
    if (q.goal === "verhogen" && q.equityReleaseAmount <= 0)
      ctx.addIssue({ code: "custom", path: ["equityReleaseAmount"], message: "Vul in hoeveel je extra wilt lenen" })
  })

export type QuickForm = z.infer<typeof quickForm>
export type QuickApplicant = z.infer<typeof quickApplicant>

export function emptyQuickApplicant(): QuickApplicant {
  return { firstName: "", dateOfBirth: "", grossMonthlySalary: 0, holidayPayPct: 8, thirteenthMonth: false, contract: "permanent", salaryFromOwnBv: false }
}

export function emptyLoanPart(calcYear: number): QuickForm["currentHome"]["loanParts"][number] {
  return { id: newId(), type: "annuity", balance: 0, ratePct: 0, fixedRateEndDate: `${calcYear + 5}-01-01` }
}

const round = (n: number) => Math.round(n * 100) / 100

// ----------------------------------------------------------------------------- startwaarden

/** Startwaarden uit wat er al in de intake staat (bijvoorbeeld na de uitgebreide wizard). */
export function quickFromIntake(intake: IntakeData, calcYear: number): QuickForm {
  const persons = intake.persoonlijk?.applicants ?? [{ firstName: "", dateOfBirth: "" }]
  const count = intake.persoonlijk?.hasPartner ? 2 : 1
  const applicants = persons.slice(0, count).map((p, i): QuickApplicant => {
    const a = emptyQuickApplicant()
    a.firstName = p.firstName ?? ""
    a.dateOfBirth = p.dateOfBirth ?? ""
    const emp = intake.inkomen?.applicants[i]?.incomes.find((x) => x.kind === "employment")
    if (emp && emp.kind === "employment" && emp.grossAnnualSalary > 0) {
      a.grossMonthlySalary = round(emp.grossAnnualSalary / 12)
      a.holidayPayPct = round((emp.holidayPay / emp.grossAnnualSalary) * 100)
      a.thirteenthMonth = emp.thirteenthMonth > 0
      a.contract = (CONTRACTS as readonly string[]).includes(emp.contract) ? (emp.contract as QuickApplicant["contract"]) : "permanent"
    }
    return a
  })
  const obligations = intake.verplichtingen?.obligations ?? []
  const student = obligations.filter((o) => o.type === "student_loan")
  const other = obligations.filter((o) => o.description === QUICK_DEBT)
  const ch = intake["huidige-woning"]
  const th = intake["nieuwe-woning"]
  const firstEnd = ch?.loanParts[0]?.endDate
  return {
    goal: intake.doel?.goal ?? "orientatie",
    hasPartner: count === 2,
    applicants,
    savings: intake.vermogen?.savings ?? 0,
    investments: intake.vermogen?.investments ?? 0,
    giftAmount: intake.vermogen?.giftAmount ?? 0,
    studentLoanMonthly: student.reduce((s, o) => s + o.monthlyPayment, 0),
    studentLoanOutstanding: student.reduce((s, o) => s + o.outstanding, 0),
    otherDebtMonthly: other.reduce((s, o) => s + o.monthlyPayment, 0),
    otherDebtOutstanding: other.reduce((s, o) => s + o.outstanding, 0),
    currentHome: {
      marketValue: ch?.marketValue ?? 0,
      wozValue: ch?.wozValue ?? null,
      mortgageStartYear: firstEnd ? Number(firstEnd.slice(0, 4)) - 30 : calcYear - 5,
      loanParts: ch?.loanParts.length
        ? ch.loanParts.map((lp) => ({ id: lp.id, type: lp.type, balance: lp.balance, ratePct: lp.ratePct, fixedRateEndDate: lp.fixedRateEndDate }))
        : [emptyLoanPart(calcYear)],
      energyLabel: ch?.energyLabel ?? "C",
    },
    targetHome: {
      purchasePrice: th?.purchasePrice ?? 0,
      newBuild: th?.kind === "new_build",
      energyLabel: th?.energyLabel ?? "C",
    },
    equityReleaseAmount: intake.voorkeuren?.equityReleaseAmount ?? 0,
    fixedRateYears: intake.voorkeuren?.fixedRateYears ?? 10,
  }
}

// ----------------------------------------------------------------------------- uit documenten

export interface SalarySuggestion {
  grossMonthlySalary?: number
  holidayPayPct?: number
  thirteenthMonth?: boolean
  contract?: QuickApplicant["contract"]
  dateOfBirth?: string
  employer?: string
  /** Datum van het document (voor 'nieuwste wint'). */
  date: string
}

export interface SalaryDoc {
  type: string
  values: Record<string, FieldValue>
  createdAt: string
}

const num = (v: FieldValue | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const str = (v: FieldValue | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

function contractFrom(text: string | null, intent: FieldValue | undefined): QuickApplicant["contract"] | undefined {
  if (intent === true) return "temporary_with_intent"
  const d = text?.toLowerCase() ?? ""
  if (!d) return undefined
  if (d.includes("onbepaalde") || d.startsWith("vast")) return "permanent"
  if (d.includes("oproep") || d.includes("flex") || d.includes("uitzend")) return "flex"
  if (d.includes("bepaalde") || d.includes("tijdelijk")) return "temporary"
  return undefined
}

/** Salarisgegevens uit één loonstrook of werkgeversverklaring. */
export function salaryFromDoc(doc: SalaryDoc): SalarySuggestion | null {
  const v = doc.values
  const date = str(v.datum_document) ?? doc.createdAt.slice(0, 10)
  const dob = str(v.geboortedatum) ?? undefined
  if (doc.type === "salarisstrook") {
    const monthly = num(v.bruto_maandsalaris)
    const pct = num(v.vakantiegeld_pct)
    if (monthly === null && !dob) return null
    return {
      grossMonthlySalary: monthly ?? undefined,
      holidayPayPct: pct !== null && pct > 0 && pct <= 20 ? pct : undefined,
      dateOfBirth: dob,
      employer: str(v.werkgever) ?? undefined,
      date,
    }
  }
  if (doc.type === "werkgeversverklaring") {
    const annual = num(v.bruto_jaarsalaris)
    const holiday = num(v.vakantiegeld)
    return {
      grossMonthlySalary: annual !== null ? round(annual / 12) : undefined,
      holidayPayPct: annual && holiday !== null ? round((holiday / annual) * 100) : undefined,
      thirteenthMonth: (num(v.dertiende_maand) ?? 0) > 0 || undefined,
      contract: contractFrom(str(v.dienstverband), v.intentieverklaring),
      dateOfBirth: dob,
      employer: str(v.werkgever) ?? undefined,
      date,
    }
  }
  return null
}

/**
 * Samengevoegde suggestie uit alle salarisdocumenten van één aanvrager: een werkgeversverklaring
 * gaat vóór een loonstrook (jaarbedragen en contractvorm); verder wint het nieuwste document.
 */
export function salarySuggestion(docs: SalaryDoc[]): SalarySuggestion | null {
  const items = docs
    .map((d) => ({ d, s: salaryFromDoc(d) }))
    .filter((x): x is { d: SalaryDoc; s: SalarySuggestion } => x.s !== null)
    .sort((a, b) => (a.d.type === b.d.type ? a.s.date.localeCompare(b.s.date) : a.d.type === "werkgeversverklaring" ? 1 : -1))
  if (items.length === 0) return null
  const out: SalarySuggestion = { date: "" }
  for (const { s } of items) {
    for (const [k, val] of Object.entries(s) as [keyof SalarySuggestion, unknown][]) if (val !== undefined) (out as unknown as Record<string, unknown>)[k] = val
  }
  return out
}

/** Vul lege velden van het formulier aan met wat we uit documenten hebben gehaald. */
export function fillFromSuggestions(q: QuickForm, suggestions: (SalarySuggestion | null)[]): QuickForm {
  const out = structuredClone(q)
  out.applicants.forEach((a, i) => {
    const s = suggestions[i]
    if (!s) return
    if (!a.dateOfBirth && s.dateOfBirth) a.dateOfBirth = s.dateOfBirth
    if (a.grossMonthlySalary === 0 && s.grossMonthlySalary) {
      a.grossMonthlySalary = s.grossMonthlySalary
      if (s.holidayPayPct !== undefined) a.holidayPayPct = s.holidayPayPct
      if (s.thirteenthMonth !== undefined) a.thirteenthMonth = s.thirteenthMonth
      if (s.contract) a.contract = s.contract
    }
  })
  return out
}

/** Soort onderneming afgeleid uit de jaarcijfers. */
export function legalFormFromFinancials(m: MergedFinancials): BusinessForm["legalForm"] | null {
  if (m.entities.length === 0) return null
  if (m.entities.every((e) => e.role === "eenmanszaak")) return "eenmanszaak"
  return m.entities.some((e) => e.role === "holding") ? "bv_holding" : "bv"
}

// ----------------------------------------------------------------------------- omzetten

export interface QuickResult {
  /** Op te slaan stappen, in volgorde. */
  steps: [Exclude<StepKey, "overzicht">, unknown][]
  /** Aannames die we hebben gedaan (getoond na het berekenen). */
  notes: string[]
}

function annualSalary(a: QuickApplicant) {
  const gross = round(a.grossMonthlySalary * 12)
  return {
    gross,
    holiday: round((gross * a.holidayPayPct) / 100),
    thirteenth: a.thirteenthMonth ? a.grossMonthlySalary : 0,
  }
}

function freshBusiness(merged: MergedFinancials, calcYear: number): BusinessForm {
  const b = defaultBusiness(calcYear)
  // Geen voorgevulde lege jaren: die zouden het gemiddelde drukken.
  b.soleProp = { years: [], forBalance: 0, forecastProfit: null }
  b.bv!.salaries = []
  b.bv!.entities[0]!.financials = []
  b.legalForm = legalFormFromFinancials(merged) ?? "eenmanszaak"
  const years = merged.entities.flatMap((e) => e.years.filter((y) => !y.isForecast).map((y) => y.year))
  b.startDate = `${years.length ? Math.min(...years) : calcYear - 3}-01-01`
  return b
}

/**
 * De onderneming van één aanvrager na het overnemen van de jaarcijfers (en, bij een DGA, het
 * salaris uit de loonstrook). Gedeeld door de berekening en de live preview van het toetsinkomen.
 */
export function quickBusiness(
  existing: BusinessForm | undefined,
  merged: MergedFinancials | null,
  a: QuickApplicant,
  calcYear: number
): { business: BusinessForm | undefined; changed: boolean; salaryNote: string | null } {
  let business = existing ? structuredClone(existing) : undefined
  let changed = false
  if (merged && merged.entities.length > 0) {
    business = applyFinancialsToBusiness(business ?? freshBusiness(merged, calcYear), merged).business
    if (!business.startDate) business.startDate = freshBusiness(merged, calcYear).startDate
    changed = true
  }
  const bv = business && (business.legalForm === "bv" || business.legalForm === "bv_holding") ? business.bv : undefined
  let salaryNote: string | null = null
  if (bv && a.salaryFromOwnBv && a.grossMonthlySalary > 0) {
    const s = annualSalary(a)
    const amount = round(s.gross + s.holiday + s.thirteenth)
    bv.salaries = [...bv.salaries.filter((x) => x.year !== calcYear), { year: calcYear, amount }].sort((x, y) => x.year - y.year).slice(-4)
    changed = true
    salaryNote = `Salaris uit je loonstrook telt als DGA-salaris ${calcYear} (${amount} per jaar incl. vakantiegeld).`
  }
  return { business, changed, salaryNote }
}

/**
 * Zet het snelle formulier om naar intake-stappen. `financials[i]` zijn de samengevoegde
 * jaarcijfers van aanvrager i (of null).
 */
export function quickToIntake(q: QuickForm, intake: IntakeData, financials: (MergedFinancials | null)[], calcYear: number): QuickResult {
  const notes: string[] = []
  const count = q.hasPartner ? 2 : 1
  const steps: QuickResult["steps"] = []
  const needsCurrent = CURRENT_HOME_GOALS.includes(q.goal)
  const needsTarget = TARGET_HOME_GOALS.includes(q.goal)

  // Een standaardnaam volgt het doel; een eigen naam blijft staan.
  const title = intake.doel?.title
  const customTitle = !!title && !(Object.values(GOAL_TITLES) as string[]).includes(title)
  steps.push(["doel", { goal: q.goal, title: customTitle ? title : GOAL_TITLES[q.goal] }])

  // Persoonlijk
  const prevP = intake.persoonlijk
  steps.push([
    "persoonlijk",
    {
      hasPartner: q.hasPartner,
      applicants: q.applicants.slice(0, count).map((a, i) => {
        const prev = prevP?.applicants[i]
        return {
          firstName: a.firstName ?? "",
          dateOfBirth: a.dateOfBirth,
          previousHomeOwner: q.goal === "starter" ? false : needsCurrent ? true : (prev?.previousHomeOwner ?? false),
          usedStartersExemption: prev?.usedStartersExemption ?? false,
          yearsWorked: prev?.yearsWorked ?? null,
        }
      }),
      maritalStatus: prevP && prevP.hasPartner === q.hasPartner ? prevP.maritalStatus : q.hasPartner ? "married" : "single",
      prenup: prevP?.prenup ?? "none",
      children: prevP?.children ?? 0,
      childrenUnder18: prevP?.childrenUnder18 ?? 0,
    },
  ])
  if (!prevP && q.hasPartner) notes.push("Aangenomen: jullie zijn fiscale partners (getrouwd of geregistreerd). Pas dit zo nodig aan in de uitgebreide intake.")

  // Ondernemer
  const entrepreneur: boolean[] = []
  const prevO = intake.ondernemer
  const ondernemer = { applicants: Array.from({ length: count }, (_, i) => ({ businesses: structuredClone(prevO?.applicants[i]?.businesses ?? []) })) }
  let businessChanged = false
  q.applicants.slice(0, count).forEach((a, i) => {
    const list = ondernemer.applicants[i]!.businesses
    const r = quickBusiness(list[0], financials[i] ?? null, a, calcYear)
    if (r.changed && r.business) {
      list[0] = r.business
      businessChanged = true
    }
    if (r.salaryNote) notes.push(r.salaryNote)
    entrepreneur[i] = list.length > 0
  })
  if (businessChanged) steps.push(["ondernemer", ondernemer])

  // Inkomen
  steps.push([
    "inkomen",
    {
      applicants: q.applicants.slice(0, count).map((a, i) => {
        const prev = intake.inkomen?.applicants[i]
        const prevEmp = prev?.incomes.find((x) => x.kind === "employment")
        const others = (prev?.incomes ?? []).filter((x) => x.kind !== "employment")
        const incomes: IncomeItem[] = [...others]
        const bvSalary = a.salaryFromOwnBv && entrepreneur[i] && ondernemer.applicants[i]!.businesses[0]?.legalForm.startsWith("bv")
        if (a.grossMonthlySalary > 0 && !bvSalary) {
          const s = annualSalary(a)
          const pe = prevEmp?.kind === "employment" ? prevEmp : undefined
          incomes.unshift({
            id: pe?.id ?? newId(),
            kind: "employment",
            employer: pe?.employer ?? "",
            contract: a.contract,
            grossAnnualSalary: s.gross,
            holidayPay: s.holiday,
            thirteenthMonth: s.thirteenth,
            fixedYearEndBonus: pe?.fixedYearEndBonus ?? 0,
            irregularityAllowance: pe?.irregularityAllowance ?? 0,
            commission: pe?.commission ?? 0,
            iblToetsinkomen: pe?.iblToetsinkomen ?? null,
          })
        }
        return {
          incomes,
          isEntrepreneur: entrepreneur[i] ?? false,
          expectedRetirementIncome: prev?.expectedRetirementIncome ?? null,
          alimonyPaidAnnual: prev?.alimonyPaidAnnual ?? 0,
        }
      }),
    },
  ])

  // Verplichtingen
  const prevOb = intake.verplichtingen ?? defaultObligations()
  const obligations = prevOb.obligations.filter((o) => o.type !== "student_loan" && o.description !== QUICK_DEBT)
  if (q.studentLoanMonthly > 0 || q.studentLoanOutstanding > 0)
    obligations.push({ id: newId(), applicantPosition: 1, type: "student_loan", description: "DUO", limitOrPrincipal: 0, monthlyPayment: q.studentLoanMonthly, outstanding: q.studentLoanOutstanding, willBeRepaid: false })
  if (q.otherDebtMonthly > 0 || q.otherDebtOutstanding > 0)
    obligations.push({ id: newId(), applicantPosition: null, type: "personal_loan", description: QUICK_DEBT, limitOrPrincipal: q.otherDebtOutstanding, monthlyPayment: q.otherDebtMonthly, outstanding: q.otherDebtOutstanding, willBeRepaid: false })
  steps.push(["verplichtingen", { ...prevOb, obligations }])

  // Vermogen
  steps.push(["vermogen", { ...(intake.vermogen ?? defaultAssets()), savings: q.savings, investments: q.investments, giftAmount: q.giftAmount }])

  // Huidige woning
  if (needsCurrent) {
    const prev = intake["huidige-woning"]
    const endDate = `${q.currentHome.mortgageStartYear + 30}-01-01`
    steps.push([
      "huidige-woning",
      {
        wozValue: q.currentHome.wozValue ?? q.currentHome.marketValue,
        marketValue: q.currentHome.marketValue,
        expectedSalePrice: prev?.expectedSalePrice || q.currentHome.marketValue,
        energyLabel: q.currentHome.energyLabel,
        erfpachtCanonAnnual: prev?.erfpachtCanonAnnual ?? 0,
        loanParts: q.currentHome.loanParts
          .filter((lp) => lp.balance > 0)
          .map((lp) => {
            const old = prev?.loanParts.find((x) => x.id === lp.id)
            return {
              ...old,
              id: lp.id,
              type: lp.type,
              balance: lp.balance,
              ratePct: lp.ratePct,
              fixedRateEndDate: lp.fixedRateEndDate,
              endDate: old?.endDate ?? endDate,
              startedBefore2013: old?.startedBefore2013 ?? q.currentHome.mortgageStartYear < 2013,
              nhg: old?.nhg ?? false,
            }
          }),
        expectedSaleDate: prev?.expectedSaleDate ?? "",
        brokerFeePct: prev?.brokerFeePct ?? null,
        moveOrder: prev?.moveOrder ?? "sell_first",
        bridgeMonths: prev?.bridgeMonths ?? 6,
        temporaryHousingMonthly: prev?.temporaryHousingMonthly ?? 0,
        temporaryHousingMonths: prev?.temporaryHousingMonths ?? 0,
      },
    ])
    if (!prev) notes.push("Aangenomen: looptijd hypotheek 30 jaar vanaf het jaar van afsluiten, geen NHG op je huidige hypotheek.")
  }

  // Nieuwe woning
  if (needsTarget) {
    const prev = intake["nieuwe-woning"]
    steps.push([
      "nieuwe-woning",
      {
        purchasePrice: q.targetHome.purchasePrice,
        marketValue: prev?.marketValue ?? null,
        wozValue: prev?.wozValue ?? null,
        kind: q.targetHome.newBuild ? "new_build" : "existing",
        propertyType: prev?.propertyType ?? "tussenwoning",
        extraWork: prev?.extraWork ?? 0,
        constructionMonths: prev?.constructionMonths ?? null,
        energyLabel: q.targetHome.energyLabel,
        erfpachtCanonAnnual: prev?.erfpachtCanonAnnual ?? 0,
        renovationAmount: prev?.renovationAmount ?? 0,
        energySavingAmount: prev?.energySavingAmount ?? 0,
        hoaMonthly: prev?.hoaMonthly ?? 0,
        deliveryDate: prev?.deliveryDate ?? "",
        ownOccupation: prev?.ownOccupation ?? true,
        useBuyersAgent: prev?.useBuyersAgent ?? false,
        useBuildingInspection: prev?.useBuildingInspection ?? !q.targetHome.newBuild,
      },
    ])
  }

  // Voorkeuren en risico's
  steps.push([
    "voorkeuren",
    {
      ...(intake.voorkeuren ?? defaultPreferences()),
      fixedRateYears: q.fixedRateYears,
      equityReleaseAmount: q.goal === "verhogen" ? q.equityReleaseAmount : (intake.voorkeuren?.equityReleaseAmount ?? 0),
    },
  ])
  if (!intake.voorkeuren) notes.push("Aangenomen: annuïtaire hypotheek, NHG waar mogelijk, gemiddelde risicobereidheid.")
  const risks = intake.risicos ?? defaultRisks(count)
  const fill = defaultRisks(1).applicants[0]!
  steps.push(["risicos", { ...risks, applicants: Array.from({ length: count }, (_, i) => risks.applicants[i] ?? fill) }])

  return { steps, notes }
}
