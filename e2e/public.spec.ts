import { expect, test } from "@playwright/test"

test("openbare pagina's en toegangscontrole", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Weet wat je kunt")
  await expect(page.getByTestId("disclaimer")).toBeVisible()
  for (const [path, heading] of [
    ["/privacy", "Privacyverklaring"],
    ["/cookies", "Cookies"],
    ["/disclaimer", "Disclaimer"],
  ]) {
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible()
  }
  await page.goto("/app")
  await expect(page).toHaveURL(/sign-in/)
})

test("voorbeelden rekenen in de browser", async ({ page }) => {
  await page.goto("/demo")
  await expect(page.getByTestId("wi-max")).toContainText("€")
  await page.getByRole("radio", { name: /DGA met een BV/ }).click()
  await expect(page.getByTestId("wi-max")).toContainText("€")
})

test("cron-endpoints vereisen het geheim", async ({ request }) => {
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401)
  const ok = await request.get("/api/cron/cleanup", { headers: { Authorization: "Bearer e2e-cron-secret-0123456789" } })
  expect(ok.status()).toBe(200)
})
