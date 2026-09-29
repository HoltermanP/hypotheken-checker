import { expect, test } from "@playwright/test"
import { login, newDossier } from "./helpers"

test("beheer alleen voor beheerders", async ({ page, context }) => {
  await login(page, "gewoon")
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible()
  await context.clearCookies()
  await login(page, "beheer", true)
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Beheer" })).toBeVisible()
  await page.goto("/admin/geldverstrekkers")
  await expect(page.getByRole("link", { name: "ABN AMRO" })).toBeVisible()
})

test("AVG: gegevens exporteren en account verwijderen", async ({ page }) => {
  await login(page, "avg")
  await newDossier(page, /Oriënteren/)
  const res = await page.request.get("/api/account/export")
  expect(res.status()).toBe(200)
  const data = await res.json()
  expect(data.dossiers).toHaveLength(1)
  await page.goto("/app/account")
  await page.getByLabel("Typ VERWIJDEREN om te bevestigen").fill("VERWIJDEREN")
  await page.getByRole("button", { name: "Alles definitief verwijderen" }).click()
  await page.waitForURL("**/?account=verwijderd")
})
