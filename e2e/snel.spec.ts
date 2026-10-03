import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fillMoney, login, newQuickDossier } from "./helpers"

test("snel: starter in één scherm berekenen", async ({ page }) => {
  await login(page, "snelstarter")
  const dossier = await newQuickDossier(page)
  await page.getByLabel("Mijn eerste woning kopen").check()
  await page.getByLabel("Geboortedatum").fill("1995-03-01")
  await fillMoney(page, "Bruto maandsalaris", "4500")
  await fillMoney(page, "Spaargeld", "40000")
  await fillMoney(page, "Koopsom", "325000")
  await page.getByRole("button", { name: "Bereken mijn advies" }).click()
  await page.waitForURL("**/advies")
  await expect(page.getByRole("heading", { name: "Samenvatting" })).toBeVisible()

  // Terug naar Start: alles staat er nog
  await page.goto(`${dossier}/start`)
  await expect(page.getByLabel("Bruto maandsalaris")).toHaveValue("4.500")
  await expect(page.getByLabel("Koopsom")).toHaveValue("325.000")
})

test("snel: DGA uploadt jaarcijfers (Excel) en rekent direct", async ({ page }) => {
  const XLSX = await import("xlsx")
  const res = await page.request.get("/api/templates/jaarcijfers")
  const wb = XLSX.read(await res.body(), { type: "buffer" })
  const fill = (sheet: string, label: string, values: number[]) => {
    const ws = wb.Sheets[sheet]!
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const r = rows.findIndex((row) => row[0] === label)
    values.forEach((v, i) => (ws[XLSX.utils.encode_cell({ r, c: i + 1 })] = { t: "n", v }))
  }
  fill("Werkmaatschappij", "Resultaat na belasting", [80000, 90000, 100000])
  fill("Werkmaatschappij", "Eigen vermogen", [300000, 380000, 480000])
  fill("Werkmaatschappij", "Balanstotaal", [500000, 600000, 700000])
  fill("Werkmaatschappij", "Liquide middelen", [100000, 150000, 200000])
  fill("Werkmaatschappij", "Vlottende activa (incl. liquide middelen)", [200000, 250000, 300000])
  fill("Werkmaatschappij", "Kortlopende schulden", [80000, 90000, 100000])
  fill("Holding", "Resultaat na belasting", [2000, 2000, 2000])
  fill("DGA", "Aandelenbelang DGA (%)", [100])
  const dga = wb.Sheets.DGA!
  ;[60000, 62000, 64000].forEach((v, i) => (dga[`B${5 + i}`] = { t: "n", v }))
  const file = path.join("test-results", "e2e-snel-jaarcijfers.xlsx")
  mkdirSync("test-results", { recursive: true })
  writeFileSync(file, Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer))

  await login(page, "sneldga")
  await newQuickDossier(page)
  await page.getByLabel("Oriënteren: wat kan ik maximaal lenen?").check()
  await page.getByLabel("Geboortedatum").fill("1980-01-01")
  await page.getByLabel("Jaarcijfers uploaden (aanvrager 1)").setInputFiles(file)
  await expect(page.getByText("Onderneming: BV met holding")).toBeVisible()
  await expect(page.getByText("Werk BV", { exact: true })).toBeVisible()
  await fillMoney(page, "Spaargeld", "50000")
  await page.getByRole("button", { name: "Bereken mijn advies" }).click()
  await page.waitForURL("**/advies")
  await expect(page.getByText("Duurzaam uitkeerbare winst")).toBeVisible()
})
