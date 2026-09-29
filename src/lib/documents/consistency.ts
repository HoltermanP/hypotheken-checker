import { docType } from "./types"
import type { FieldValue } from "./extraction"

/**
 * Consistentiechecks tussen bevestigde documenten onderling en met de intake. Puur en getest.
 *
 * Afwijkingsdrempels (modelaanname, zie DECISIONS.md): ≤ 5% groen, ≤ 15% oranje, > 15% rood.
 * Voor het fiscale loon (jaaropgave) geldt een ruimere marge (≤ 15% groen), omdat pensioenpremie
 * en andere inhoudingen het fiscale loon lager maken dan het bruto salaris.
 */

export type Status = "green" | "orange" | "red"

export interface ConfirmedDoc {
  id: string
  type: string
  applicantPosition: number | null
  values: Record<string, FieldValue>
  uploadedAt: string
}

export interface IntakeFacts {
  calculationDate: string
  applicants: {
    position: number
    firstName?: string
    dateOfBirth?: string
    grossAnnualEmployment: number | null
    iblToetsinkomen: number | null
    studentLoanMonthly: number | null
    savings?: number
    businesses: {
      legalForm: string
      shareholdingPct: number | null
      currentAccountDga: number | null
      profits: { year: number; value: number }[]
      dgaSalaries: { year: number; value: number }[]
      fluctuationExplained: boolean
    }[]
  }[]
  savings: number | null
  purchasePrice: number | null
  targetWoz: number | null
  currentWoz: number | null
  currentDebt: number | null
}

export interface ConsistencyCheck {
  id: string
  label: string
  status: Status
  detail: string
  applicantPosition: number | null
  askExplanation?: boolean
}

const num = (v: FieldValue | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const str = (v: FieldValue | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function deviationPct(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b))
  return base === 0 ? 0 : (Math.abs(a - b) / base) * 100
}

export function statusFor(dev: number, greenMax = 5, orangeMax = 15): Status {
  return dev <= greenMax ? "green" : dev <= orangeMax ? "orange" : "red"
}

function monthsOld(date: string, now: string): number {
  const [y1, m1] = date.split("-").map(Number)
  const [y2, m2] = now.split("-").map(Number)
  return (y2! - y1!) * 12 + (m2! - m1!)
}

const fmt = (n: number) => Math.round(n).toLocaleString("nl-NL")

function normName(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !["van", "der", "den", "het", "de"].includes(t))
}

