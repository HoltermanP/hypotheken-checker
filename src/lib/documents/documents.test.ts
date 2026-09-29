import { describe, expect, it } from "vitest"
import { isValidBsn, redactBsn, redactDeep } from "./bsn"
import { runConsistencyChecks, deviationPct, statusFor, type ConfirmedDoc, type IntakeFacts } from "./consistency"
import { coerce, normalizeExtraction } from "./extraction"
import { checklist, docType } from "./types"

describe("BSN", () => {
  it("elfproef", () => {
    expect(isValidBsn("111222333")).toBe(true)
    expect(isValidBsn("123456789")).toBe(false)
    expect(isValidBsn("000000000")).toBe(false)
    expect(isValidBsn("12345")).toBe(false)
  })
  it("verwijdert BSN's (ook met punten) maar laat andere getallen staan", () => {
    expect(redactBsn("BSN 1112.22.333 en IBAN 123456789")).toBe("BSN [BSN verwijderd] en IBAN 123456789")
    expect(redactDeep({ bsn: "111222333", naam: "A 111222333", lijst: ["111 222 333"], n: 5 })).toEqual({
      naam: "A [BSN verwijderd]",
      lijst: ["[BSN verwijderd]"],
      n: 5,
    })
  })
})

describe("extractie normaliseren", () => {
  it("zet tekstwaarden om naar het juiste type", () => {
    expect(coerce("money", "€ 54.321,00")).toBe(54321)
    expect(coerce("date", "01-02-2026")).toBe("2026-02-01")
    expect(coerce("date", "2026-02-01T00:00")).toBe("2026-02-01")
    expect(coerce("date", "februari")).toBeNull()
    expect(coerce("boolean", "Ja")).toBe(true)
    expect(coerce("boolean", "nee")).toBe(false)
    expect(coerce("boolean", "?")).toBeNull()
    expect(coerce("percent", "8%")).toBe(8)
    expect(coerce("text", "  x ")).toBe("x")
    expect(coerce("money", null)).toBeNull()
  })
  it("normaliseert modeluitvoer en verwijdert BSN", () => {
    const def = docType("werkgeversverklaring")!
    const n = normalizeExtraction(
      def,
      {
        documentTypeMatches: true,
        detectedDocumentType: "werkgeversverklaring",
        fields: [
          { key: "bruto_jaarsalaris", value: "48.000", confidence: 0.95, note: null },
          { key: "naam", value: "J. Jansen 111222333", confidence: 1.4, note: null },
          { key: "onbekend", value: "x", confidence: 1, note: null },
        ],
        warnings: ["BSN 111222333 gezien"],
      },
      "claude-sonnet-5",
      "2026-09-29T10:00:00Z"
    )
    expect(n.fields.find((f) => f.key === "bruto_jaarsalaris")!.value).toBe(48000)
    expect(n.fields.find((f) => f.key === "naam")!.value).toBe("J. Jansen [BSN verwijderd]")
    expect(n.fields.find((f) => f.key === "naam")!.confidence).toBe(1)
    expect(n.fields.find((f) => f.key === "provisie")!.confidence).toBe(0)
    expect(n.fields.some((f) => f.key === "onbekend")).toBe(false)
    expect(n.warnings[0]).toContain("[BSN verwijderd]")
  })
})

describe("checklist", () => {
  it("verplichte documenten afhankelijk van het profiel", () => {
    const items = checklist({
      goal: "doorstromer",
      applicants: [
        { position: 1, employment: [{ contract: "flex" }], pension: false, businesses: [], studentLoan: true },
        { position: 2, employment: [], pension: false, businesses: [{ legalForm: "bv_holding", holding: true }], studentLoan: false },
      ],
      hasCurrentHome: true,
      hasTargetHome: true,
      newBuild: false,
      renovation: true,
      savings: true,
      nearAow: [false, true],
    })
    const req = (t: string, p: number | null) => items.find((i) => i.type === t && i.applicantPosition === p)?.required
    expect(req("ibl_rapport", 1)).toBe(true)
    expect(req("duo_overzicht", 1)).toBe(true)
    expect(req("managementovereenkomst", 2)).toBe(true)
    expect(req("pensioenoverzicht", 2)).toBe(true)
    expect(req("hypotheekoverzicht", null)).toBe(true)
    expect(req("koopovereenkomst", null)).toBe(true)
    expect(req("offerte_verbouwing", null)).toBe(true)
    expect(new Set(items.map((i) => `${i.type}|${i.applicantPosition}`)).size).toBe(items.length)
  })
})

