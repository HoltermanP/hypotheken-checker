// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest"
import { migrate } from "drizzle-orm/pglite/migrator"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import {
  defaultAssets,
  defaultIncome,
  defaultPersonal,
  defaultPreferences,
  defaultRisks,
  defaultTargetHome,
} from "@/lib/intake/defaults"

process.env.DATABASE_URL = "pglite:"

const { getDb, schema } = await import("@/lib/db/client")
const dossiers = await import("./dossiers")
const advice = await import("./advice")
const scenarios = await import("./scenarios")
const documents = await import("./documents")
const account = await import("./account")
const { enforceRateLimit, RateLimitError } = await import("@/lib/rate-limit")

beforeAll(async () => {
  await migrate(getDb() as unknown as PgliteDatabase, { migrationsFolder: "drizzle" })
}, 60_000)

async function fullDossier(userId: string) {
  const d = await dossiers.createDossier(userId, "starter", "Test")
  const personal = defaultPersonal()
  personal.applicants[0]!.dateOfBirth = "1994-03-01"
  const income = defaultIncome(1)
  const e = income.applicants[0]!.incomes[0]!
  if (e.kind === "employment") e.grossAnnualSalary = 62000
  const steps: [string, unknown][] = [
    ["persoonlijk", personal],
    ["inkomen", income],
    ["verplichtingen", { obligations: [], bkrRegistrations: "" }],
    ["vermogen", { ...defaultAssets(), savings: 45000 }],
    ["nieuwe-woning", { ...defaultTargetHome(), purchasePrice: 320000 }],
    ["voorkeuren", defaultPreferences()],
    ["risicos", defaultRisks(1)],
  ]
  for (const [step, data] of steps) {
    const r = await dossiers.saveStep(userId, d.id, step as never, data)
    expect(r.ok, step).toBe(true)
  }
  return d
}

