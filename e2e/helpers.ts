import { expect, type Page } from "@playwright/test"

export async function login(page: Page, user: string, admin = false) {
  await page.goto("/sign-in")
  await page.getByLabel("Test-gebruiker").fill(user)
  if (admin) await page.getByLabel("Beheerder").check()
  await page.getByRole("button", { name: "Inloggen" }).click()
  await page.waitForURL("**/app")
}

export async function newDossier(page: Page, goalLabel: RegExp) {
  await page.goto("/app")
  await page.getByRole("button", { name: goalLabel }).click()
  await page.waitForURL("**/intake/persoonlijk")
  return page.url().replace(/\/intake\/.*/, "")
}

export async function next(page: Page, expectedStep: string) {
  await page.getByRole("button", { name: "Opslaan en verder" }).click()
  await page.waitForURL(`**/intake/${expectedStep}`)
}

export async function fillMoney(page: Page, label: string | RegExp, value: string, nth = 0) {
  const input = page.getByLabel(label, { exact: typeof label === "string" }).nth(nth)
  await input.fill(value)
  await input.blur()
}

export async function personal(page: Page, dobs: string[]) {
  if (dobs.length > 1) await page.getByLabel("Ik koop samen met een partner (medeaanvrager)").check()
  for (const [i, dob] of dobs.entries()) await page.getByLabel("Geboortedatum").nth(i).fill(dob)
}

export async function calculate(page: Page) {
  await expect(page.getByText("Alle stappen zijn ingevuld")).toBeVisible()
  await page.getByRole("button", { name: "Bereken mijn advies" }).click()
  await page.waitForURL("**/advies")
  await expect(page.getByRole("heading", { name: "Samenvatting" })).toBeVisible()
}