describe("consistentiechecks", () => {
  const facts: IntakeFacts = {
    calculationDate: "2026-09-29",
    applicants: [
      {
        position: 1,
        dateOfBirth: "1990-01-01",
        grossAnnualEmployment: 54000,
        iblToetsinkomen: 50000,
        studentLoanMonthly: 150,
        businesses: [
          {
            legalForm: "eenmanszaak",
            shareholdingPct: 60,
            currentAccountDga: 10000,
            profits: [
              { year: 2023, value: 40000 },
              { year: 2024, value: 70000 },
              { year: 2025, value: 50000 },
            ],
            dgaSalaries: [],
            fluctuationExplained: false,
          },
        ],
      },
    ],
    savings: 40000,
    purchasePrice: 400000,
    targetWoz: 380000,
    currentWoz: null,
    currentDebt: 200000,
  }
  const doc = (type: string, values: ConfirmedDoc["values"], pos: number | null = 1): ConfirmedDoc => ({ id: type + JSON.stringify(values).length, type, applicantPosition: pos, values, uploadedAt: "2026-09-01" })

  it("salaris, identiteit, actualiteit en ondernemer", () => {
    const checks = runConsistencyChecks(
      [
        doc("werkgeversverklaring", { bruto_jaarsalaris: 50000, vakantiegeld: 4000, naam: "Jan de Vries", geboortedatum: "1990-01-01", datum_document: "2026-01-10" }),
        doc("salarisstrook", { bruto_maandsalaris: 4166.67, naam: "J. de Vries", geboortedatum: "1990-01-01", datum_document: "2026-09-01" }),
        doc("jaaropgave", { fiscaal_loon: 47000 }),
        doc("ibl_rapport", { ibl_toetsinkomen: 55000 }),
        doc("duo_overzicht", { maandtermijn: 150 }),
        doc("jaarrekening", { jaar: 2025, winst_ib: 50000, rekening_courant_dga: 10000 }),
        doc("ib_aangifte", { jaar: 2025, winst_uit_onderneming: 45000 }),
        doc("ivo", { toetsinkomen: 48000 }),
        doc("aandeelhoudersregister", { aandelenpercentage: 50 }),
        doc("koopovereenkomst", { koopsom: 400000 }, null),
        doc("woz_beschikking", { woz_waarde: 380000 }, null),
        doc("hypotheekoverzicht", { totale_restschuld: 230000 }, null),
        doc("bankafschrift", { saldo: 20000 }, 1),
      ],
      facts
    )
    const s = (id: string) => checks.find((c) => c.id.startsWith(id))?.status
    expect(s("oud_")).toBe("orange") // werkgeversverklaring > 3 maanden
    expect(s("dob_1")).toBe("green")
    expect(s("naam_1")).toBe("green")
    expect(s("salaris_intake_1")).toBe("green")
    expect(s("salaris_strook_1")).toBe("green")
    expect(s("salaris_jaaropgave_1")).toBe("green")
    expect(s("ibl_1")).toBe("orange")
    expect(s("duo_1")).toBe("green")
    expect(s("winst_1_0_2025")).toBe("orange")
    expect(s("aandelen_")).toBe("red")
    expect(s("rc_")).toBe("green")
    expect(s("ivo_")).toBe("green")
    expect(s("schommeling_")).toBe("orange")
    expect(s("koopsom")).toBe("green")
    expect(s("woz")).toBe("green")
    expect(s("restschuld")).toBe("red")
    expect(s("spaargeld")).toBe("red")
  })
  it("afwijkende geboortedatum is rood; afwijkende namen oranje", () => {
    const checks = runConsistencyChecks(
      [doc("salarisstrook", { naam: "Piet Bakker", geboortedatum: "1991-01-01" }), doc("jaaropgave", { naam: "Klaas Smit" })],
      facts
    )
    expect(checks.find((c) => c.id === "dob_1")!.status).toBe("red")
    expect(checks.find((c) => c.id === "naam_1")!.status).toBe("orange")
  })
  it("hulpfuncties", () => {
    expect(deviationPct(0, 0)).toBe(0)
    expect(deviationPct(100, 110)).toBeCloseTo(9.09, 2)
    expect(statusFor(20)).toBe("red")
  })
})

import { applyToIntake } from "./apply"
import { defaultBusiness, defaultIncome, defaultRisks, defaultTargetHome, defaultCurrentHome } from "@/lib/intake/defaults"

