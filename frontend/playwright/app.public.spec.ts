import { expect, test } from "@playwright/test"

test("shows the public landing page", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Build your empire and dominate the galaxy" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Play for free" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible()
})

test("redirects signed-out users from game creation to sign in", async ({ page }) => {
  await page.goto("/games/create")

  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fgames%2Fcreate$/)
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible()
})
