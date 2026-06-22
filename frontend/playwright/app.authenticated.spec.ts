import { expect, test } from "@playwright/test"

test("creates a game as an authenticated user", async ({ page }) => {
  const gameName = `Playwright game ${Date.now()}`

  await page.goto("/games/create")

  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible()
  await page.getByRole("textbox", { name: "Game name" }).fill(gameName)
  await page.getByRole("spinbutton", { name: "Max number of players" }).fill("2")
  await page.getByRole("button", { name: "Create", exact: true }).click()

  await expect(page).toHaveURL(/\/games\/\d+$/)
  await expect(page.getByRole("heading", { name: gameName })).toBeVisible()
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible()
})