describe("documentwaarden overnemen in de intake", () => {
  const base = () => {
    const b = defaultBusiness(2026)
    return {
      inkomen: defaultIncome(1),
      risicos: defaultRisks(1),
      "nieuwe-woning": defaultTargetHome(),
      ondernemer: { applicants: [{ businesses: [b] }] },
    }
  }
  it("werkgeversverklaring, IBL, pensioen", () => {
    const i = base()
    const r = applyToIntake(i, { type: "werkgeversverklaring", applicantPosition: 1, values: { bruto_jaarsalaris: 50000, vakantiegeld: 4000, dienstverband: "bepaalde tijd", intentieverklaring: true, werkgever: "X BV" } })
    const e = (r.changed.inkomen as typeof i.inkomen).applicants[0]!.incomes[0]!
    expect(e.kind === "employment" && e.grossAnnualSalary).toBe(50000)
    expect(e.kind === "employment" && e.contract).toBe("temporary_with_intent")
    const flex = applyToIntake(i, { type: "werkgeversverklaring", applicantPosition: 1, values: { dienstverband: "oproepkracht" } })
    const f = (flex.changed.inkomen as typeof i.inkomen).applicants[0]!.incomes[0]!
    expect(f.kind === "employment" && f.contract).toBe("flex")
    expect(applyToIntake(i, { type: "ibl_rapport", applicantPosition: 1, values: { ibl_toetsinkomen: 41000 } }).changed.inkomen).toBeTruthy()
    const p = applyToIntake(i, { type: "pensioenoverzicht", applicantPosition: 1, values: { aow_per_jaar: 15000, pensioen_per_jaar: 12000, nabestaandenpensioen_per_jaar: 8000 } })
    expect((p.changed.inkomen as typeof i.inkomen).applicants[0]!.expectedRetirementIncome).toBe(27000)
    expect((p.changed.risicos as typeof i.risicos).applicants[0]!.survivorPensionAnnual).toBe(8000)
  })
  it("woning, label, DUO en ondernemer", () => {
    const i = base()
    expect((applyToIntake(i, { type: "koopovereenkomst", applicantPosition: null, values: { koopsom: 410000, leveringsdatum: "2026-12-01" } }).changed["nieuwe-woning"] as { purchasePrice: number }).purchasePrice).toBe(410000)
    expect((applyToIntake(i, { type: "energielabel", applicantPosition: null, values: { energielabel: "a++" } }).changed["nieuwe-woning"] as { energyLabel: string }).energyLabel).toBe("A++")
    expect(applyToIntake(i, { type: "energielabel", applicantPosition: null, values: { energielabel: "Z" } }).changed["nieuwe-woning"]).toBeUndefined()
    expect(applyToIntake(i, { type: "woz_beschikking", applicantPosition: null, values: { woz_waarde: 390000 } }).changed["nieuwe-woning"]).toBeTruthy()
    expect(applyToIntake({ ...i, "huidige-woning": defaultCurrentHome() }, { type: "verkoopovereenkomst", applicantPosition: null, values: { verkoopprijs: 350000 } }).changed["huidige-woning"]).toBeTruthy()
    const duo = applyToIntake(i, { type: "duo_overzicht", applicantPosition: 1, values: { maandtermijn: 120, restschuld: 20000 } })
    expect((duo.changed.verplichtingen as { obligations: { monthlyPayment: number }[] }).obligations[0]!.monthlyPayment).toBe(120)
    const year = i.ondernemer.applicants[0]!.businesses[0]!.soleProp!.years[2]!.year
    const ib = applyToIntake(i, { type: "ib_aangifte", applicantPosition: 1, values: { jaar: year, winst_uit_onderneming: 61000, urencriterium: true } })
    expect((ib.changed.ondernemer as typeof i.ondernemer).applicants[0]!.businesses[0]!.soleProp!.years[2]!.profit).toBe(61000)
    expect(applyToIntake(i, { type: "ivo", applicantPosition: 1, values: { toetsinkomen: 55000 } }).changed.ondernemer).toBeTruthy()
    const bvIntake = structuredClone(i)
    bvIntake.ondernemer.applicants[0]!.businesses[0]!.legalForm = "bv"
    const jr = applyToIntake(bvIntake, { type: "jaarrekening", applicantPosition: 1, values: { jaar: year, omzet: 200000, resultaat_na_belasting: 80000, rekening_courant_dga: 5000, winst_ib: 70000 } })
    const b = (jr.changed.ondernemer as typeof i.ondernemer).applicants[0]!.businesses[0]!
    expect(b.bv!.entities[0]!.financials[2]!.resultAfterTax).toBe(80000)
    expect(b.bv!.currentAccountDga).toBe(5000)
    expect(applyToIntake(i, { type: "aandeelhoudersregister", applicantPosition: 1, values: { aandelenpercentage: 60 } }).changed.ondernemer).toBeTruthy()
    expect(applyToIntake(i, { type: "jaaropgave_dga", applicantPosition: 1, values: { jaar: 2030, fiscaal_loon: 60000 } }).changed.ondernemer).toBeTruthy()
    expect(applyToIntake(i, { type: "bouwkundig_rapport", applicantPosition: null, values: {} }).summary[0]).toMatch(/controles/)
  })
})
