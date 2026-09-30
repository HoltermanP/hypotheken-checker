import { expect, test, type Page } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { calculate, fillMoney, login, newDossier, next, personal } from "./helpers"

async function toEntrepreneurStep(page: Page, user: string, dob: string, extraSalary?: string) {
  await login(page, user)
  await newDossier(page, /Mijn eerste woning kopen/)
  await personal(page, [dob])
  await next(page, "inkomen")
  if (extraSalary) {
    await fillMoney(page, "Bruto jaarsalaris (zonder vakantiegeld)", extraSalary)
  } else {
    await page.getByRole("button", { name: "Inkomen verwijderen" }).click()
  }
  await page.getByLabel("Ik ben (ook) ondernemer (eenmanszaak, vof, BV of holding)").check()
  await next(page, "ondernemer")
}

async function finish(page: Page) {
  await next(page, "verplichtingen")
  await next(page, "vermogen")
  await fillMoney(page, "Spaargeld", "60000")
  await next(page, "nieuwe-woning")
  await fillMoney(page, "Koopsom", "350000")
  await next(page, "voorkeuren")
  await next(page, "risicos")
  await next(page, "overzicht")
  await calculate(page)
  await expect(page.getByRole("heading", { name: "Ondernemers", exact: true })).toBeVisible()
  expect(await page.getByTestId("entrepreneur-lender-row").count()).toBeGreaterThanOrEqual(15)
}

test("eenmanszaak met loondienst ernaast: toetsinkomen per bank", async ({ page }) => {
  await toEntrepreneurStep(page, "zzp", "1990-01-01", "30000")
  await page.getByLabel("Startdatum onderneming").fill("2020-01-01")
  for (const [i, v] of ["20000", "26000", "24000"].entries()) {
    await fillMoney(page, "Winst vóór ondernemersaftrek", v, i)
  }
  await finish(page)
  await expect(page.getByTestId("entrepreneur-lender-row").filter({ hasText: /Gemiddelde van drie jaar/ }).first()).toBeVisible()
})

test("startende eenmanszaak met 1 jaar cijfers", async ({ page }) => {
  await toEntrepreneurStep(page, "starterzzp", "1995-01-01")
  await page.getByLabel("Startdatum onderneming").fill("2025-01-01")
  await fillMoney(page, "Winst vóór ondernemersaftrek", "48000", 2)
  await fillMoney(page, "Prognose winst lopend jaar", "52000")
  await finish(page)
  await expect(page.getByTestId("entrepreneur-lender-row").filter({ hasText: "telt niet" }).first()).toBeVisible()
})

