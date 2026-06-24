import { expect, test } from "../fixtures.ts"
import { HomePage } from "../pages/HomePage.ts"

test("shows the public landing page", async ({ page }) => {
  const homePage = await HomePage.goto(page)

  await test.step("Verify the landing page content", async () => {
    await expect(homePage.heading).toBeVisible()
    await expect(homePage.playForFreeLink).toBeVisible()
    await expect(homePage.createAccountLink).toBeVisible()
  })
})