describe("servicelaag met database", () => {
  it("slaat alle stappen genormaliseerd op en laadt ze terug", async () => {
    const d = await fullDossier("user_a")
    const { intake, completedSteps } = await dossiers.loadIntake("user_a", d.id)
    expect(completedSteps).toEqual(expect.arrayContaining(["doel", "persoonlijk", "inkomen", "vermogen", "nieuwe-woning", "voorkeuren", "risicos"]))
    expect(intake.inkomen!.applicants[0]!.incomes[0]).toMatchObject({ kind: "employment", grossAnnualSalary: 62000 })
    expect(intake["nieuwe-woning"]!.purchasePrice).toBe(320000)
    // Gevoelige data staat versleuteld in de database
    const raw = await getDb().execute(`select data from incomes where dossier_id = '${d.id}'`)
    expect(JSON.stringify(raw)).not.toContain("62000")
  })

  it("isoleert dossiers per gebruiker", async () => {
    const d = await fullDossier("user_b")
    await expect(dossiers.loadIntake("user_c", d.id)).rejects.toBeInstanceOf(dossiers.NotFoundError)
    await expect(dossiers.saveStep("user_c", d.id, "vermogen", defaultAssets())).rejects.toBeInstanceOf(dossiers.NotFoundError)
    await expect(dossiers.getOwnedDossier("user_b", "geen-uuid")).rejects.toBeInstanceOf(dossiers.NotFoundError)
    expect(await dossiers.listDossiers("user_c")).toHaveLength(0)
  })

  it("ongeldige stapdata wordt geweigerd; concepten worden bewaard", async () => {
    const d = await dossiers.createDossier("user_d", "starter", "T")
    const r = await dossiers.saveStep("user_d", d.id, "persoonlijk", defaultPersonal())
    expect(r.ok).toBe(false)
    await dossiers.saveDraft("user_d", d.id, "persoonlijk", { hasPartner: true })
    const { drafts } = await dossiers.loadIntake("user_d", d.id)
    expect(drafts.persoonlijk).toEqual({ hasPartner: true })
    await dossiers.skipStep("user_d", d.id, "nieuwe-woning")
    expect((await dossiers.loadIntake("user_d", d.id)).skipped).toContain("nieuwe-woning")
  })

  it("berekent, hergebruikt de berekening bij gelijke invoer en rekent scenario's", async () => {
    const d = await fullDossier("user_e")
    const first = await advice.calculateAdvice("user_e", d.id)
    const second = await advice.calculateAdvice("user_e", d.id)
    expect(second.calculationId).toBe(first.calculationId)
    expect(first.output.summary.maxMortgage).toBeGreaterThan(200000)
    const latest = await advice.latestCalculation("user_e", d.id)
    expect(latest!.input.goal).toBe("starter")
    const { defs, saved } = await scenarios.getScenarioDefinitions("user_e", d.id)
    expect(saved).toBe(false)
    await scenarios.saveScenarioDefinitions("user_e", d.id, [defs[0], { id: "x", name: "Rente 5%", overrides: { ratePct: 5 } }])
    const res = await scenarios.computeScenarios("user_e", d.id)
    expect(res.map((r) => r.name)).toEqual([defs[0]!.name, "Rente 5%"])
    await expect(scenarios.saveScenarioDefinitions("user_e", d.id, [{ id: "y", name: "x", overrides: { onbekend: 1 } }])).rejects.toThrow()
  })

  it("documenten: registreren, bevestigen en overnemen in de intake; eigendom afgedwongen", async () => {
    const d = await fullDossier("user_f")
    const id = await documents.registerDocument("user_f", {
      dossierId: d.id,
      type: "werkgeversverklaring",
      applicantPosition: 1,
      pathname: `dossiers/${d.id}/x`,
      url: "local://dossiers/x",
      contentType: "application/pdf",
      size: 1000,
      fileName: "wgv.pdf",
    })
    await expect(
      documents.registerDocument("user_f", { dossierId: d.id, type: "werkgeversverklaring", applicantPosition: 1, pathname: "elders/x", url: "u", contentType: "application/pdf", size: 1, fileName: "a" })
    ).rejects.toBeInstanceOf(documents.DocumentValidationError)
    await expect(documents.getOwnedDocument("user_x", id)).rejects.toBeInstanceOf(dossiers.NotFoundError)
    const r = await documents.confirmDocument("user_f", id, { bruto_jaarsalaris: 65000, vakantiegeld: 5200, onbekend: 1 }, true)
    expect(r.errors).toEqual([])
    const { intake } = await dossiers.loadIntake("user_f", d.id)
    expect(intake.inkomen!.applicants[0]!.incomes[0]).toMatchObject({ grossAnnualSalary: 65000, holidayPay: 5200 })
    const checks = await documents.documentChecksForDossier("user_f", d.id)
    expect(checks.confirmedTypes).toEqual(["werkgeversverklaring"])
    expect(await documents.confirmedDocumentValue("user_f", d.id, "werkgeversverklaring", "bruto_jaarsalaris")).toBe(65000)
    expect((await documents.signedDownloadUrl("user_f", id)).startsWith(`/api/documents/${id}/download?token=`)).toBe(true)
    await documents.deleteDocument("user_f", id)
    expect(await documents.listDocuments("user_f", d.id)).toHaveLength(0)
  })

  it("verwijdert verlopen documenten", async () => {
    const d = await fullDossier("user_g")
    await documents.registerDocument("user_g", { dossierId: d.id, type: "salarisstrook", applicantPosition: 1, pathname: `dossiers/${d.id}/y`, url: "local://dossiers/y", contentType: "image/png", size: 10, fileName: "s.png" })
    expect(await documents.purgeExpiredDocuments(new Date(Date.now() + 400 * 86_400_000))).toBeGreaterThanOrEqual(1)
  })

  it("rate limiting per uur", async () => {
    await enforceRateLimit("test", "user_h", 2)
    await enforceRateLimit("test", "user_h", 2)
    await expect(enforceRateLimit("test", "user_h", 2)).rejects.toBeInstanceOf(RateLimitError)
  })

  it("AVG: export en volledige verwijdering", async () => {
    const d = await fullDossier("user_i")
    await advice.calculateAdvice("user_i", d.id)
    const exp = await account.exportUserData("user_i")
    expect(exp.dossiers).toHaveLength(1)
    expect(exp.dossiers[0]!.berekeningen).toHaveLength(1)
    await account.deleteDossierCompletely("user_i", d.id)
    expect(await dossiers.listDossiers("user_i")).toHaveLength(0)
    await fullDossier("user_i")
    await account.deleteAllUserData("user_i")
    expect(await dossiers.listDossiers("user_i")).toHaveLength(0)
    const users = await getDb().select().from(schema.users)
    expect(users.find((u) => u.id === "user_i")).toBeUndefined()
  })
})