test("DGA met holding en werkmaatschappij", async ({ page }) => {
  await toEntrepreneurStep(page, "dga", "1978-01-01")
  await page.getByLabel("Rechtsvorm").selectOption("bv_holding")
  await page.getByLabel("Startdatum onderneming").fill("2012-01-01")
  for (const [i, v] of ["70000", "70000", "72000"].entries()) await fillMoney(page, /^Salaris 20/, v, i)
  await fillMoney(page, "Management fee per jaar", "90000")
  await page.getByLabel("Vastgelegd in een managementovereenkomst").check()
  await page.getByLabel("Structureel (elk jaar)").check()
  await page.getByLabel("Zakelijk (marktconforme hoogte)").check()
  // Werkmaatschappij: laatste jaar cijfers (standaard open)
  await fillMoney(page, "Resultaat na belasting", "95000", 2)
  await fillMoney(page, "Eigen vermogen", "400000", 2)
  await fillMoney(page, "Balanstotaal", "700000", 2)
  await fillMoney(page, "Liquide middelen", "200000", 2)
  await fillMoney(page, "Vlottende activa (incl. liquide)", "350000", 2)
  await fillMoney(page, "Kortlopende schulden", "150000", 2)
  // Holding toevoegen als aandeelhouder van de werkmaatschappij
  await page.getByRole("button", { name: "Entiteit toevoegen" }).click()
  await page.getByLabel("Naam").last().fill("Holding BV")
  await page.getByLabel("Aandeelhouder").first().selectOption({ label: "Holding BV" })
  await finish(page)
  await expect(page.getByText("geconsolideerd", { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Salaris of dividend verhogen/)).toBeVisible()
})

test("vof met winstaandeel", async ({ page }) => {
  await toEntrepreneurStep(page, "vof", "1985-01-01")
  await page.getByLabel("Rechtsvorm").selectOption("vof")
  await page.getByLabel("Startdatum onderneming").fill("2018-01-01")
  await page.getByLabel("Jouw winstaandeel").fill("50")
  for (const [i, v] of ["44000", "47000", "50000"].entries()) {
    await fillMoney(page, "Winst vóór ondernemersaftrek", v, i)
  }
  await finish(page)
  await expect(page.getByTestId("entrepreneur-lender-row").filter({ hasText: "€ 47.000" }).first()).toBeVisible()
})

test("DGA met een BV", async ({ page }) => {
  await toEntrepreneurStep(page, "dgabv", "1980-01-01")
  await page.getByLabel("Rechtsvorm").selectOption("bv")
  await page.getByLabel("Startdatum onderneming").fill("2015-01-01")
  for (const [i, v] of ["60000", "60000", "62000"].entries()) await fillMoney(page, /^Salaris 20/, v, i)
  await fillMoney(page, "Resultaat na belasting", "80000", 2)
  await fillMoney(page, "Eigen vermogen", "300000", 2)
  await fillMoney(page, "Balanstotaal", "500000", 2)
  await fillMoney(page, "Liquide middelen", "150000", 2)
  await fillMoney(page, "Vlottende activa (incl. liquide)", "220000", 2)
  await fillMoney(page, "Kortlopende schulden", "90000", 2)
  await finish(page)
  await expect(page.getByText("Duurzaam uitkeerbare winst")).toBeVisible()
  await expect(page.getByText("Hypotheek bij de eigen BV", { exact: true })).toBeVisible()
})

test("DGA: jaarcijfers uit een Excel-bestand (sjabloon) inlezen en overnemen", async ({ page }) => {
  const XLSX = await import("xlsx")
  const res = await page.request.get("/api/templates/jaarcijfers")
  expect(res.ok()).toBe(true)
  const wb = XLSX.read(await res.body(), { type: "buffer" })
  const fill = (sheet: string, label: string, values: number[]) => {
    const ws = wb.Sheets[sheet]!
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const r = rows.findIndex((row) => row[0] === label)
    values.forEach((v, i) => (ws[XLSX.utils.encode_cell({ r, c: i + 1 })] = { t: "n", v }))
  }
  fill("Werkmaatschappij", "Resultaat na belasting", [80000, 90000, 100000])
  fill("Werkmaatschappij", "Incidentele posten (vóór belasting, + = bate)", [0, 0, 20000])
  fill("Werkmaatschappij", "Eigen vermogen", [300000, 380000, 480000])
  fill("Werkmaatschappij", "Balanstotaal", [500000, 600000, 700000])
  fill("Werkmaatschappij", "Liquide middelen", [100000, 150000, 200000])
  fill("Werkmaatschappij", "Vlottende activa (incl. liquide middelen)", [200000, 250000, 300000])
  fill("Werkmaatschappij", "Kortlopende schulden", [80000, 90000, 100000])
  fill("Holding", "Resultaat na belasting", [2000, 2000, 2000])
  fill("DGA", "Aandelenbelang DGA (%)", [100])
  const dga = wb.Sheets.DGA!
  ;[60000, 62000, 64000].forEach((v, i) => (dga[`B${5 + i}`] = { t: "n", v }))
  const file = path.join("test-results", "e2e-jaarcijfers.xlsx")
  mkdirSync("test-results", { recursive: true })
  writeFileSync(file, Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer))

  await login(page, "dgaexcel")
  const dossier = await newDossier(page, /Mijn eerste woning kopen/)
  await personal(page, ["1980-01-01"])
  await next(page, "inkomen")
  await page.getByRole("button", { name: "Inkomen verwijderen" }).click()
  await page.getByLabel("Ik ben (ook) ondernemer (eenmanszaak, vof, BV of holding)").check()
  await next(page, "ondernemer")
  await page.getByLabel("Rechtsvorm").selectOption("bv")
  await page.getByLabel("Startdatum onderneming").fill("2015-01-01")
  await next(page, "verplichtingen")

  await page.goto(`${dossier}/ondernemer`)
  await expect(page.getByRole("heading", { name: "1. Bestanden" })).toBeVisible()
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page.getByText("sjabloon", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Naam").first()).toHaveValue("Werk BV")
  await expect(page.getByRole("table", { name: "Toetsinkomen per bank" })).toBeVisible()
  await expect(page.getByText("Genormaliseerd resultaat na belasting")).toBeVisible()
  await page.getByRole("button", { name: "Overnemen in intake" }).click()
  await expect(page.getByText("overgenomen", { exact: true })).toBeVisible()

  await page.goto(`${dossier}/intake/ondernemer`)
  await expect(page.getByLabel("Rechtsvorm")).toHaveValue("bv_holding")
  await expect(page.getByLabel("Naam onderneming")).toHaveValue("Werk BV")
})
