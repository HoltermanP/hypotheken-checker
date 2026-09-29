import { expect, test } from "@playwright/test"
import path from "node:path"
import { writeFileSync, mkdirSync } from "node:fs"
import { calculate, fillMoney, login, newDossier, next, personal } from "./helpers"

const PDF = path.join("test-results", "e2e-werkgeversverklaring.pdf")

test.beforeAll(() => {
  mkdirSync("test-results", { recursive: true })
  writeFileSync(
    PDF,
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
  )
})

test("starter: intake, document, advies, PDF en wat-als", async ({ page }) => {
  await login(page, "starter")
  const dossier = await newDossier(page, /Mijn eerste woning kopen/)

  await personal(page, ["1996-05-01"])
  await next(page, "inkomen")
  await fillMoney(page, "Bruto jaarsalaris (zonder vakantiegeld)", "55000")
  await fillMoney(page, "Vakantiegeld per jaar", "4400")
  await next(page, "verplichtingen")
  await page.getByRole("button", { name: "Verplichting toevoegen" }).click()
  await page.getByLabel("Soort").selectOption("student_loan")
  await fillMoney(page, "Maandtermijn", "120")
  await fillMoney(page, "Openstaande schuld", "25000")
  await next(page, "vermogen")
  await fillMoney(page, "Spaargeld", "45000")
  await next(page, "nieuwe-woning")
  await fillMoney(page, "Koopsom", "300000")
  await next(page, "voorkeuren")
  await next(page, "risicos")
  await next(page, "overzicht")

  // Hervatten: de gegevens blijven bewaard
  await page.goto(`${dossier}/intake/inkomen`)
  await expect(page.getByLabel("Bruto jaarsalaris (zonder vakantiegeld)")).toHaveValue("55.000")

  // Document uploaden, (handmatig) bevestigen en overnemen
  await page.goto(`${dossier}/documenten`)
  await page.locator("input[type=file]").first().setInputFiles(PDF)
  await expect(page.getByText("Controleer de waarden")).toBeVisible()
  await fillMoney(page, "Bruto jaarsalaris (excl. vakantiegeld)", "56000")
  await page.getByRole("button", { name: "Bevestigen en overnemen in intake" }).click()
  await expect(page.getByText(/Consistentiecontrole/)).toBeVisible()
  await expect(page.getByText(/intake ↔ werkgeversverklaring/)).toBeVisible()

  await page.goto(`${dossier}/intake/overzicht`)
  await calculate(page)
  await expect(page.getByTestId("disclaimer").first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Bankadvies" })).toBeVisible()
  expect(await page.getByTestId("lender-row").count()).toBeGreaterThanOrEqual(15)
  await expect(page.getByTestId("top-lender").first()).toBeVisible()
  expect(await page.getByTestId("stress-result").count()).toBeGreaterThan(3)
  expect(await page.getByTestId("assumption-row").count()).toBeGreaterThan(20)
  await expect(page.getByText("te verifiëren").first()).toBeVisible()
  await expect(page.getByText("Standaardtoelichting op basis van de berekening.").first()).toBeVisible()

  const pdf = await page.request.get(`${dossier.replace(/^.*\/app\/dossiers\//, "/api/dossiers/")}/pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()["content-type"]).toContain("application/pdf")
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF")

  await page.goto(`${dossier}/wat-als`)
  const before = await page.getByTestId("wi-gross").innerText()
  await page.getByLabel("Hypotheekrente").focus()
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight")
  await expect(page.getByTestId("wi-gross")).not.toHaveText(before)

  await page.goto(`${dossier}/chat`)
  await page.getByLabel("Je vraag").fill("Hoeveel kan ik lenen?")
  await page.getByRole("button", { name: "Versturen" }).click()
  await expect(page.getByText(/niet beschikbaar|rapport/).last()).toBeVisible()
})
