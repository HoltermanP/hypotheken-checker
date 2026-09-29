import type { IntakeData, StepKey } from "@/lib/intake/schema"
import { ENERGY_LABELS } from "@/lib/intake/schema"
import { newId } from "@/lib/intake/defaults"
import type { FieldValue } from "./extraction"

/**
 * Bevestigde documentwaarden overnemen in de intake. Geeft de gewijzigde stappen terug; de
 * aanroeper slaat die op via de normale (gevalideerde) stap-opslag. Puur.
 */

export interface ApplyResult {
  changed: Partial<Record<Exclude<StepKey, "overzicht">, unknown>>
  summary: string[]
}

const num = (v: FieldValue | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const str = (v: FieldValue | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function applyToIntake(
  intake: IntakeData,
  doc: { type: string; applicantPosition: number | null; values: Record<string, FieldValue> }
): ApplyResult {
  const v = doc.values
  const idx = Math.max(0, (doc.applicantPosition ?? 1) - 1)
  const changed: ApplyResult["changed"] = {}
  const summary: string[] = []
  const clone = <T>(x: T): T => structuredClone(x)

  const withEmployment = (fn: (e: Extract<NonNullable<IntakeData["inkomen"]>["applicants"][number]["incomes"][number], { kind: "employment" }>) => void) => {
    if (!intake.inkomen) return
    const inc = clone(intake.inkomen)
    const app = inc.applicants[idx]
    if (!app) return
    let e = app.incomes.find((i) => i.kind === "employment")
    if (!e) {
      e = { id: newId(), kind: "employment", contract: "permanent", grossAnnualSalary: 0, holidayPay: 0, thirteenthMonth: 0, fixedYearEndBonus: 0, irregularityAllowance: 0, commission: 0, iblToetsinkomen: null }
      app.incomes.push(e)
    }
    fn(e as never)
    changed.inkomen = inc
  }

  const firstBusiness = () => {
    if (!intake.ondernemer) return null
    const o = clone(intake.ondernemer)
    const b = o.applicants[idx]?.businesses[0]
    return b ? { o, b } : null
  }

  switch (doc.type) {
    case "werkgeversverklaring":
      withEmployment((e) => {
        const set = (k: "grossAnnualSalary" | "holidayPay" | "thirteenthMonth" | "fixedYearEndBonus" | "irregularityAllowance" | "commission", f: string) => {
          const n = num(v[f])
          if (n !== null) e[k] = n
        }
        set("grossAnnualSalary", "bruto_jaarsalaris")
        set("holidayPay", "vakantiegeld")
        set("thirteenthMonth", "dertiende_maand")
        set("fixedYearEndBonus", "eindejaarsuitkering")
        set("irregularityAllowance", "onregelmatigheidstoeslag")
        set("commission", "provisie")
        const d = str(v.dienstverband)?.toLowerCase() ?? ""
        if (v.intentieverklaring === true) e.contract = "temporary_with_intent"
        else if (d.includes("onbepaalde") || d.startsWith("vast")) e.contract = "permanent"
        else if (d.includes("oproep") || d.includes("flex") || d.includes("uitzend")) e.contract = "flex"
        else if (d.includes("bepaalde") || d.includes("tijdelijk")) e.contract = "temporary"
        const w = str(v.werkgever)
        if (w) e.employer = w
      })
      summary.push("Salaris en contractvorm overgenomen uit de werkgeversverklaring.")
      break
    case "ibl_rapport": {
      const n = num(v.ibl_toetsinkomen)
      if (n !== null) {
        withEmployment((e) => {
          e.iblToetsinkomen = n
        })
        summary.push("IBL-toetsinkomen overgenomen.")
      }
      break
    }
    case "pensioenoverzicht": {
      const total = (num(v.aow_per_jaar) ?? 0) + (num(v.pensioen_per_jaar) ?? 0)
      if (total > 0 && intake.inkomen) {
        const inc = clone(intake.inkomen)
        if (inc.applicants[idx]) inc.applicants[idx]!.expectedRetirementIncome = total
        changed.inkomen = inc
        summary.push("Verwacht pensioeninkomen overgenomen.")
      }
      const nab = num(v.nabestaandenpensioen_per_jaar)
      if (nab !== null && intake.risicos?.applicants[idx]) {
        const r = clone(intake.risicos)
        r.applicants[idx]!.survivorPensionAnnual = nab
        changed.risicos = r
        summary.push("Partnerpensioen overgenomen.")
      }
      break
    }
    case "woz_beschikking": {
      const n = num(v.woz_waarde)
      if (n === null) break
      if (intake["huidige-woning"]) {
        changed["huidige-woning"] = { ...clone(intake["huidige-woning"]), wozValue: n }
        summary.push("WOZ-waarde huidige woning overgenomen.")
      } else if (intake["nieuwe-woning"]) {
        changed["nieuwe-woning"] = { ...clone(intake["nieuwe-woning"]), wozValue: n }
        summary.push("WOZ-waarde nieuwe woning overgenomen.")
      }
      break
    }
    case "koopovereenkomst":
      if (intake["nieuwe-woning"]) {
        const t = clone(intake["nieuwe-woning"])
        const koopsom = num(v.koopsom)
        if (koopsom !== null) t.purchasePrice = koopsom
        const lev = str(v.leveringsdatum)
        if (lev) t.deliveryDate = lev
        changed["nieuwe-woning"] = t
        summary.push("Koopsom en leveringsdatum overgenomen.")
      }
      break
    case "taxatierapport": {
      const mw = num(v.marktwaarde)
      if (mw === null) break
      if (intake["nieuwe-woning"]) {
        const t = clone(intake["nieuwe-woning"])
        t.marketValue = mw
        changed["nieuwe-woning"] = t
      } else if (intake["huidige-woning"]) {
        changed["huidige-woning"] = { ...clone(intake["huidige-woning"]), marketValue: mw }
      }
      summary.push("Marktwaarde uit het taxatierapport overgenomen.")
      break
    }
    case "energielabel": {
      const raw = str(v.energielabel)?.toUpperCase().replace(/\s/g, "")
      const label = ENERGY_LABELS.find((l) => l === raw)
      if (!label) break
      if (intake["nieuwe-woning"]) changed["nieuwe-woning"] = { ...clone(intake["nieuwe-woning"]), energyLabel: label }
      else if (intake["huidige-woning"]) changed["huidige-woning"] = { ...clone(intake["huidige-woning"]), energyLabel: label }
      summary.push(`Energielabel ${label} overgenomen.`)
      break
    }
    case "verkoopovereenkomst":
      if (intake["huidige-woning"]) {
        const c = clone(intake["huidige-woning"])
        const p = num(v.verkoopprijs)
        if (p !== null) c.expectedSalePrice = p
        const d = str(v.leveringsdatum)
        if (d) c.expectedSaleDate = d
        changed["huidige-woning"] = c
        summary.push("Verkoopprijs en leveringsdatum overgenomen.")
      }
      break
    case "duo_overzicht": {
      const m = num(v.maandtermijn)
      if (m === null) break
      const ob = clone(intake.verplichtingen ?? { obligations: [] })
      const existing = ob.obligations.find((o) => o.type === "student_loan" && (o.applicantPosition ?? 1) === idx + 1)
      const rest = num(v.restschuld) ?? 0
      if (existing) {
        existing.monthlyPayment = m
        existing.outstanding = rest
      } else {
        ob.obligations.push({ id: newId(), applicantPosition: idx + 1, type: "student_loan", description: "DUO", limitOrPrincipal: 0, monthlyPayment: m, outstanding: rest, willBeRepaid: false })
      }
      changed.verplichtingen = ob
      summary.push("Studieschuld overgenomen uit het DUO-overzicht.")
      break
    }
    case "ivo": {
      const n = num(v.toetsinkomen)
      const fb = firstBusiness()
      if (n !== null && fb) {
        fb.b.ivoIncome = n
        changed.ondernemer = fb.o
        summary.push("IVO-toetsinkomen overgenomen.")
      }
      break
    }
    case "ib_aangifte": {
      const year = num(v.jaar)
      const winst = num(v.winst_uit_onderneming)
      const fb = firstBusiness()
      if (year && winst !== null && fb?.b.soleProp) {
        const y = fb.b.soleProp.years.find((x) => x.year === year)
        if (y) y.profit = winst
        if (typeof v.urencriterium === "boolean" && y) y.hoursCriterionMet = v.urencriterium
        changed.ondernemer = fb.o
        summary.push(`Winst ${year} overgenomen uit de IB-aangifte.`)
      }
      break
    }
    case "jaarrekening": {
      const year = num(v.jaar)
      const fb = firstBusiness()
      if (!year || !fb) break
      if (fb.b.soleProp && num(v.winst_ib) !== null) {
        const y = fb.b.soleProp.years.find((x) => x.year === year)
        if (y) {
          y.profit = num(v.winst_ib)!
          if (num(v.omzet) !== null) y.revenue = num(v.omzet)!
        }
      }
      if (fb.b.bv && (fb.b.legalForm === "bv" || fb.b.legalForm === "bv_holding")) {
        const name = str(v.entiteit)?.toLowerCase()
        const ent = fb.b.bv.entities.find((e) => name && e.name.toLowerCase().includes(name)) ?? fb.b.bv.entities.find((e) => e.role === "werkmaatschappij") ?? fb.b.bv.entities[0]
        const f = ent?.financials.find((x) => x.year === year)
        if (f) {
          const map: [keyof typeof f, string][] = [
            ["revenue", "omzet"],
            ["resultBeforeTax", "resultaat_voor_belasting"],
            ["resultAfterTax", "resultaat_na_belasting"],
            ["equity", "eigen_vermogen"],
            ["balanceTotal", "balanstotaal"],
            ["liquidAssets", "liquide_middelen"],
            ["currentLiabilities", "kortlopende_schulden"],
            ["dgaSalaryPaid", "salaris_dga"],
          ]
          for (const [k, fk] of map) {
            const n = num(v[fk])
            if (n !== null) (f as Record<string, number>)[k] = n
          }
        }
        const rc = num(v.rekening_courant_dga)
        if (rc !== null) fb.b.bv.currentAccountDga = rc
      }
      changed.ondernemer = fb.o
      summary.push(`Jaarcijfers ${year} overgenomen.`)
      break
    }
    case "aandeelhoudersregister": {
      const p = num(v.aandelenpercentage)
      const fb = firstBusiness()
      if (p !== null && fb?.b.bv) {
        fb.b.bv.shareholdingPct = p
        changed.ondernemer = fb.o
        summary.push("Aandelenpercentage overgenomen.")
      }
      break
    }
    case "rekening_courant": {
      const s = num(v.saldo)
      const fb = firstBusiness()
      if (s !== null && fb?.b.bv) {
        fb.b.bv.currentAccountDga = s
        changed.ondernemer = fb.o
        summary.push("Rekening-courant overgenomen.")
      }
      break
    }
    case "jaaropgave_dga": {
      const year = num(v.jaar)
      const loon = num(v.fiscaal_loon)
      const fb = firstBusiness()
      if (year && loon !== null && fb?.b.bv) {
        const s = fb.b.bv.salaries.find((x) => x.year === year)
        if (s) s.amount = loon
        else fb.b.bv.salaries.push({ year, amount: loon })
        changed.ondernemer = fb.o
        summary.push(`DGA-salaris ${year} overgenomen.`)
      }
      break
    }
    default:
      summary.push("Dit document gebruiken we voor de controles; er worden geen velden automatisch overgenomen.")
  }
  if (Object.keys(changed).length === 0 && summary.length === 0) summary.push("Geen velden overgenomen.")
  return { changed, summary }
}