export function runConsistencyChecks(docs: ConfirmedDoc[], facts: IntakeFacts): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = []
  const push = (c: ConsistencyCheck) => checks.push(c)

  // 1. Actualiteit
  for (const d of docs) {
    const def = docType(d.type)
    const date = str(d.values.datum_document)
    if (def?.maxAgeMonths && date) {
      const age = monthsOld(date, facts.calculationDate)
      if (age > def.maxAgeMonths) {
        push({
          id: `oud_${d.id}`,
          label: `${def.label} is te oud`,
          status: "orange",
          detail: `Het document is ${age} maanden oud; maximaal ${def.maxAgeMonths} maanden. Upload een recenter exemplaar.`,
          applicantPosition: d.applicantPosition,
        })
      }
    }
  }

  for (const a of facts.applicants) {
    const mine = docs.filter((d) => d.applicantPosition === a.position)
    const who = a.position === 1 ? "aanvrager 1" : "partner"

    // 2. Identiteit: geboortedatum en naam
    const dobs = mine.map((d) => str(d.values.geboortedatum)).filter((v): v is string => !!v)
    if (a.dateOfBirth && dobs.some((d) => d !== a.dateOfBirth)) {
      push({ id: `dob_${a.position}`, label: `Geboortedatum ${who}`, status: "red", detail: "De geboortedatum op een document wijkt af van de intake.", applicantPosition: a.position })
    } else if (dobs.length > 0) {
      push({ id: `dob_${a.position}`, label: `Geboortedatum ${who}`, status: "green", detail: "Geboortedatum komt overeen in alle documenten.", applicantPosition: a.position })
    }
    const names = mine.map((d) => str(d.values.naam)).filter((v): v is string => !!v)
    if (names.length >= 2) {
      const sets = names.map(normName)
      const common = sets.reduce((acc, s) => acc.filter((t) => s.includes(t)))
      push({
        id: `naam_${a.position}`,
        label: `Naam ${who}`,
        status: common.length > 0 ? "green" : "orange",
        detail: common.length > 0 ? "De naam komt overeen in de documenten." : "De namen op de documenten lijken niet op elkaar. Controleer of alle documenten van dezelfde persoon zijn.",
        applicantPosition: a.position,
      })
    }

    // 3. Salaris: werkgeversverklaring ↔ salarisstrook ↔ jaaropgave ↔ IBL ↔ intake
    const wgv = mine.find((d) => d.type === "werkgeversverklaring")
    const wgvAnnual = wgv
      ? ["bruto_jaarsalaris", "vakantiegeld", "dertiende_maand", "eindejaarsuitkering", "onregelmatigheidstoeslag", "provisie"].reduce((s, k) => s + (num(wgv.values[k]) ?? 0), 0)
      : null
    const reference = wgvAnnual && wgvAnnual > 0 ? wgvAnnual : a.grossAnnualEmployment
    const refLabel = wgvAnnual && wgvAnnual > 0 ? "werkgeversverklaring" : "intake"
    if (reference && reference > 0) {
      if (wgvAnnual && a.grossAnnualEmployment) {
        const dev = deviationPct(wgvAnnual, a.grossAnnualEmployment)
        push({ id: `salaris_intake_${a.position}`, label: `Salaris ${who}: intake ↔ werkgeversverklaring`, status: statusFor(dev), detail: `Intake € ${fmt(a.grossAnnualEmployment)} tegenover werkgeversverklaring € ${fmt(wgvAnnual)} (${dev.toFixed(1)}% verschil).`, applicantPosition: a.position })
      }
      const strook = mine.find((d) => d.type === "salarisstrook")
      const monthly = strook ? num(strook.values.bruto_maandsalaris) : null
      if (monthly) {
        const vg = num(strook!.values.vakantiegeld_pct) ?? 8
        const annual = monthly * 12 * (1 + vg / 100)
        const dev = deviationPct(annual, reference)
        push({ id: `salaris_strook_${a.position}`, label: `Salaris ${who}: salarisstrook ↔ ${refLabel}`, status: statusFor(dev), detail: `Salarisstrook × 12 + vakantiegeld = € ${fmt(annual)} tegenover € ${fmt(reference)} (${dev.toFixed(1)}%).`, applicantPosition: a.position })
      }
      const jo = mine.find((d) => d.type === "jaaropgave")
      const fiscal = jo ? num(jo.values.fiscaal_loon) : null
      if (fiscal) {
        const dev = deviationPct(fiscal, reference)
        push({ id: `salaris_jaaropgave_${a.position}`, label: `Salaris ${who}: jaaropgave ↔ ${refLabel}`, status: statusFor(dev, 15, 25), detail: `Fiscaal loon € ${fmt(fiscal)} tegenover € ${fmt(reference)} (${dev.toFixed(1)}%). Het fiscale loon is vaak lager door pensioenpremie.`, applicantPosition: a.position })
      }
      const ibl = mine.find((d) => d.type === "ibl_rapport")
      const iblValue = ibl ? num(ibl.values.ibl_toetsinkomen) : null
      if (iblValue && a.iblToetsinkomen) {
        const dev = deviationPct(iblValue, a.iblToetsinkomen)
        push({ id: `ibl_${a.position}`, label: `IBL-toetsinkomen ${who}`, status: statusFor(dev), detail: `IBL-rapport € ${fmt(iblValue)} tegenover intake € ${fmt(a.iblToetsinkomen)}.`, applicantPosition: a.position })
      }
    }

    // 4. Studieschuld
    const duo = mine.find((d) => d.type === "duo_overzicht")
    const duoMonthly = duo ? num(duo.values.maandtermijn) : null
    if (duoMonthly !== null && a.studentLoanMonthly !== null) {
      const dev = deviationPct(duoMonthly, a.studentLoanMonthly)
      push({ id: `duo_${a.position}`, label: `Studieschuld ${who}`, status: statusFor(dev), detail: `DUO-termijn € ${fmt(duoMonthly)} tegenover intake € ${fmt(a.studentLoanMonthly)}.`, applicantPosition: a.position })
    }

    // 5. Ondernemers
    for (const [bi, b] of a.businesses.entries()) {
      const tag = `${a.position}_${bi}`
      const ib = mine.filter((d) => d.type === "ib_aangifte")
      const jr = mine.filter((d) => d.type === "jaarrekening")
      for (const r of jr) {
        const year = num(r.values.jaar)
        const winst = num(r.values.winst_ib)
        const match = ib.find((x) => num(x.values.jaar) === year)
        const ibWinst = match ? num(match.values.winst_uit_onderneming) : null
        if (year && winst !== null && ibWinst !== null) {
          const dev = deviationPct(winst, ibWinst)
          push({ id: `winst_${tag}_${year}`, label: `Winst ${year}: jaarrekening ↔ IB-aangifte`, status: statusFor(dev), detail: `Jaarrekening € ${fmt(winst)} tegenover IB-aangifte € ${fmt(ibWinst)}.`, applicantPosition: a.position })
        }
        const intakeProfit = b.profits.find((p) => p.year === year)
        if (year && winst !== null && intakeProfit) {
          const dev = deviationPct(winst, intakeProfit.value)
          push({ id: `winst_intake_${tag}_${year}`, label: `Winst ${year}: jaarrekening ↔ intake`, status: statusFor(dev), detail: `Jaarrekening € ${fmt(winst)} tegenover intake € ${fmt(intakeProfit.value)}.`, applicantPosition: a.position })
        }
        const sal = num(r.values.salaris_dga)
        const joDga = mine.find((d) => d.type === "jaaropgave_dga" && num(d.values.jaar) === year)
        const joSal = joDga ? num(joDga.values.fiscaal_loon) : null
        if (year && sal !== null && joSal !== null) {
          const dev = deviationPct(sal, joSal)
          push({ id: `dga_salaris_${tag}_${year}`, label: `DGA-salaris ${year}: jaarrekening ↔ jaaropgave`, status: statusFor(dev), detail: `Jaarrekening € ${fmt(sal)} tegenover jaaropgave € ${fmt(joSal)}.`, applicantPosition: a.position })
        }
        const rc = num(r.values.rekening_courant_dga)
        if (rc !== null && b.currentAccountDga !== null) {
          const dev = deviationPct(rc, b.currentAccountDga)
          push({ id: `rc_${tag}_${year}`, label: "Rekening-courant DGA op de balans", status: statusFor(dev), detail: `Balans € ${fmt(rc)} tegenover intake € ${fmt(b.currentAccountDga)}.`, applicantPosition: a.position })
        }
      }
      const ivo = mine.find((d) => d.type === "ivo")
      const ivoIncome = ivo ? num(ivo.values.toetsinkomen) : null
      const lastProfit = b.profits.at(-1)?.value ?? null
      if (ivoIncome !== null && lastProfit !== null && b.legalForm !== "bv" && b.legalForm !== "bv_holding") {
        const dev = deviationPct(ivoIncome, lastProfit)
        push({ id: `ivo_${tag}`, label: "IVO ↔ winst laatste jaar", status: statusFor(dev, 10, 25), detail: `IVO-toetsinkomen € ${fmt(ivoIncome)} tegenover winst € ${fmt(lastProfit)}.`, applicantPosition: a.position })
      }
      const reg = mine.find((d) => d.type === "aandeelhoudersregister")
      const regPct = reg ? num(reg.values.aandelenpercentage) : null
      if (regPct !== null && b.shareholdingPct !== null) {
        push({
          id: `aandelen_${tag}`,
          label: "Aandelenpercentage",
          status: Math.abs(regPct - b.shareholdingPct) < 0.5 ? "green" : "red",
          detail: `Register ${regPct}% tegenover intake ${b.shareholdingPct}%.`,
          applicantPosition: a.position,
        })
      }
      // Grote schommelingen tussen jaren → toelichting vragen
      const values = b.profits.map((p) => p.value)
      const jump = values.some((v, i) => i > 0 && deviationPct(v, values[i - 1]!) > 30)
      if (jump && !b.fluctuationExplained) {
        push({
          id: `schommeling_${tag}`,
          label: "Grote verschillen tussen jaren",
          status: "orange",
          detail: "De winst verschilt tussen jaren meer dan 30%. Geef in de intake een toelichting (bijvoorbeeld incidentele baten of lasten).",
          applicantPosition: a.position,
          askExplanation: true,
        })
      }
    }
  }

  // 6. Woning en vermogen
  const koop = docs.find((d) => d.type === "koopovereenkomst")
  const koopsom = koop ? num(koop.values.koopsom) : null
  if (koopsom !== null && facts.purchasePrice) {
    const dev = deviationPct(koopsom, facts.purchasePrice)
    push({ id: "koopsom", label: "Koopsom: koopovereenkomst ↔ intake", status: statusFor(dev, 0.5, 5), detail: `Koopovereenkomst € ${fmt(koopsom)} tegenover intake € ${fmt(facts.purchasePrice)}.`, applicantPosition: null })
  }
  const woz = docs.find((d) => d.type === "woz_beschikking")
  const wozValue = woz ? num(woz.values.woz_waarde) : null
  const intakeWoz = facts.currentWoz ?? facts.targetWoz
  if (wozValue !== null && intakeWoz) {
    const dev = deviationPct(wozValue, intakeWoz)
    push({ id: "woz", label: "WOZ-waarde", status: statusFor(dev), detail: `Beschikking € ${fmt(wozValue)} tegenover intake € ${fmt(intakeWoz)}.`, applicantPosition: null })
  }
  const hyp = docs.find((d) => d.type === "hypotheekoverzicht")
  const rest = hyp ? num(hyp.values.totale_restschuld) : null
  if (rest !== null && facts.currentDebt !== null) {
    const dev = deviationPct(rest, facts.currentDebt)
    push({ id: "restschuld", label: "Restschuld huidige hypotheek", status: statusFor(dev, 2, 10), detail: `Overzicht bank € ${fmt(rest)} tegenover intake € ${fmt(facts.currentDebt)}.`, applicantPosition: null })
  }
  const saldi = docs.filter((d) => d.type === "bankafschrift").map((d) => num(d.values.saldo) ?? 0)
  if (saldi.length > 0 && facts.savings) {
    const total = saldi.reduce((a, b) => a + b, 0)
    push({
      id: "spaargeld",
      label: "Spaargeld aangetoond",
      status: total >= facts.savings * 0.95 ? "green" : total >= facts.savings * 0.75 ? "orange" : "red",
      detail: `Afschriften € ${fmt(total)} tegenover opgegeven spaargeld € ${fmt(facts.savings)}.`,
      applicantPosition: null,
    })
  }
  return checks
}
